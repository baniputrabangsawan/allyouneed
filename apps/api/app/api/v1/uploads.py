from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response

from app.api.deps import entitlement_service, job_service
from app.schemas.common import DataResponse
from app.schemas.uploads import (
    CompleteUploadRequest,
    PresignedUpload,
    PresignUploadRequest,
    UploadedFile,
)
from app.services.entitlement_service import EntitlementService
from app.services.job_service import JobService
from app.services.upload_service import UploadService, get_upload_service

router = APIRouter()


def upload_service() -> UploadService:
    return get_upload_service()


@router.post("/presign", response_model=DataResponse[PresignedUpload])
async def presign_upload(
    payload: PresignUploadRequest,
    uploads: Annotated[UploadService, Depends(upload_service)],
    jobs: Annotated[JobService, Depends(job_service)],
    entitlements: Annotated[EntitlementService, Depends(entitlement_service)],
    entitlement_token: Annotated[str | None, Header(alias="X-Entitlement-Token")] = None,
) -> DataResponse[PresignedUpload]:
    await jobs.validate_tool_accepts(
        payload.tool_id,
        payload.content_type,
        payload.size,
        entitlement_token=entitlement_token,
        entitlements=entitlements,
    )
    return DataResponse(data=uploads.presign(payload))


@router.post("/complete", response_model=DataResponse[UploadedFile])
async def complete_upload(
    payload: CompleteUploadRequest,
    uploads: Annotated[UploadService, Depends(upload_service)],
) -> DataResponse[UploadedFile]:
    return DataResponse(data=uploads.complete(payload))


@router.put("/local/{file_key:path}", status_code=204)
async def local_upload(
    file_key: str,
    request: Request,
    uploads: Annotated[UploadService, Depends(upload_service)],
) -> Response:
    uploads.write(file_key, await request.body(), request.headers.get("content-type"))
    return Response(status_code=204)
