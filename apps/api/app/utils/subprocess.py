import asyncio
import logging
import re
from collections.abc import Awaitable, Callable
from inspect import isawaitable
from pathlib import Path

from app.processors.base import ProcessingError

ALLOWED_BINARIES = frozenset({"ffmpeg", "ffprobe"})
logger = logging.getLogger(__name__)

CommandProgress = Callable[[float], Awaitable[None] | None]

_OUT_TIME_US = re.compile(r"out_time_(?:ms|us)=(\d+)")
_OUT_TIME = re.compile(r"out_time=(\d+):(\d+):(\d+(?:\.\d+)?)")

FFMPEG_FAILED_MESSAGE = "The media engine could not process this file."


def _progress_fraction(line: str, duration: float) -> float | None:
    match = _OUT_TIME.search(line)
    if match:
        hours, minutes, seconds = match.groups()
        processed = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
        return min(1.0, max(0.0, processed / duration))
    match = _OUT_TIME_US.search(line)
    if match:
        processed = int(match.group(1)) / 1_000_000
        return min(1.0, max(0.0, processed / duration))
    return None


def _with_progress_pipe(args: list[str]) -> list[str]:
    if len(args) >= 2 and args[1] == "-progress":
        return args
    return [args[0], "-progress", "pipe:1", "-nostats", *args[1:]]


async def _emit_progress(on_progress: CommandProgress, fraction: float) -> None:
    result = on_progress(fraction)
    if isawaitable(result):
        await result


async def run_command(
    args: list[str],
    *,
    cancel_event: asyncio.Event | None = None,
    timeout: float = 300,
    on_progress: CommandProgress | None = None,
    duration: float | None = None,
) -> bytes:
    if not args or Path(args[0]).name not in ALLOWED_BINARIES:
        raise ProcessingError("Unsupported executable.")
    if any(not isinstance(arg, str) for arg in args):
        raise ProcessingError("Invalid process arguments.")

    track = (
        on_progress is not None
        and duration is not None
        and duration > 0
        and Path(args[0]).name == "ffmpeg"
    )
    command = _with_progress_pipe(args) if track else args

    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except OSError as exc:
        raise ProcessingError(FFMPEG_FAILED_MESSAGE, code="FFMPEG_FAILED") from exc

    if track:
        stdout, stderr = await _run_with_progress(
            process,
            cancel_event=cancel_event,
            timeout=timeout,
            on_progress=on_progress,
            duration=duration or 0,
        )
    else:
        stdout, stderr = await _run_simple(process, cancel_event=cancel_event, timeout=timeout)

    if process.returncode:
        detail = stderr.decode(errors="replace")[-1000:]
        logger.warning("ffmpeg failed (exit %s): %s", process.returncode, detail)
        raise ProcessingError(FFMPEG_FAILED_MESSAGE, code="FFMPEG_FAILED")
    return stdout


async def _run_simple(
    process: asyncio.subprocess.Process,
    *,
    cancel_event: asyncio.Event | None,
    timeout: float,
) -> tuple[bytes, bytes]:
    waiter = asyncio.create_task(process.communicate())
    watchers: set[asyncio.Task[object]] = {waiter}
    cancel_waiter: asyncio.Task[bool] | None = None
    if cancel_event is not None:
        cancel_waiter = asyncio.create_task(cancel_event.wait())
        watchers.add(cancel_waiter)

    done, _pending = await asyncio.wait(
        watchers, timeout=timeout, return_when=asyncio.FIRST_COMPLETED
    )
    timed_out = not done
    cancelled = cancel_waiter is not None and cancel_waiter in done
    if timed_out or cancelled:
        process.kill()
        waiter.cancel()
        if cancel_waiter is not None:
            cancel_waiter.cancel()
        if cancelled:
            raise asyncio.CancelledError
        raise TimeoutError

    if cancel_waiter is not None:
        cancel_waiter.cancel()
    stdout, stderr = waiter.result()
    return stdout, stderr


async def _run_with_progress(
    process: asyncio.subprocess.Process,
    *,
    cancel_event: asyncio.Event | None,
    timeout: float,
    on_progress: CommandProgress | None,
    duration: float,
) -> tuple[bytes, bytes]:
    stderr_chunks: list[bytes] = []

    async def read_stderr() -> None:
        assert process.stderr is not None
        while True:
            chunk = await process.stderr.read(4096)
            if not chunk:
                return
            stderr_chunks.append(chunk)

    async def read_progress() -> None:
        assert process.stdout is not None
        while True:
            line = await process.stdout.readline()
            if not line:
                return
            if on_progress is None:
                continue
            fraction = _progress_fraction(line.decode("utf-8", errors="replace"), duration)
            if fraction is None:
                continue
            await _emit_progress(on_progress, fraction)

    stderr_task = asyncio.create_task(read_stderr())
    progress_task = asyncio.create_task(read_progress())
    waiter = asyncio.create_task(process.wait())
    watchers: set[asyncio.Task[object]] = {waiter}
    cancel_waiter: asyncio.Task[bool] | None = None
    if cancel_event is not None:
        cancel_waiter = asyncio.create_task(cancel_event.wait())
        watchers.add(cancel_waiter)

    done, _pending = await asyncio.wait(
        watchers, timeout=timeout, return_when=asyncio.FIRST_COMPLETED
    )
    cancelled = cancel_waiter is not None and cancel_waiter in done
    timed_out = waiter not in done and not cancelled
    if waiter not in done:
        process.kill()
        waiter.cancel()
        stderr_task.cancel()
        progress_task.cancel()
        if cancel_waiter is not None:
            cancel_waiter.cancel()
        if cancelled:
            raise asyncio.CancelledError
        if timed_out:
            raise TimeoutError

    if cancel_waiter is not None:
        cancel_waiter.cancel()
    await asyncio.gather(stderr_task, progress_task, return_exceptions=True)
    await waiter
    return b"", b"".join(stderr_chunks)
