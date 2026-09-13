from pathlib import Path
from typing import Protocol

from fastapi import status

from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.core.job_payload import input_keys
from app.processors.base import ProcessingError
from app.processors.media import resolve_audio_convert_format
from app.schemas.jobs import CreateJobRequest
from app.tools.registry import Tool
from app.utils.media import duration_seconds, probe


class CompletedUploadLookup(Protocol):
    def require_completed(self, file_key: str) -> Path: ...


def validate_job_payload(
    tool: Tool,
    payload: CreateJobRequest,
    uploads: CompletedUploadLookup,
) -> None:
    if not tool.enabled or tool.execution_mode == "disabled":
        raise ApiError(status.HTTP_404_NOT_FOUND, "JOB_NOT_FOUND", "Tool is not available.")
    if tool.execution_mode == "local-only":
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "VALIDATION_ERROR",
            "Tool must run client-side.",
        )

    _validate_tool_options(tool.id, payload.options)
    keys = input_keys(payload.input)
    accepts_text_only = (
        tool.id == "text-to-speech" and bool(str(payload.options.get("text") or "").strip())
    ) or (tool.id == "html-to-image" and bool(str(payload.options.get("html") or "").strip()))
    if accepts_text_only and not keys:
        return
    if tool.id == "add-subtitle" and len(keys) != 2:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "VALIDATION_ERROR",
            "Add Subtitle needs one video file and one subtitle file.",
        )
    if not keys or len(keys) > tool.max_files:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "VALIDATION_ERROR",
            "Invalid number of input files.",
        )
    if len(keys) > get_settings().max_batch_files:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "TOO_MANY_FILES",
            "Too many files in this request.",
        )
    for key in keys:
        uploads.require_completed(key)


def _validate_tool_options(tool_id: str, options: dict[str, object]) -> None:
    try:
        if tool_id == "audio-converter":
            resolve_audio_convert_format(options)
        elif tool_id == "speech-to-text":
            from app.providers.stt import resolve_stt_format, resolve_stt_language

            resolve_stt_format(options)
            resolve_stt_language(options)
        elif tool_id == "text-to-speech":
            from app.providers.tts import (
                resolve_tts_format,
                resolve_tts_speed,
                resolve_tts_style,
                resolve_tts_text,
                resolve_tts_voice,
            )

            resolve_tts_text(str(options.get("text", "")))
            voice = resolve_tts_voice(options)
            resolve_tts_style(options, voice)
            resolve_tts_speed(options)
            resolve_tts_format(options)
    except ProcessingError as exc:
        code = exc.code if exc.code != "PROCESSING_FAILED" else "VALIDATION_ERROR"
        if tool_id in {"audio-converter", "speech-to-text"}:
            code = "UNSUPPORTED_FORMAT"
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, code, str(exc)) from exc


async def validate_media_duration(tool: Tool, inputs: list[Path]) -> None:
    if tool.queue not in {"audio", "video", "stt"}:
        return
    settings = get_settings()
    maximum = (
        settings.stt_max_duration_seconds
        if tool.queue == "stt"
        else settings.max_media_duration_seconds
    )
    total = 0.0
    for source in inputs:
        media_duration = duration_seconds(await probe(source))
        if media_duration is not None:
            total += media_duration
    if total > maximum:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "MEDIA_TOO_LONG",
            f"Combined media duration exceeds the {maximum}-second safety limit.",
        )
