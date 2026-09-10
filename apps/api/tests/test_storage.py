from pathlib import Path

import pytest
from fastapi import status

from app.core.exceptions import ApiError
from app.providers.storage.local import LocalStorageProvider
from app.utils.signing import sign_download, verify_download


async def test_local_storage_roundtrip(tmp_path: Path) -> None:
    storage = LocalStorageProvider(tmp_path)
    key = "uploads/2026/01/01/abc"
    storage.write_bytes(key, b"hello")
    assert await storage.exists(key)
    url, _expires = await storage.create_download_url(key)
    assert url.startswith("/api/v1/downloads/")
    await storage.delete(key)
    assert not await storage.exists(key)


def test_storage_rejects_path_escape(tmp_path: Path) -> None:
    storage = LocalStorageProvider(tmp_path)
    with pytest.raises(ApiError) as exc:
        storage.path("../secret")
    assert exc.value.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_download_signature() -> None:
    token = sign_download("results/a", 4_000_000_000)
    assert verify_download("results/a", token, 4_000_000_000)
    assert not verify_download("results/a", token, 1)
