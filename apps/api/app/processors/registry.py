from collections.abc import Callable

from app.processors.ai.generic import (
    BackgroundRemovalProcessor,
    SpeechToTextProcessor,
    TextToSpeechProcessor,
    UpscaleProcessor,
)
from app.processors.base import ProcessingError, Processor
from app.processors.html_to_image import HtmlToImageProcessor
from app.processors.image.basic_background import BasicBackgroundRemovalProcessor
from app.processors.image.blur_face import BlurFaceProcessor
from app.processors.image.generic import ImageProcessor
from app.processors.image.ops import JPEG_TOOLS, PNG_TOOLS, WEBP_TOOLS
from app.processors.media import MEDIA_TOOLS, MediaProcessor
from app.processors.ocr.generic import OcrProcessor
from app.processors.pdf.generic import PdfProcessor

IMAGE_TOOLS = (
    {
        "compress-image",
        "resize-image",
        "crop-image",
        "rotate-image",
        "flip-image",
        "convert-to-jpg",
        "convert-from-jpg",
        "image-converter",
        "jpg-to-png",
        "png-to-jpg",
        "jpg-to-webp",
        "png-to-webp",
        "webp-to-jpg",
        "remove-metadata",
        "image-enhancement",
        "thumbnail-generator",
        "favicon-generator",
        "blur-face",
        "basic-background-removal",
    }
    | JPEG_TOOLS
    | PNG_TOOLS
    | WEBP_TOOLS
)

PDF_TOOLS = {
    "compress-pdf",
    "merge-pdf",
    "split-pdf",
    "jpg-to-pdf",
    "png-to-pdf",
    "pdf-to-jpg",
    "pdf-to-png",
    "rotate-pdf",
    "delete-pdf-pages",
    "reorder-pdf-pages",
    "extract-pdf-pages",
    "watermark-pdf",
    "page-number-pdf",
    "protect-pdf",
    "unlock-pdf",
    "pdf-metadata-viewer",
    "pdf-to-text",
}

Factory = Callable[[], Processor]


def _image(tool_id: str) -> Factory:
    return lambda: ImageProcessor(tool_id)


def _pdf(tool_id: str) -> Factory:
    return lambda: PdfProcessor(tool_id)


def _media(tool_id: str) -> Factory:
    return lambda: MediaProcessor(tool_id)


processor_registry: dict[str, Factory] = {
    **{tool_id: _image(tool_id) for tool_id in IMAGE_TOOLS},
    **{tool_id: _pdf(tool_id) for tool_id in PDF_TOOLS},
    **{tool_id: _media(tool_id) for tool_id in MEDIA_TOOLS},
    "blur-face": BlurFaceProcessor,
    "basic-background-removal": BasicBackgroundRemovalProcessor,
    "remove-background": BackgroundRemovalProcessor,
    "upscale-image": UpscaleProcessor,
    "speech-to-text": SpeechToTextProcessor,
    "text-to-speech": TextToSpeechProcessor,
    "ocr-pdf": OcrProcessor,
    "html-to-image": HtmlToImageProcessor,
}


def get_processor(tool_id: str) -> Processor:
    try:
        return processor_registry[tool_id]()
    except KeyError:
        raise ProcessingError(f"Processor for {tool_id} is not installed.") from None
