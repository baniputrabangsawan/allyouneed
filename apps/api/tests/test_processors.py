from pathlib import Path

from PIL import Image

from app.processors.base import ProcessorContext
from app.processors.registry import get_processor, processor_registry
from tests.helpers import png_bytes


def test_processor_registry_covers_core_tools() -> None:
    for tool_id in (
        "resize-image",
        "merge-pdf",
        "video-compressor",
        "speech-to-text",
        "noise-reduction",
    ):
        assert tool_id in processor_registry
        assert get_processor(tool_id) is not None


async def test_crop_image(tmp_path: Path) -> None:
    source = tmp_path / "in.png"
    source.write_bytes(png_bytes((16, 10)))
    output = tmp_path / "out.png"
    context = ProcessorContext(
        job_id="job_crop",
        tool_id="crop-image",
        options={"left": 2, "top": 2, "right": 10, "bottom": 8},
        work_dir=tmp_path,
    )
    result = await get_processor("crop-image").process([source], output, context=context)
    assert output.is_file()
    assert result.metadata["width"] == 8
    assert result.metadata["height"] == 6
    with Image.open(output) as image:
        assert image.size == (8, 6)


async def test_image_conversion(tmp_path: Path) -> None:
    source = tmp_path / "in.png"
    source.write_bytes(png_bytes((16, 10)))
    output = tmp_path / "out.jpg"
    context = ProcessorContext(
        job_id="job_test", tool_id="png-to-jpg", options={}, work_dir=tmp_path
    )
    result = await get_processor("png-to-jpg").process([source], output, context=context)
    assert output.is_file()
    assert result.metadata["width"] == 16
    with Image.open(output) as image:
        assert image.format == "JPEG"


async def test_pdf_merge(tmp_path: Path) -> None:
    import fitz

    pages = []
    for index in range(2):
        document = fitz.open()
        page = document.new_page(width=120, height=120)
        page.insert_text((10, 20), f"page {index}")
        path = tmp_path / f"page-{index}.pdf"
        document.save(path)
        document.close()
        pages.append(path)
    output = tmp_path / "merged.pdf"
    context = ProcessorContext(job_id="job_pdf", tool_id="merge-pdf", options={}, work_dir=tmp_path)
    result = await get_processor("merge-pdf").process(pages, output, context=context)
    assert result.metadata["pages"] == 2
    with fitz.open(output) as merged:
        assert merged.page_count == 2
