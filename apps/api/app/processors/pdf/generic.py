import asyncio
import json
from pathlib import Path
from typing import Any

import fitz  # type: ignore[import-untyped]
from PIL import Image

from app.processors.base import (
    ProcessingError,
    Processor,
    ProcessorContext,
    ProcessorResult,
    integer,
)


def page_numbers(options: dict[str, Any], count: int) -> list[int]:
    pages = options.get("pages", list(range(1, count + 1)))
    if (
        not isinstance(pages, list)
        or not pages
        or any(not isinstance(page, int) or page < 1 or page > count for page in pages)
    ):
        raise ProcessingError("Invalid page selection.")
    return pages


def process_pdf(
    tool_id: str, inputs: list[Path], options: dict[str, Any], output: Path
) -> dict[str, Any]:
    if tool_id in {"jpg-to-pdf", "png-to-pdf"}:
        images = [Image.open(path).convert("RGB") for path in inputs]
        images[0].save(output, save_all=True, append_images=images[1:])
        for image in images:
            image.close()
        return {"pages": len(inputs)}

    document = fitz.open(inputs[0])
    if tool_id == "merge-pdf":
        merged = fitz.open()
        for path in inputs:
            with fitz.open(path) as part:
                merged.insert_pdf(part)
        merged.save(output)
        pages = merged.page_count
        merged.close()
        document.close()
        return {"pages": pages}
    if tool_id in {"pdf-metadata-viewer", "pdf-to-text"}:
        data = (
            document.metadata
            if tool_id == "pdf-metadata-viewer"
            else {"text": "\n\n".join(page.get_text() for page in document)}
        )
        output.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        pages = document.page_count
        document.close()
        return {"pages": pages}
    if tool_id in {"pdf-to-jpg", "pdf-to-png"}:
        page = document.load_page(integer(options, "page", 1) - 1)
        page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(output)
        document.close()
        return {"pages": 1}
    if tool_id == "rotate-pdf":
        for page in document:
            page.set_rotation((page.rotation + integer(options, "rotation", 90)) % 360)
    elif tool_id in {"delete-pdf-pages", "extract-pdf-pages"}:
        pages = page_numbers(options, document.page_count)
        if tool_id == "delete-pdf-pages":
            document.delete_pages([page - 1 for page in pages])
        else:
            extracted = fitz.open()
            for page in pages:
                extracted.insert_pdf(document, from_page=page - 1, to_page=page - 1)
            document.close()
            document = extracted
    elif tool_id == "reorder-pdf-pages":
        document.select([page - 1 for page in page_numbers(options, document.page_count)])
    elif tool_id in {"watermark-pdf", "page-number-pdf"}:
        for index, page in enumerate(document):
            if tool_id == "watermark-pdf":
                text = str(options.get("text", "Watermark"))
            else:
                text = str(index + 1)
            page.insert_text((36, page.rect.height - 36), text, fontsize=12)
    elif tool_id == "split-pdf":
        pages = page_numbers(options, document.page_count)
        extracted = fitz.open()
        for page in pages:
            extracted.insert_pdf(document, from_page=page - 1, to_page=page - 1)
        document.close()
        document = extracted
    elif tool_id == "unlock-pdf":
        password = str(options.get("password", ""))
        if password:
            document.authenticate(password)

    if tool_id == "protect-pdf":
        password = str(options.get("password", ""))
        if not password:
            raise ProcessingError("A password is required.")
        document.save(
            output, encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw=password, user_pw=password
        )
    else:
        document.save(output, garbage=4, deflate=True)
    pages = document.page_count
    document.close()
    return {"pages": pages}


class PdfProcessor(Processor):
    def __init__(self, tool_id: str) -> None:
        self.tool_id = tool_id

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        await context.report(None, "processing")
        metadata = await asyncio.to_thread(
            process_pdf, self.tool_id, inputs, context.options, output
        )
        return ProcessorResult(metadata=metadata)
