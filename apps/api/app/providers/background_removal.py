from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol, cast

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
from app.processors.base import ProcessingError, ProcessorContext
from app.processors.image.face import load_oriented_image

Mask = NDArray[np.uint8]
Rgb = NDArray[np.uint8]

ERROR_UNSUPPORTED = "UNSUPPORTED_IMAGE"
ERROR_DECODE = "IMAGE_DECODE_FAILED"
ERROR_MODEL = "MODEL_UNAVAILABLE"
ERROR_FAILED = "BACKGROUND_REMOVAL_FAILED"
ERROR_EXPORT = "RESULT_EXPORT_FAILED"

MODES = {"fast", "quality"}
_MAX_INFERENCE_EDGE = {"fast": 768, "quality": 1024}
_MODEL_CACHE: dict[str, Any] = {}
_MODEL_LOCK = asyncio.Lock()
_AI_LOCK = asyncio.Lock()


class BackgroundRemovalProvider(Protocol):
    async def remove(
        self, source: Path, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]: ...


@dataclass(frozen=True)
class SegmentationResult:
    mask: Mask
    model: str


class SelfHostedBackgroundRemovalProvider:
    async def remove(
        self, source: Path, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]:
        mode = parse_mode(context.options)
        started = asyncio.get_running_loop().time()
        await context.report(None, "removing-background")
        image = _load_image(source)
        try:
            rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
            async with _AI_LOCK:
                segmentation = await _segment(rgb, mode)
            context.raise_if_cancelled()
            await context.report(None, "refining-edges")
            mask = refine_mask(segmentation.mask, rgb, mode=mode)
            result = apply_alpha(rgb, mask)
            if result.size != image.size:
                raise ProcessingError(
                    "Output dimensions must match the original image.", code=ERROR_EXPORT
                )
            await context.report(None, "finalizing")
            try:
                result.save(output, format="PNG", optimize=True)
            except OSError as exc:
                raise ProcessingError(
                    "Could not export the transparent PNG.", code=ERROR_EXPORT
                ) from exc
            elapsed_ms = round((asyncio.get_running_loop().time() - started) * 1000)
            return {
                "width": result.width,
                "height": result.height,
                "originalSize": source.stat().st_size,
                "mode": mode,
                "model": segmentation.model,
                "processingTimeMs": elapsed_ms,
                "alpha": "refined",
            }
        finally:
            image.close()


def parse_mode(options: dict[str, Any]) -> str:
    value = str(options.get("mode", "quality")).lower()
    if value not in MODES:
        raise ProcessingError("Removal quality must be fast or quality.", code="VALIDATION_ERROR")
    return value


async def _segment(rgb: Rgb, mode: str) -> SegmentationResult:
    model = await _load_model(mode)
    if not callable(model):
        raise ProcessingError(
            "Background removal model is unavailable on this server.", code=ERROR_MODEL
        )
    work, _ = _downscale(rgb, _MAX_INFERENCE_EDGE[mode])
    try:
        mask = await asyncio.to_thread(model, work)
    except Exception as exc:
        raise ProcessingError(
            "Background removal failed for this image.", code=ERROR_FAILED
        ) from exc
    return SegmentationResult(mask=_fit_mask(mask, rgb.shape[1], rgb.shape[0]), model=mode)


async def _load_model(mode: str) -> Any:
    async with _MODEL_LOCK:
        if mode in _MODEL_CACHE:
            return _MODEL_CACHE[mode]
        loader = _load_fast_model if mode == "fast" else _load_quality_model
        model = await asyncio.to_thread(loader)
        _MODEL_CACHE[mode] = model
        return model


def _load_fast_model() -> Any:
    try:
        from rembg import new_session, remove  # type: ignore[import-not-found]
    except ImportError:
        return None
    session = new_session("u2netp")

    def infer(rgb: Rgb) -> Mask:
        image = Image.fromarray(rgb, mode="RGB")
        result = remove(image, session=session, only_mask=True)
        return np.asarray(result.convert("L"), dtype=np.uint8)

    return infer


def _load_quality_model() -> Any:
    try:
        import torch  # type: ignore[import-not-found]
        from torchvision import transforms  # type: ignore[import-not-found]
        from transformers import AutoModelForImageSegmentation  # type: ignore[import-not-found]
    except ImportError:
        return None

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = AutoModelForImageSegmentation.from_pretrained(
        "ZhengPeng7/BiRefNet", trust_remote_code=True
    )
    model.to(device)
    model.eval()
    transform = transforms.Compose(
        [
            transforms.Resize((1024, 1024)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    def infer(rgb: Rgb) -> Mask:
        image = Image.fromarray(rgb, mode="RGB")
        tensor = transform(image).unsqueeze(0).to(device)
        with torch.no_grad():
            prediction = model(tensor)[-1].sigmoid().cpu()[0].squeeze()
        mask = transforms.ToPILImage()(prediction).resize(image.size, Image.Resampling.BILINEAR)
        return np.asarray(mask.convert("L"), dtype=np.uint8)

    return infer


def refine_mask(mask: Mask, rgb: Rgb, *, mode: str) -> Mask:
    fitted = _fit_mask(mask, rgb.shape[1], rgb.shape[0])
    threshold = 6 if mode == "quality" else 12
    binary = np.asarray(np.where(fitted > threshold, 255, 0), dtype=np.uint8)
    area = max(
        8,
        round(rgb.shape[0] * rgb.shape[1] * (0.0008 if mode == "quality" else 0.0015)),
    )
    clean = _remove_small_artifacts(binary, area)
    kernel_size = 3 if mode == "fast" else 5
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    closed = cv2.morphologyEx(clean, cv2.MORPH_CLOSE, kernel)
    uncertain = cv2.dilate(closed, kernel, iterations=1) - cv2.erode(closed, kernel, iterations=1)
    blur_size = 3 if mode == "fast" else 5
    softened = np.asarray(cv2.GaussianBlur(fitted, (blur_size, blur_size), 0), dtype=np.uint8)
    refined = np.where(uncertain > 0, softened, np.minimum(fitted, closed)).astype(np.uint8)
    return np.asarray(cv2.medianBlur(refined, 3), dtype=np.uint8)


def apply_alpha(rgb: Rgb, mask: Mask) -> Image.Image:
    if mask.shape[:2] != rgb.shape[:2]:
        raise ProcessingError("Mask size must match the image.", code=ERROR_EXPORT)
    return Image.fromarray(np.dstack((_decontaminate_edges(rgb, mask), mask)), mode="RGBA")


def _decontaminate_edges(rgb: Rgb, mask: Mask) -> Rgb:
    edge = (mask > 0) & (mask < 245)
    if not np.any(edge):
        return rgb
    foreground = np.where(mask[..., None] > 245, rgb, 0).astype(np.uint8)
    blurred = cv2.GaussianBlur(foreground, (0, 0), 2)
    result = rgb.copy()
    result[edge] = np.asarray(0.85 * rgb[edge] + 0.15 * blurred[edge], dtype=np.uint8)
    return result


def _load_image(source: Path) -> Image.Image:
    try:
        image = load_oriented_image(source)
    except (UnidentifiedImageError, OSError) as exc:
        raise ProcessingError("This image could not be decoded.", code=ERROR_DECODE) from exc
    if image.width < 8 or image.height < 8:
        image.close()
        raise ProcessingError("Image is too small for background removal.", code=ERROR_UNSUPPORTED)
    return image


def _fit_mask(mask: Any, width: int, height: int) -> Mask:
    array = np.asarray(mask, dtype=np.uint8)
    if array.ndim == 3:
        array = array[:, :, 0]
    if array.shape[:2] != (height, width):
        array = np.asarray(
            cv2.resize(array, (width, height), interpolation=cv2.INTER_LINEAR), dtype=np.uint8
        )
    return array


def _remove_small_artifacts(mask: Mask, min_area: int) -> Mask:
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    cleaned = np.zeros(mask.shape, dtype=np.uint8)
    for label in range(1, count):
        if int(stats[label, cv2.CC_STAT_AREA]) >= min_area:
            cleaned[labels == label] = 255
    return cleaned


def _fallback_mask(rgb: Rgb, mode: str) -> Mask:
    work, scale = _downscale(rgb, _MAX_INFERENCE_EDGE[mode])
    height, width = work.shape[:2]
    rect = (
        max(1, width // 12),
        max(1, height // 12),
        max(2, width * 5 // 6),
        max(2, height * 5 // 6),
    )
    mask = np.zeros((height, width), dtype=np.uint8)
    bgd = np.zeros((1, 65), dtype=np.float64)
    fgd = np.zeros((1, 65), dtype=np.float64)
    try:
        cv2.grabCut(
            cv2.cvtColor(work, cv2.COLOR_RGB2BGR),
            mask,
            rect,
            bgd,
            fgd,
            5 if mode == "fast" else 8,
            cv2.GC_INIT_WITH_RECT,
        )
    except cv2.error as exc:
        raise ProcessingError(
            "Background removal failed for this image.", code=ERROR_FAILED
        ) from exc
    binary = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    if scale != 1:
        binary = np.asarray(
            cv2.resize(binary, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LINEAR),
            dtype=np.uint8,
        )
    return binary


def _downscale(rgb: Rgb, max_edge: int) -> tuple[Rgb, float]:
    height, width = rgb.shape[:2]
    edge = max(height, width)
    if edge <= max_edge:
        return rgb, 1
    scale = max_edge / edge
    size = (max(2, round(width * scale)), max(2, round(height * scale)))
    return cast(Rgb, cv2.resize(rgb, size, interpolation=cv2.INTER_AREA)), scale


def get_background_removal_provider() -> BackgroundRemovalProvider:
    settings = get_settings()
    if settings.background_removal_provider != "selfhosted" or not settings.enable_self_hosted_ai:
        raise ProcessingError("Background removal model is unavailable.", code=ERROR_MODEL)
    return SelfHostedBackgroundRemovalProvider()
