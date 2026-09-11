import asyncio
from io import BytesIO
from pathlib import Path

import pytest
from httpx import AsyncClient
from PIL import Image

from app.processors.base import ProcessingError, ProcessorContext
from app.processors.html_to_image import (
    MAX_INPUT_BYTES,
    assemble_document,
    chromium_available,
    prepare_render,
)
from app.processors.registry import get_processor, processor_registry


async def _wait_for_job(api: AsyncClient, job_id: str) -> dict[str, object]:
    for _ in range(400):
        job = (await api.get(f"/api/v1/jobs/{job_id}")).json()["data"]
        if job["status"] in {"completed", "failed", "cancelled"}:
            return job
        await asyncio.sleep(0.05)
    raise AssertionError("job did not finish")


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8\xff"
FIXTURE_HTML = '<div id="t" style="width:64px;height:32px;background:#ff0000"></div>'
needs_chromium = not chromium_available()


def test_processor_is_registered() -> None:
    assert "html-to-image" in processor_registry
    assert get_processor("html-to-image") is not None


def test_prepare_render_rejects_urls() -> None:
    with pytest.raises(ProcessingError, match="URL rendering"):
        prepare_render([], {"html": FIXTURE_HTML, "url": "https://example.com"})
    with pytest.raises(ProcessingError, match="URL rendering"):
        prepare_render([], {"html": FIXTURE_HTML, "goto": "file:///etc/passwd"})


def test_prepare_render_rejects_oversized_html() -> None:
    with pytest.raises(ProcessingError, match="too large"):
        prepare_render([], {"html": "x" * (MAX_INPUT_BYTES + 1)})


def test_prepare_render_rejects_invalid_format() -> None:
    with pytest.raises(ProcessingError, match="Output format"):
        prepare_render([], {"html": FIXTURE_HTML, "format": "gif"})


def test_assemble_document_wraps_fragments_and_injects_css() -> None:
    document = assemble_document("<p>Hi</p>", "p{color:red}")
    assert "<!DOCTYPE html>" in document
    assert "<p>Hi</p>" in document
    assert "p{color:red}" in document
    full = assemble_document(
        "<!DOCTYPE html><html><head></head><body>X</body></html>",
        "body{margin:0}",
    )
    assert full.count("body{margin:0}") == 1
    assert "<head>" in full


@pytest.mark.skipif(needs_chromium, reason="playwright chromium")
async def test_html_to_image_png_signature_and_size(tmp_path: Path) -> None:
    output = tmp_path / "out.png"
    context = ProcessorContext(
        job_id="job_html_png",
        tool_id="html-to-image",
        options={"html": FIXTURE_HTML, "width": 64, "height": 32, "format": "png"},
        work_dir=tmp_path,
    )
    result = await get_processor("html-to-image").process([], output, context=context)
    assert output.is_file()
    data = output.read_bytes()
    assert data.startswith(PNG_SIGNATURE)
    assert result.metadata["width"] == 64
    assert result.metadata["height"] == 32
    assert result.extension == "png"
    with Image.open(BytesIO(data)) as image:
        assert image.format == "PNG"
        assert image.size == (64, 32)


@pytest.mark.skipif(needs_chromium, reason="playwright chromium")
async def test_html_to_image_jpeg_signature(tmp_path: Path) -> None:
    output = tmp_path / "out.jpg"
    context = ProcessorContext(
        job_id="job_html_jpg",
        tool_id="html-to-image",
        options={"html": FIXTURE_HTML, "width": 64, "height": 32, "format": "jpeg"},
        work_dir=tmp_path,
    )
    result = await get_processor("html-to-image").process([], output, context=context)
    data = output.read_bytes()
    assert data.startswith(JPEG_SIGNATURE)
    assert result.extension == "jpg"
    with Image.open(BytesIO(data)) as image:
        assert image.format == "JPEG"
        assert image.size == (64, 32)


@pytest.mark.skipif(needs_chromium, reason="playwright chromium")
async def test_blocked_network_still_renders(tmp_path: Path) -> None:
    html = (
        '<div style="width:64px;height:32px;background:#00f"></div>'
        '<img src="https://example.com/pixel.png" width="1" height="1"/>'
        '<img src="file:///etc/passwd" width="1" height="1"/>'
    )
    output = tmp_path / "out.png"
    context = ProcessorContext(
        job_id="job_html_blocked",
        tool_id="html-to-image",
        options={"html": html, "width": 64, "height": 32},
        work_dir=tmp_path,
    )
    await get_processor("html-to-image").process([], output, context=context)
    data = output.read_bytes()
    assert data.startswith(PNG_SIGNATURE)
    with Image.open(BytesIO(data)) as image:
        assert image.size == (64, 32)


@pytest.mark.skipif(needs_chromium, reason="playwright chromium")
async def test_html_to_image_job_returns_signed_download(api: AsyncClient) -> None:
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "html-to-image",
            "input": {},
            "options": {"html": FIXTURE_HTML, "width": 64, "height": 32, "format": "png"},
        },
    )
    assert created.status_code == 202, created.text
    job_id = created.json()["data"]["jobId"]
    job = await _wait_for_job(api, job_id)
    assert job["status"] == "completed", job
    payload = (await api.get(f"/api/v1/jobs/{job_id}/result")).json()["data"]["result"]
    assert payload["downloadUrl"]
    assert payload["filename"]
    assert "storageKey" not in payload
    downloaded = await api.get(payload["downloadUrl"])
    assert downloaded.status_code == 200
    assert downloaded.content.startswith(PNG_SIGNATURE)
    with Image.open(BytesIO(downloaded.content)) as image:
        assert image.format == "PNG"
        assert image.size == (64, 32)


@pytest.mark.skipif(needs_chromium, reason="playwright chromium")
async def test_html_to_image_job_rejects_url_option(api: AsyncClient) -> None:
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "html-to-image",
            "input": {},
            "options": {"html": FIXTURE_HTML, "url": "https://example.com"},
        },
    )
    assert created.status_code == 202, created.text
    job = await _wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "failed"
    assert "URL" in str(job.get("error"))
