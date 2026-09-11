from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, status

from app.api.deps import license_service, require_admin
from app.core.config import get_settings
from app.core.enums import LicensePlan
from app.schemas.admin import (
    AdminIdentityView,
    AdminLicensePage,
    AdminLicenseView,
    AdminOverview,
    CreateAdminLicenseRequest,
    IssuedAdminLicense,
    RenewAdminLicenseRequest,
)
from app.schemas.common import DataResponse
from app.schemas.licenses import LicenseView
from app.security.admin import AdminIdentity
from app.services.license_service import AuditActor, LicenseService

router = APIRouter()


def actor(identity: AdminIdentity, request: Request) -> AuditActor:
    return AuditActor(identity.admin_id, identity.email, request.state.request_id)


@router.get("/me", response_model=DataResponse[AdminIdentityView])
async def admin_identity(
    identity: Annotated[AdminIdentity, Depends(require_admin)],
) -> DataResponse[AdminIdentityView]:
    return DataResponse(
        data=AdminIdentityView(
            admin_id=identity.admin_id,
            email=identity.email,
            identity_provider=identity.identity_provider,
            logout_url=get_settings().cloudflare_access_logout_url,
        )
    )


@router.post(
    "", response_model=DataResponse[IssuedAdminLicense], status_code=status.HTTP_201_CREATED
)
async def issue_license(
    payload: CreateAdminLicenseRequest,
    request: Request,
    identity: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[IssuedAdminLicense]:
    plan = LicensePlan(
        f"pro_{payload.duration_months}_month{'s' if payload.duration_months != 1 else ''}"
    )
    return DataResponse(
        data=await service.issue_admin(plan, note=payload.note, actor=actor(identity, request))
    )


@router.get("", response_model=DataResponse[AdminLicensePage])
async def list_licenses(
    _: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    license_status: Annotated[
        Literal["unused", "active", "expired", "suspended", "revoked"] | None,
        Query(alias="status"),
    ] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    sort: Annotated[
        Literal[
            "created_at",
            "-created_at",
            "updated_at",
            "-updated_at",
            "expires_at",
            "-expires_at",
            "status",
            "-status",
        ],
        Query(),
    ] = "-created_at",
    created_from: Annotated[datetime | None, Query()] = None,
    created_to: Annotated[datetime | None, Query()] = None,
) -> DataResponse[AdminLicensePage]:
    return DataResponse(
        data=await service.list_admin(
            page=page,
            page_size=page_size,
            status=license_status,
            search=search,
            sort=sort,
            created_from=created_from,
            created_to=created_to,
        )
    )


@router.get("/overview/metrics", response_model=DataResponse[AdminOverview])
async def overview(
    _: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[AdminOverview]:
    return DataResponse(data=await service.overview())


@router.get("/{license_id}", response_model=DataResponse[AdminLicenseView])
async def get_license(
    license_id: str,
    _: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[AdminLicenseView]:
    return DataResponse(data=await service.get_admin(license_id))


@router.post("/{license_id}/renew", response_model=DataResponse[LicenseView])
async def renew_license(
    license_id: str,
    payload: RenewAdminLicenseRequest,
    request: Request,
    identity: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(
        data=await service.renew(
            license_id, months=payload.duration_months, actor=actor(identity, request)
        )
    )


@router.post("/{license_id}/suspend", response_model=DataResponse[LicenseView])
async def suspend_license(
    license_id: str,
    request: Request,
    identity: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.suspend(license_id, actor(identity, request)))


@router.post("/{license_id}/resume", response_model=DataResponse[LicenseView])
async def resume_license(
    license_id: str,
    request: Request,
    identity: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.resume(license_id, actor(identity, request)))


@router.post("/{license_id}/revoke", response_model=DataResponse[LicenseView])
async def revoke_license(
    license_id: str,
    request: Request,
    identity: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.revoke(license_id, actor(identity, request)))


@router.post("/{license_id}/reset-activations", response_model=DataResponse[LicenseView])
async def reset_activations(
    license_id: str,
    request: Request,
    identity: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.reset_activations(license_id, actor(identity, request)))
