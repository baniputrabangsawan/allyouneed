from __future__ import annotations

import asyncio
import threading
import time
from pathlib import Path
from typing import Any, Protocol

from app.core.config import get_settings
from app.processors.base import ProcessingError, ProcessorContext
from app.processors.media import first_audio_stream
from app.utils.media import duration_seconds, probe
from app.utils.subprocess import run_command

WHISPER_MODELS = frozenset({"tiny", "base", "small", "medium", "large-v3"})
STT_LANGUAGES = frozenset({"auto", "en", "id"})
STT_FORMATS = frozenset({"txt", "srt", "vtt"})
_MODEL: Any = None
_MODEL_NAME: str | None = None
_LOAD_LOCK = threading.Lock()
_INFER_LOCK = threading.Lock()


class SpeechToTextProvider(Protocol):
    async def transcribe(self, source: Path, *, context: ProcessorContext) -> dict[str, Any]: ...


def resolve_stt_language(options: dict[str, Any]) -> str | None:
    raw = str(options.get("language", "auto")).strip().lower()
    if raw in {"", "auto", "detect"}:
        return None
    if raw in {"en", "eng", "english"}:
        return "en"
    if raw in {"id", "ind", "id-id", "bahasa", "bahasa indonesia", "indonesian"}:
        return "id"
    if raw not in STT_LANGUAGES:
        raise ProcessingError("Language must be Auto Detect, English, or Bahasa Indonesia.")
    return raw


def resolve_stt_format(options: dict[str, Any]) -> str:
    raw = str(options.get("format", "txt")).split("/")[-1].lower().lstrip(".")
    if raw in {"text", "plain", "txt"}:
        return "txt"
    if raw not in STT_FORMATS:
        raise ProcessingError("Output format must be Plain Text, SRT, or VTT.")
    return raw


def timestamps_enabled(options: dict[str, Any]) -> bool:
    value = options.get("timestamps", False)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def format_timestamp(seconds: float, *, vtt: bool = False) -> str:
    total = max(0, seconds)
    hours = int(total // 3600)
    minutes = int((total % 3600) // 60)
    secs = total % 60
    marker = "." if vtt else ","
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}".replace(".", marker, 1)


def segments_to_srt(segments: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for index, segment in enumerate(segments, start=1):
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        start = format_timestamp(float(segment.get("start", 0)))
        end = format_timestamp(float(segment.get("end", 0)))
        blocks.append(f"{index}\n{start} --> {end}\n{text}")
    return "\n\n".join(blocks) + ("\n" if blocks else "")


def segments_to_vtt(segments: list[dict[str, Any]]) -> str:
    blocks = ["WEBVTT", ""]
    for segment in segments:
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        start = format_timestamp(float(segment.get("start", 0)), vtt=True)
        end = format_timestamp(float(segment.get("end", 0)), vtt=True)
        blocks.append(f"{start} --> {end}\n{text}\n")
    return "\n".join(blocks).rstrip() + ("\n" if len(blocks) > 2 else "")


def segments_to_text(segments: list[dict[str, Any]], *, timestamps: bool) -> str:
    paragraphs: list[str] = []
    buffer: list[str] = []
    last_end = 0.0
    paragraph_start: float | None = None
    for segment in segments:
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        start = float(segment.get("start", 0))
        end = float(segment.get("end", 0))
        if buffer and start - last_end > 1.2:
            line = " ".join(buffer)
            if timestamps and paragraph_start is not None:
                line = f"[{format_timestamp(paragraph_start)}] {line}"
            paragraphs.append(line)
            buffer = []
            paragraph_start = start
        if paragraph_start is None:
            paragraph_start = start
        buffer.append(text)
        last_end = end
    if buffer:
        line = " ".join(buffer)
        if timestamps and paragraph_start is not None:
            line = f"[{format_timestamp(paragraph_start)}] {line}"
        paragraphs.append(line)
    return "\n\n".join(paragraphs)


def transcription_payload(
    segments: list[dict[str, Any]],
    *,
    language: str,
    duration: float | None,
    processing_time: float,
    timestamps: bool,
) -> dict[str, Any]:
    text = segments_to_text(segments, timestamps=timestamps)
    trimmed = text.strip()
    words = 0 if not trimmed else len(trimmed.split())
    return {
        "text": text,
        "language": language,
        "duration": duration,
        "processingTime": round(processing_time, 3),
        "wordCount": words,
        "characterCount": len(text),
        "srt": segments_to_srt(segments),
        "vtt": segments_to_vtt(segments),
        "segments": segments,
    }


class UnavailableSttProvider:
    async def transcribe(self, source: Path, *, context: ProcessorContext) -> dict[str, Any]:
        raise ProcessingError(
            "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
        )


class FasterWhisperProvider:
    async def transcribe(self, source: Path, *, context: ProcessorContext) -> dict[str, Any]:
        settings = get_settings()
        language = resolve_stt_language(context.options)
        timestamps = timestamps_enabled(context.options)
        await context.report(8, "decoding")
        info = await _probe_media(source, context)
        if first_audio_stream(info) is None:
            raise ProcessingError("This file has no audio stream.", code="NO_AUDIO_STREAM")
        duration = duration_seconds(info)
        if duration is not None and duration > settings.stt_max_duration_seconds:
            raise ProcessingError(
                "This recording is too long to transcribe.", code="TRANSCRIPTION_FAILED"
            )
        wav = context.work_dir / "stt-16k-mono.wav"
        await context.report(20, "decoding")
        await _preprocess_audio(source, wav, context)
        await context.report(40, "transcribing")
        started = time.perf_counter()
        try:
            segments, detected, model_duration = await asyncio.to_thread(
                _transcribe_sync, str(wav), language
            )
        except ProcessingError:
            raise
        except Exception as exc:
            raise ProcessingError(
                "The audio could not be transcribed.", code="TRANSCRIPTION_FAILED"
            ) from exc
        elapsed = time.perf_counter() - started
        await context.report(90, "finalizing")
        return transcription_payload(
            segments,
            language=detected or language or "und",
            duration=duration if duration is not None else model_duration,
            processing_time=elapsed,
            timestamps=timestamps,
        )


def _whisper_model_name() -> str:
    name = get_settings().whisper_model.strip() or "small"
    if name not in WHISPER_MODELS:
        raise ProcessingError(
            "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
        )
    return name


def _load_model() -> Any:
    global _MODEL, _MODEL_NAME
    name = _whisper_model_name()
    with _LOAD_LOCK:
        if _MODEL is not None and name == _MODEL_NAME:
            return _MODEL
        try:
            from faster_whisper import WhisperModel  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ProcessingError(
                "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
            ) from exc
        try:
            _MODEL = WhisperModel(name, device="cpu", compute_type="int8")
            _MODEL_NAME = name
        except Exception as exc:
            raise ProcessingError(
                "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
            ) from exc
        return _MODEL


def _transcribe_sync(
    path: str, language: str | None
) -> tuple[list[dict[str, Any]], str, float | None]:
    model = _load_model()
    with _INFER_LOCK:
        segments, info = model.transcribe(path, language=language, vad_filter=True, beam_size=5)
        items = [
            {"start": float(segment.start), "end": float(segment.end), "text": segment.text.strip()}
            for segment in segments
        ]
    detected = getattr(info, "language", None)
    duration = getattr(info, "duration", None)
    language_code = detected if isinstance(detected, str) else (language or "und")
    measured = float(duration) if isinstance(duration, (int, float)) else None
    return items, language_code, measured


async def _probe_media(source: Path, context: ProcessorContext) -> dict[str, Any]:
    try:
        return await probe(source, cancel_event=context.cancel_event)
    except ProcessingError as exc:
        if exc.code == "FFMPEG_FAILED" and "not available" in str(exc).lower():
            raise
        raise ProcessingError(
            "This media file is not supported.", code="UNSUPPORTED_MEDIA"
        ) from exc


async def _preprocess_audio(source: Path, wav: Path, context: ProcessorContext) -> None:
    try:
        await run_command(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                str(wav),
            ],
            cancel_event=context.cancel_event,
            timeout=300,
        )
    except ProcessingError as exc:
        if exc.code == "FFMPEG_FAILED":
            raise
        raise ProcessingError(
            "This media file is not supported.", code="UNSUPPORTED_MEDIA"
        ) from exc
    if not wav.is_file() or wav.stat().st_size == 0:
        raise ProcessingError("This file has no audio stream.", code="NO_AUDIO_STREAM")


def get_stt_provider() -> SpeechToTextProvider:
    settings = get_settings()
    if not settings.enable_self_hosted_ai:
        return UnavailableSttProvider()
    provider = settings.stt_provider.strip().lower()
    if provider in {"selfhosted", "faster-whisper", "whisper"}:
        return FasterWhisperProvider()
    return UnavailableSttProvider()
