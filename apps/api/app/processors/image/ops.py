from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageOps

from app.core.config import get_settings
from app.processors.base import ProcessingError, integer

JPEG_TOOLS = {"convert-to-jpg", "png-to-jpg", "webp-to-jpg"}
PNG_TOOLS = {"jpg-to-png"}
WEBP_TOOLS = {"jpg-to-webp", "png-to-webp"}


def open_image(source: Path) -> Image.Image:
    with Image.open(source) as opened:
        opened.load()
        image = opened.copy()
    pixels = image.width * image.height
    if pixels > get_settings().max_image_pixels:
        raise ProcessingError("Image exceeds the megapixel limit.", code="OUT_OF_MEMORY")
    return image


def apply_image_op(tool_id: str, image: Image.Image, options: dict[str, Any]) -> Image.Image:
    if tool_id == "resize-image":
        return image.resize(
            (integer(options, "width", image.width), integer(options, "height", image.height))
        )
    if tool_id == "crop-image":
        left, top = integer(options, "left", 0, minimum=0), integer(options, "top", 0, minimum=0)
        return image.crop(
            (
                left,
                top,
                integer(options, "right", image.width),
                integer(options, "bottom", image.height),
            )
        )
    if tool_id == "rotate-image":
        return image.rotate(-integer(options, "rotation", 90), expand=True)
    if tool_id == "flip-image":
        return ImageOps.mirror(image) if options.get("horizontal", True) else ImageOps.flip(image)
    if tool_id == "image-enhancement":
        return ImageEnhance.Contrast(ImageEnhance.Sharpness(image).enhance(1.3)).enhance(1.1)
    if tool_id in {"thumbnail-generator", "favicon-generator"}:
        size = integer(options, "size", 256)
        image.thumbnail((size, size))
        return image
    if tool_id == "remove-metadata":
        return image.copy()
    return image


def save_image(image: Image.Image, output: Path, options: dict[str, Any]) -> dict[str, Any]:
    extension = output.suffix[1:].upper().replace("JPG", "JPEG")
    if extension == "JPEG" and image.mode not in {"RGB", "L"}:
        background = Image.new("RGB", image.size, options.get("background", "white"))
        if image.mode == "RGBA":
            background.paste(image, mask=image.getchannel("A"))
        else:
            background.paste(image.convert("RGB"))
        image = background
    image.save(output, format=extension, quality=integer(options, "quality", 80), optimize=True)
    return {"width": image.width, "height": image.height}
