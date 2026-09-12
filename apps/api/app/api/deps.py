from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApiError
from app.db.models import AdminSession, AdminUser
from app.db.session import get_session
from app.security.admin import AdminIdentity, token_hash
from app.services.admin_auth_service import AdminAuthService
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


def admin_auth_service(
    session: Annotated[AsyncSession, Depends(db_session)],
) -> AdminAuthService:
    return AdminAuthService(session)


async def admin_context(
    request: Request,
    service: Annotated[AdminAuthService, Depends(admin_auth_service)],
) -> tuple[AdminIdentity, AdminSession, AdminUser]:
    from app.core.config import get_settings

    context = await service.resolve(request.cookies.get(get_settings().admin_session_cookie_name))
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        csrf = request.headers.get("X-CSRF-Token", "")
        if token_hash(csrf) != context[1].csrf_hash:
            raise ApiError(status.HTTP_403_FORBIDDEN, "CSRF_INVALID", "The CSRF token is invalid.")
    return context


async def require_admin(
    context: Annotated[tuple[AdminIdentity, AdminSession, AdminUser], Depends(admin_context)],
) -> AdminIdentity:
    return context[0]
