import asyncio
import hashlib
import json
import shutil
from functools import partial
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import status
from sqlalchemy.exc import IntegrityError

from app.core.capabilities import capability_for_tool
from app.core.config import get_settings
from app.core.enums import JobStatus
from app.core.exceptions import ApiError
from app.core.job_payload import input_keys
from app.core.state_machine import TERMINAL, ensure_transition
from app.processors.base import ProcessingError, ProcessorContext
from app.processors.registry import get_processor
from app.repositories.jobs import JobRepository
from app.schemas.jobs import CreateJobRequest, Job
from app.services.entitlement_service import EntitlementService
from app.services.job_concurrency import JobConcurrencyLimiter, get_job_concurrency_limiter
from app.services.job_output import output_format
from app.services.job_validation import validate_job_payload, validate_media_duration
from app.services.upload_service import get_upload_service
from app.tools.registry import Tool, tool_registry
from app.utils.media_accept import content_type_accepted
from app.utils.signing import signed_download_path
from app.utils.temp import cleanup_work_dir, job_work_dir


class JobService:
    def __init__(self, limiter: JobConcurrencyLimiter | None = None) -> None:
        self._repo = JobRepository()
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._cancel: dict[str, asyncio.Event] = {}
        self._lock = asyncio.Lock()
        self._limiter = limiter or get_job_concurrency_limiter()

    async def create(
        self,
        payload: CreateJobRequest,
        *,
        idempotency_key: str | None = None,
        request_id: str | None = None,
        entitlement_token: str | None = None,
        entitlements: EntitlementService | None = None,
    ) -> Job:
        tool = self._tool(payload.tool_id)
        identity = await self._require_premium(tool, entitlement_token, entitlements)
        validate_job_payload(tool, payload, get_upload_service())
        fingerprint = hashlib.sha256(
            json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()
        ).hexdigest()
        async with self._lock:
            if idempotency_key:
                prior = await self._repo.idempotency(idempotency_key)
                if prior is not None:
                    prior_fingerprint, job_id = prior
                    if prior_fingerprint != fingerprint:
                        raise ApiError(
                            status.HTTP_409_CONFLICT,
                            "IDEMPOTENCY_CONFLICT",
                            "Idempotency key was reused with another request.",
                        )
                    found = await self._repo.get(job_id)
                    if found is None:
                        raise ApiError(
                            status.HTTP_404_NOT_FOUND, "JOB_NOT_FOUND", "Job was not found."
                        )
                    return found
            job = Job(
                job_id=f"job_{uuid4().hex}",
                tool_id=tool.id,
                status=JobStatus.QUEUED.value,
                stage="validating",
                request_id=request_id,
            )
            if identity is not None:
                acquired = await self._limiter.acquire(
                    job.job_id, tool.queue, identity[0], identity[1]
                )
                if not acquired:
                    raise ApiError(
                        status.HTTP_429_TOO_MANY_REQUESTS,
                        "CONCURRENCY_LIMIT",
                        "Too many jobs are already running for this license.",
                    )
            try:
                await self._repo.save(
                    job,
                    payload,
                    idempotency_key=idempotency_key,
                    idempotency_fingerprint=fingerprint,
                    execution_mode=tool.execution_mode,
                )
            except IntegrityError:
                if not idempotency_key:
                    raise
                prior = await self._repo.idempotency(idempotency_key)
                if prior is None:
                    raise
                prior_fingerprint, job_id = prior
                if prior_fingerprint != fingerprint:
                    raise ApiError(
                        status.HTTP_409_CONFLICT,
                        "IDEMPOTENCY_CONFLICT",
                        "Idempotency key was reused with another request.",
                    ) from None
                found = await self._repo.get(job_id)
                if found is None:
                    raise ApiError(
                        status.HTTP_404_NOT_FOUND, "JOB_NOT_FOUND", "Job was not found."
                    ) from None
                return found
            self._cancel[job.job_id] = asyncio.Event()
            if get_settings().inline_jobs:
                task = asyncio.create_task(self.execute(job.job_id))
                self._tasks[job.job_id] = task
                task.add_done_callback(partial(self._discard_task, job.job_id))
            else:
                from app.workers.tasks import enqueue

                try:
                    enqueue(tool.queue, job.job_id)
                except Exception as exc:
                    await self._limiter.release(job.job_id)
                    await self._update(
                        job.job_id,
                        status=JobStatus.FAILED.value,
                        stage=None,
                        progress=None,
                        error={
                            "code": "PROCESSING_QUEUE_UNAVAILABLE",
                            "message": "The processing queue is unavailable.",
                        },
                    )
                    raise ApiError(
                        status.HTTP_503_SERVICE_UNAVAILABLE,
                        "PROCESSING_QUEUE_UNAVAILABLE",
                        "The processing queue is unavailable.",
                    ) from exc
            return job

    async def get(self, job_id: str) -> Job:
        job = await self._repo.get(job_id)
        if job is None:
            raise ApiError(
                status.HTTP_404_NOT_FOUND, "JOB_NOT_FOUND", "Job was not found."
            ) from None
        return job

    async def cancel(self, job_id: str) -> Job:
        job = await self.get(job_id)
        if job.status in TERMINAL:
            return job
        event = self._cancel.get(job_id)
        if event:
            event.set()
        task = self._tasks.get(job_id)
        if task:
            task.cancel()
        await self._limiter.release(job_id)
        return await self._update(
            job_id, status=JobStatus.CANCELLED.value, stage=None, progress=None
        )

    async def validate_tool_accepts(
        self,
        tool_id: str,
        content_type: str,
        size: int,
        *,
        filename: str = "",
        entitlement_token: str | None = None,
        entitlements: EntitlementService | None = None,
    ) -> Tool:
        tool = self._tool(tool_id)
        await self._require_premium(tool, entitlement_token, entitlements)
        maximum = min(tool.max_file_size, get_settings().max_upload_mb * 1024 * 1024)
        if tool.accepted_mimes and not content_type_accepted(
            tool.accepted_mimes, content_type, filename
        ):
            raise ApiError(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                "UNSUPPORTED_FORMAT",
                "File type is not supported for this tool.",
            )
        if size > maximum:
            raise ApiError(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "FILE_TOO_LARGE", "File is too large."
            )
        return tool

    async def execute(self, job_id: str) -> None:
        job = await self.get(job_id)
        if job.status in TERMINAL:
            return
        tool = self._tool(job.tool_id or "")
        upload_service = get_upload_service()
        try:
            payload = await self._repo.payload(job_id)
            if job.status == JobStatus.QUEUED.value:
                claimed = await self._repo.update_from(
                    JobStatus.QUEUED.value,
                    job_id,
                    status=JobStatus.PROCESSING.value,
                    stage="downloading",
                    progress=5,
                )
                if claimed is None or claimed.status != JobStatus.PROCESSING.value:
                    return
            elif job.status != JobStatus.PROCESSING.value:
                return
            keys = input_keys(payload.input)
            source_paths = [upload_service.require_completed(key) for key in keys]
            work = job_work_dir(job_id)
            inputs = []
            for index, source in enumerate(source_paths):
                dest = work / f"input-{index}{_source_suffix(upload_service, keys[index], source)}"
                shutil.copy2(source, dest)
                inputs.append(dest)
            await validate_media_duration(tool, inputs)
            if not inputs:
                if tool.id == "html-to-image":
                    inputs = [work / "input-0.html"]
                    inputs[0].write_text(str(payload.options.get("html", "")), encoding="utf-8")
                else:
                    inputs = [work / "input-0.txt"]
                    inputs[0].write_text(str(payload.options.get("text", "")), encoding="utf-8")
            extension, content_type = output_format(tool.id, payload.options, inputs[0])
            output = work / f"output.{extension}"

            async def report_progress(progress: int | None, stage: str | None) -> None:
                current = await self._repo.get(job_id)
                if current is None or current.status in TERMINAL:
                    raise InterruptedError("Job was cancelled.")
                await self._update(job_id, progress=progress, stage=stage)

            context = ProcessorContext(
                job_id=job_id,
                tool_id=tool.id,
                options=payload.options,
                work_dir=work,
                cancel_event=self._cancel.setdefault(job_id, asyncio.Event()),
                on_progress=report_progress,
            )
            await self._update(job_id, stage="processing", progress=None)
            current = await self._repo.get(job_id)
            if current is None or current.status in TERMINAL:
                return
            processor = get_processor(tool.id)
            result = await asyncio.wait_for(
                processor.process(inputs, output, context=context), timeout=tool.timeout
            )
            current = await self._repo.get(job_id)
            if current is None or current.status in TERMINAL:
                return
            if result.extension:
                extension = result.extension
            if result.content_type:
                content_type = result.content_type
            if result.extension and output.suffix != f".{extension}":
                renamed = output.with_suffix(f".{extension}")
                if output.is_file():
                    output.replace(renamed)
                output = renamed
            if not output.is_file() or output.stat().st_size == 0:
                raise ProcessingError("Processor produced no output.")
            if output.stat().st_size > get_settings().max_result_mb * 1024 * 1024:
                raise ProcessingError("Processor output exceeds the safety limit.")
            storage_key, stored = upload_service.result_path(job_id, extension)
            shutil.copy2(output, stored)
            download_url, expires_at = signed_download_path(storage_key)
            payload_result = {
                "filename": f"{tool.id}-result.{extension}",
                "contentType": content_type,
                "size": stored.stat().st_size,
                "storageKey": storage_key,
                "downloadUrl": download_url,
                "expiresAt": expires_at.isoformat(),
                **result.metadata,
            }
            await self._update(
                job_id,
                status=JobStatus.COMPLETED.value,
                stage="finalizing",
                progress=100,
                result=payload_result,
            )
        except (asyncio.CancelledError, InterruptedError):
            current = await self._repo.get(job_id)
            if current and current.status not in TERMINAL:
                await self._update(
                    job_id, status=JobStatus.CANCELLED.value, stage=None, progress=None
                )
        except TimeoutError:
            await self._update(
                job_id,
                status=JobStatus.FAILED.value,
                stage=None,
                progress=None,
                error={"code": "JOB_TIMEOUT", "message": "Processing timed out."},
            )
        except (ApiError, ProcessingError, OSError, ValueError) as exc:
            message = exc.message if isinstance(exc, ApiError) else str(exc)
            code = exc.code if isinstance(exc, (ApiError, ProcessingError)) else "PROCESSING_FAILED"
            await self._update(
                job_id,
                status=JobStatus.FAILED.value,
                stage=None,
                progress=None,
                error={"code": code, "message": message},
            )
        finally:
            cleanup_work_dir(job_id)
            await self._limiter.release(job_id)
            self._cancel.pop(job_id, None)

    def _discard_task(self, job_id: str, completed: asyncio.Task[None]) -> None:
        if self._tasks.get(job_id) is completed:
            self._tasks.pop(job_id, None)

    async def _update(self, job_id: str, **updates: Any) -> Job:
        current = await self.get(job_id)
        if current.status in TERMINAL and updates.get("status") != JobStatus.EXPIRED:
            return current
        target = updates.get("status", current.status)
        ensure_transition(current.status, str(target))
        updated = await self._repo.update_from(current.status, job_id, **updates)
        if updated is None:
            return await self.get(job_id)
        return updated

    async def _require_premium(
        self,
        tool: Tool,
        entitlement_token: str | None,
        entitlements: EntitlementService | None,
    ) -> tuple[str, str] | None:
        capability = tool.required_capability or capability_for_tool(tool.id)
        if not tool.premium and not capability:
            return None
        if entitlements is None:
            raise ApiError(
                status.HTTP_403_FORBIDDEN,
                "LICENSE_REQUIRED",
                "A Pro license is required for this tool.",
            )
        return await entitlements.require(entitlement_token, capability or tool.id)

    @staticmethod
    def _tool(tool_id: str) -> Tool:
        try:
            return tool_registry[tool_id]
        except KeyError:
            raise ApiError(
                status.HTTP_404_NOT_FOUND, "JOB_NOT_FOUND", "Tool was not found."
            ) from None


def _source_suffix(upload_service: Any, file_key: str, source: Path) -> str:
    issued = upload_service.issued(file_key)
    if issued is not None:
        suffix = Path(issued.filename).suffix.lower()
        if suffix:
            return suffix
    return source.suffix.lower()


_service = JobService()


def get_job_service() -> JobService:
    return _service
