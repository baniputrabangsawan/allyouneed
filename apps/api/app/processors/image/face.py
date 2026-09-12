from functools import lru_cache
from pathlib import Path
from typing import cast

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image, ImageOps

from app.processors.base import ProcessingError
from app.processors.image.ops import open_image, save_image

FaceBox = tuple[int, int, int, int]
Point = tuple[int, int]
BgrImage = NDArray[np.uint8]
GrayImage = NDArray[np.uint8]
Polygon = NDArray[np.int32]

_VENDORED_CASCADE = Path(__file__).with_name("data") / "haarcascade_frontalface_default.xml"
_MODES = {"blur", "pixelate"}
_INTENSITIES = {"light", "medium", "strong", "privacy"}
_SEARCH_EXPAND = 0.22
_MASK_EXPAND = {"light": 0.08, "medium": 0.10, "strong": 0.12, "privacy": 0.15}
_FEATHER = {"light": 6, "medium": 9, "strong": 12, "privacy": 16}
_SIGMA_FRACTION = {"light": 0.06, "medium": 0.12, "strong": 0.20, "privacy": 0.32}
_MIN_SIGMA = {"light": 4.0, "medium": 10.0, "strong": 20.0, "privacy": 36.0}
_PIXEL_FRACTION = {"light": 0.08, "medium": 0.14, "strong": 0.22, "privacy": 0.34}
_MIN_PIXEL_BLOCK = {"light": 6, "medium": 12, "strong": 20, "privacy": 32}


def load_oriented_image(source: Path) -> Image.Image:
    image = open_image(source)
    oriented = ImageOps.exif_transpose(image)
    if oriented is not image:
        image.close()
    return oriented


def clamp_box(
    x: int, y: int, width: int, height: int, image_width: int, image_height: int
) -> FaceBox:
    left = max(0, min(int(x), image_width))
    top = max(0, min(int(y), image_height))
    right = max(left, min(int(x) + int(width), image_width))
    bottom = max(top, min(int(y) + int(height), image_height))
    return left, top, right - left, bottom - top


def expand_face_box(
    box: FaceBox,
    image_width: int,
    image_height: int,
    *,
    factor: float,
) -> FaceBox:
    x, y, width, height = box
    pad_x = max(1, int(round(width * factor / 2)))
    pad_top = max(1, int(round(height * factor * 0.70)))
    pad_bottom = max(1, int(round(height * factor * 0.55)))
    return clamp_box(
        x - pad_x,
        y - pad_top,
        width + 2 * pad_x,
        height + pad_top + pad_bottom,
        image_width,
        image_height,
    )


def parse_face_options(options: dict[str, object]) -> tuple[str, str]:
    mode = str(options.get("mode", "blur")).strip().lower() or "blur"
    if mode not in _MODES:
        raise ProcessingError("Invalid mode.")
    raw = options.get("intensity", options.get("preset", "strong"))
    intensity = str(raw).strip().lower() or "strong"
    if intensity not in _INTENSITIES:
        intensity = "strong"
    return mode, intensity


def blur_sigma_for_face(face_width: int, *, intensity: str) -> float:
    fraction = _SIGMA_FRACTION.get(intensity, _SIGMA_FRACTION["strong"])
    minimum = _MIN_SIGMA.get(intensity, _MIN_SIGMA["strong"])
    return max(minimum, float(face_width) * fraction)


def pixel_block_for_face(face_width: int, *, intensity: str) -> int:
    fraction = _PIXEL_FRACTION.get(intensity, _PIXEL_FRACTION["strong"])
    minimum = _MIN_PIXEL_BLOCK.get(intensity, _MIN_PIXEL_BLOCK["strong"])
    return max(minimum, int(round(face_width * fraction)))


def detect_frontal_faces(gray: NDArray[np.uint8]) -> list[FaceBox]:
    prepared = _prepared_gray(gray)
    return _detect_with(_cascade("haarcascade_frontalface_default.xml"), prepared, gray.shape)


def detect_faces(gray: NDArray[np.uint8]) -> list[FaceBox]:
    height, width = gray.shape[:2]
    prepared = _prepared_gray(gray)
    boxes = detect_frontal_faces(gray)
    profile = _cascade("haarcascade_profileface.xml")
    if profile is not None:
        boxes.extend(_detect_with(profile, prepared, gray.shape, min_size=(24, 24)))
        flipped = cv2.flip(prepared, 1)
        for x, y, box_width, box_height in _detect_with(
            profile, flipped, gray.shape, min_size=(24, 24)
        ):
            boxes.append((width - x - box_width, y, box_width, box_height))
    return _nms(boxes)


def apply_face_obscure(
    bgr: BgrImage,
    boxes: list[FaceBox],
    *,
    mode: str,
    intensity: str = "strong",
) -> BgrImage:
    result = bgr.copy()
    image_height, image_width = result.shape[:2]
    expand = _MASK_EXPAND.get(intensity, _MASK_EXPAND["strong"])
    for box in boxes:
        hull = face_contour_hull(bgr, box, expand=expand)
        if hull is None:
            continue
        x, y, width, height = _padded_bounds(hull, image_width, image_height, intensity)
        if width < 2 or height < 2:
            continue
        roi = result[y : y + height, x : x + width]
        source = bgr[y : y + height, x : x + width]
        if roi.size == 0 or source.size == 0:
            continue
        mask = _feathered_polygon_mask((width, height), hull, origin=(x, y), intensity=intensity)
        if mode == "pixelate":
            obscured = _pixelate(source, pixel_block_for_face(width, intensity=intensity))
        else:
            obscured = _gaussian_blur(source, blur_sigma_for_face(width, intensity=intensity))
        result[y : y + height, x : x + width] = _composite(roi, obscured, mask)
    return result


def face_contour_hull(
    bgr: BgrImage,
    box: FaceBox,
    *,
    expand: float,
) -> Polygon | None:
    image_height, image_width = bgr.shape[:2]
    points = _landmark_points(bgr, box)
    if len(points) < 3:
        return None
    hull = cv2.convexHull(np.array(points, dtype=np.int32))
    scaled = _scale_polygon(hull, expand, image_width, image_height)
    if scaled.shape[0] < 3:
        return None
    return scaled


def image_to_bgr(image: Image.Image) -> BgrImage:
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    return cast(BgrImage, cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))


def bgr_to_image(bgr: BgrImage) -> Image.Image:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def blur_faces(source: Path, output: Path, options: dict[str, object]) -> dict[str, int | str]:
    mode, intensity = parse_face_options(options)
    image = load_oriented_image(source)
    try:
        bgr = image_to_bgr(image)
        gray = cast(GrayImage, cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
        boxes = detect_faces(gray)
        if not boxes:
            raise ProcessingError("No face detected", code="NO_FACES_DETECTED")
        obscured = apply_face_obscure(bgr, boxes, mode=mode, intensity=intensity)
        saved = save_image(bgr_to_image(obscured), output, options)
        return {**saved, "faces": len(boxes), "mode": mode, "intensity": intensity}
    finally:
        image.close()


def _landmark_points(bgr: BgrImage, box: FaceBox) -> list[Point]:
    image_height, image_width = bgr.shape[:2]
    points = _face_scaffold(box)
    search = expand_face_box(box, image_width, image_height, factor=_SEARCH_EXPAND)
    x, y, width, height = search
    if width < 8 or height < 8:
        return points
    roi = bgr[y : y + height, x : x + width]
    gray = cast(GrayImage, cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY))
    prepared = _prepared_gray(gray)
    points.extend(_offset_points(_eye_points(prepared, width, height), x, y))
    points.extend(_offset_points(_mouth_points(prepared, width, height), x, y))
    points.extend(_offset_points(_skin_contour_points(roi), x, y))
    return _unique_points(points, image_width, image_height)


def _face_scaffold(box: FaceBox) -> list[Point]:
    x, y, width, height = box
    return [
        (x + int(0.22 * width), y + int(0.10 * height)),
        (x + int(0.50 * width), y + int(0.04 * height)),
        (x + int(0.78 * width), y + int(0.10 * height)),
        (x + int(0.96 * width), y + int(0.36 * height)),
        (x + int(0.93 * width), y + int(0.58 * height)),
        (x + int(0.74 * width), y + int(0.88 * height)),
        (x + int(0.50 * width), y + int(0.99 * height)),
        (x + int(0.26 * width), y + int(0.88 * height)),
        (x + int(0.07 * width), y + int(0.58 * height)),
        (x + int(0.04 * width), y + int(0.36 * height)),
    ]


def _eye_points(gray: GrayImage, width: int, height: int) -> list[Point]:
    cascade = _cascade("haarcascade_eye.xml")
    if cascade is None:
        return []
    upper = gray[: max(8, int(height * 0.65))]
    min_side = max(8, int(min(width, height) * 0.12))
    points: list[Point] = []
    for ex, ey, eye_w, eye_h in _raw_detect(cascade, upper, (min_side, min_side), neighbors=4):
        points.extend(
            (
                (ex, ey),
                (ex + eye_w, ey),
                (ex, ey + eye_h),
                (ex + eye_w, ey + eye_h),
                (ex + eye_w // 2, max(0, ey - max(2, eye_h // 2))),
            )
        )
    return points


def _mouth_points(gray: GrayImage, width: int, height: int) -> list[Point]:
    cascade = _cascade("haarcascade_smile.xml")
    if cascade is None:
        return []
    top = int(height * 0.48)
    lower = gray[top:]
    if lower.size == 0:
        return []
    min_w = max(10, int(width * 0.22))
    min_h = max(8, int(height * 0.10))
    points: list[Point] = []
    for mx, my, mouth_w, mouth_h in _raw_detect(cascade, lower, (min_w, min_h), neighbors=18):
        my += top
        chin = my + mouth_h + max(2, mouth_h // 3)
        points.extend(
            (
                (mx, my + mouth_h),
                (mx + mouth_w, my + mouth_h),
                (mx + mouth_w // 2, chin),
            )
        )
    return points


def _skin_contour_points(roi: BgrImage) -> list[Point]:
    if roi.size == 0:
        return []
    ycrcb = cv2.cvtColor(roi, cv2.COLOR_BGR2YCrCb)
    skin = cv2.inRange(ycrcb, (0, 133, 77), (255, 173, 127))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    skin = cv2.morphologyEx(skin, cv2.MORPH_OPEN, kernel)
    skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(skin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    largest = max(contours, key=cv2.contourArea)
    area = float(cv2.contourArea(largest))
    roi_area = float(roi.shape[0] * roi.shape[1])
    if area < 0.12 * roi_area:
        return []
    bx, by, bw, bh = cv2.boundingRect(largest)
    if bw * bh > 0.88 * roi_area:
        return []
    peri = cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, max(1.0, 0.012 * peri), True)
    if len(approx) < 6:
        return []
    return [(int(px), int(py)) for px, py in approx.reshape(-1, 2)]


def _feathered_polygon_mask(
    size: tuple[int, int],
    hull: Polygon,
    *,
    origin: tuple[int, int],
    intensity: str,
) -> GrayImage:
    width, height = size
    mask = np.zeros((height, width), dtype=np.uint8)
    shifted = hull.reshape(-1, 2) - np.array(origin, dtype=np.int32)
    if shifted.shape[0] < 3:
        return cast(GrayImage, mask)
    cv2.fillConvexPoly(mask, shifted, 255)
    kernel = _feather_kernel(width, height, intensity)
    return cast(GrayImage, cv2.GaussianBlur(mask, (kernel, kernel), 0))


def _padded_bounds(
    hull: Polygon,
    image_width: int,
    image_height: int,
    intensity: str,
) -> FaceBox:
    x, y, width, height = cv2.boundingRect(hull)
    pad = _feather_kernel(width, height, intensity) + 2
    return clamp_box(x - pad, y - pad, width + 2 * pad, height + 2 * pad, image_width, image_height)


def _scale_polygon(points: NDArray[np.integer], factor: float, image_width: int, image_height: int) -> Polygon:
    pts = points.reshape(-1, 2).astype(np.float32)
    center = pts.mean(axis=0)
    scaled = center + (pts - center) * (1.0 + factor)
    scaled[:, 0] = np.clip(scaled[:, 0], 0, max(0, image_width - 1))
    scaled[:, 1] = np.clip(scaled[:, 1], 0, max(0, image_height - 1))
    return np.round(scaled).astype(np.int32)


def _feather_kernel(width: int, height: int, intensity: str) -> int:
    preset = _FEATHER.get(intensity, _FEATHER["strong"])
    capped = max(3, min(preset, int(min(width, height) * 0.18), 16))
    return capped if capped % 2 == 1 else capped + 1


def _prepared_gray(gray: NDArray[np.uint8]) -> GrayImage:
    return cast(GrayImage, cv2.equalizeHist(gray))


def _detect_with(
    cascade: cv2.CascadeClassifier | None,
    gray: GrayImage,
    shape: tuple[int, ...],
    *,
    min_size: tuple[int, int] = (30, 30),
    neighbors: int = 5,
) -> list[FaceBox]:
    if cascade is None:
        return []
    height, width = int(shape[0]), int(shape[1])
    boxes = [
        clamp_box(int(x), int(y), int(box_w), int(box_h), width, height)
        for x, y, box_w, box_h in _raw_detect(cascade, gray, min_size, neighbors=neighbors)
    ]
    return [box for box in boxes if box[2] > 0 and box[3] > 0]


def _raw_detect(
    cascade: cv2.CascadeClassifier,
    gray: GrayImage,
    min_size: tuple[int, int],
    *,
    neighbors: int,
) -> list[tuple[int, int, int, int]]:
    if gray.size == 0:
        return []
    detected = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=neighbors,
        minSize=min_size,
        flags=cv2.CASCADE_SCALE_IMAGE,
    )
    if detected is None or len(detected) == 0:
        return []
    return [(int(x), int(y), int(w), int(h)) for x, y, w, h in detected]


def _nms(boxes: list[FaceBox], threshold: float = 0.35) -> list[FaceBox]:
    ordered = sorted(boxes, key=lambda box: box[2] * box[3], reverse=True)
    kept: list[FaceBox] = []
    for box in ordered:
        if all(_iou(box, other) < threshold for other in kept):
            kept.append(box)
    return kept


def _iou(left: FaceBox, right: FaceBox) -> float:
    ax, ay, aw, ah = left
    bx, by, bw, bh = right
    x0, y0 = max(ax, bx), max(ay, by)
    x1, y1 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    overlap = max(0, x1 - x0) * max(0, y1 - y0)
    union = aw * ah + bw * bh - overlap
    return overlap / union if union else 0.0


def _offset_points(points: list[Point], x: int, y: int) -> list[Point]:
    return [(px + x, py + y) for px, py in points]


def _unique_points(points: list[Point], image_width: int, image_height: int) -> list[Point]:
    seen: set[Point] = set()
    unique: list[Point] = []
    for px, py in points:
        point = (max(0, min(px, image_width - 1)), max(0, min(py, image_height - 1)))
        if point in seen:
            continue
        seen.add(point)
        unique.append(point)
    return unique


def _gaussian_blur(roi: BgrImage, sigma: float) -> BgrImage:
    radius = max(1.0, float(sigma))
    return cast(BgrImage, cv2.GaussianBlur(roi, (0, 0), sigmaX=radius, sigmaY=radius))


def _pixelate(roi: BgrImage, block: int) -> BgrImage:
    height, width = roi.shape[:2]
    step = max(2, int(block))
    small_width = max(1, width // step)
    small_height = max(1, height // step)
    small = cv2.resize(roi, (small_width, small_height), interpolation=cv2.INTER_LINEAR)
    return cast(BgrImage, cv2.resize(small, (width, height), interpolation=cv2.INTER_NEAREST))


def _composite(original: BgrImage, obscured: BgrImage, mask: GrayImage) -> BgrImage:
    alpha = mask.astype(np.float32) / 255.0
    alpha = alpha[:, :, None]
    blended = obscured.astype(np.float32) * alpha + original.astype(np.float32) * (1.0 - alpha)
    return cast(BgrImage, np.clip(blended, 0, 255).astype(np.uint8))


@lru_cache(maxsize=8)
def _cascade(name: str) -> cv2.CascadeClassifier | None:
    packaged = getattr(getattr(cv2, "data", None), "haarcascades", None)
    candidates = []
    if packaged:
        candidates.append(Path(packaged) / name)
    if name == "haarcascade_frontalface_default.xml":
        candidates.append(_VENDORED_CASCADE)
    for path in candidates:
        if not path.is_file():
            continue
        classifier = cv2.CascadeClassifier(str(path))
        if not classifier.empty():
            return classifier
    if name == "haarcascade_frontalface_default.xml":
        raise ProcessingError("Haar cascade is not installed.")
    return None
