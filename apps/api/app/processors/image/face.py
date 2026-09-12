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

_VENDORED_CASCADE = Path(__file__).with_name("data") / "haarcascade_frontalface_default.xml"
_MODES = {"blur", "pixelate"}
_MAX_BLUR_STRENGTH = 20
_MAX_PIXELATE_BLOCK = 20


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


def parse_face_options(options: dict[str, object]) -> str:
    mode = str(options.get("mode", "blur")).strip().lower() or "blur"
    if mode not in _MODES:
        raise ProcessingError("Invalid mode.")
    return mode


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


def apply_face_obscure(bgr: BgrImage, boxes: list[FaceBox], *, mode: str) -> BgrImage:
    result = bgr.copy()
    for x, y, width, height in boxes:
        roi = result[y : y + height, x : x + width]
        if roi.size == 0:
            continue
        if mode == "pixelate":
            result[y : y + height, x : x + width] = _pixelate(roi, _MAX_PIXELATE_BLOCK)
        else:
            kernel = 2 * _MAX_BLUR_STRENGTH + 1
            result[y : y + height, x : x + width] = cv2.GaussianBlur(roi, (kernel, kernel), 0)
    return result


def image_to_bgr(image: Image.Image) -> BgrImage:
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    return cast(BgrImage, cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))


def bgr_to_image(bgr: BgrImage) -> Image.Image:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def blur_faces(source: Path, output: Path, options: dict[str, object]) -> dict[str, int | str]:
    mode = parse_face_options(options)
    image = load_oriented_image(source)
    try:
        bgr = image_to_bgr(image)
        gray = cast(BgrImage, cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
        boxes = detect_frontal_faces(gray)
        if not boxes:
            raise ProcessingError("No face detected", code="NO_FACES_DETECTED")
        obscured = apply_face_obscure(bgr, boxes, mode=mode)
        saved = save_image(bgr_to_image(obscured), output, options)
        return {**saved, "faces": len(boxes), "mode": mode}
    finally:
        image.close()


def _pixelate(roi: BgrImage, strength: int) -> BgrImage:
    height, width = roi.shape[:2]
    block = max(2, strength)
    small_width = max(1, width // block)
    small_height = max(1, height // block)
    small = cv2.resize(roi, (small_width, small_height), interpolation=cv2.INTER_LINEAR)
    return cast(BgrImage, cv2.resize(small, (width, height), interpolation=cv2.INTER_NEAREST))


def _cascade_path() -> str:
    packaged = getattr(getattr(cv2, "data", None), "haarcascades", None)
    if packaged:
        candidate = Path(packaged) / "haarcascade_frontalface_default.xml"
        if candidate.is_file():
            return str(candidate)
    if _VENDORED_CASCADE.is_file():
        return str(_VENDORED_CASCADE)
    raise ProcessingError("Haar cascade is not installed.")
