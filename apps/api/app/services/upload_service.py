from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from uuid import uuid4

from fastapi import status

from app.core.exceptions import ApiError
from app.providers.storage.local import LocalStorageProvider
from app.schemas.uploads import (
    CompleteUploadRequest,
    PresignedUpload,
    PresignUploadRequest,
    UploadedFile,
)
from app.utils.magic import validate_magic


class UploadService:
    def __init__(self, storage: LocalStorageProvider | None = None) -> None:
        self.storage = storage or LocalStorageProvider()
        self._issued: dict[str, PresignUploadRequest] = {}
        self._completed: set[str] = set()
        self._lock = Lock()

    def presign(self, payload: PresignUploadRequest) -> PresignedUpload:
        today = datetime.now(UTC).strftime("%Y/%m/%d")
        file_key = f"uploads/{today}/{uuid4().hex}"
        with self._lock:
            self._issued[file_key] = payload
        return PresignedUpload(
            upload_url=f"/api/v1/uploads/local/{file_key}",
            file_key=file_key,
            expires_in=900,
            headers={"Content-Type": payload.content_type},
        )

    def write(self, file_key: str, data: bytes, content_type: str | None) -> None:
        with self._lock:
            issued = self._issued.get(file_key)
        if issued is None:
            raise ApiError(status.HTTP_404_NOT_FOUND, "UPLOAD_FAILED", "Upload was not issued.")
        if len(data) != issued.size or len(data) == 0:
            raise ApiError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "INVALID_FILE",
                "Uploaded size does not match.",
            )
        if content_type and content_type != issued.content_type:
            raise ApiError(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                "UNSUPPORTED_FORMAT",
                "Content type does not match.",
            )
        self.storage.write_bytes(file_key, data)

    def complete(self, payload: CompleteUploadRequest) -> UploadedFile:
        with self._lock:
            issued = self._issued.get(payload.file_key)
        path = self.path(payload.file_key)
        if issued is None or not path.is_file() or path.stat().st_size != issued.size:
            raise ApiError(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "UPLOAD_FAILED", "Upload is incomplete."
            )
        validate_magic(path, issued.content_type)
        with self._lock:
            self._completed.add(payload.file_key)
        return UploadedFile(file_key=payload.file_key)

    def require_completed(self, file_key: str) -> Path:
        path = self.path(file_key)
        with self._lock:
            completed = file_key in self._completed
            issued = file_key in self._issued
        if completed:
            return path
        if not issued and path.is_file():
            return path
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "INVALID_FILE", "Upload is not complete."
        )

    def describe(self, file_key: str) -> UploadedFile:
        path = self.require_completed(file_key)
        issued = self.issued(file_key)
        return UploadedFile(
            file_key=file_key,
            filename=issued.filename if issued else None,
            content_type=issued.content_type if issued else None,
            size=issued.size if issued else path.stat().st_size,
        )

    def result_path(self, job_id: str, extension: str) -> tuple[str, Path]:
        key = f"results/{datetime.now(UTC):%Y/%m/%d}/{job_id}/{uuid4().hex}.{extension}"
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        return key, path

    def path(self, key: str) -> Path:
        return self.storage.path(key)

    def issued(self, file_key: str) -> PresignUploadRequest | None:
        with self._lock:
            return self._issued.get(file_key)


_service = UploadService()


def get_upload_service() -> UploadService:
    return _service
