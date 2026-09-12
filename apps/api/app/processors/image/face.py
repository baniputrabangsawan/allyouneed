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
BgrImage = NDArray[np.uint8]
GrayImage = NDArray[np.uint8]

_VENDORED_CASCADE = Path(__file__).with_name("data") / "haarcascade_frontalface_default.xml"
_MODES = {"blur", "pixelate"}
_INTENSITIES = {"light", "medium", "strong", "privacy"}
_EXPAND = {"light": 0.20, "medium": 0.24, "strong": 0.28, "privacy": 0.38}
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


@lru_cache(maxsize=1)
def _frontal_cascade() -> cv2.CascadeClassifier:
    path = _cascade_path()
    classifier = cv2.CascadeClassifier(path)
    if classifier.empty():
        raise ProcessingError("Haar cascade could not be loaded.")
    return classifier


def detect_frontal_faces(gray: NDArray[np.uint8]) -> list[FaceBox]:
    height, width = gray.shape[:2]
    detected = _frontal_cascade().detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )
    boxes = [clamp_box(int(x), int(y), int(w), int(h), width, height) for x, y, w, h in detected]
    return [box for box in boxes if box[2] > 0 and box[3] > 0]


def apply_face_obscure(
    bgr: BgrImage,
    boxes: list[FaceBox],
    *,
    mode: str,
    intensity: str = "strong",
) -> BgrImage:
    result = bgr.copy()
    image_height, image_width = result.shape[:2]
    factor = _EXPAND.get(intensity, _EXPAND["strong"])
    for box in boxes:
        x, y, width, height = expand_face_box(box, image_width, image_height, factor=factor)
        if width < 2 or height < 2:
            continue
        roi = result[y : y + height, x : x + width]
        if roi.size == 0:
            continue
        mask = _feathered_round_rect_mask(width, height)
        if mode == "pixelate":
            obscured = _pixelate(roi, pixel_block_for_face(width, intensity=intensity))
        else:
            obscured = _gaussian_blur(roi, blur_sigma_for_face(width, intensity=intensity))
        result[y : y + height, x : x + width] = _composite(roi, obscured, mask)
    return result


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
        boxes = detect_frontal_faces(gray)
        if not boxes:
            raise ProcessingError("No face detected", code="NO_FACES_DETECTED")
        obscured = apply_face_obscure(bgr, boxes, mode=mode, intensity=intensity)
        saved = save_image(bgr_to_image(obscured), output, options)
        return {**saved, "faces": len(boxes), "mode": mode, "intensity": intensity}
    finally:
        image.close()


def _feathered_round_rect_mask(width: int, height: int) -> GrayImage:
    mask = np.zeros((height, width), dtype=np.uint8)
    radius = max(4, int(min(width, height) * 0.10))
    _fill_round_rect(mask, radius)
    feather = max(3, int(min(width, height) * 0.04))
    kernel = feather if feather % 2 == 1 else feather + 1
    return cast(GrayImage, cv2.GaussianBlur(mask, (kernel, kernel), 0))


def _fill_round_rect(mask: GrayImage, radius: int) -> None:
    height, width = mask.shape[:2]
    radius = max(1, min(int(radius), width // 2, height // 2))
    cv2.rectangle(mask, (radius, 0), (width - radius, height), 255, -1)
    cv2.rectangle(mask, (0, radius), (width, height - radius), 255, -1)
    cv2.circle(mask, (radius, radius), radius, 255, -1)
    cv2.circle(mask, (width - 1 - radius, radius), radius, 255, -1)
    cv2.circle(mask, (radius, height - 1 - radius), radius, 255, -1)
    cv2.circle(mask, (width - 1 - radius, height - 1 - radius), radius, 255, -1)


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


def _cascade_path() -> str:
    packaged = getattr(getattr(cv2, "data", None), "haarcascades", None)
    if packaged:
        candidate = Path(packaged) / "haarcascade_frontalface_default.xml"
        if candidate.is_file():
            return str(candidate)
    if _VENDORED_CASCADE.is_file():
        return str(_VENDORED_CASCADE)
    raise ProcessingError("Haar cascade is not installed.")
