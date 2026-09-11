import asyncio
import json
import shutil
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.processors.base import ProcessingError, ProcessorContext
from app.processors.media import (
    NOISE_REDUCTION_PRESETS,
    escape_subtitles_path,
    ffmpeg_args,
    noise_reduction_filter,
    stream_types,
)
from app.processors.registry import get_processor
from app.utils.media import duration_seconds, probe, validate_media_output
from app.utils.subprocess import run_command
from tests.helpers import upload_bytes

needs_ffmpeg = shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None


async def _wait_for_job(api: AsyncClient, job_id: str) -> dict[str, object]:
    for _ in range(400):
        job = (await api.get(f"/api/v1/jobs/{job_id}")).json()["data"]
        if job["status"] in {"completed", "failed", "cancelled"}:
            return job
        await asyncio.sleep(0.05)
    raise AssertionError("job did not finish")


async def _make_clip(path: Path, *, duration: str = "0.4") -> bytes:
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c=red:s=64x48:d={duration}",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=440:duration={duration}",
            "-shortest",
            "-pix_fmt",
            "yuv420p",
            str(path),
        ]
    )
    return path.read_bytes()


async def _make_audio(path: Path) -> bytes:
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=0.4",
            str(path),
        ]
    )
    return path.read_bytes()


async def _make_noisy_audio(path: Path, *, duration: str = "0.4") -> bytes:
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=440:duration={duration}",
            "-f",
            "lavfi",
            "-i",
            f"anoisesrc=color=white:amplitude=0.08:duration={duration}",
            "-filter_complex",
            "[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=0,aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=mono",
            "-ar",
            "44100",
            "-ac",
            "1",
            str(path),
        ]
    )
    return path.read_bytes()


def test_noise_reduction_presets_map_to_afftdn() -> None:
    assert noise_reduction_filter({}) == "afftdn=nr=12:nf=-50:nt=w"
    assert noise_reduction_filter({"strength": "light"}) == "afftdn=nr=8:nf=-50:nt=w"
    assert noise_reduction_filter({"strength": "MEDIUM"}) == "afftdn=nr=12:nf=-50:nt=w"
    assert noise_reduction_filter({"strength": "strong"}) == "afftdn=nr=24:nf=-40:nt=w"
    assert NOISE_REDUCTION_PRESETS["medium"] == (12, -50)
    args = ffmpeg_args(
        "noise-reduction", [Path("tone.wav")], {"strength": "light"}, Path("out.mp3")
    )
    assert args[args.index("-af") + 1] == "afftdn=nr=8:nf=-50:nt=w"
    assert "arnndn" not in " ".join(args)
    try:
        noise_reduction_filter({"strength": "extreme"})
        raise AssertionError("expected invalid strength")
    except ProcessingError as exc:
        assert "light, medium, or strong" in str(exc)


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_noise_reduction_produces_ffprobe_valid_audio(tmp_path: Path) -> None:
    source = tmp_path / "noisy.wav"
    await _make_noisy_audio(source)
    source_info = await probe(source)
    source_duration = duration_seconds(source_info)
    assert source_duration is not None
    output = tmp_path / "cleaned.mp3"
    context = ProcessorContext(
        job_id="job_denoise",
        tool_id="noise-reduction",
        options={"strength": "medium"},
        work_dir=tmp_path,
    )
    await get_processor("noise-reduction").process([source], output, context=context)
    assert output.is_file()
    info = await probe(output)
    validate_media_output(info)
    kinds = [
        stream.get("codec_type") for stream in info.get("streams", []) if isinstance(stream, dict)
    ]
    assert "audio" in kinds
    result_duration = duration_seconds(info)
    assert result_duration is not None
    assert abs(result_duration - source_duration) < 0.15
    audio = next(stream for stream in info["streams"] if stream.get("codec_type") == "audio")
    assert int(audio.get("sample_rate", 0)) in {44100, 48000}
    assert int(audio.get("channels", 0)) >= 1


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_noise_reduction_job(api: AsyncClient, tmp_path: Path) -> None:
    source = tmp_path / "noisy.wav"
    data = await _make_noisy_audio(source)
    source_duration = duration_seconds(await probe(source))
    assert source_duration is not None
    file_key = await upload_bytes(
        api, data, filename="noisy.wav", content_type="audio/wav", tool_id="noise-reduction"
    )
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "noise-reduction",
            "input": {"fileKey": file_key},
            "options": {"strength": "medium"},
        },
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed", job
    result = await api.get(f"/api/v1/jobs/{job['jobId']}/result")
    downloaded = await api.get(result.json()["data"]["result"]["downloadUrl"])
    assert downloaded.status_code == 200
    output = tmp_path / "cleaned.mp3"
    output.write_bytes(downloaded.content)
    info = await probe(output)
    validate_media_output(info)
    kinds = [
        stream.get("codec_type") for stream in info.get("streams", []) if isinstance(stream, dict)
    ]
    assert "audio" in kinds
    result_duration = duration_seconds(info)
    assert result_duration is not None
    assert abs(result_duration - source_duration) < 0.15


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_change_volume_produces_ffprobe_valid_audio(tmp_path: Path) -> None:
    source = tmp_path / "tone.wav"
    await _make_audio(source)
    output = tmp_path / "louder.mp3"
    context = ProcessorContext(
        job_id="job_volume",
        tool_id="change-volume",
        options={"volume": 1.5},
        work_dir=tmp_path,
    )
    await get_processor("change-volume").process([source], output, context=context)
    assert output.is_file()
    validate_media_output(await probe(output))


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_extract_audio_job(api: AsyncClient, tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    data = await _make_clip(clip)
    file_key = await upload_bytes(
        api, data, filename="clip.mp4", content_type="video/mp4", tool_id="extract-audio"
    )
    created = await api.post(
        "/api/v1/jobs",
        json={"toolId": "extract-audio", "input": {"fileKey": file_key}, "options": {}},
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed", job
    result = await api.get(f"/api/v1/jobs/{job['jobId']}/result")
    downloaded = await api.get(result.json()["data"]["result"]["downloadUrl"])
    assert downloaded.status_code == 200
    output = tmp_path / "extracted.mp3"
    output.write_bytes(downloaded.content)
    validate_media_output(await probe(output))


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_video_compressor_job(api: AsyncClient, tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    data = await _make_clip(clip)
    file_key = await upload_bytes(
        api, data, filename="clip.mp4", content_type="video/mp4", tool_id="video-compressor"
    )
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "video-compressor",
            "input": {"fileKey": file_key},
            "options": {"crf": 32},
        },
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed", job
    result = await api.get(f"/api/v1/jobs/{job['jobId']}/result")
    downloaded = await api.get(result.json()["data"]["result"]["downloadUrl"])
    assert downloaded.status_code == 200
    output = tmp_path / "compressed.mp4"
    output.write_bytes(downloaded.content)
    validate_media_output(await probe(output))


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_video_metadata_is_json(tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    await _make_clip(clip)
    output = tmp_path / "meta.json"
    context = ProcessorContext(
        job_id="job_meta", tool_id="video-metadata-viewer", options={}, work_dir=tmp_path
    )
    await get_processor("video-metadata-viewer").process([clip], output, context=context)
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["streams"]


SRT_FIXTURE = "1\n00:00:00,000 --> 00:00:00,400\nHello\n"


def test_escape_subtitles_path_escapes_filter_metacharacters(tmp_path: Path) -> None:
    path = tmp_path / "cap:tion'[].srt"
    escaped = escape_subtitles_path(path)
    assert "\\:" in escaped
    assert "\\'" in escaped
    assert "\\[" in escaped
    assert "\\]" in escaped


def test_add_subtitle_ffmpeg_args_burn_and_mux(tmp_path: Path) -> None:
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"not-a-real-video")
    subtitle = tmp_path / "cap:tion.srt"
    subtitle.write_text(SRT_FIXTURE, encoding="utf-8")
    burned = ffmpeg_args(
        "add-subtitle",
        [video, subtitle],
        {"mode": "burn", "fontSize": 28, "fontColor": "yellow"},
        tmp_path / "out.mp4",
    )
    assert burned[0] == "ffmpeg"
    vf = burned[burned.index("-vf") + 1]
    assert vf.startswith("subtitles='")
    assert "\\:" in vf
    assert "force_style=" in vf
    assert "FontSize=28" in vf
    assert "-c:a" in burned
    assert burned[burned.index("-c:a") + 1] == "copy"
    muxed = ffmpeg_args(
        "add-subtitle",
        [subtitle, video],
        {"mode": "mux"},
        tmp_path / "out.mp4",
    )
    assert muxed[muxed.index("-c:s") + 1] == "mov_text"
    assert "-c:v" in muxed and muxed[muxed.index("-c:v") + 1] == "copy"
    assert "-c:a" in muxed and muxed[muxed.index("-c:a") + 1] == "copy"


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_add_subtitle_burns_srt_and_keeps_audio(tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    await _make_clip(clip)
    subtitle = tmp_path / "captions.srt"
    subtitle.write_text(SRT_FIXTURE, encoding="utf-8")
    output = tmp_path / "burned.mp4"
    context = ProcessorContext(
        job_id="job_burn",
        tool_id="add-subtitle",
        options={"mode": "burn"},
        work_dir=tmp_path,
    )
    await get_processor("add-subtitle").process([clip, subtitle], output, context=context)
    info = await probe(output)
    validate_media_output(info)
    kinds = stream_types(info)
    assert "video" in kinds
    assert "audio" in kinds
    assert "subtitle" not in kinds


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_add_subtitle_muxes_srt_track(tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    await _make_clip(clip)
    subtitle = tmp_path / "captions.srt"
    subtitle.write_text(SRT_FIXTURE, encoding="utf-8")
    output = tmp_path / "muxed.mp4"
    context = ProcessorContext(
        job_id="job_mux",
        tool_id="add-subtitle",
        options={"mode": "mux"},
        work_dir=tmp_path,
    )
    await get_processor("add-subtitle").process([subtitle, clip], output, context=context)
    info = await probe(output)
    validate_media_output(info)
    kinds = stream_types(info)
    assert "video" in kinds
    assert "audio" in kinds
    assert "subtitle" in kinds


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_add_subtitle_job(api: AsyncClient, tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    video = await _make_clip(clip)
    video_key = await upload_bytes(
        api, video, filename="clip.mp4", content_type="video/mp4", tool_id="add-subtitle"
    )
    subtitle_key = await upload_bytes(
        api,
        SRT_FIXTURE.encode("utf-8"),
        filename="captions.srt",
        content_type="text/plain",
        tool_id="add-subtitle",
    )
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "add-subtitle",
            "input": {"files": [video_key, subtitle_key]},
            "options": {"mode": "burn", "format": "mp4"},
        },
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed", job
    result = await api.get(f"/api/v1/jobs/{job['jobId']}/result")
    downloaded = await api.get(result.json()["data"]["result"]["downloadUrl"])
    assert downloaded.status_code == 200
    output = tmp_path / "subtitled.mp4"
    output.write_bytes(downloaded.content)
    info = await probe(output)
    validate_media_output(info)
    kinds = stream_types(info)
    assert "video" in kinds
    assert "audio" in kinds
