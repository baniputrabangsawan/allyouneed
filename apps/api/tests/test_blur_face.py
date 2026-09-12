from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.processors.base import ProcessingError, ProcessorContext
from app.processors.image.face import (
    apply_face_obscure,
    blur_sigma_for_face,
    clamp_box,
    detect_frontal_faces,
    expand_face_box,
    face_contour_hull,
    image_to_bgr,
    parse_face_options,
    pixel_block_for_face,
)
from app.processors.registry import get_processor
from tests.helpers import png_bytes

FIXTURE = Path(__file__).parent / "fixtures" / "frontal-face.png"


def _draw_generated_face(size: int = 400) -> Image.Image:
    image = Image.new("RGB", (size, size), (40, 80, 40))
    draw = ImageDraw.Draw(image)
    face = (70, 50, 330, 360)
    draw.ellipse(face, fill=(214, 167, 133))
    draw.ellipse((120, 130, 175, 175), fill=(255, 255, 255))
    draw.ellipse((225, 130, 280, 175), fill=(255, 255, 255))
    draw.ellipse((140, 145, 160, 165), fill=(40, 30, 20))
    draw.ellipse((245, 145, 265, 165), fill=(40, 30, 20))
    draw.arc((145, 110, 185, 140), 200, 340, fill=(80, 50, 30), width=6)
    draw.arc((215, 110, 255, 140), 200, 340, fill=(80, 50, 30), width=6)
    draw.polygon([(200, 175), (185, 235), (215, 235)], fill=(194, 132, 107))
    draw.arc((155, 250, 245, 310), 20, 160, fill=(140, 50, 50), width=8)
    return image


def _face_source(tmp_path: Path) -> Path:
    if FIXTURE.is_file():
        return FIXTURE
    path = tmp_path / "face.png"
    _draw_generated_face().save(path, "PNG")
    return path


def _context(tmp_path: Path, options: dict[str, object] | None = None) -> ProcessorContext:
    return ProcessorContext(
        job_id="job_blur_face",
        tool_id="blur-face",
        options=options or {},
        work_dir=tmp_path,
    )


def test_clamp_box_stays_inside_image_bounds() -> None:
    assert clamp_box(-10, -5, 40, 30, 20, 20) == (0, 0, 20, 20)
    assert clamp_box(15, 15, 20, 20, 20, 20) == (15, 15, 5, 5)
    assert clamp_box(50, 50, 10, 10, 20, 20) == (20, 20, 0, 0)


async def test_blur_face_rejects_images_without_faces(tmp_path: Path) -> None:
    source = tmp_path / "blank.png"
    source.write_bytes(png_bytes((80, 60)))
    output = tmp_path / "out.png"
    with pytest.raises(ProcessingError) as raised:
        await get_processor("blur-face").process([source], output, context=_context(tmp_path))
    assert raised.value.code == "NO_FACES_DETECTED"
    assert str(raised.value) == "No face detected"
    assert not output.exists()


def test_parse_face_options_is_mode_and_intensity() -> None:
    assert parse_face_options({}) == ("blur", "strong")
    assert parse_face_options({"mode": "Blur"}) == ("blur", "strong")
    assert parse_face_options({"mode": "pixelate"}) == ("pixelate", "strong")
    assert parse_face_options({"mode": "blur", "intensity": "privacy"}) == ("blur", "privacy")
    assert parse_face_options({"mode": "blur", "preset": "light"}) == ("blur", "light")
    assert parse_face_options({"mode": "blur", "strength": 99}) == ("blur", "strong")
    assert parse_face_options({"intensity": "unknown"}) == ("blur", "strong")


def test_expand_face_box_covers_forehead_cheeks_and_chin() -> None:
    expanded = expand_face_box((40, 40, 100, 120), 400, 400, factor=0.12)
    x, y, width, height = expanded
    assert x < 40
    assert y < 40
    assert x + width > 140
    assert y + height > 160
    privacy = expand_face_box((40, 40, 100, 120), 400, 400, factor=0.15)
    assert privacy[2] >= width
    assert privacy[3] >= height
    assert expand_face_box((0, 0, 20, 20), 20, 20, factor=0.15) == (0, 0, 20, 20)


def test_blur_and_pixel_scale_with_face_size() -> None:
    small = blur_sigma_for_face(40, intensity="strong")
    large = blur_sigma_for_face(400, intensity="strong")
    assert large > small
    assert large >= 400 * 0.18
    assert blur_sigma_for_face(20, intensity="privacy") >= 28
    assert pixel_block_for_face(400, intensity="privacy") >= pixel_block_for_face(80, intensity="light")
    light = blur_sigma_for_face(200, intensity="light")
    medium = blur_sigma_for_face(200, intensity="medium")
    strong = blur_sigma_for_face(200, intensity="strong")
    privacy = blur_sigma_for_face(200, intensity="privacy")
    assert light < medium < strong < privacy


async def test_blur_face_rejects_invalid_mode_and_ignores_strength(tmp_path: Path) -> None:
    source = tmp_path / "blank.png"
    source.write_bytes(png_bytes((80, 60)))
    output = tmp_path / "out.png"
    with pytest.raises(ProcessingError, match="Invalid mode"):
        await get_processor("blur-face").process(
            [source], output, context=_context(tmp_path, {"mode": "wipe"})
        )
    with pytest.raises(ProcessingError) as raised:
        await get_processor("blur-face").process(
            [source], output, context=_context(tmp_path, {"strength": 0})
        )
    assert raised.value.code == "NO_FACES_DETECTED"
    assert "Invalid strength" not in str(raised.value)


def test_generated_or_fixture_face_is_detected_by_haar(tmp_path: Path) -> None:
    source = _face_source(tmp_path)
    with Image.open(source) as image:
        gray = np.asarray(image.convert("L"))
    boxes = detect_frontal_faces(gray)
    assert boxes, "Haar cascade did not detect a frontal face in the test image"


async def test_blur_face_changes_detected_roi_and_keeps_size(tmp_path: Path) -> None:
    source = _face_source(tmp_path)
    output = tmp_path / "out.png"
    with Image.open(source) as original:
        original_size = original.size
        original_bgr = image_to_bgr(original)
        gray = np.asarray(original.convert("L"))
    boxes = detect_frontal_faces(gray)
    assert boxes
    x, y, width, height = boxes[0]
    result = await get_processor("blur-face").process(
        [source], output, context=_context(tmp_path)
    )
    assert output.is_file()
    assert result.metadata["width"] == original_size[0]
    assert result.metadata["height"] == original_size[1]
    assert int(result.metadata["faces"]) >= 1
    assert result.metadata["mode"] == "blur"
    assert result.metadata["intensity"] == "strong"
    with Image.open(output) as blurred:
        assert blurred.size == original_size
        blurred_bgr = image_to_bgr(blurred)
    before = original_bgr[y : y + height, x : x + width]
    after = blurred_bgr[y : y + height, x : x + width]
    assert before.size and after.size
    assert not np.array_equal(before, after)
    corner = original_bgr[0:8, 0:8]
    assert np.array_equal(corner, blurred_bgr[0:8, 0:8])


def test_soft_mask_follows_face_contour_not_a_box() -> None:
    image = np.zeros((120, 120, 3), dtype=np.uint8)
    image[:, :] = (20, 180, 20)
    image[30:90, 30:90] = (40, 40, 220)
    boxes = [(30, 30, 60, 60)]
    hull = face_contour_hull(image, boxes[0], expand=0.15)
    assert hull is not None
    assert hull.reshape(-1, 2).shape[0] >= 5
    obscured = apply_face_obscure(image, boxes, mode="blur", intensity="privacy")
    assert not np.array_equal(image[60, 60], obscured[60, 60])
    assert np.array_equal(image[0:8, 0:8], obscured[0:8, 0:8])
    # Box corners sit outside the facial contour, so they stay sharp.
    assert np.array_equal(image[31, 31], obscured[31, 31])
    assert np.array_equal(image[31, 88], obscured[31, 88])
    assert np.array_equal(image[88, 31], obscured[88, 31])
    assert np.array_equal(image[88, 88], obscured[88, 88])


def test_privacy_hides_identity_more_than_light() -> None:
    image = np.zeros((160, 160, 3), dtype=np.uint8)
    image[:, :] = (30, 30, 30)
    yy, xx = np.ogrid[:160, :160]
    face = ((xx - 80) ** 2) / (50 ** 2) + ((yy - 80) ** 2) / (60 ** 2) <= 1
    image[face] = (90, 160, 220)
    image[70:90, 55:75] = (20, 20, 20)
    image[70:90, 85:105] = (20, 20, 20)
    boxes = [(30, 20, 100, 120)]
    light = apply_face_obscure(image, boxes, mode="blur", intensity="light")
    privacy = apply_face_obscure(image, boxes, mode="blur", intensity="privacy")

    def interior_detail(frame: np.ndarray) -> float:
        return float(np.std(frame[50:110, 50:110].astype(np.float32)))

    assert interior_detail(privacy) < interior_detail(light)
    assert interior_detail(privacy) < interior_detail(image)
    assert not np.array_equal(privacy[80, 80], image[80, 80])


def test_edge_and_small_faces_stay_inside_image() -> None:
    image = np.full((80, 80, 3), 40, dtype=np.uint8)
    image[2:22, 2:22] = (200, 80, 40)
    obscured = apply_face_obscure(image, [(2, 2, 20, 20), (50, 50, 40, 40)], mode="blur", intensity="privacy")
    assert obscured.shape == image.shape
    assert not np.array_equal(image[12, 12], obscured[12, 12])


async def test_pixelate_mode_changes_roi_and_keeps_size(tmp_path: Path) -> None:
    source = _face_source(tmp_path)
    output = tmp_path / "out.png"
    with Image.open(source) as original:
        original_size = original.size
        original_bgr = image_to_bgr(original)
        gray = np.asarray(original.convert("L"))
    boxes = detect_frontal_faces(gray)
    x, y, width, height = boxes[0]
    result = await get_processor("blur-face").process(
        [source], output, context=_context(tmp_path, {"mode": "pixelate"})
    )
    assert result.metadata["width"] == original_size[0]
    assert result.metadata["height"] == original_size[1]
    assert result.metadata["mode"] == "pixelate"
    assert result.metadata["intensity"] == "strong"
    with Image.open(output) as pixelated:
        assert pixelated.size == original_size
        after = image_to_bgr(pixelated)[y : y + height, x : x + width]
    before = original_bgr[y : y + height, x : x + width]
    assert not np.array_equal(before, after)
