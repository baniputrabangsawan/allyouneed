from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.api.deps import require_admin
from app.core.config import get_settings
from app.core.redis import redis_call
from app.db.session import get_engine
from app.providers.storage import get_storage
from app.schemas.admin import AdminSystemHealth
from app.schemas.common import DataResponse
from app.security.admin import AdminIdentity

router = APIRouter()
HealthStatus = Literal["healthy", "degraded", "unavailable"]


@router.get("/health", response_model=DataResponse[AdminSystemHealth])
async def system_health(
    _: Annotated[AdminIdentity, Depends(require_admin)],
) -> DataResponse[AdminSystemHealth]:
    settings = get_settings()
    database: HealthStatus = "healthy"
    storage: HealthStatus = "healthy"
    try:
        async with get_engine().connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception:
        database = "unavailable"
    try:
        get_storage()
    except Exception:
        storage = "unavailable"
    redis: HealthStatus = "healthy" if await redis_call("ping") else "degraded"
    workers: HealthStatus = (
        "healthy" if not settings.inline_jobs and redis == "healthy" else "degraded"
    )
    return DataResponse(
        data=AdminSystemHealth(
            api="healthy", database=database, redis=redis, workers=workers, storage=storage
        )
    )
