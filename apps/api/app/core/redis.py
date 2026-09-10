from __future__ import annotations

from functools import lru_cache
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings


@lru_cache
def redis_client() -> Redis | None:
    settings = get_settings()
    if settings.inline_jobs or not settings.redis_url:
        return None
    return Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_connect_timeout=0.2,
        socket_timeout=0.2,
    )


async def redis_call(operation: str, *args: Any, **kwargs: Any) -> Any:
    client = redis_client()
    if client is None:
        return None
    try:
        method = getattr(client, operation)
        return await method(*args, **kwargs)
    except Exception:
        return None
