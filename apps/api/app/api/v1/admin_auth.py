from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.api.deps import admin_auth_service, admin_context
from app.core.config import get_settings
from app.db.models import AdminSession, AdminUser
from app.schemas.admin_auth import (
    AdminAuthView,
    AdminLoginRequest,
    AdminPasswordRequest,
    AdminSensitiveRequest,
    AdminTotpRequest,
    RecoveryCodesView,
    TotpSetupView,
)
from app.schemas.common import DataResponse
from app.security.admin import AdminIdentity
from app.services.admin_auth_service import AdminAuthService, SessionTokens

router = APIRouter()


def _set_cookies(response: Response, tokens: SessionTokens) -> None:
    settings = get_settings()
    max_age = 300 if tokens.requires_totp else settings.admin_session_ttl_seconds
    secure = settings.app_env == "production"
    response.set_cookie(
        settings.admin_session_cookie_name,
        tokens.session,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/",
    )
    response.set_cookie(
        settings.admin_csrf_cookie_name,
        tokens.csrf,
        max_age=max_age,
        httponly=False,
        secure=secure,
        samesite="strict",
        path="/",
    )


def _clear_cookies(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.admin_session_cookie_name, path="/")
    response.delete_cookie(settings.admin_csrf_cookie_name, path="/")


@router.post("/login", response_model=DataResponse[AdminAuthView])
async def login(
    payload: AdminLoginRequest,
    request: Request,
    response: Response,
    service: Annotated[AdminAuthService, Depends(admin_auth_service)],
) -> DataResponse[AdminAuthView]:
    tokens = await service.login(payload.email, payload.password, request.state.request_id)
    _set_cookies(response, tokens)
    return DataResponse(
        data=AdminAuthView(
            authenticated=not tokens.requires_totp, requires_totp=tokens.requires_totp
        )
    )


@router.post("/totp/verify", response_model=DataResponse[AdminAuthView])
async def verify_login_totp(
    payload: AdminTotpRequest,
    request: Request,
    response: Response,
    service: Annotated[AdminAuthService, Depends(admin_auth_service)],
) -> DataResponse[AdminAuthView]:
    tokens = await service.verify_login_totp(
        request.cookies.get(get_settings().admin_session_cookie_name, ""),
        payload.code,
        request.state.request_id,
    )
    _set_cookies(response, tokens)
    identity, _, user = await service.resolve(tokens.session)
    return DataResponse(
        data=AdminAuthView(authenticated=True, email=identity.email, totp_enabled=user.totp_enabled)
    )


@router.get("/me", response_model=DataResponse[AdminAuthView])
async def me(
    context: Annotated[tuple[AdminIdentity, AdminSession, AdminUser], Depends(admin_context)],
) -> DataResponse[AdminAuthView]:
    identity, _, user = context
    return DataResponse(
        data=AdminAuthView(authenticated=True, email=identity.email, totp_enabled=user.totp_enabled)
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    context: Annotated[tuple[AdminIdentity, AdminSession, AdminUser], Depends(admin_context)],
    service: Annotated[AdminAuthService, Depends(admin_auth_service)],
) -> None:
    _, session, user = context
    await service.logout(session, user, request.state.request_id)
    _clear_cookies(response)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: AdminPasswordRequest,
    request: Request,
    context: Annotated[tuple[AdminIdentity, AdminSession, AdminUser], Depends(admin_context)],
    service: Annotated[AdminAuthService, Depends(admin_auth_service)],
) -> None:
    _, session, user = context
    await service.change_password(
        session, user, payload.current_password, payload.new_password, request.state.request_id
    )


@router.post("/totp/setup", response_model=DataResponse[TotpSetupView])
async def setup_totp(
    payload: AdminSensitiveRequest,
    context: Annotated[tuple[AdminIdentity, AdminSession, AdminUser], Depends(admin_context)],
    service: Annotated[AdminAuthService, Depends(admin_auth_service)],
) -> DataResponse[TotpSetupView]:
    _, _, user = context
    secret, uri = await service.setup_totp(user, payload.password)
    return DataResponse(data=TotpSetupView(provisioning_uri=uri, secret=secret))


@router.post("/totp/confirm", response_model=DataResponse[RecoveryCodesView])
async def confirm_totp(
    payload: AdminTotpRequest,
    request: Request,
    context: Annotated[tuple[AdminIdentity, AdminSession, AdminUser], Depends(admin_context)],
    service: Annotated[AdminAuthService, Depends(admin_auth_service)],
) -> DataResponse[RecoveryCodesView]:
    _, _, user = context
    return DataResponse(
        data=RecoveryCodesView(
            recovery_codes=await service.confirm_totp(user, payload.code, request.state.request_id)
        )
    )


@router.post("/totp/disable", status_code=status.HTTP_204_NO_CONTENT)
async def disable_totp(
    payload: AdminSensitiveRequest,
    request: Request,
    context: Annotated[tuple[AdminIdentity, AdminSession, AdminUser], Depends(admin_context)],
    service: Annotated[AdminAuthService, Depends(admin_auth_service)],
) -> None:
    _, _, user = context
    await service.disable_totp(user, payload.password, payload.code, request.state.request_id)
