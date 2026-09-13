import asyncio
import json
import shutil
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.processors.base import ProcessingError, ProcessorContext
from app.processors.media import (
    MISSING_RNNOISE_MODEL,
    NOISE_REDUCTION_PRESETS,
    audio_converter_args,
    burn_force_style,
    escape_subtitles_path,
    ffmpeg_args,
    first_audio_stream,
    noise_reduction_filter,
    resolve_audio_convert_format,
    rnnoise_model_file,
    stream_types,
)
from app.processors.registry import get_processor
from app.utils.media import duration_seconds, probe, validate_media_output
from app.utils.subprocess import FFMPEG_FAILED_MESSAGE, run_command
from tests.helpers import pro_headers, upload_bytes

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


async def _make_noisy_audio(path: Path, *, duration: str = "1.2") -> bytes:
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
            f"anoisesrc=color=white:amplitude=0.18:duration={duration}",
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


async def _pcm_s16le(path: Path, dest: Path) -> bytes:
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(path),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "s16le",
            str(dest),
        ]
    )
    return dest.read_bytes()


def _rms(pcm: bytes) -> float:
    import array

    samples = array.array("h")
    samples.frombytes(pcm[: len(pcm) - len(pcm) % 2])
    if not samples:
        return 0.0
    return (sum(sample * sample for sample in samples) / len(samples)) ** 0.5


def test_noise_reduction_presets_map_to_afftdn() -> None:
    assert noise_reduction_filter({}) == "afftdn=nr=28:nf=-60:tn=1:tr=1:om=o:rf=-42"
    assert noise_reduction_filter({"strength": "light"}) == "afftdn=nr=18:nf=-55:tn=1:tr=1:om=o"
    assert noise_reduction_filter({"mode": "STANDARD", "strength": "MEDIUM"}) == (
        "afftdn=nr=28:nf=-60:tn=1:tr=1:om=o:rf=-42"
    )
    assert noise_reduction_filter({"strength": "strong"}) == (
        "afftdn=nr=42:nf=-65:tn=1:tr=1:om=o:rf=-35"
    )
    assert NOISE_REDUCTION_PRESETS["medium"] == (28, -60, -42)
    args = ffmpeg_args(
        "noise-reduction",
        [Path("tone.wav")],
        {"mode": "standard", "strength": "light"},
        Path("out.mp3"),
    )
    graph = args[args.index("-af") + 1]
    assert graph == "afftdn=nr=18:nf=-55:tn=1:tr=1:om=o"
    assert "tn=1" in graph
    assert "arnndn" not in " ".join(args)
    assert "-c" not in args and "copy" not in args
    try:
        noise_reduction_filter({"strength": "extreme"})
        raise AssertionError("expected invalid strength")
    except ProcessingError as exc:
        assert "light, medium, or strong" in str(exc)
    try:
        noise_reduction_filter({"mode": "magic"})
        raise AssertionError("expected invalid mode")
    except ProcessingError as exc:
        assert "standard or smart" in str(exc)


def test_noise_reduction_smart_uses_arnndn() -> None:
    model = rnnoise_model_file()
    assert model.is_file(), model
    graph = noise_reduction_filter({"mode": "smart", "strength": "medium"})
    assert "arnndn" in graph
    assert "afftdn" not in graph
    assert "aformat=sample_rates=48000" in graph
    assert "mix=0.85" in graph
    assert model.name in graph
    args = ffmpeg_args(
        "noise-reduction",
        [Path("tone.wav")],
        {"mode": "smart", "strength": "strong"},
        Path("out.mp3"),
    )
    joined = " ".join(args)
    assert args[args.index("-af") + 1].startswith("aformat=sample_rates=48000,arnndn=")
    assert "mix=1.0" in args[args.index("-af") + 1]
    assert "-c" not in args and "copy" not in joined


def test_noise_reduction_smart_missing_model(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    missing = tmp_path / "missing.rnnn"
    monkeypatch.setattr("app.processors.media.rnnoise_model_file", lambda: missing)
    with pytest.raises(ProcessingError) as caught:
        noise_reduction_filter({"mode": "smart", "strength": "medium"})
    assert str(caught.value) == MISSING_RNNOISE_MODEL


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_ffmpeg_nonzero_exit_is_ffmpeg_failed(tmp_path: Path) -> None:
    missing = tmp_path / "missing.wav"
    with pytest.raises(ProcessingError) as caught:
        await run_command(
            ["ffmpeg", "-y", "-i", str(missing), str(tmp_path / "out.mp3")],
            timeout=15,
        )
    assert caught.value.code == "FFMPEG_FAILED"
    assert str(caught.value) == FFMPEG_FAILED_MESSAGE


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
        options={"mode": "standard", "strength": "medium"},
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
@pytest.mark.parametrize("mode", ["standard", "smart"])
async def test_noise_reduction_pcm_differs_and_lowers_noise(tmp_path: Path, mode: str) -> None:
    if mode == "smart":
        assert rnnoise_model_file().is_file()
    source = tmp_path / "noisy.wav"
    await _make_noisy_audio(source, duration="1.2")
    output = tmp_path / f"cleaned-{mode}.wav"
    context = ProcessorContext(
        job_id=f"job_denoise_{mode}",
        tool_id="noise-reduction",
        options={"mode": mode, "strength": "medium"},
        work_dir=tmp_path,
    )
    await get_processor("noise-reduction").process([source], output, context=context)
    source_pcm = await _pcm_s16le(source, tmp_path / f"source-{mode}.pcm")
    result_pcm = await _pcm_s16le(output, tmp_path / f"result-{mode}.pcm")
    assert result_pcm != source_pcm
    source_rms = _rms(source_pcm)
    result_rms = _rms(result_pcm)
    assert source_rms > 0
    assert result_rms > source_rms * 0.12
    assert result_rms < source_rms * 0.92


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_noise_reduction_job(admin_api: AsyncClient, tmp_path: Path) -> None:
    api = admin_api
    headers = await pro_headers(api, "install-noise")
    source = tmp_path / "noisy.wav"
    data = await _make_noisy_audio(source)
    source_duration = duration_seconds(await probe(source))
    assert source_duration is not None
    file_key = await upload_bytes(
        api,
        data,
        filename="noisy.wav",
        content_type="audio/wav",
        tool_id="noise-reduction",
        headers=headers,
    )
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "noise-reduction",
            "input": {"fileKey": file_key},
            "options": {"mode": "standard", "strength": "medium"},
        },
        headers=headers,
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed", job
    result = await api.get(f"/api/v1/jobs/{job['jobId']}/result")
    downloaded = await api.get(result.json()["data"]["result"]["downloadUrl"])
    assert downloaded.status_code == 200
    assert downloaded.content != data
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
VTT_FIXTURE = "WEBVTT\n\n00:00:00.000 --> 00:00:00.400\nHello\n"
ID_SRT_FIXTURE = (
    "1\n00:00:00,000 --> 00:00:00,400\n"
    "Selamat pagi, ini baris subtitle bahasa Indonesia yang sangat panjang sekali "
    "dan harus tetap terbakar ke dalam video tanpa merusak berkas.\n"
)


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
    assert "PrimaryColour=" in vf
    assert "Alignment=2" in vf
    assert "MarginV=24" in vf
    assert "-c:a" in burned
    assert burned[burned.index("-c:a") + 1] == "copy"


def test_burn_force_style_maps_user_options(tmp_path: Path) -> None:
    subtitle = tmp_path / "captions.srt"
    subtitle.write_text(SRT_FIXTURE, encoding="utf-8")
    style = burn_force_style(
        {
            "fontSize": 32,
            "fontColor": "#ffff00",
            "outline": "background",
            "position": "top",
            "marginV": 48,
        },
        subtitle,
    )
    assert style is not None
    assert "FontSize=32" in style
    assert "Alignment=8" in style
    assert "MarginV=48" in style
    assert "BorderStyle=3" in style
    ass = tmp_path / "styled.ass"
    ass.write_text("[Script Info]\nDialogue: 0\n", encoding="utf-8")
    assert burn_force_style({"fontSize": 32}, ass) is None
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"not-a-real-video")
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
async def test_add_subtitle_burns_vtt_and_keeps_audio(tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    await _make_clip(clip)
    subtitle = tmp_path / "captions.vtt"
    subtitle.write_text(VTT_FIXTURE, encoding="utf-8")
    output = tmp_path / "burned.mp4"
    context = ProcessorContext(
        job_id="job_burn_vtt",
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
async def test_add_subtitle_burns_indonesian_long_lines(tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    await _make_clip(clip)
    subtitle = tmp_path / "captions.srt"
    subtitle.write_text(ID_SRT_FIXTURE, encoding="utf-8")
    output = tmp_path / "burned.mp4"
    context = ProcessorContext(
        job_id="job_burn_id",
        tool_id="add-subtitle",
        options={"mode": "burn", "fontSize": 20, "position": "bottom", "marginV": 16},
        work_dir=tmp_path,
    )
    await get_processor("add-subtitle").process([clip, subtitle], output, context=context)
    info = await probe(output)
    validate_media_output(info)
    assert "video" in stream_types(info)


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_add_subtitle_rejects_invalid_and_unsupported_files(tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    await _make_clip(clip)
    empty = tmp_path / "empty.srt"
    empty.write_text("", encoding="utf-8")
    malformed = tmp_path / "bad.srt"
    malformed.write_text("this is not a cue\n", encoding="utf-8")
    unsupported = tmp_path / "notes.txt"
    unsupported.write_text("just a note without timestamps", encoding="utf-8")
    processor = get_processor("add-subtitle")

    async def fail(subtitle: Path, code: str) -> None:
        with pytest.raises(ProcessingError) as caught:
            await processor.process(
                [clip, subtitle],
                tmp_path / f"{subtitle.stem}.mp4",
                context=ProcessorContext(
                    job_id=f"job_{subtitle.stem}",
                    tool_id="add-subtitle",
                    options={"mode": "burn"},
                    work_dir=tmp_path,
                ),
            )
        assert caught.value.code == code

    await fail(empty, "INVALID_SUBTITLE_FILE")
    await fail(malformed, "INVALID_SUBTITLE_FILE")
    await fail(unsupported, "UNSUPPORTED_SUBTITLE_FORMAT")


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_add_subtitle_rejects_audio_without_video(tmp_path: Path) -> None:
    audio = tmp_path / "tone.wav"
    await _make_audio(audio)
    subtitle = tmp_path / "captions.srt"
    subtitle.write_text(SRT_FIXTURE, encoding="utf-8")
    with pytest.raises(ProcessingError) as caught:
        await get_processor("add-subtitle").process(
            [audio, subtitle],
            tmp_path / "out.mp4",
            context=ProcessorContext(
                job_id="job_no_video",
                tool_id="add-subtitle",
                options={"mode": "burn"},
                work_dir=tmp_path,
            ),
        )
    assert caught.value.code == "NO_VIDEO_STREAM"


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
async def test_add_subtitle_job(admin_api: AsyncClient, tmp_path: Path) -> None:
    api = admin_api
    headers = await pro_headers(api, "install-subtitle")
    clip = tmp_path / "clip.mp4"
    video = await _make_clip(clip)
    video_key = await upload_bytes(
        api,
        video,
        filename="clip.mp4",
        content_type="video/mp4",
        tool_id="add-subtitle",
        headers=headers,
    )
    subtitle_key = await upload_bytes(
        api,
        SRT_FIXTURE.encode("utf-8"),
        filename="captions.srt",
        content_type="text/plain",
        tool_id="add-subtitle",
        headers=headers,
    )
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "add-subtitle",
            "input": {"files": [video_key, subtitle_key]},
            "options": {"mode": "burn", "format": "mp4"},
        },
        headers=headers,
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


def test_audio_converter_args_lossy_and_lossless(tmp_path: Path) -> None:
    source = tmp_path / "tone.wav"
    source.write_bytes(b"RIFF")
    mp3 = audio_converter_args([source], {"format": "mp3", "bitrate": "192k"}, tmp_path / "out.mp3")
    assert mp3[:8] == ["ffmpeg", "-y", "-i", str(source), "-vn", "-map", "0:a:0", "-c:a"]
    assert "libmp3lame" in mp3
    assert "-b:a" in mp3 and mp3[mp3.index("-b:a") + 1] == "192k"
    wav = audio_converter_args([source], {"format": "wav", "bitrate": "320k"}, tmp_path / "out.wav")
    assert "pcm_s16le" in wav
    assert "-b:a" not in wav
    with pytest.raises(ProcessingError, match="MP3, WAV, M4A"):
        resolve_audio_convert_format({"format": "wma"})


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_audio_converter_preserves_duration_across_formats(tmp_path: Path) -> None:
    source = tmp_path / "tone.wav"
    await _make_audio(source)
    source_duration = duration_seconds(await probe(source))
    assert source_duration is not None
    for fmt, codec in (
        ("mp3", "mp3"),
        ("flac", "flac"),
        ("m4a", "aac"),
        ("ogg", "vorbis"),
        ("opus", "opus"),
        ("wav", "pcm_s16le"),
    ):
        output = tmp_path / f"out.{fmt if fmt != 'm4a' else 'm4a'}"
        context = ProcessorContext(
            job_id=f"job_ac_{fmt}",
            tool_id="audio-converter",
            options={"format": fmt, "bitrate": "128k"},
            work_dir=tmp_path,
        )
        result = await get_processor("audio-converter").process([source], output, context=context)
        assert output.is_file() and output.stat().st_size > 0
        info = await probe(output)
        audio = first_audio_stream(info)
        assert audio is not None
        assert audio.get("codec_name") == codec
        duration = duration_seconds(info)
        assert duration is not None
        assert abs(duration - source_duration) < 0.15
        assert result.extension == ("m4a" if fmt == "m4a" else fmt)


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_audio_converter_extracts_from_video(tmp_path: Path) -> None:
    clip = tmp_path / "clip.mp4"
    await _make_clip(clip)
    source_duration = duration_seconds(await probe(clip))
    output = tmp_path / "out.mp3"
    context = ProcessorContext(
        job_id="job_ac_video",
        tool_id="audio-converter",
        options={"format": "mp3", "bitrate": "192k", "sampleRate": 44100, "channels": 1},
        work_dir=tmp_path,
    )
    await get_processor("audio-converter").process([clip], output, context=context)
    info = await probe(output)
    audio = first_audio_stream(info)
    assert audio is not None
    assert audio.get("codec_name") == "mp3"
    assert int(audio.get("sample_rate", 0)) == 44100
    assert int(audio.get("channels", 0)) == 1
    assert abs((duration_seconds(info) or 0) - (source_duration or 0)) < 0.15


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_audio_converter_rejects_unreadable_and_silent_inputs(tmp_path: Path) -> None:
    junk = tmp_path / "broken.wav"
    junk.write_bytes(b"not an audio file")
    silent = tmp_path / "silent.mp4"
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=64x48:d=0.4",
            "-an",
            "-pix_fmt",
            "yuv420p",
            str(silent),
        ]
    )
    context = ProcessorContext(
        job_id="job_ac_bad",
        tool_id="audio-converter",
        options={"format": "mp3"},
        work_dir=tmp_path,
    )
    with pytest.raises(ProcessingError, match="could not be read"):
        await get_processor("audio-converter").process(
            [junk], tmp_path / "out.mp3", context=context
        )
    with pytest.raises(ProcessingError, match="no audio stream"):
        await get_processor("audio-converter").process(
            [silent], tmp_path / "silent.mp3", context=context
        )


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_audio_converter_job(api: AsyncClient, tmp_path: Path) -> None:
    source = tmp_path / "tone.wav"
    data = await _make_audio(source)
    source_duration = duration_seconds(await probe(source))
    file_key = await upload_bytes(
        api, data, filename="tone.wav", content_type="audio/wav", tool_id="audio-converter"
    )
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "audio-converter",
            "input": {"fileKey": file_key},
            "options": {"format": "mp3", "bitrate": "192k"},
        },
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed", job
    result = await api.get(f"/api/v1/jobs/{job['jobId']}/result")
    payload = result.json()["data"]["result"]
    assert payload["filename"].endswith(".mp3")
    assert payload["outputFormat"] == "mp3"
    downloaded = await api.get(payload["downloadUrl"])
    assert downloaded.status_code == 200
    output = tmp_path / "converted.mp3"
    output.write_bytes(downloaded.content)
    info = await probe(output)
    audio = first_audio_stream(info)
    assert audio is not None
    assert audio.get("codec_name") == "mp3"
    assert abs((duration_seconds(info) or 0) - (source_duration or 0)) < 0.15


async def test_audio_converter_rejects_unknown_format(api: AsyncClient, tmp_path: Path) -> None:
    source = tmp_path / "tone.wav"
    if needs_ffmpeg:
        pytest.skip("ffmpeg")
    data = await _make_audio(source)
    file_key = await upload_bytes(
        api, data, filename="tone.wav", content_type="audio/wav", tool_id="audio-converter"
    )
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "audio-converter",
            "input": {"fileKey": file_key},
            "options": {"format": "wma"},
        },
    )
    assert created.status_code == 422
    assert created.json()["error"]["code"] == "UNSUPPORTED_FORMAT"


async def _make_audio_webm(path: Path) -> bytes:
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=0.3",
            "-c:a",
            "libopus",
            str(path),
        ]
    )
    return path.read_bytes()


async def _make_video_only_webm(path: Path) -> bytes:
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=32x32:d=0.2",
            "-an",
            "-c:v",
            "libvpx",
            "-b:v",
            "50k",
            str(path),
        ]
    )
    return path.read_bytes()


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_noise_reduction_accepts_audio_only_webm(
    admin_api: AsyncClient, tmp_path: Path
) -> None:
    api = admin_api
    headers = await pro_headers(api, "install-noise-webm")
    source = tmp_path / "recording.webm"
    data = await _make_audio_webm(source)
    info = await probe(source)
    assert first_audio_stream(info) is not None
    file_key = await upload_bytes(
        api,
        data,
        filename="recording-20260911-180608.webm",
        content_type="video/webm;codecs=opus",
        tool_id="noise-reduction",
        headers=headers,
    )
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "noise-reduction",
            "input": {"fileKey": file_key},
            "options": {"mode": "standard", "strength": "medium"},
        },
        headers=headers,
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, str(created.json()["data"]["jobId"]))
    assert job["status"] == "completed"


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_noise_reduction_rejects_video_only_webm(tmp_path: Path) -> None:
    source = tmp_path / "silent.webm"
    await _make_video_only_webm(source)
    output = tmp_path / "out.mp3"
    context = ProcessorContext(
        job_id="job_no_audio",
        tool_id="noise-reduction",
        options={"mode": "standard", "strength": "medium"},
        work_dir=tmp_path,
    )
    try:
        await get_processor("noise-reduction").process([source], output, context=context)
        raise AssertionError("expected missing audio stream")
    except ProcessingError as exc:
        assert exc.code == "AUDIO_STREAM_NOT_FOUND"


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_video_compressor_rejects_audio_only_webm(tmp_path: Path) -> None:
    source = tmp_path / "recording.webm"
    await _make_audio_webm(source)
    output = tmp_path / "out.mp4"
    context = ProcessorContext(
        job_id="job_no_video",
        tool_id="video-compressor",
        options={},
        work_dir=tmp_path,
    )
    try:
        await get_processor("video-compressor").process([source], output, context=context)
        raise AssertionError("expected missing video stream")
    except ProcessingError as exc:
        assert exc.code == "VIDEO_STREAM_NOT_FOUND"
