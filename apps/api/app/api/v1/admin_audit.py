from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import license_service, require_admin
from app.schemas.admin import AdminAuditPage
from app.schemas.common import DataResponse
from app.security.admin import AdminIdentity
from app.services.license_service import LicenseService

router = APIRouter()


@router.get("", response_model=DataResponse[AdminAuditPage])
async def list_audit(
    _: Annotated[AdminIdentity, Depends(require_admin)],
    service: Annotated[LicenseService, Depends(license_service)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    action: Annotated[str | None, Query(max_length=64)] = None,
    license_id: Annotated[str | None, Query(max_length=36)] = None,
) -> DataResponse[AdminAuditPage]:
    return DataResponse(
        data=await service.audit_page(
            page=page, page_size=page_size, action=action, license_id=license_id
        )
    )
