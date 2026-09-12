from __future__ import annotations

from typing import Protocol

from app.core.config import get_settings
from app.core.redis import redis_call

COUNTER_PREFIX = "license:conc:"
JOB_PREFIX = "license:jobconc:"
SLOT_TTL_SECONDS = 900


class JobConcurrencyLimiter(Protocol):
    async def acquire(
        self, job_id: str, queue: str, license_id: str, installation_hash: str
    ) -> bool: ...

    async def release(self, job_id: str) -> None: ...


class NoOpJobConcurrencyLimiter:
    async def acquire(
        self, job_id: str, queue: str, license_id: str, installation_hash: str
    ) -> bool:
        return True

    async def release(self, job_id: str) -> None:
        return None


class MemoryJobConcurrencyLimiter:
    def __init__(self, *, ai_limit: int = 2, video_limit: int = 1) -> None:
        self._ai_limit = ai_limit
        self._video_limit = video_limit
        self._counts: dict[str, int] = {}
        self._jobs: dict[str, str] = {}

    def limit_for(self, queue: str) -> int | None:
        if queue in {"ai-image", "stt", "tts"}:
            return self._ai_limit
        if queue == "video":
            return self._video_limit
        return None

    async def acquire(
        self, job_id: str, queue: str, license_id: str, installation_hash: str
    ) -> bool:
        limit = self.limit_for(queue)
        if limit is None:
            return True
        key = _counter_key(queue, license_id, installation_hash)
        current = self._counts.get(key, 0)
        if current >= limit:
            return False
        self._counts[key] = current + 1
        self._jobs[job_id] = key
        return True

    async def release(self, job_id: str) -> None:
        key = self._jobs.pop(job_id, None)
        if key is None:
            return
        current = self._counts.get(key, 0)
        if current <= 1:
            self._counts.pop(key, None)
        else:
            self._counts[key] = current - 1


class RedisJobConcurrencyLimiter:
    async def acquire(
        self, job_id: str, queue: str, license_id: str, installation_hash: str
    ) -> bool:
        limit = _limit_for_queue(queue)
        if limit is None:
            return True
        counter = _counter_key(queue, license_id, installation_hash)
        count = await redis_call("incr", counter)
        if count is None:
            return True
        await redis_call("expire", counter, SLOT_TTL_SECONDS)
        if int(count) > limit:
            await redis_call("decr", counter)
            return False
        await redis_call("set", JOB_PREFIX + job_id, counter, ex=SLOT_TTL_SECONDS)
        return True

    async def release(self, job_id: str) -> None:
        counter = await redis_call("getdel", JOB_PREFIX + job_id)
        if not isinstance(counter, str):
            return
        await redis_call("decr", counter)


def _counter_key(queue: str, license_id: str, installation_hash: str) -> str:
    return f"{COUNTER_PREFIX}{queue}:{license_id}:{installation_hash}"


def _limit_for_queue(queue: str) -> int | None:
    settings = get_settings()
    if queue in {"ai-image", "stt", "tts"}:
        return settings.ai_concurrent_jobs
    if queue == "video":
        return settings.video_concurrent_jobs
    return None


def get_job_concurrency_limiter() -> JobConcurrencyLimiter:
    settings = get_settings()
    if settings.inline_jobs or not settings.redis_url:
        return NoOpJobConcurrencyLimiter()
    return RedisJobConcurrencyLimiter()
