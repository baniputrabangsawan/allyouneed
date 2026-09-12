import asyncio
import math
import shutil
import struct
import wave
from pathlib import Path
from typing import Any

import pytest
from httpx import AsyncClient

from app.processors.base import ProcessingError, ProcessorContext
from app.processors.registry import get_processor
from app.providers.stt import (
    UnavailableSttProvider,
    resolve_stt_format,
    resolve_stt_language,
    segments_to_srt,
    segments_to_text,
    segments_to_vtt,
    timestamps_enabled,
    transcription_payload,
)
from app.providers.tts import (
    PiperProvider,
    UnavailableTtsProvider,
    available_tts_voices,
    resolve_tts_format,
    resolve_tts_speed,
    resolve_tts_text,
    resolve_tts_voice,
)
from app.utils.media import duration_seconds, probe, validate_media_output
from app.utils.subprocess import run_command
from tests.helpers import upload_bytes

needs_ffmpeg = pytest.mark.skipif(
    shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
    reason="ffmpeg",
)

SEGMENTS = [
    {"start": 0.0, "end": 0.8, "text": "Hello from Kits."},
    {"start": 2.2, "end": 3.0, "text": "Processed locally."},
]


def _piper_voice() -> Path:
    return Path(".").resolve() / ".data" / "models" / "tts" / "en_US-lessac-medium.onnx"


def _whisper_tiny_cached() -> bool:
    hub = Path.home() / ".cache" / "huggingface" / "hub" / "models--Systran--faster-whisper-tiny"
    return hub.is_dir()


def _context(tmp_path: Path, tool_id: str, options: dict[str, Any]) -> ProcessorContext:
    return ProcessorContext(
        job_id=f"job_{tool_id}", tool_id=tool_id, options=options, work_dir=tmp_path
    )


async def _wait_for_job(api: AsyncClient, job_id: str) -> dict[str, object]:
    for _ in range(400):
        job = (await api.get(f"/api/v1/jobs/{job_id}")).json()["data"]
        if job["status"] in {"completed", "failed", "cancelled"}:
            return job
        await asyncio.sleep(0.05)
    raise AssertionError("job did not finish")


def _write_tone_wav(path: Path, *, duration: float = 0.4, sample_rate: int = 16_000) -> None:
    frames = int(sample_rate * duration)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        payload = b"".join(
            struct.pack(
                "<h",
                int(12_000 * math.sin(2 * math.pi * 440 * index / sample_rate)),
            )
            for index in range(frames)
        )
        handle.writeframes(payload)


async def _make_audio(path: Path, *, fmt: str = "wav") -> bytes:
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


async def _make_video_with_audio(path: Path) -> bytes:
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=64x48:d=0.4",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=0.4",
            "-shortest",
            "-pix_fmt",
            "yuv420p",
            str(path),
        ]
    )
    return path.read_bytes()


async def _make_silent_video(path: Path) -> bytes:
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=64x48:d=0.4",
            "-an",
            "-pix_fmt",
            "yuv420p",
            str(path),
        ]
    )
    return path.read_bytes()


def _fake_transcribe(_path: str, language: str | None) -> tuple[list[dict[str, Any]], str, float]:
    return SEGMENTS, language or "en", 0.4


def _fake_synthesize(text: str, wav: Path, voice: Any, speed: float, engine: str) -> int:
    assert text
    assert engine in {"kokoro", "piper"}
    assert speed > 0
    frequency = 440 if voice.id == "en_US-lessac-medium" else 660
    frames = int(16_000 * max(0.3, 0.4 / speed))
    with wave.open(str(wav), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16_000)
        handle.writeframes(
            b"".join(
                struct.pack("<h", int(12_000 * math.sin(2 * math.pi * frequency * index / 16_000)))
                for index in range(frames)
            )
        )
    return 16_000


async def _pro_headers(api: AsyncClient) -> dict[str, str]:
    issued = (await api.post("/api/v1/admin/licenses", json={"durationMonths": 1})).json()["data"]
    activated = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": issued["licenseKey"], "installationId": "install-speech"},
    )
    return {"X-Entitlement-Token": activated.json()["data"]["token"]}


def test_stt_option_helpers() -> None:
    assert resolve_stt_language({}) is None
    assert resolve_stt_language({"language": "English"}) == "en"
    assert resolve_stt_language({"language": "Bahasa Indonesia"}) == "id"
    assert resolve_stt_format({"format": "text/vtt"}) == "vtt"
    assert timestamps_enabled({"timestamps": "true"}) is True
    with pytest.raises(ProcessingError):
        resolve_stt_language({"language": "fr"})
    with pytest.raises(ProcessingError):
        resolve_stt_format({"format": "json"})


def test_stt_caption_payload_preserves_paragraphs() -> None:
    payload = transcription_payload(
        SEGMENTS, language="en", duration=3.0, processing_time=1.25, timestamps=False
    )
    stamped = transcription_payload(
        SEGMENTS, language="en", duration=3.0, processing_time=1.25, timestamps=True
    )
    assert "Hello from Kits." in payload["text"]
    assert "Processed locally." in payload["text"]
    assert "\n\n" in payload["text"]
    assert payload["srt"].startswith("1\n")
    assert payload["vtt"].startswith("WEBVTT")
    assert payload["wordCount"] == 5
    assert "[00:00:00,000]" in stamped["text"]
    assert "segments" in payload
    assert segments_to_text(SEGMENTS, timestamps=False).count("\n\n") == 1
    assert "-->" in segments_to_srt(SEGMENTS)
    assert segments_to_vtt(SEGMENTS).startswith("WEBVTT")


def test_tts_option_helpers() -> None:
    voices = available_tts_voices()
    assert any(voice.id == "en_US-lessac-medium" for voice in voices)
    assert all(voice.language != "id-ID" for voice in voices)
    assert resolve_tts_text(" Hello from Kits. ") == "Hello from Kits."
    assert resolve_tts_voice({"voice": "en_US-lessac-medium"}).name == "Lessac Medium"
    assert resolve_tts_speed({"speed": "1.25"}) == 1.25
    assert resolve_tts_format({"format": "audio/mpeg"}) == "mp3"
    with pytest.raises(ProcessingError) as too_long:
        resolve_tts_text("x" * 5001)
    assert too_long.value.code == "TEXT_TOO_LONG"
    with pytest.raises(ProcessingError) as voice:
        resolve_tts_voice({"voice": "robot"})
    assert voice.value.code == "VOICE_UNAVAILABLE"
    with pytest.raises(ProcessingError) as language:
        resolve_tts_voice({"voice": "en_US-lessac-medium", "language": "id-ID"})
    assert language.value.code == "UNSUPPORTED_LANGUAGE"
    with pytest.raises(ProcessingError):
        resolve_tts_speed({"speed": 2})
    with pytest.raises(ProcessingError):
        resolve_tts_text("   ")


async def test_text_to_speech_capabilities_endpoint(api: AsyncClient) -> None:
    response = await api.get("/api/v1/tts/capabilities")
    assert response.status_code == 200
    data = response.json()["data"]
    ids = [voice["id"] for voice in data["voices"]]
    assert "en_US-lessac-medium" in ids
    assert "en-US" in data["languages"]
    assert "id-ID" not in data["languages"]


@needs_ffmpeg
async def test_speech_to_text_wav_webm_and_video(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.providers.stt._transcribe_sync", _fake_transcribe)
    cases = [
        (tmp_path / "tone.wav", "txt"),
        (tmp_path / "tone.webm", "srt"),
        (tmp_path / "clip.mp4", "vtt"),
    ]
    await _make_audio(cases[0][0])
    await _make_audio(cases[1][0], fmt="webm")
    await _make_video_with_audio(cases[2][0])
    for source, fmt in cases:
        output = tmp_path / f"out.{fmt}"
        result = await get_processor("speech-to-text").process(
            [source],
            output,
            context=_context(tmp_path, "speech-to-text", {"language": "en", "format": fmt}),
        )
        body = output.read_text(encoding="utf-8")
        assert "Hello from Kits." in body
        assert result.extension == fmt
        assert "segments" not in result.metadata
        if fmt == "vtt":
            assert body.startswith("WEBVTT")
            assert result.content_type == "text/vtt"
        if fmt == "srt":
            assert "-->" in body


@needs_ffmpeg
async def test_speech_to_text_rejects_no_audio_and_invalid_media(tmp_path: Path) -> None:
    silent = tmp_path / "silent.mp4"
    await _make_silent_video(silent)
    with pytest.raises(ProcessingError) as missing:
        await get_processor("speech-to-text").process(
            [silent],
            tmp_path / "out.txt",
            context=_context(tmp_path, "speech-to-text", {"format": "txt"}),
        )
    assert missing.value.code == "NO_AUDIO_STREAM"

    garbage = tmp_path / "not-media.bin"
    garbage.write_bytes(b"not a media file")
    with pytest.raises(ProcessingError) as unsupported:
        await get_processor("speech-to-text").process(
            [garbage],
            tmp_path / "bad.txt",
            context=_context(tmp_path, "speech-to-text", {"format": "txt"}),
        )
    assert unsupported.value.code in {"UNSUPPORTED_MEDIA", "FFMPEG_FAILED"}


async def test_speech_to_text_model_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.processors.ai.generic.get_stt_provider", lambda: UnavailableSttProvider()
    )
    with pytest.raises(ProcessingError) as caught:
        await get_processor("speech-to-text").process(
            [tmp_path / "missing.wav"],
            tmp_path / "out.txt",
            context=_context(tmp_path, "speech-to-text", {"format": "txt"}),
        )
    assert caught.value.code == "MODEL_UNAVAILABLE"


@needs_ffmpeg
async def test_text_to_speech_mp3_and_wav(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.processors.ai.generic.get_tts_provider", lambda: PiperProvider())
    monkeypatch.setattr("app.providers.tts._synthesize_wav", _fake_synthesize)
    for fmt in ("mp3", "wav"):
        output = tmp_path / f"speech.{fmt}"
        result = await get_processor("text-to-speech").process(
            [],
            output,
            context=_context(
                tmp_path,
                "text-to-speech",
                {
                    "text": "Hello from Kits.",
                    "voice": "en_US-lessac-medium",
                    "language": "en-US",
                    "format": fmt,
                    "speed": 1,
                },
            ),
        )
        assert output.is_file()
        info = await probe(output)
        validate_media_output(info)
        assert duration_seconds(info) and duration_seconds(info) > 0
        assert result.extension == fmt
        assert result.content_type == ("audio/mpeg" if fmt == "mp3" else "audio/wav")
        assert result.metadata["voice"] == "en_US-lessac-medium"
        assert result.metadata["voiceName"] == "Lessac Medium"
        assert result.metadata["provider"] == "piper"
        assert "kokoro_id" not in result.metadata
        assert "piper_id" not in result.metadata


async def test_text_to_speech_model_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.processors.ai.generic.get_tts_provider", lambda: UnavailableTtsProvider()
    )
    with pytest.raises(ProcessingError) as caught:
        await get_processor("text-to-speech").process(
            [],
            tmp_path / "out.mp3",
            context=_context(
                tmp_path,
                "text-to-speech",
                {"text": "Hello from Kits.", "voice": "en_US-lessac-medium", "format": "mp3"},
            ),
        )
    assert caught.value.code == "MODEL_UNAVAILABLE"


async def test_speech_tools_require_license(admin_api: AsyncClient) -> None:
    api = admin_api
    blocked_upload = await api.post(
        "/api/v1/uploads/presign",
        json={
            "filename": "tone.wav",
            "contentType": "audio/wav",
            "size": 12,
            "toolId": "speech-to-text",
        },
    )
    assert blocked_upload.status_code == 403
    assert blocked_upload.json()["error"]["code"] == "LICENSE_REQUIRED"

    blocked_tts = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "text-to-speech",
            "input": {},
            "options": {
                "text": "Hello from Kits.",
                "voice": "en_US-lessac-medium",
                "format": "mp3",
            },
        },
    )
    assert blocked_tts.status_code == 403
    assert blocked_tts.json()["error"]["code"] == "LICENSE_REQUIRED"


async def test_text_to_speech_rejects_invalid_options(admin_api: AsyncClient) -> None:
    api = admin_api
    headers = await _pro_headers(api)
    too_long = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "text-to-speech",
            "input": {},
            "options": {"text": "x" * 5001, "voice": "en_US-lessac-medium", "format": "mp3"},
        },
        headers=headers,
    )
    assert too_long.status_code == 422
    assert too_long.json()["error"]["code"] == "TEXT_TOO_LONG"

    unknown = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "text-to-speech",
            "input": {},
            "options": {"text": "Hello from Kits.", "voice": "robot", "format": "mp3"},
        },
        headers=headers,
    )
    assert unknown.status_code == 422
    assert unknown.json()["error"]["code"] == "VOICE_UNAVAILABLE"

    mismatch = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "text-to-speech",
            "input": {},
            "options": {
                "text": "Hello from Kits.",
                "voice": "en_US-lessac-medium",
                "language": "id-ID",
                "format": "mp3",
            },
        },
        headers=headers,
    )
    assert mismatch.status_code == 422
    assert mismatch.json()["error"]["code"] == "UNSUPPORTED_LANGUAGE"


@needs_ffmpeg
async def test_speech_to_text_job(
    admin_api: AsyncClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.providers.stt._transcribe_sync", _fake_transcribe)
    api = admin_api
    headers = await _pro_headers(api)
    source = tmp_path / "tone.wav"
    data = await _make_audio(source)
    file_key = await upload_bytes(
        api,
        data,
        filename="tone.wav",
        content_type="audio/wav",
        tool_id="speech-to-text",
        headers=headers,
    )
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "speech-to-text",
            "input": {"fileKey": file_key},
            "options": {"language": "en", "format": "txt", "timestamps": False},
        },
        headers=headers,
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed", job
    result = (await api.get(f"/api/v1/jobs/{job['jobId']}/result")).json()["data"]["result"]
    assert "Hello from Kits." in result["text"]
    assert result["contentType"].startswith("text/")
    assert "segments" not in result
    downloaded = await api.get(result["downloadUrl"])
    assert downloaded.status_code == 200
    assert "Hello from Kits." in downloaded.text


@needs_ffmpeg
async def test_text_to_speech_job(
    admin_api: AsyncClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.processors.ai.generic.get_tts_provider", lambda: PiperProvider())
    monkeypatch.setattr("app.providers.tts._synthesize_wav", _fake_synthesize)
    api = admin_api
    headers = await _pro_headers(api)
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "text-to-speech",
            "input": {},
            "options": {
                "text": "Hello from Kits.",
                "voice": "en_US-lessac-medium",
                "language": "en-US",
                "speed": 1,
                "format": "mp3",
            },
        },
        headers=headers,
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed", job
    result = (await api.get(f"/api/v1/jobs/{job['jobId']}/result")).json()["data"]["result"]
    assert result["contentType"] == "audio/mpeg"
    assert result["voiceName"] == "Lessac Medium"
    downloaded = await api.get(result["downloadUrl"])
    assert downloaded.status_code == 200
    output = tmp_path / "hello.mp3"
    output.write_bytes(downloaded.content)
    validate_media_output(await probe(output))
    assert duration_seconds(await probe(output))


@needs_ffmpeg
@pytest.mark.skipif(not _piper_voice().is_file(), reason="piper voice")
async def test_text_to_speech_live_piper(tmp_path: Path) -> None:
    output = tmp_path / "live.wav"
    result = await get_processor("text-to-speech").process(
        [],
        output,
        context=_context(
            tmp_path,
            "text-to-speech",
            {
                "text": "Hello from Kits.",
                "voice": "en_US-lessac-medium",
                "format": "wav",
                "speed": 1,
            },
        ),
    )
    assert output.is_file()
    info = await probe(output)
    validate_media_output(info)
    assert duration_seconds(info) and duration_seconds(info) > 0
    assert result.extension == "wav"
    assert result.content_type == "audio/wav"
    assert result.metadata["engine"] == "piper"
    assert result.metadata["voiceName"] == "Lessac Medium"


@needs_ffmpeg
@pytest.mark.skipif(not _piper_voice().is_file(), reason="piper voice")
@pytest.mark.skipif(not _whisper_tiny_cached(), reason="whisper tiny")
async def test_speech_to_text_live_whisper(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.providers.stt._whisper_model_name", lambda: "tiny")
    spoken = tmp_path / "spoken.wav"
    await get_processor("text-to-speech").process(
        [],
        spoken,
        context=_context(
            tmp_path,
            "text-to-speech",
            {
                "text": "Hello from Kits.",
                "voice": "en_US-lessac-medium",
                "format": "wav",
                "speed": 1,
            },
        ),
    )
    output = tmp_path / "live.txt"
    result = await get_processor("speech-to-text").process(
        [spoken],
        output,
        context=_context(
            tmp_path,
            "speech-to-text",
            {"language": "en", "format": "txt", "timestamps": False},
        ),
    )
    body = output.read_text(encoding="utf-8").lower()
    assert "hello" in body or "kits" in body
    assert result.extension == "txt"
    assert result.content_type == "text/plain"
    assert "segments" not in result.metadata
    language = str(result.metadata.get("language") or "")
    assert language == "en" or language.startswith("en")
