import asyncio
from pathlib import Path

from app.processors.base import Processor, ProcessorContext, ProcessorResult
from app.processors.image.ops import apply_image_op, open_image, save_image


class ImageProcessor(Processor):
    def __init__(self, tool_id: str) -> None:
        self.tool_id = tool_id

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        def run() -> dict[str, int]:
            image = open_image(inputs[0])
            try:
                transformed = apply_image_op(self.tool_id, image, context.options)
                return save_image(transformed, output, context.options)
            finally:
                image.close()

        await context.report(None, "decoding")
        metadata = await asyncio.to_thread(run)
        return ProcessorResult(metadata=metadata)
