from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import license_service, require_admin
from app.schemas.common import DataResponse
from app.schemas.licenses import (
    IssuedLicense,
    IssueLicenseRequest,
    LicenseView,
    RenewLicenseRequest,
)
from app.services.license_service import LicenseService

router = APIRouter(dependencies=[Depends(require_admin)])


@router.post("", response_model=DataResponse[IssuedLicense], status_code=status.HTTP_201_CREATED)
async def issue_license(
    payload: IssueLicenseRequest,
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[IssuedLicense]:
    return DataResponse(data=await service.issue(payload.plan, note=payload.note))


@router.get("", response_model=DataResponse[list[LicenseView]])
async def list_licenses(
    service: Annotated[LicenseService, Depends(license_service)],
    prefix: Annotated[str | None, Query()] = None,
) -> DataResponse[list[LicenseView]]:
    return DataResponse(data=await service.list_licenses(prefix))


@router.get("/{license_id}", response_model=DataResponse[LicenseView])
async def get_license(
    license_id: str,
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.get(license_id))


@router.post("/{license_id}/renew", response_model=DataResponse[LicenseView])
async def renew_license(
    license_id: str,
    payload: RenewLicenseRequest,
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.renew(license_id, payload.plan, payload.months))


@router.post("/{license_id}/suspend", response_model=DataResponse[LicenseView])
async def suspend_license(
    license_id: str,
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.suspend(license_id))


@router.post("/{license_id}/resume", response_model=DataResponse[LicenseView])
async def resume_license(
    license_id: str,
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.resume(license_id))


@router.post("/{license_id}/revoke", response_model=DataResponse[LicenseView])
async def revoke_license(
    license_id: str,
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.revoke(license_id))


@router.post("/{license_id}/reset-activations", response_model=DataResponse[LicenseView])
async def reset_activations(
    license_id: str,
    service: Annotated[LicenseService, Depends(license_service)],
) -> DataResponse[LicenseView]:
    return DataResponse(data=await service.reset_activations(license_id))
