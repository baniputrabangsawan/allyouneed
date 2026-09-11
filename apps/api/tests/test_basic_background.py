from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.processors.base import ProcessingError, ProcessorContext
from app.processors.image.grabcut import (
    apply_mask_as_alpha,
    default_foreground_rect,
    parse_foreground_rect,
    refine_mask,
)
from app.processors.registry import get_processor


def _synthetic_cutout(path: Path, size: int = 160) -> Path:
    image = Image.new("RGB", (size, size), (24, 48, 210))
    draw = ImageDraw.Draw(image)
    inset = size // 4
    draw.rectangle((inset, inset, size - inset - 1, size - inset - 1), fill=(230, 36, 36))
    image.save(path, "PNG")
    return path


def _context(tmp_path: Path, options: dict[str, object] | None = None) -> ProcessorContext:
    return ProcessorContext(
        job_id="job_basic_bg",
        tool_id="basic-background-removal",
        options=options or {},
        work_dir=tmp_path,
    )


def test_default_foreground_rect_insets_from_edges() -> None:
    assert default_foreground_rect(100, 80) == (10, 8, 80, 64)


def test_parse_foreground_rect_rejects_boxes_outside_the_image() -> None:
    with pytest.raises(ProcessingError, match="outside"):
        parse_foreground_rect({"left": 90, "top": 0, "width": 20, "height": 10}, 100, 80)


def test_refine_mask_feathers_and_closes_gaps() -> None:
    mask = np.zeros((40, 40), dtype=np.uint8)
    mask[8:32, 8:32] = 255
    mask[18:22, 18:22] = 0
    refined = refine_mask(mask)
    assert refined.shape == mask.shape
    assert int(refined[20, 20]) > 0
    assert 0 < int(refined[8, 20]) < 255


def test_apply_mask_as_alpha_keeps_rgb_and_size() -> None:
    rgb = np.zeros((12, 10, 3), dtype=np.uint8)
    rgb[:, :] = (10, 20, 30)
    mask = np.full((12, 10), 180, dtype=np.uint8)
    image = apply_mask_as_alpha(rgb, mask)
    assert image.size == (10, 12)
    assert image.mode == "RGBA"
    assert image.getpixel((0, 0)) == (10, 20, 30, 180)


async def test_grabcut_cutout_on_synthetic_foreground(tmp_path: Path) -> None:
    source = _synthetic_cutout(tmp_path / "in.png")
    output = tmp_path / "out.png"
    with Image.open(source) as original:
        original_size = original.size
    result = await get_processor("basic-background-removal").process(
        [source],
        output,
        context=_context(tmp_path, {"left": 30, "top": 30, "width": 100, "height": 100}),
    )
    assert output.is_file()
    assert result.extension == "png"
    assert result.content_type == "image/png"
    assert result.metadata["width"] == original_size[0]
    assert result.metadata["height"] == original_size[1]
    assert result.metadata["method"] == "grabcut"
    with Image.open(output) as cutout:
        assert cutout.size == original_size
        assert cutout.mode == "RGBA"
        center = cutout.getpixel((80, 80))
        corner = cutout.getpixel((2, 2))
        assert center[0] > 180 and center[3] > 180
        assert corner[3] < 40


async def test_grabcut_jpeg_input_exports_transparent_png(tmp_path: Path) -> None:
    png_path = _synthetic_cutout(tmp_path / "in.png")
    source = tmp_path / "in.jpg"
    with Image.open(png_path) as image:
        image.convert("RGB").save(source, "JPEG", quality=95)
    output = tmp_path / "out.png"
    await get_processor("basic-background-removal").process(
        [source],
        output,
        context=_context(tmp_path, {"left": 30, "top": 30, "width": 100, "height": 100}),
    )
    with Image.open(output) as cutout:
        assert cutout.format == "PNG"
        assert cutout.mode == "RGBA"
        assert cutout.size == (160, 160)


async def test_grabcut_rejects_tiny_images(tmp_path: Path) -> None:
    source = tmp_path / "tiny.png"
    Image.new("RGB", (4, 4), "red").save(source, "PNG")
    with pytest.raises(ProcessingError, match="too small"):
        await get_processor("basic-background-removal").process(
            [source], tmp_path / "out.png", context=_context(tmp_path)
        )


async def test_grabcut_webp_input_keeps_original_size(tmp_path: Path) -> None:
    png_path = _synthetic_cutout(tmp_path / "in.png")
    source = tmp_path / "in.webp"
    with Image.open(png_path) as image:
        image.save(source, "WEBP")
    output = tmp_path / "out.png"
    result = await get_processor("basic-background-removal").process(
        [source],
        output,
        context=_context(tmp_path, {"left": 30, "top": 30, "width": 100, "height": 100}),
    )
    assert result.metadata["width"] == 160
    assert result.metadata["height"] == 160
    with Image.open(output) as cutout:
        assert cutout.size == (160, 160)
        assert cutout.mode == "RGBA"
