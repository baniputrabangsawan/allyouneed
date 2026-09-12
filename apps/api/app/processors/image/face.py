from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from math import hypot
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
_YUNET_MODEL = Path(__file__).with_name("data") / "face_detection_yunet_2023mar.onnx"
_MODES = {"blur", "pixelate"}
_INTENSITIES = {"light", "medium", "strong", "privacy"}
_MASK_EXPAND = {"light": 0.04, "medium": 0.07, "strong": 0.10, "privacy": 0.14}
_FEATHER_FRACTION = {"light": 0.012, "medium": 0.018, "strong": 0.024, "privacy": 0.03}
_SIGMA_FRACTION = {"light": 0.06, "medium": 0.12, "strong": 0.20, "privacy": 0.32}
_MIN_SIGMA = {"light": 4.0, "medium": 10.0, "strong": 20.0, "privacy": 36.0}
_PIXEL_FRACTION = {"light": 0.08, "medium": 0.14, "strong": 0.22, "privacy": 0.34}
_MIN_PIXEL_BLOCK = {"light": 6, "medium": 12, "strong": 20, "privacy": 32}
_INFERENCE_MAX_SIDE = 720
_MIN_SCORE = 0.62
_NMS_IOU = 0.3
_MIN_ASPECT = 0.55
_MAX_ASPECT = 1.7



@dataclass(frozen=True)
class FaceDetection:
    box: FaceBox
    score: float
    landmarks: tuple[Point, ...]


def load_oriented_image(source: Path) -> Image.Image:
    image = open_image(source)
    try:
        oriented = ImageOps.exif_transpose(image)
    except Exception:
        oriented = image.copy()
    return oriented


def clamp_box(
    x: int, y: int, width: int, height: int, image_width: int, image_height: int
) -> FaceBox:
    left = max(0, min(int(x), image_width))
    top = max(0, min(int(y), image_height))
    right = max(left, min(int(x + width), image_width))
    bottom = max(top, min(int(y + height), image_height))
    return left, top, right - left, bottom - top


def expand_face_box(
    box: FaceBox,
    image_width: int,
    image_height: int,
    *,
    factor: float,
) -> FaceBox:
    x, y, width, height = box
    pad_x = int(round(width * factor))
    pad_y = int(round(height * factor))
    return clamp_box(
        x - pad_x,
        y - pad_y,
        width + 2 * pad_x,
        height + 2 * pad_y,
        image_width,
        image_height,
    )


def parse_face_options(options: dict[str, object]) -> tuple[str, str]:
    mode = str(options.get("mode", "blur")).strip().lower() or "blur"
    if mode not in _MODES:
        raise ProcessingError("Invalid mode", code="INVALID_MODE")
    raw_intensity = options.get("intensity", options.get("preset", "strong"))
    intensity = str(raw_intensity).strip().lower() or "strong"
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
    cascade = _cascade("haarcascade_frontalface_default.xml")
    return _filter_boxes(_detect_with(cascade, prepared, gray.shape), gray.shape)



def detect_faces(gray: NDArray[np.uint8]) -> list[FaceBox]:
    return [item.box for item in detect_face_detections(gray)]


def detect_face_detections(image: GrayImage | BgrImage) -> list[FaceDetection]:
    if image.ndim == 2:
        gray = cast(GrayImage, image)
        bgr = cast(BgrImage, cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR))
    else:
        bgr = cast(BgrImage, image)
        gray = cast(GrayImage, cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
    image_height, image_width = gray.shape[:2]
    detections = _detect_yunet(bgr)
    if not detections:
        detections = _detect_haar(gray)
    return _nms(_filter_detections(detections, image_width, image_height))


def apply_face_obscure(
    bgr: BgrImage,
    boxes: list[FaceBox],
    *,
    mode: str,
    intensity: str = "strong",
    detections: list[FaceDetection] | None = None,
) -> BgrImage:
    image_height, image_width = bgr.shape[:2]
    expand = _MASK_EXPAND.get(intensity, _MASK_EXPAND["strong"])
    faces = detections if detections is not None else [
        FaceDetection(box=box, score=1.0, landmarks=tuple(_landmarks_from_box(box)))
        for box in boxes
    ]
    combined = np.zeros((image_height, image_width), dtype=np.uint8)
    face_width = 1
    for face in faces:
        hull = face_contour_hull(bgr, face.box, expand=expand, landmarks=face.landmarks)
        if hull is None:
            continue
        mask = _full_face_mask(bgr, hull, intensity)
        combined = np.maximum(combined, mask)
        face_width = max(face_width, face.box[2], int(cv2.boundingRect(hull)[2]))
    if int(combined.max()) == 0:
        return bgr.copy()
    x, y, width, height = cv2.boundingRect(combined)
    x, y, width, height = _padded_bounds_box(
        x, y, width, height, image_width, image_height, intensity
    )
    if width < 2 or height < 2:
        return bgr.copy()
    source = bgr[y : y + height, x : x + width]
    local = combined[y : y + height, x : x + width]
    if mode == "pixelate":
        obscured = _pixelate(source, pixel_block_for_face(face_width, intensity=intensity))
    else:
        obscured = _gaussian_blur(source, blur_sigma_for_face(face_width, intensity=intensity))
    result = bgr.copy()
    result[y : y + height, x : x + width] = _composite(source, obscured, local)
    return result


def face_contour_hull(
    bgr: BgrImage,
    box: FaceBox,
    *,
    expand: float,
    landmarks: tuple[Point, ...] | None = None,
) -> Polygon | None:
    image_height, image_width = bgr.shape[:2]
    points = list(landmarks) if landmarks and len(landmarks) >= 5 else _landmarks_from_box(box)
    polygon = _face_polygon_from_landmarks(points, image_width, image_height)
    if len(polygon) < 3:
        return None
    contour = np.array(polygon, dtype=np.int32)
    scaled = _scale_polygon(contour, expand, image_width, image_height)
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
        detections = detect_face_detections(bgr)
        if not detections:
            raise ProcessingError("No face detected", code="NO_FACES_DETECTED")
        obscured = apply_face_obscure(
            bgr,
            [item.box for item in detections],
            mode=mode,
            intensity=intensity,
            detections=detections,
        )
        if _debug_enabled(options):
            obscured = _debug_overlay(obscured, detections, intensity)
        saved = save_image(bgr_to_image(obscured), output, options)
        return {**saved, "faces": len(detections), "mode": mode, "intensity": intensity}
    finally:
        image.close()


def scale_to_original(
    x: float,
    y: float,
    *,
    original_width: int,
    original_height: int,
    inference_width: int,
    inference_height: int,
) -> Point:
    if inference_width <= 0 or inference_height <= 0:
        return (int(round(x)), int(round(y)))
    return (
        int(round(x * original_width / inference_width)),
        int(round(y * original_height / inference_height)),
    )


def _detect_yunet(bgr: BgrImage) -> list[FaceDetection]:
    if not _YUNET_MODEL.is_file() or not hasattr(cv2, "FaceDetectorYN_create"):
        return []
    original_height, original_width = bgr.shape[:2]
    small, scale = _inference_image(bgr)
    inf_h, inf_w = small.shape[:2]
    try:
        detector = cv2.FaceDetectorYN_create(
            str(_YUNET_MODEL), "", (inf_w, inf_h), _MIN_SCORE, _NMS_IOU, 5000
        )
        detector.setInputSize((inf_w, inf_h))
        _retval, faces = detector.detect(small)
    except cv2.error:
        return []
    if faces is None or len(faces) == 0:
        return []
    detections: list[FaceDetection] = []
    for row in faces:
        values = [float(item) for item in row]
        if len(values) < 15:
            continue
        x, y, width, height = values[0], values[1], values[2], values[3]
        score = values[14]
        origin = scale_to_original(
            x,
            y,
            original_width=original_width,
            original_height=original_height,
            inference_width=inf_w,
            inference_height=inf_h,
        )
        box = clamp_box(
            origin[0],
            origin[1],
            int(round(width / scale)),
            int(round(height / scale)),
            original_width,
            original_height,
        )
        landmarks = tuple(
            scale_to_original(
                values[4 + index * 2],
                values[5 + index * 2],
                original_width=original_width,
                original_height=original_height,
                inference_width=inf_w,
                inference_height=inf_h,
            )
            for index in range(5)
        )
        detections.append(FaceDetection(box=box, score=float(score), landmarks=landmarks))
    return detections


def _detect_haar(gray: GrayImage) -> list[FaceDetection]:
    prepared = _prepared_gray(gray)
    boxes = _filter_boxes(
        _detect_with(
            _cascade("haarcascade_frontalface_default.xml"),
            prepared,
            gray.shape,
            neighbors=6,
        ),
        gray.shape,
    )
    return [
        FaceDetection(box=box, score=0.55, landmarks=tuple(_landmarks_from_box(box)))
        for box in boxes
    ]


def _filter_detections(
    detections: list[FaceDetection],
    image_width: int,
    image_height: int,
) -> list[FaceDetection]:
    min_side = max(24, int(min(image_width, image_height) * 0.04))
    min_area = max(24 * 24, int(image_width * image_height * 0.002))
    kept: list[FaceDetection] = []
    for face in detections:
        x, y, width, height = face.box
        if face.score < 0.54:
            continue
        if width < min_side or height < min_side or width * height < min_area:
            continue
        aspect = width / height if height else 0.0
        if aspect < _MIN_ASPECT or aspect > _MAX_ASPECT:
            continue
        if not _landmarks_valid(face.landmarks, face.box, image_width, image_height):
            continue
        kept.append(face)
    return kept

def _filter_boxes(boxes: list[FaceBox], shape: tuple[int, ...]) -> list[FaceBox]:
    height, width = int(shape[0]), int(shape[1])
    min_side = max(24, int(min(width, height) * 0.04))
    min_area = max(24 * 24, int(width * height * 0.002))
    filtered: list[FaceBox] = []
    for x, y, box_w, box_h in boxes:
        if box_w < min_side or box_h < min_side or box_w * box_h < min_area:
            continue
        aspect = box_w / box_h if box_h else 0.0
        if aspect < _MIN_ASPECT or aspect > _MAX_ASPECT:
            continue
        filtered.append((x, y, box_w, box_h))
    return filtered


def _landmarks_valid(
    landmarks: tuple[Point, ...],
    box: FaceBox,
    image_width: int,
    image_height: int,
) -> bool:
    if len(landmarks) < 5:
        return False
    x, y, width, height = expand_face_box(box, image_width, image_height, factor=0.25)
    inside = 0
    for px, py in landmarks:
        if px < 0 or py < 0 or px >= image_width or py >= image_height:
            continue
        if x <= px <= x + width and y <= py <= y + height:
            inside += 1
    return inside >= 4


def _landmarks_from_box(box: FaceBox) -> list[Point]:
    x, y, width, height = box
    return [
        (x + int(0.30 * width), y + int(0.38 * height)),
        (x + int(0.70 * width), y + int(0.38 * height)),
        (x + int(0.50 * width), y + int(0.55 * height)),
        (x + int(0.36 * width), y + int(0.74 * height)),
        (x + int(0.64 * width), y + int(0.74 * height)),
    ]


def _face_polygon_from_landmarks(
    landmarks: list[Point] | tuple[Point, ...],
    image_width: int,
    image_height: int,
) -> list[Point]:
    if len(landmarks) < 5:
        return []
    right_eye = np.array(landmarks[0], dtype=np.float64)
    left_eye = np.array(landmarks[1], dtype=np.float64)
    nose = np.array(landmarks[2], dtype=np.float64)
    mouth_right = np.array(landmarks[3], dtype=np.float64)
    mouth_left = np.array(landmarks[4], dtype=np.float64)
    eye_mid = (right_eye + left_eye) * 0.5
    mouth_mid = (mouth_right + mouth_left) * 0.5
    eye_span = hypot(*(left_eye - right_eye)) or 1.0
    vertical = mouth_mid - eye_mid
    down_len = hypot(*vertical) or 1.0
    down = vertical / down_len
    across = left_eye - right_eye
    right = across / (hypot(*across) or 1.0)
    face_height = max(eye_span * 1.65, down_len * 2.2)
    face_width = max(eye_span * 1.75, hypot(*(mouth_left - mouth_right)) * 1.7)
    forehead = eye_mid - down * (0.40 * face_height)
    chin = mouth_mid + down * (0.40 * face_height)
    raw = [
        forehead - right * (0.28 * face_width),
        forehead,
        forehead + right * (0.28 * face_width),
        eye_mid + right * (0.48 * face_width) - down * (0.02 * face_height),
        nose + right * (0.50 * face_width) + down * (0.04 * face_height),
        mouth_left + right * (0.10 * face_width) + down * (0.18 * face_height),
        chin,
        mouth_right - right * (0.10 * face_width) + down * (0.18 * face_height),
        nose - right * (0.50 * face_width) + down * (0.04 * face_height),
        eye_mid - right * (0.48 * face_width) - down * (0.02 * face_height),
    ]
    points: list[Point] = []
    for point in raw:
        points.append(
            (
                int(np.clip(round(float(point[0])), 0, max(0, image_width - 1))),
                int(np.clip(round(float(point[1])), 0, max(0, image_height - 1))),
            )
        )
    return points


def _full_face_mask(bgr: BgrImage, hull: Polygon, intensity: str) -> GrayImage:
    image_height, image_width = bgr.shape[:2]
    polygon = np.zeros((image_height, image_width), dtype=np.uint8)
    cv2.fillPoly(polygon, [hull.reshape(-1, 1, 2)], 255)
    refined = _refine_with_grabcut(bgr, hull, polygon)
    face_w = max(8, int(cv2.boundingRect(hull)[2]))
    kernel = _feather_kernel(face_w, face_w, intensity)
    return cast(GrayImage, cv2.GaussianBlur(refined, (kernel, kernel), 0))


def _refine_with_grabcut(bgr: BgrImage, hull: Polygon, polygon: GrayImage) -> GrayImage:
    image_height, image_width = bgr.shape[:2]
    x, y, width, height = _padded_bounds(hull, image_width, image_height, "light")
    if width < 24 or height < 24:
        return polygon
    roi = bgr[y : y + height, x : x + width]
    gc = np.full((height, width), cv2.GC_BGD, dtype=np.uint8)
    origin = np.array([x, y], dtype=np.int32)
    expanded = _scale_polygon(hull, 0.06, image_width, image_height).reshape(-1, 2) - origin
    core = _scale_polygon(hull, -0.16, image_width, image_height).reshape(-1, 2) - origin
    if expanded.shape[0] >= 3:
        cv2.fillPoly(gc, [expanded.reshape(-1, 1, 2)], cv2.GC_PR_FGD)
    if core.shape[0] >= 3:
        cv2.fillPoly(gc, [core.reshape(-1, 1, 2)], cv2.GC_FGD)
    try:
        cv2.grabCut(
            roi,
            gc,
            None,
            np.zeros((1, 65), np.float64),
            np.zeros((1, 65), np.float64),
            3,
            cv2.GC_INIT_WITH_MASK,
        )
    except cv2.error:
        return polygon
    fg = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    allowed = np.zeros((height, width), dtype=np.uint8)
    if expanded.shape[0] >= 3:
        cv2.fillPoly(allowed, [expanded.reshape(-1, 1, 2)], 255)
    fg = cv2.bitwise_and(fg, allowed)
    sure = polygon[y : y + height, x : x + width]
    fg = np.maximum(fg, sure)
    full = polygon.copy()
    full[y : y + height, x : x + width] = fg
    return cast(GrayImage, full)


def _padded_bounds_box(
    x: int,
    y: int,
    width: int,
    height: int,
    image_width: int,
    image_height: int,
    intensity: str,
) -> FaceBox:
    pad = _feather_kernel(width, height, intensity) + 2
    return clamp_box(x - pad, y - pad, width + 2 * pad, height + 2 * pad, image_width, image_height)





def _inference_image(bgr: BgrImage) -> tuple[BgrImage, float]:
    height, width = bgr.shape[:2]
    scale = min(1.0, _INFERENCE_MAX_SIDE / max(width, height))
    if scale >= 1.0:
        return bgr, 1.0
    resized = cv2.resize(
        bgr,
        (max(1, int(width * scale)), max(1, int(height * scale))),
        interpolation=cv2.INTER_AREA,
    )
    return cast(BgrImage, resized), scale


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


def _scale_polygon(
    points: NDArray[np.integer],
    factor: float,
    image_width: int,
    image_height: int,
) -> Polygon:
    pts = points.reshape(-1, 2).astype(np.float32)
    center = pts.mean(axis=0)
    scaled = center + (pts - center) * (1.0 + factor)
    scaled[:, 0] = np.clip(scaled[:, 0], 0, max(0, image_width - 1))
    scaled[:, 1] = np.clip(scaled[:, 1], 0, max(0, image_height - 1))
    return np.round(scaled).astype(np.int32)


def _feather_kernel(width: int, height: int, intensity: str) -> int:
    fraction = _FEATHER_FRACTION.get(intensity, _FEATHER_FRACTION["strong"])
    radius = int(round(max(width, height) * fraction))
    kernel = max(3, min(radius * 2 + 1, int(min(width, height) * 0.12)))
    return kernel if kernel % 2 == 1 else kernel + 1


def _prepared_gray(gray: NDArray[np.uint8]) -> GrayImage:
    return cast(GrayImage, cv2.equalizeHist(gray))


def _detect_with(
    cascade: cv2.CascadeClassifier | None,
    gray: GrayImage,
    shape: tuple[int, ...],
    *,
    min_size: tuple[int, int] = (30, 30),
    neighbors: int = 6,
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


def _nms(detections: list[FaceDetection], threshold: float = _NMS_IOU) -> list[FaceDetection]:
    ordered = sorted(
        detections,
        key=lambda item: (item.score, item.box[2] * item.box[3]),
        reverse=True,
    )
    kept: list[FaceDetection] = []
    for item in ordered:
        if all(
            _iou(item.box, other.box) < threshold and not _centers_too_close(item.box, other.box)
            for other in kept
        ):
            kept.append(item)
    return kept


def _centers_too_close(left: FaceBox, right: FaceBox) -> bool:
    ax, ay, aw, ah = left
    bx, by, bw, bh = right
    dx = (ax + aw / 2) - (bx + bw / 2)
    dy = (ay + ah / 2) - (by + bh / 2)
    limit = 0.45 * min(hypot(aw, ah), hypot(bw, bh))
    return hypot(dx, dy) < limit



def _iou(left: FaceBox, right: FaceBox) -> float:
    ax, ay, aw, ah = left
    bx, by, bw, bh = right
    x0, y0 = max(ax, bx), max(ay, by)
    x1, y1 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    overlap = max(0, x1 - x0) * max(0, y1 - y0)
    union = aw * ah + bw * bh - overlap
    return overlap / union if union else 0.0


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


def _debug_enabled(options: dict[str, object]) -> bool:
    if not bool(options.get("debug")):
        return False
    try:
        from app.core.config import get_settings

        return get_settings().app_env != "production"
    except Exception:
        return True


def _debug_overlay(bgr: BgrImage, detections: list[FaceDetection], intensity: str) -> BgrImage:
    overlay = bgr.copy()
    expand = _MASK_EXPAND.get(intensity, _MASK_EXPAND["strong"])
    image_height, image_width = overlay.shape[:2]
    for face in detections:
        x, y, width, height = face.box
        cv2.rectangle(overlay, (x, y), (x + width, y + height), (80, 220, 80), 1)
        for px, py in face.landmarks:
            cv2.circle(overlay, (px, py), 2, (40, 40, 240), -1)
        hull = face_contour_hull(bgr, face.box, expand=expand, landmarks=face.landmarks)
        if hull is not None:
            cv2.polylines(overlay, [hull], True, (40, 220, 220), 1)
            bx, by, bw, bh = cv2.boundingRect(hull)
            cv2.rectangle(overlay, (bx, by), (bx + bw, by + bh), (220, 180, 40), 1)
        cv2.putText(
            overlay,
            f"{face.score:.2f}",
            (x, max(12, y - 4)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            (240, 240, 240),
            1,
            cv2.LINE_AA,
        )
    return overlay


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
