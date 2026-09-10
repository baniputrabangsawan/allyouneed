import asyncio
from pathlib import Path

from app.processors.base import ProcessingError

ALLOWED_BINARIES = frozenset({"ffmpeg", "ffprobe"})


async def run_command(
    args: list[str],
    *,
    cancel_event: asyncio.Event | None = None,
    timeout: float = 300,
) -> bytes:
    if not args or Path(args[0]).name not in ALLOWED_BINARIES:
        raise ProcessingError("Unsupported executable.")
    if any(not isinstance(arg, str) for arg in args):
        raise ProcessingError("Invalid process arguments.")

    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
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
    if process.returncode:
        raise ProcessingError(stderr.decode(errors="replace")[-1000:])
    return stdout
