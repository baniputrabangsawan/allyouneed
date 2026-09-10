from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.db.session import get_session
from app.services.entitlement_service import EntitlementService
from app.services.job_service import JobService, get_job_service
from app.services.license_service import LicenseService


def job_service() -> JobService:
    return get_job_service()


async def db_session() -> AsyncIterator[AsyncSession]:
    async for session in get_session():
        yield session


def license_service(session: Annotated[AsyncSession, Depends(db_session)]) -> LicenseService:
    return LicenseService(session)


def entitlement_service(
    session: Annotated[AsyncSession, Depends(db_session)],
) -> EntitlementService:
    return EntitlementService(session)


def require_admin(
    admin_key: Annotated[str | None, Header(alias="X-Admin-Key")] = None,
) -> None:
    expected = get_settings().admin_api_key
    if not expected or admin_key != expected:
        raise ApiError(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", "Admin key is required.")
