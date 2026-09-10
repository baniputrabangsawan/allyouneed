from pathlib import Path
from typing import Any, Protocol

from app.core.config import get_settings
from app.processors.base import ProcessingError, ProcessorContext


class UpscaleProvider(Protocol):
    async def upscale(
        self, source: Path, output: Path, *, scale: int, context: ProcessorContext
    ) -> dict[str, Any]: ...


class UnavailableUpscaleProvider:
    async def upscale(
        self, source: Path, output: Path, *, scale: int, context: ProcessorContext
    ) -> dict[str, Any]:
        raise ProcessingError("Upscale provider is not installed.", code="SERVICE_UNAVAILABLE")


def get_upscale_provider() -> UpscaleProvider:
    _ = get_settings().upscale_provider
    return UnavailableUpscaleProvider()
