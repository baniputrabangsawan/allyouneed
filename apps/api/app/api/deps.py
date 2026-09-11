from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.security.admin import AdminIdentity, authenticate_admin
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


def require_admin(request: Request) -> AdminIdentity:
    return authenticate_admin(request)
