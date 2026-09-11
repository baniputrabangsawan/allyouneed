import asyncio
from pathlib import Path

from app.processors.base import Processor, ProcessorContext, ProcessorResult
from app.processors.image.face import blur_faces


class BlurFaceProcessor(Processor):
    tool_id = "blur-face"

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        await context.report(None, "detecting")
        metadata = await asyncio.to_thread(blur_faces, inputs[0], output, context.options)
        return ProcessorResult(metadata=metadata)
