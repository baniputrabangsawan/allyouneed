from datetime import UTC, datetime

from app.services.job_concurrency import MemoryJobConcurrencyLimiter
from app.services.license_cache import MemoryLicenseStatusCache


async def test_memory_status_cache_roundtrip_and_invalidate() -> None:
    cache = MemoryLicenseStatusCache()
    expires = datetime(2026, 10, 1, tzinfo=UTC)
    await cache.set(
        "lic-1",
        status="active",
        plan="pro_1_month",
        installation_hash="hash-a",
        expires_at=expires,
        capabilities=["image.ai.upscale"],
    )
    stored = await cache.get("lic-1")
    assert stored is not None
    assert stored["status"] == "active"
    assert stored["installation_hash"] == "hash-a"
    assert stored["expires_at"] == expires.isoformat()
    await cache.invalidate("lic-1")
    assert await cache.get("lic-1") is None


async def test_memory_concurrency_limits_ai_and_video() -> None:
    limiter = MemoryJobConcurrencyLimiter(ai_limit=2, video_limit=1)
    assert await limiter.acquire("j1", "ai-image", "lic", "hash")
    assert await limiter.acquire("j2", "ai-image", "lic", "hash")
    assert await limiter.acquire("j3", "ai-image", "lic", "hash") is False
    await limiter.release("j1")
    assert await limiter.acquire("j4", "ai-image", "lic", "hash")
    assert await limiter.acquire("v1", "video", "lic", "hash")
    assert await limiter.acquire("v2", "video", "lic", "hash") is False
    assert await limiter.acquire("r1", "image", "lic", "hash")
