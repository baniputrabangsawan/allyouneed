from pathlib import Path
from typing import Any, Protocol

from app.core.config import get_settings
from app.processors.base import ProcessingError, ProcessorContext


class OcrProvider(Protocol):
    async def extract(self, source: Path, *, context: ProcessorContext) -> dict[str, Any]: ...


class UnavailableOcrProvider:
    async def extract(self, source: Path, *, context: ProcessorContext) -> dict[str, Any]:
        raise ProcessingError("OCR provider is not installed.", code="SERVICE_UNAVAILABLE")


def get_ocr_provider() -> OcrProvider:
    _ = get_settings().ocr_provider
    return UnavailableOcrProvider()
