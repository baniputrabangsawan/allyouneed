from collections.abc import Callable

from app.processors.base import ProcessingError, Processor
from app.processors.media import MEDIA_TOOLS, MediaProcessor

JPEG_TOOLS = {"convert-to-jpg", "png-to-jpg", "webp-to-jpg"}
PNG_TOOLS = {"jpg-to-png"}
WEBP_TOOLS = {"jpg-to-webp", "png-to-webp"}

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
    def create() -> Processor:
        from app.processors.image.generic import ImageProcessor

        return ImageProcessor(tool_id)

    return create


def _pdf(tool_id: str) -> Factory:
    def create() -> Processor:
        from app.processors.pdf.generic import PdfProcessor

        return PdfProcessor(tool_id)

    return create


def _media(tool_id: str) -> Factory:
    return lambda: MediaProcessor(tool_id)


def _blur_face() -> Processor:
    from app.processors.image.blur_face import BlurFaceProcessor

    return BlurFaceProcessor()


def _basic_background() -> Processor:
    from app.processors.image.basic_background import BasicBackgroundRemovalProcessor

    return BasicBackgroundRemovalProcessor()


def _background_removal() -> Processor:
    from app.processors.ai.generic import BackgroundRemovalProcessor

    return BackgroundRemovalProcessor()


def _upscale() -> Processor:
    from app.processors.ai.generic import UpscaleProcessor

    return UpscaleProcessor()


def _speech_to_text() -> Processor:
    from app.processors.ai.generic import SpeechToTextProcessor

    return SpeechToTextProcessor()


def _text_to_speech() -> Processor:
    from app.processors.ai.generic import TextToSpeechProcessor

    return TextToSpeechProcessor()


def _ocr() -> Processor:
    from app.processors.ocr.generic import OcrProcessor

    return OcrProcessor()


def _html_to_image() -> Processor:
    from app.processors.html_to_image import HtmlToImageProcessor

    return HtmlToImageProcessor()


processor_registry: dict[str, Factory] = {
    **{tool_id: _image(tool_id) for tool_id in IMAGE_TOOLS},
    **{tool_id: _pdf(tool_id) for tool_id in PDF_TOOLS},
    **{tool_id: _media(tool_id) for tool_id in MEDIA_TOOLS},
    "blur-face": _blur_face,
    "basic-background-removal": _basic_background,
    "remove-background": _background_removal,
    "upscale-image": _upscale,
    "speech-to-text": _speech_to_text,
    "text-to-speech": _text_to_speech,
    "ocr-pdf": _ocr,
    "html-to-image": _html_to_image,
}


def get_processor(tool_id: str) -> Processor:
    try:
        return processor_registry[tool_id]()
    except KeyError:
        raise ProcessingError(f"Processor for {tool_id} is not installed.") from None
