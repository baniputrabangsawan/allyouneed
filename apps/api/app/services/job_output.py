import mimetypes
from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi import status

from app.core.exceptions import ApiError
from app.processors.base import ProcessingError
from app.processors.media import MEDIA_TOOLS, resolve_audio_convert_format
from app.processors.registry import IMAGE_TOOLS, PDF_TOOLS

SUPPORTED_OUTPUT_EXTENSIONS = frozenset(
    {
        "jpg",
        "png",
        "webp",
        "avif",
        "pdf",
        "json",
        "txt",
        "srt",
        "vtt",
        "mp3",
        "wav",
        "ogg",
        "m4a",
        "flac",
        "opus",
        "mp4",
        "webm",
        "gif",
    }
)

FIXED_OUTPUT_EXTENSIONS = {
    "convert-to-jpg": "jpg",
    "png-to-jpg": "jpg",
    "webp-to-jpg": "jpg",
    "jpg-to-png": "png",
    "jpg-to-webp": "webp",
    "png-to-webp": "webp",
    "jpg-to-pdf": "pdf",
    "png-to-pdf": "pdf",
    "pdf-to-jpg": "jpg",
    "pdf-to-png": "png",
    "pdf-metadata-viewer": "json",
    "pdf-to-text": "json",
    "video-metadata-viewer": "json",
    "generate-thumbnail": "jpg",
    "video-screenshot": "jpg",
    "extract-audio": "mp3",
    "extract-audio-from-video": "mp3",
    "video-to-gif": "gif",
    "gif-to-video": "mp4",
    "ocr-pdf": "json",
    "remove-background": "png",
    "basic-background-removal": "png",
}


def output_format(tool_id: str, options: dict[str, Any], source: Path) -> tuple[str, str]:
    extension = FIXED_OUTPUT_EXTENSIONS.get(tool_id)
    if extension is None:
        extension = _dynamic_output_extension(tool_id, options, source)
    if extension not in SUPPORTED_OUTPUT_EXTENSIONS:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "UNSUPPORTED_FORMAT",
            "Output format is not supported.",
        )
    content_type = mimetypes.guess_type(f"result.{extension}")[0]
    return extension, content_type or "application/octet-stream"


def _dynamic_output_extension(tool_id: str, options: dict[str, Any], source: Path) -> str | None:
    if tool_id == "html-to-image":
        extension = _normalized_format(options.get("format", "png"))
        return extension if extension in {"png", "jpg"} else None
    if tool_id == "speech-to-text":
        from app.providers.stt import resolve_stt_format

        return _resolve_format(lambda: resolve_stt_format(options))
    if tool_id == "text-to-speech":
        return _text_to_speech_format(options)
    if tool_id == "image-converter":
        return _normalized_format(options.get("format", "jpeg"))
    if tool_id in PDF_TOOLS:
        return "pdf"
    if tool_id == "add-subtitle":
        return _normalized_format(options.get("format", "mp4"))
    if tool_id == "audio-converter":
        return _resolve_format(lambda: resolve_audio_convert_format(options).ext)
    if tool_id in MEDIA_TOOLS:
        default = "mp4" if "video" in tool_id else "mp3"
        return _normalized_format(options.get("format", default))
    if tool_id in IMAGE_TOOLS:
        return _normalized_format(source.suffix) or "jpg"
    return None


def _text_to_speech_format(options: dict[str, Any]) -> str:
    from app.providers.tts import (
        resolve_tts_format,
        resolve_tts_style,
        resolve_tts_text,
        resolve_tts_voice,
    )

    try:
        resolve_tts_text(str(options.get("text", "")))
        voice = resolve_tts_voice(options)
        resolve_tts_style(options, voice)
        return resolve_tts_format(options)
    except ProcessingError as exc:
        code = exc.code if exc.code != "PROCESSING_FAILED" else "VALIDATION_ERROR"
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, code, str(exc)) from exc


def _resolve_format(resolver: Callable[[], object]) -> str:
    try:
        return str(resolver())
    except ProcessingError as exc:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "UNSUPPORTED_FORMAT",
            str(exc),
        ) from exc


def _normalized_format(value: object) -> str:
    return str(value).split("/")[-1].lower().lstrip(".").replace("jpeg", "jpg")
