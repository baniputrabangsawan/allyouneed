from pathlib import Path

import cv2
import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.processors.base import ProcessingError, ProcessorContext
from app.processors.image.face import (
    _MASK_EXPAND,
    FaceDetection,
    _debug_enabled,
    _nms,
    apply_face_obscure,
    blur_sigma_for_face,
    clamp_box,
    detect_frontal_faces,
    expand_face_box,
    face_contour_hull,
    image_to_bgr,
    parse_face_options,
    pixel_block_for_face,
    scale_to_original,
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
    privacy_block = pixel_block_for_face(400, intensity="privacy")
    light_block = pixel_block_for_face(80, intensity="light")
    assert privacy_block >= light_block
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
    result = await get_processor("blur-face").process([source], output, context=_context(tmp_path))
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
    face = ((xx - 80) ** 2) / (50**2) + ((yy - 80) ** 2) / (60**2) <= 1
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
    obscured = apply_face_obscure(
        image, [(2, 2, 20, 20), (50, 50, 40, 40)], mode="blur", intensity="privacy"
    )
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


def test_nms_drops_overlapping_duplicates() -> None:
    landmarks = ((10, 10), (20, 10), (15, 16), (12, 22), (18, 22))
    kept = _nms(
        [
            FaceDetection(box=(10, 10, 80, 90), score=0.9, landmarks=landmarks),
            FaceDetection(box=(18, 14, 76, 88), score=0.4, landmarks=landmarks),
            FaceDetection(box=(200, 10, 70, 80), score=0.8, landmarks=landmarks),
        ]
    )
    assert [item.box[0] for item in kept] == [10, 200]


def test_scale_to_original_maps_inference_coords() -> None:
    mapped = scale_to_original(
        10, 20, original_width=400, original_height=300, inference_width=200, inference_height=150
    )
    assert mapped == (20, 40)


def test_mask_expansion_is_proportional_not_a_square() -> None:
    assert _MASK_EXPAND["light"] == 0.04
    assert _MASK_EXPAND["medium"] == 0.07
    assert _MASK_EXPAND["strong"] == 0.10
    assert _MASK_EXPAND["privacy"] == 0.14
    box = (40, 40, 100, 140)
    light = expand_face_box(box, 400, 400, factor=_MASK_EXPAND["light"])
    privacy = expand_face_box(box, 400, 400, factor=_MASK_EXPAND["privacy"])
    assert privacy[2] > light[2]
    assert privacy[3] / privacy[2] == pytest.approx(light[3] / light[2], rel=0.08)


def test_debug_overlay_is_off_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    class Settings:
        app_env = "production"

    monkeypatch.setattr("app.core.config.get_settings", lambda: Settings())
    assert _debug_enabled({"debug": True}) is False
    dev = type("S", (), {"app_env": "development"})()
    monkeypatch.setattr("app.core.config.get_settings", lambda: dev)
    assert _debug_enabled({"debug": True}) is True
    assert _debug_enabled({}) is False


def test_busy_background_does_not_invent_extra_masks() -> None:
    image = np.full((200, 200, 3), 30, dtype=np.uint8)
    image[40:160, 50:150] = (90, 160, 220)
    image[70:90, 70:90] = (20, 20, 20)
    image[70:90, 110:130] = (20, 20, 20)
    image[0:30, 0:30] = (200, 40, 40)
    image[170:200, 170:200] = (40, 200, 40)
    detections = [
        FaceDetection(
            box=(50, 40, 100, 120),
            score=0.92,
            landmarks=((80, 80), (120, 80), (100, 105), (85, 130), (115, 130)),
        )
    ]
    obscured = apply_face_obscure(
        image, [detections[0].box], mode="blur", intensity="strong", detections=detections
    )
    assert np.array_equal(image[10, 10], obscured[10, 10])
    assert np.array_equal(image[185, 185], obscured[185, 185])
    assert not np.array_equal(image[80, 80], obscured[80, 80])


def test_multiple_faces_get_independent_masks() -> None:
    image = np.full((160, 280, 3), 20, dtype=np.uint8)
    image[40:120, 30:110] = (80, 140, 210)
    image[40:120, 170:250] = (80, 140, 210)
    left = FaceDetection(
        box=(30, 40, 80, 80),
        score=0.9,
        landmarks=((50, 65), (90, 65), (70, 85), (55, 105), (85, 105)),
    )
    right = FaceDetection(
        box=(170, 40, 80, 80),
        score=0.88,
        landmarks=((190, 65), (230, 65), (210, 85), (195, 105), (225, 105)),
    )
    obscured = apply_face_obscure(
        image, [left.box, right.box], mode="blur", intensity="privacy", detections=[left, right]
    )
    assert not np.array_equal(image[80, 70], obscured[80, 70])
    assert not np.array_equal(image[80, 210], obscured[80, 210])
    assert np.array_equal(image[10, 140], obscured[10, 140])


async def test_debug_overlay_changes_pixels_only_when_enabled(tmp_path: Path) -> None:
    source = _face_source(tmp_path)
    plain = tmp_path / "plain.png"
    debug = tmp_path / "debug.png"
    await get_processor("blur-face").process([source], plain, context=_context(tmp_path))
    await get_processor("blur-face").process(
        [source], debug, context=_context(tmp_path, {"debug": True})
    )
    with Image.open(plain) as left, Image.open(debug) as right:
        assert left.size == right.size


def _changed_components(original: np.ndarray, obscured: np.ndarray, thresh: int = 14) -> int:
    delta = np.max(np.abs(original.astype(np.int16) - obscured.astype(np.int16)), axis=2)
    binary = (delta > thresh).astype(np.uint8)
    kernel = np.ones((3, 3), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    count, _labels = cv2.connectedComponents(binary)
    return int(count) - 1


def test_single_face_produces_one_blur_region() -> None:
    image = np.full((180, 180, 3), 24, dtype=np.uint8)
    yy, xx = np.ogrid[:180, :180]
    face = ((xx - 90) ** 2) / (42**2) + ((yy - 88) ** 2) / (52**2) <= 1
    image[face] = (88, 150, 210)
    detections = [
        FaceDetection(
            box=(48, 36, 84, 104),
            score=0.94,
            landmarks=((72, 78), (108, 78), (90, 98), (76, 118), (104, 118)),
        )
    ]
    obscured = apply_face_obscure(
        image, [detections[0].box], mode="blur", intensity="strong", detections=detections
    )
    assert _changed_components(image, obscured) == 1
    assert np.array_equal(image[8, 8], obscured[8, 8])


def test_light_medium_privacy_change_blur_strength() -> None:
    image = np.full((160, 160, 3), 30, dtype=np.uint8)
    yy, xx = np.ogrid[:160, :160]
    face = ((xx - 80) ** 2) / (48**2) + ((yy - 80) ** 2) / (58**2) <= 1
    image[face] = (90, 160, 220)
    image[70:90, 55:75] = (20, 20, 20)
    image[70:90, 85:105] = (20, 20, 20)
    box = (32, 22, 96, 116)
    light = apply_face_obscure(image, [box], mode="blur", intensity="light")
    medium = apply_face_obscure(image, [box], mode="blur", intensity="medium")
    privacy = apply_face_obscure(image, [box], mode="blur", intensity="privacy")

    def detail(frame: np.ndarray) -> float:
        return float(np.std(frame[50:110, 50:110].astype(np.float32)))

    assert detail(privacy) < detail(medium) < detail(light)
    assert np.array_equal(image[4, 4], privacy[4, 4])
