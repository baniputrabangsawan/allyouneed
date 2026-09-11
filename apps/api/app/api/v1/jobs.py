import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response, status
from fastapi.responses import StreamingResponse

from app.api.deps import entitlement_service, job_service
from app.core.exceptions import ApiError
from app.core.state_machine import TERMINAL
from app.schemas.common import DataResponse
from app.schemas.jobs import CreateJobRequest, Job, JobResult
from app.services.entitlement_service import EntitlementService
from app.services.job_service import JobService

router = APIRouter()


@router.post("", response_model=DataResponse[Job], status_code=status.HTTP_202_ACCEPTED)
async def create_job(
    payload: CreateJobRequest,
    request: Request,
    response: Response,
    service: Annotated[JobService, Depends(job_service)],
    entitlements: Annotated[EntitlementService, Depends(entitlement_service)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    entitlement_token: Annotated[str | None, Header(alias="X-Entitlement-Token")] = None,
) -> DataResponse[Job]:
    job = await service.create(
        payload,
        idempotency_key=idempotency_key,
        request_id=getattr(request.state, "request_id", None),
        entitlement_token=entitlement_token,
        entitlements=entitlements,
    )
    response.headers["Location"] = f"/api/v1/jobs/{job.job_id}"
    return DataResponse(data=job)


@router.get("/{job_id}", response_model=DataResponse[Job])
async def get_job(
    job_id: str, service: Annotated[JobService, Depends(job_service)]
) -> DataResponse[Job]:
    return DataResponse(data=await service.get(job_id))


@router.delete("/{job_id}", response_model=DataResponse[Job])
async def cancel_job(
    job_id: str,
    service: Annotated[JobService, Depends(job_service)],
) -> DataResponse[Job]:
    return DataResponse(data=await service.cancel(job_id))


@router.get("/{job_id}/result", response_model=DataResponse[JobResult])
async def get_job_result(
    job_id: str,
    service: Annotated[JobService, Depends(job_service)],
) -> DataResponse[JobResult]:
    job = await service.get(job_id)
    if job.status != "completed" or job.result is None:
        raise ApiError(status.HTTP_409_CONFLICT, "JOB_NOT_READY", "Job result is not ready.")
    return DataResponse(data=JobResult(job_id=job.job_id, result=job.result))


@router.get("/{job_id}/events")
async def job_events(
    job_id: str, service: Annotated[JobService, Depends(job_service)]
) -> StreamingResponse:
    await service.get(job_id)

    async def events() -> AsyncIterator[str]:
        while True:
            job = await service.get(job_id)
            payload = json.dumps({"data": job.model_dump(mode="json", by_alias=True)}, default=str)
            yield f"data: {payload}\n\n"
            if job.status in TERMINAL:
                break
            await asyncio.sleep(0.25)

    return StreamingResponse(events(), media_type="text/event-stream")
