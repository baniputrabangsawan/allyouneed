from io import BytesIO

import fitz
from httpx import AsyncClient
from PIL import Image

from tests.helpers import png_bytes, upload_bytes, upload_pdf, wait_for_job


async def _download_result(api: AsyncClient, job_id: str) -> bytes:
    result = await api.get(f"/api/v1/jobs/{job_id}/result")
    downloaded = await api.get(result.json()["data"]["result"]["downloadUrl"])
    assert downloaded.status_code == 200
    assert downloaded.content
    return downloaded.content


async def _create_job(
    api: AsyncClient, tool_id: str, file_key: str | list[str], options: dict[str, object]
) -> dict[str, object]:
    payload = {
        "toolId": tool_id,
        "input": {"files": file_key} if isinstance(file_key, list) else {"fileKey": file_key},
        "options": options,
    }
    created = await api.post("/api/v1/jobs", json=payload)
    assert created.status_code == 202, created.text
    job = await wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed", job
    return job


async def test_merge_and_extract_pdf_families(api: AsyncClient) -> None:
    first = await upload_pdf(api, tool_id="merge-pdf")
    second = await upload_pdf(api, tool_id="merge-pdf")
    merged = await _create_job(api, "merge-pdf", [first, second], {})
    merged_bytes = await _download_result(api, str(merged["jobId"]))
    with fitz.open(stream=merged_bytes, filetype="pdf") as document:
        assert document.page_count == 2

    extracted = await _create_job(
        api,
        "extract-pdf-pages",
        await upload_bytes(
            api,
            merged_bytes,
            filename="merged.pdf",
            content_type="application/pdf",
            tool_id="extract-pdf-pages",
        ),
        {"pages": [1]},
    )
    extracted_bytes = await _download_result(api, str(extracted["jobId"]))
    with fitz.open(stream=extracted_bytes, filetype="pdf") as document:
        assert document.page_count == 1


async def test_rotate_watermark_and_protect_pdf(api: AsyncClient) -> None:
    file_key = await upload_pdf(api, tool_id="rotate-pdf")
    rotated = await _create_job(api, "rotate-pdf", file_key, {"rotation": 90})
    rotated_bytes = await _download_result(api, str(rotated["jobId"]))
    with fitz.open(stream=rotated_bytes, filetype="pdf") as document:
        assert document[0].rotation == 90

    watermarked = await _create_job(
        api, "watermark-pdf", await upload_pdf(api, tool_id="watermark-pdf"), {"text": "Mark"}
    )
    watermarked_bytes = await _download_result(api, str(watermarked["jobId"]))
    with fitz.open(stream=watermarked_bytes, filetype="pdf") as document:
        assert "Mark" in document[0].get_text()

    protected = await _create_job(
        api, "protect-pdf", await upload_pdf(api, tool_id="protect-pdf"), {"password": "secret"}
    )
    protected_bytes = await _download_result(api, str(protected["jobId"]))
    with fitz.open(stream=protected_bytes, filetype="pdf") as document:
        assert document.needs_pass


async def test_image_pdf_round_trip(api: AsyncClient) -> None:
    png_key = await upload_bytes(
        api,
        png_bytes((16, 10)),
        filename="page.png",
        content_type="image/png",
        tool_id="png-to-pdf",
    )
    pdf_job = await _create_job(api, "png-to-pdf", png_key, {})
    pdf_bytes = await _download_result(api, str(pdf_job["jobId"]))
    with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
        assert document.page_count == 1

    jpg_key = await upload_bytes(
        api, pdf_bytes, filename="page.pdf", content_type="application/pdf", tool_id="pdf-to-jpg"
    )
    jpg_job = await _create_job(api, "pdf-to-jpg", jpg_key, {})
    jpg_bytes = await _download_result(api, str(jpg_job["jobId"]))
    with Image.open(BytesIO(jpg_bytes)) as image:
        assert image.format == "JPEG"
