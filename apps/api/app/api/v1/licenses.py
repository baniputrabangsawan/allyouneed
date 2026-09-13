from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.api.deps import entitlement_service
from app.schemas.common import DataResponse
from app.schemas.licenses import (
    ActivateLicenseRequest,
    EntitlementPayload,
    LicenseStatusView,
    RedeemTransferRequest,
    RestoreEntitlementRequest,
    TransferTokenView,
)
from app.services.entitlement_service import EntitlementService

router = APIRouter()

EntitlementToken = Annotated[str | None, Header(alias="X-Entitlement-Token")]


@router.post("/activate", response_model=DataResponse[EntitlementPayload])
async def activate_license(
    payload: ActivateLicenseRequest,
    service: Annotated[EntitlementService, Depends(entitlement_service)],
) -> DataResponse[EntitlementPayload]:
    return DataResponse(
        data=await service.activate(
            payload.license_key, payload.installation_id, payload.device_secret
        )
    )


@router.post("/restore", response_model=DataResponse[EntitlementPayload])
async def restore_license(
    payload: RestoreEntitlementRequest,
    service: Annotated[EntitlementService, Depends(entitlement_service)],
) -> DataResponse[EntitlementPayload]:
    return DataResponse(data=await service.restore(payload.installation_id, payload.device_secret))


@router.post("/refresh", response_model=DataResponse[EntitlementPayload])
async def refresh_license(
    service: Annotated[EntitlementService, Depends(entitlement_service)],
    token: EntitlementToken = None,
) -> DataResponse[EntitlementPayload]:
    return DataResponse(data=await service.refresh(_require_token(token)))


@router.post("/deactivate", response_model=DataResponse[LicenseStatusView])
async def deactivate_license(
    service: Annotated[EntitlementService, Depends(entitlement_service)],
    token: EntitlementToken = None,
) -> DataResponse[LicenseStatusView]:
    return DataResponse(data=await service.deactivate(_require_token(token)))


@router.get("/status", response_model=DataResponse[LicenseStatusView])
async def license_status(
    service: Annotated[EntitlementService, Depends(entitlement_service)],
    token: EntitlementToken = None,
) -> DataResponse[LicenseStatusView]:
    return DataResponse(data=await service.status(_require_token(token)))


@router.post("/transfer", response_model=DataResponse[TransferTokenView])
async def issue_transfer(
    service: Annotated[EntitlementService, Depends(entitlement_service)],
    token: EntitlementToken = None,
) -> DataResponse[TransferTokenView]:
    return DataResponse(data=await service.issue_transfer(_require_token(token)))


@router.post("/transfer/redeem", response_model=DataResponse[EntitlementPayload])
async def redeem_transfer(
    payload: RedeemTransferRequest,
    service: Annotated[EntitlementService, Depends(entitlement_service)],
) -> DataResponse[EntitlementPayload]:
    return DataResponse(
        data=await service.redeem_transfer(
            payload.token, payload.installation_id, payload.device_secret
        )
    )


def _require_token(token: str | None) -> str:
    from fastapi import status as http_status

    from app.core.exceptions import ApiError

    if not token:
        raise ApiError(
            http_status.HTTP_401_UNAUTHORIZED,
            "ENTITLEMENT_INVALID",
            "An entitlement token is required.",
        )
    return token
