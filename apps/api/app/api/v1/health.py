from fastapi import APIRouter, status
from sqlalchemy import text

from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.db.session import get_engine
from app.providers.storage.local import LocalStorageProvider
from app.schemas.common import DataResponse

router = APIRouter()


@router.get("/live", response_model=DataResponse[dict[str, str]])
async def live() -> DataResponse[dict[str, str]]:
    return DataResponse(data={"status": "ok"})


@router.get("/ready", response_model=DataResponse[dict[str, str]])
async def ready() -> DataResponse[dict[str, str]]:
    settings = get_settings()
    try:
        LocalStorageProvider().path("health").parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SERVICE_UNAVAILABLE",
            "Storage is not ready.",
        ) from exc
    try:
        async with get_engine().connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SERVICE_UNAVAILABLE",
            "Database is not ready.",
        ) from exc
    return DataResponse(data={"status": "ok", "env": settings.app_env})
