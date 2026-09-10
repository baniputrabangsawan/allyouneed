from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any, cast

import dramatiq

from app.workers.broker import broker

QUEUES = ("image", "pdf", "audio", "video", "ocr", "stt", "tts", "ai-image")


async def _run(job_id: str) -> None:
    from app.services.job_service import get_job_service

    await get_job_service().execute(job_id)


def process_job(job_id: str) -> None:
    asyncio.run(_run(job_id))


def _actor(queue: str) -> dramatiq.Actor[Any, None]:
    retries = 3 if queue in {"image", "pdf", "audio", "video"} else 1
    name = f"process_{queue.replace('-', '_')}"
    decorate = cast(
        Callable[..., dramatiq.Actor[Any, None]],
        dramatiq.actor(
            actor_name=name,
            queue_name=queue,
            broker=broker,
            max_retries=retries,
            min_backoff=1_000,
        ),
    )
    return decorate(process_job)


ACTORS = {queue: _actor(queue) for queue in QUEUES}


def enqueue(queue: str, job_id: str) -> None:
    actor = ACTORS.get(queue, ACTORS["image"])
    actor.send(job_id)
