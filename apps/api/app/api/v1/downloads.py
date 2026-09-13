from fastapi import APIRouter, Query, status
from fastapi.responses import FileResponse

from app.core.exceptions import ApiError
from app.services.upload_service import get_upload_service
from app.utils.signing import verify_download

router = APIRouter()

_MEDIA_TYPES = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".opus": "audio/ogg",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".gif": "image/gif",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".json": "application/json",
    ".pdf": "application/pdf",
}


@router.get("/{file_key:path}", response_class=FileResponse)
async def download(
    file_key: str,
    expires: int | None = Query(default=None),
    token: str | None = Query(default=None),
) -> FileResponse:
    path = get_upload_service().path(file_key)
    signed = expires is not None and token is not None and verify_download(file_key, token, expires)
    if not file_key.startswith("results/") or not path.is_file() or not signed:
        raise ApiError(status.HTTP_404_NOT_FOUND, "DOWNLOAD_EXPIRED", "Download is not available.")
    media_type = _MEDIA_TYPES.get(path.suffix.lower())
    if media_type:
        return FileResponse(path, media_type=media_type, filename=path.name)
    return FileResponse(path, filename=path.name)
