from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Protocol

from app.core.config import get_settings
from app.core.redis import redis_call

CACHE_PREFIX = "license:status:"


class LicenseStatusCache(Protocol):
    async def get(self, license_id: str) -> dict[str, Any] | None: ...

    async def set(
        self,
        license_id: str,
        *,
        status: str,
        plan: str,
        installation_hash: str,
        expires_at: datetime | None,
        capabilities: list[str],
    ) -> None: ...

    async def invalidate(self, license_id: str) -> None: ...


class MemoryLicenseStatusCache:
    def __init__(self) -> None:
        self._items: dict[str, dict[str, Any]] = {}

    async def get(self, license_id: str) -> dict[str, Any] | None:
        payload = self._items.get(license_id)
        return None if payload is None else dict(payload)

    async def set(
        self,
        license_id: str,
        *,
        status: str,
        plan: str,
        installation_hash: str,
        expires_at: datetime | None,
        capabilities: list[str],
    ) -> None:
        self._items[license_id] = _payload(
            status=status,
            plan=plan,
            installation_hash=installation_hash,
            expires_at=expires_at,
            capabilities=capabilities,
        )

    async def invalidate(self, license_id: str) -> None:
        self._items.pop(license_id, None)


class RedisLicenseStatusCache:
    async def get(self, license_id: str) -> dict[str, Any] | None:
        raw = await redis_call("get", CACHE_PREFIX + license_id)
        if not isinstance(raw, str):
            return None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return None
        return payload if isinstance(payload, dict) else None

    async def set(
        self,
        license_id: str,
        *,
        status: str,
        plan: str,
        installation_hash: str,
        expires_at: datetime | None,
        capabilities: list[str],
    ) -> None:
        ttl = get_settings().license_status_cache_ttl_seconds
        await redis_call(
            "set",
            CACHE_PREFIX + license_id,
            json.dumps(
                _payload(
                    status=status,
                    plan=plan,
                    installation_hash=installation_hash,
                    expires_at=expires_at,
                    capabilities=capabilities,
                )
            ),
            ex=ttl,
        )

    async def invalidate(self, license_id: str) -> None:
        await redis_call("delete", CACHE_PREFIX + license_id)


class NoOpLicenseStatusCache:
    async def get(self, license_id: str) -> dict[str, Any] | None:
        return None

    async def set(
        self,
        license_id: str,
        *,
        status: str,
        plan: str,
        installation_hash: str,
        expires_at: datetime | None,
        capabilities: list[str],
    ) -> None:
        return None

    async def invalidate(self, license_id: str) -> None:
        return None


def _payload(
    *,
    status: str,
    plan: str,
    installation_hash: str,
    expires_at: datetime | None,
    capabilities: list[str],
) -> dict[str, Any]:
    return {
        "status": status,
        "plan": plan,
        "installation_hash": installation_hash,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "capabilities": capabilities,
    }


def get_license_status_cache() -> LicenseStatusCache:
    settings = get_settings()
    if settings.inline_jobs or not settings.redis_url:
        return NoOpLicenseStatusCache()
    return RedisLicenseStatusCache()
