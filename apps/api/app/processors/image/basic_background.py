import asyncio
from pathlib import Path

from app.processors.base import Processor, ProcessorContext, ProcessorResult
from app.processors.image.grabcut import remove_background_grabcut


class BasicBackgroundRemovalProcessor(Processor):
    tool_id = "basic-background-removal"

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        await context.report(None, "segmenting")
        metadata = await asyncio.to_thread(
            remove_background_grabcut, inputs[0], output, context.options
        )
        return ProcessorResult(metadata=metadata, extension="png", content_type="image/png")
