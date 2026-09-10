import asyncio
import json
from pathlib import Path
from typing import Any

from app.processors.base import ProcessingError
from app.utils.subprocess import run_command


async def probe(path: Path, *, cancel_event: asyncio.Event | None = None) -> dict[str, Any]:
    stdout = await run_command(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            str(path),
        ],
        cancel_event=cancel_event,
        timeout=30,
    )
    try:
        data = json.loads(stdout.decode())
    except json.JSONDecodeError as exc:
        raise ProcessingError("Unable to read media metadata.") from exc
    if not isinstance(data, dict):
        raise ProcessingError("Unable to read media metadata.")
    return data


def duration_seconds(info: dict[str, Any]) -> float | None:
    fmt = info.get("format")
    if not isinstance(fmt, dict):
        return None
    raw = fmt.get("duration")
    try:
        value = float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def validate_media_output(info: dict[str, Any]) -> None:
    streams = info.get("streams")
    if not isinstance(streams, list) or not streams:
        raise ProcessingError("Output file has no media streams.")
