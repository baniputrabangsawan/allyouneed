from datetime import datetime
from pathlib import Path

from fastapi import status

from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.utils.signing import signed_download_path


class LocalStorageProvider:
    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or Path(get_settings().storage_root)).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    async def create_upload_url(self, key: str, content_type: str, size: int) -> dict[str, object]:
        return {
            "uploadUrl": f"/api/v1/uploads/local/{key}",
            "expiresIn": 900,
            "headers": {"Content-Type": content_type},
        }

    async def create_download_url(self, key: str) -> tuple[str, datetime]:
        return signed_download_path(key)

    async def exists(self, key: str) -> bool:
        return self.path(key).is_file()

    async def delete(self, key: str) -> None:
        self.path(key).unlink(missing_ok=True)

    def path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents and path != self.root:
            raise ApiError(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "VALIDATION_ERROR", "Invalid storage key."
            )
        return path

    def write_bytes(self, key: str, data: bytes) -> Path:
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".part")
        temporary.write_bytes(data)
        temporary.replace(path)
        return path
