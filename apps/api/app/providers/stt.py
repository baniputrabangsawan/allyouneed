from pathlib import Path
from typing import Any, Protocol

from app.core.config import get_settings
from app.processors.base import ProcessingError, ProcessorContext


class SpeechToTextProvider(Protocol):
    async def transcribe(self, source: Path, *, context: ProcessorContext) -> dict[str, Any]: ...


class UnavailableSttProvider:
    async def transcribe(self, source: Path, *, context: ProcessorContext) -> dict[str, Any]:
        raise ProcessingError(
            "Speech-to-text provider is not installed.", code="SERVICE_UNAVAILABLE"
        )


def get_stt_provider() -> SpeechToTextProvider:
    _ = get_settings().stt_provider
    return UnavailableSttProvider()
