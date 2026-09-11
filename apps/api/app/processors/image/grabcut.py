from pathlib import Path

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image

from app.processors.base import ProcessingError, integer
from app.processors.image.face import load_oriented_image

RgbImage = NDArray[np.uint8]
Mask = NDArray[np.uint8]
Rect = tuple[int, int, int, int]

_MAX_GRABCUT_EDGE = 640
_MIN_SIZE = 8


def default_foreground_rect(width: int, height: int) -> Rect:
    inset_x = max(1, round(width * 0.1))
    inset_y = max(1, round(height * 0.1))
    return inset_x, inset_y, max(1, width - inset_x * 2), max(1, height - inset_y * 2)


def parse_foreground_rect(options: dict[str, object], width: int, height: int) -> Rect:
    default_left, default_top, default_width, default_height = default_foreground_rect(
        width, height
    )
    left = integer(options, "left", default_left, minimum=0, maximum=max(0, width - 1))
    top = integer(options, "top", default_top, minimum=0, maximum=max(0, height - 1))
    rect_width = integer(options, "width", default_width, minimum=1, maximum=width)
    rect_height = integer(options, "height", default_height, minimum=1, maximum=height)
    if left + rect_width > width or top + rect_height > height:
        raise ProcessingError("Foreground box extends outside the image.")
    if rect_width < 2 or rect_height < 2:
        raise ProcessingError("Foreground box is too small.")
    return left, top, rect_width, rect_height


def grabcut_mask(rgb: RgbImage, rect: Rect) -> Mask:
    height, width = rgb.shape[:2]
    bgr = np.asarray(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), dtype=np.uint8)
    work, scale = _downscale(bgr)
    work_rect = _scale_rect(rect, scale, work.shape[1], work.shape[0])
    mask = np.zeros(work.shape[:2], dtype=np.uint8)
    background_model = np.zeros((1, 65), dtype=np.float64)
    foreground_model = np.zeros((1, 65), dtype=np.float64)
    try:
        cv2.grabCut(
            work,
            mask,
            work_rect,
            background_model,
            foreground_model,
            5,
            cv2.GC_INIT_WITH_RECT,
        )
    except cv2.error as exc:
        raise ProcessingError("GrabCut could not segment this image.") from exc
    binary = np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
        255,
        0,
    ).astype(np.uint8)
    if binary.shape[1] != width or binary.shape[0] != height:
        binary = np.asarray(
            cv2.resize(binary, (width, height), interpolation=cv2.INTER_LINEAR),
            dtype=np.uint8,
        )
    return binary


def refine_mask(mask: Mask) -> Mask:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)
    return np.asarray(cv2.GaussianBlur(closed, (5, 5), 0), dtype=np.uint8)


def apply_mask_as_alpha(rgb: RgbImage, mask: Mask) -> Image.Image:
    if mask.shape[:2] != rgb.shape[:2]:
        raise ProcessingError("Mask size must match the image.")
    rgba = np.dstack((rgb, mask))
    return Image.fromarray(rgba, mode="RGBA")


def remove_background_grabcut(
    source: Path, output: Path, options: dict[str, object]
) -> dict[str, int | str]:
    image = load_oriented_image(source)
    try:
        if image.width < _MIN_SIZE or image.height < _MIN_SIZE:
            raise ProcessingError("Image is too small for background removal.")
        rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
        rect = _inset_rect(
            parse_foreground_rect(options, image.width, image.height),
            image.width,
            image.height,
        )
        mask = refine_mask(grabcut_mask(rgb, rect))
        result = apply_mask_as_alpha(rgb, mask)
        if result.size != image.size:
            raise ProcessingError("Output dimensions must match the original image.")
        result.save(output, format="PNG", optimize=True)
        return {
            "width": result.width,
            "height": result.height,
            "method": "grabcut",
            "left": rect[0],
            "top": rect[1],
            "boxWidth": rect[2],
            "boxHeight": rect[3],
        }
    finally:
        image.close()


def _inset_rect(rect: Rect, width: int, height: int) -> Rect:
    left, top, rect_width, rect_height = rect
    left = min(max(1, left), max(1, width - 3))
    top = min(max(1, top), max(1, height - 3))
    right = min(width - 1, max(left + 2, left + rect_width))
    bottom = min(height - 1, max(top + 2, top + rect_height))
    if right - left < 2 or bottom - top < 2:
        raise ProcessingError("Foreground box is too small.")
    return left, top, right - left, bottom - top


def _downscale(bgr: RgbImage) -> tuple[RgbImage, float]:
    height, width = bgr.shape[:2]
    edge = max(height, width)
    if edge <= _MAX_GRABCUT_EDGE:
        return bgr, 1.0
    scale = _MAX_GRABCUT_EDGE / edge
    size = (max(2, int(round(width * scale))), max(2, int(round(height * scale))))
    resized = np.asarray(cv2.resize(bgr, size, interpolation=cv2.INTER_AREA), dtype=np.uint8)
    return resized, scale


def _scale_rect(rect: Rect, scale: float, width: int, height: int) -> Rect:
    left, top, rect_width, rect_height = rect
    scaled_left = max(0, min(int(round(left * scale)), width - 2))
    scaled_top = max(0, min(int(round(top * scale)), height - 2))
    scaled_width = max(2, min(int(round(rect_width * scale)), width - scaled_left))
    scaled_height = max(2, min(int(round(rect_height * scale)), height - scaled_top))
    return scaled_left, scaled_top, scaled_width, scaled_height
