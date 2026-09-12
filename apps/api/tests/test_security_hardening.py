from pathlib import Path
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.exceptions import ApiError
from app.services.job_service import _validate_media_duration
from app.tools.registry import tool_registry


async def test_public_api_security_headers(api: AsyncClient) -> None:
    response = await api.get("/api/v1/health/live")

    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]


async def test_rejects_oversized_json_before_parsing(api: AsyncClient) -> None:
    response = await api.post(
        "/api/v1/jobs",
        content=b"{}",
        headers={"Content-Type": "application/json", "Content-Length": "1048577"},
    )

    assert response.status_code == 413
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


async def test_rejects_chunked_json_over_limit(api: AsyncClient) -> None:
    async def chunks():
        yield b"x" * 600_000
        yield b"x" * 600_000

    response = await api.post(
        "/api/v1/jobs", content=chunks(), headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


async def test_rejects_upload_larger_than_declared(api: AsyncClient) -> None:
    presigned = await api.post(
        "/api/v1/uploads/presign",
        json={
            "filename": "x.png",
            "contentType": "image/png",
            "size": 4,
            "toolId": "resize-image",
        },
    )
    upload = presigned.json()["data"]

    response = await api.put(upload["uploadUrl"], content=b"five!", headers=upload["headers"])

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


async def test_job_creation_rate_limit_is_enforced(
    api: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(api_rate_limit_enabled=True)

    async def over_limit(command: str, *args: object, **kwargs: object) -> int:
        return 31 if command == "incr" else 1

    monkeypatch.setattr("app.middleware.api_rate_limit.get_settings", lambda: settings)
    monkeypatch.setattr("app.middleware.api_rate_limit.redis_call", over_limit)

    response = await api.post("/api/v1/jobs", json={})

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "60"
    assert response.json()["error"]["code"] == "RATE_LIMITED"


async def test_combined_media_duration_is_limited(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def four_second_probe(_path: Path) -> dict[str, object]:
        return {"format": {"duration": "4"}}

    monkeypatch.setattr("app.services.job_service.probe", four_second_probe)
    monkeypatch.setattr(
        "app.services.job_service.get_settings",
        lambda: SimpleNamespace(max_media_duration_seconds=5, stt_max_duration_seconds=3),
    )

    with pytest.raises(ApiError, match="Combined media duration") as error:
        await _validate_media_duration(
            tool_registry["audio-merger"], [Path("one.wav"), Path("two.wav")]
        )

    assert error.value.code == "MEDIA_TOO_LONG"
    assert error.value.status_code == 422


def test_production_rejects_unsafe_defaults() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", inline_jobs=False)


def test_production_rejects_invalid_totp_encryption_key() -> None:
    with pytest.raises(ValidationError, match="valid Fernet key"):
        Settings(
            app_env="production",
            inline_jobs=False,
            cors_origins=["https://usekits.online"],
            admin_cors_origins=["https://usekits.online"],
            admin_totp_encryption_key="not-a-fernet-key",
            entitlement_private_key="configured-by-secret-store",
            license_database_url="postgresql+asyncpg://kits:secret@database.internal/kits",
            redis_url="rediss://redis.internal:6379/0",
            public_base_url="https://api.usekits.online",
            download_signing_secret="a-production-secret-with-at-least-32-bytes",
        )


def test_production_accepts_explicit_hardened_configuration() -> None:
    settings = Settings(
        app_env="production",
        inline_jobs=False,
        api_rate_limit_enabled=True,
        cors_origins=["https://usekits.online"],
        admin_cors_origins=["https://usekits.online"],
        admin_totp_encryption_key="YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=",
        entitlement_private_key="configured-by-secret-store",
        license_database_url="postgresql+asyncpg://kits:secret@database.internal/kits",
        redis_url="rediss://redis.internal:6379/0",
        public_base_url="https://api.usekits.online",
        download_signing_secret="a-production-secret-with-at-least-32-bytes",
    )

    assert settings.app_env == "production"
