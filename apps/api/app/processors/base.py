from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from inspect import isawaitable
from pathlib import Path
from typing import Any

ProgressCallback = Callable[[int | None, str | None], Awaitable[None] | None]


class ProcessingError(Exception):
    def __init__(self, message: str, *, code: str = "PROCESSING_FAILED") -> None:
        super().__init__(message)
        self.code = code


@dataclass
class ProcessorContext:
    job_id: str
    tool_id: str
    options: dict[str, Any]
    work_dir: Path
    cancel_event: Any | None = None
    on_progress: ProgressCallback | None = None

    async def report(self, progress: int | None, stage: str | None) -> None:
        if self.on_progress is None:
            return
        result = self.on_progress(progress, stage)
        if isawaitable(result):
            await result

    def raise_if_cancelled(self) -> None:
        if self.cancel_event is not None and self.cancel_event.is_set():
            raise InterruptedError("Job was cancelled.")


@dataclass
class ProcessorResult:
    metadata: dict[str, Any]
    content_type: str | None = None
    extension: str | None = None


class Processor(ABC):
    tool_id: str

    @abstractmethod
    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult: ...


def integer(
    options: dict[str, Any],
    key: str,
    default: int,
    *,
    minimum: int = 1,
    maximum: int = 20_000,
) -> int:
    value = int(options.get(key, default))
    if value < minimum or value > maximum:
        raise ProcessingError(f"Invalid {key}.")
    return value
