import json
from pathlib import Path

from app.processors.base import Processor, ProcessorContext, ProcessorResult
from app.providers.ocr import get_ocr_provider


class OcrProcessor(Processor):
    tool_id = "ocr-pdf"

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        await context.report(None, "processing")
        result = await get_ocr_provider().extract(inputs[0], context=context)
        output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        return ProcessorResult(metadata={"pages": len(result.get("pages", []))})
