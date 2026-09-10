from pathlib import Path
from typing import Any

from app.processors.base import ProcessingError, ProcessorContext, ProcessorResult
from app.processors.media import AUDIO_TOOLS, MEDIA_TOOLS, VIDEO_TOOLS
from app.processors.registry import IMAGE_TOOLS, PDF_TOOLS, get_processor

__all__ = [
    "AUDIO_TOOLS",
    "IMAGE_TOOLS",
    "MEDIA_TOOLS",
    "PDF_TOOLS",
    "ProcessingError",
    "VIDEO_TOOLS",
    "process",
]


async def process(
    tool_id: str,
    inputs: list[Path],
    options: dict[str, Any],
    output: Path,
    *,
    context: ProcessorContext | None = None,
) -> dict[str, Any]:
    processor = get_processor(tool_id)
    ctx = context or ProcessorContext(
        job_id="job_inline",
        tool_id=tool_id,
        options=options,
        work_dir=output.parent,
    )
    result: ProcessorResult = await processor.process(inputs, output, context=ctx)
    return result.metadata
