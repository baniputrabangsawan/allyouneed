from typing import Literal

from pydantic import BaseModel, Field

from app.core.capabilities import TOOL_CAPABILITIES
from app.processors.media import AUDIO_TOOLS, VIDEO_TOOLS
from app.processors.registry import IMAGE_TOOLS, PDF_TOOLS

ExecutionMode = Literal["local-only", "sync", "async", "disabled"]

MB = 1024 * 1024
IMAGES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
PDF = {"application/pdf"}
AUDIO = {
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/ogg",
    "audio/webm",
    "audio/flac",
    "audio/x-flac",
    "audio/aac",
    "audio/opus",
}
VIDEO = {"video/mp4", "video/webm", "video/quicktime", "image/gif"}
SUBTITLES = {
    "text/plain",
    "text/vtt",
    "application/x-subrip",
    "text/x-subrip",
    "application/x-ass",
    "text/x-ass",
    "text/x-ssa",
    "application/octet-stream",
}
TEXT = {"text/plain"}


class Tool(BaseModel):
    id: str
    execution_mode: ExecutionMode = "async"
    processor: str
    queue: str
    accepted_mimes: set[str]
    output_mimes: set[str] = Field(default_factory=set)
    max_file_size: int
    max_files: int = 1
    timeout: int
    enabled: bool = True
    requires_auth: bool = False
    premium: bool = False
    required_capability: str | None = None


def tools(
    ids: set[str],
    queue: str,
    mimes: set[str],
    *,
    max_files: int = 1,
    timeout: int = 120,
    execution_mode: ExecutionMode = "async",
    premium: bool = False,
) -> dict[str, Tool]:
    return {
        tool_id: Tool(
            id=tool_id,
            processor=tool_id,
            queue=queue,
            accepted_mimes=mimes,
            max_file_size=100 * MB,
            max_files=max_files,
            timeout=timeout,
            execution_mode=execution_mode,
            premium=premium,
            required_capability=TOOL_CAPABILITIES.get(tool_id),
        )
        for tool_id in ids
    }


tool_registry: dict[str, Tool] = {
    **tools(IMAGE_TOOLS, "image", IMAGES, timeout=60),
    **tools(PDF_TOOLS, "pdf", PDF | {"image/jpeg", "image/png"}, max_files=20, timeout=120),
    **tools(AUDIO_TOOLS, "audio", AUDIO | VIDEO, max_files=20, timeout=300),
    **tools(VIDEO_TOOLS - {"add-subtitle"}, "video", AUDIO | VIDEO, max_files=20, timeout=600),
    **tools({"add-subtitle"}, "video", VIDEO | SUBTITLES, max_files=2, timeout=600),
    **tools({"ocr-pdf"}, "ocr", PDF | IMAGES, timeout=300),
    **tools({"speech-to-text"}, "stt", AUDIO | VIDEO, timeout=900),
    **tools({"text-to-speech"}, "tts", TEXT, timeout=180),
    **tools({"remove-background", "upscale-image"}, "ai-image", IMAGES, timeout=300, premium=True),
    "basic-background-removal": Tool(
        id="basic-background-removal",
        processor="basic-background-removal",
        queue="image",
        accepted_mimes={"image/jpeg", "image/png", "image/webp"},
        output_mimes={"image/png"},
        max_file_size=100 * MB,
        max_files=1,
        timeout=120,
    ),
    "html-to-image": Tool(
        id="html-to-image",
        processor="html-to-image",
        queue="image",
        accepted_mimes={"text/html", "text/plain"},
        output_mimes={"image/png", "image/jpeg"},
        max_file_size=512 * 1024,
        max_files=1,
        timeout=120,
    ),
}
