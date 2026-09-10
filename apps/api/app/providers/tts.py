from pathlib import Path
from typing import Any, Protocol

from app.core.config import get_settings
from app.processors.base import ProcessingError, ProcessorContext


class TextToSpeechProvider(Protocol):
    async def synthesize(
        self, text: str, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]: ...


class UnavailableTtsProvider:
    async def synthesize(
        self, text: str, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]:
        raise ProcessingError(
            "Text-to-speech provider is not installed.", code="SERVICE_UNAVAILABLE"
        )


def get_tts_provider() -> TextToSpeechProvider:
    _ = get_settings().tts_provider
    return UnavailableTtsProvider()
