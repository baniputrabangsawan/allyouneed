from pathlib import Path
from typing import Any, Protocol

from app.core.config import get_settings
from app.processors.base import ProcessingError, ProcessorContext


class BackgroundRemovalProvider(Protocol):
    async def remove(
        self, source: Path, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]: ...


class UnavailableBackgroundRemovalProvider:
    async def remove(
        self, source: Path, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]:
        raise ProcessingError(
            "Background removal provider is not installed.", code="SERVICE_UNAVAILABLE"
        )


def get_background_removal_provider() -> BackgroundRemovalProvider:
    _ = get_settings().background_removal_provider
    return UnavailableBackgroundRemovalProvider()
