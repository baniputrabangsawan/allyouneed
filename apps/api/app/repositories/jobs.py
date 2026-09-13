from datetime import timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.core.clock import aware, now
from app.core.config import get_settings
from app.core.enums import JobStatus
from app.core.job_payload import input_keys
from app.core.state_machine import TERMINAL, ensure_transition
from app.db.models import JobInput, JobOutput, ProcessingJob
from app.db.session import get_session_factory
from app.schemas.jobs import CreateJobRequest, Job
from app.utils.signing import signed_download_path

_JOB_LOAD = (selectinload(ProcessingJob.inputs), selectinload(ProcessingJob.result))

_RESULT_PUBLIC_KEYS = frozenset(
    {"filename", "contentType", "size", "downloadUrl", "expiresAt", "storageKey"}
)


class JobRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession] | None = None) -> None:
        self._session_factory = session_factory

    def _factory(self) -> async_sessionmaker[AsyncSession]:
        return self._session_factory or get_session_factory()

    async def save(
        self,
        job: Job,
        payload: CreateJobRequest | None = None,
        *,
        idempotency_key: str | None = None,
        idempotency_fingerprint: str | None = None,
        execution_mode: str | None = None,
    ) -> Job:
        factory = self._factory()
        async with factory() as session:
            row = await self._load(session, job.job_id)
            if row is None:
                stamp = job.updated_at
                row = ProcessingJob(
                    id=job.job_id,
                    tool_id=job.tool_id or (payload.tool_id if payload else ""),
                    status=job.status,
                    execution_mode=execution_mode or "async",
                    progress=job.progress,
                    stage=job.stage,
                    input_payload=payload.input if payload is not None else {},
                    options=payload.options if payload is not None else {},
                    error_code=_error_code(job.error),
                    error_message=_error_message(job.error),
                    request_id=job.request_id,
                    idempotency_key=idempotency_key,
                    idempotency_fingerprint=idempotency_fingerprint,
                    created_at=job.created_at,
                    started_at=None,
                    completed_at=None,
                    failed_at=None,
                    cancelled_at=None,
                    expires_at=job.created_at + timedelta(seconds=get_settings().file_ttl_seconds),
                    updated_at=stamp,
                )
                _stamp_status_times(row, job.status, stamp)
                session.add(row)
                await session.flush()
                if payload is not None:
                    await _write_inputs(session, job.job_id, payload.input)
                if job.result:
                    await _write_result(session, job.job_id, job.result)
            else:
                _apply_job_fields(row, job)
                if payload is not None:
                    row.input_payload = payload.input
                    row.options = payload.options
                    await _write_inputs(session, job.job_id, payload.input)
                if idempotency_key:
                    row.idempotency_key = idempotency_key
                    row.idempotency_fingerprint = idempotency_fingerprint
                if execution_mode:
                    row.execution_mode = execution_mode
                if job.result is not None:
                    await _write_result(session, job.job_id, job.result)
            await session.commit()
            row = await self._load(session, job.job_id)
            assert row is not None
            return _to_job(row)

    async def get(self, job_id: str) -> Job | None:
        factory = self._factory()
        async with factory() as session:
            row = await self._load(session, job_id)
            return _to_job(row) if row is not None else None

    async def payload(self, job_id: str) -> CreateJobRequest:
        factory = self._factory()
        async with factory() as session:
            row = await self._load(session, job_id)
            if row is None:
                raise KeyError(job_id)
            return CreateJobRequest(
                tool_id=row.tool_id,
                input=dict(row.input_payload),
                options=dict(row.options),
            )

    async def remember_idempotency(self, key: str, fingerprint: str, job_id: str) -> None:
        factory = self._factory()
        async with factory() as session:
            row = await session.get(ProcessingJob, job_id)
            if row is None:
                return
            row.idempotency_key = key
            row.idempotency_fingerprint = fingerprint
            await session.commit()

    async def idempotency(self, key: str) -> tuple[str, str] | None:
        factory = self._factory()
        async with factory() as session:
            result = await session.execute(
                select(ProcessingJob).where(ProcessingJob.idempotency_key == key)
            )
            row = result.scalar_one_or_none()
            if row is None or row.idempotency_fingerprint is None:
                return None
            return row.idempotency_fingerprint, row.id

    async def update_from(self, expected_status: str, job_id: str, **updates: Any) -> Job | None:
        factory = self._factory()
        async with factory() as session:
            row = await self._load(session, job_id)
            if row is None:
                return None
            target = str(updates.get("status", row.status))
            if row.status in {status.value for status in TERMINAL} and target != JobStatus.EXPIRED:
                return _to_job(row)
            ensure_transition(row.status, target)
            stamp = now()
            values = _update_values(updates, stamp)
            result = await session.execute(
                update(ProcessingJob)
                .where(ProcessingJob.id == job_id, ProcessingJob.status == expected_status)
                .values(**values)
            )
            if getattr(result, "rowcount", 0) == 0:
                await session.rollback()
                return None
            if updates.get("result") is not None:
                await _write_result(session, job_id, updates["result"])
            await session.commit()
            row = await self._load(session, job_id)
            return _to_job(row) if row is not None else None

    async def _load(self, session: AsyncSession, job_id: str) -> ProcessingJob | None:
        result = await session.execute(
            select(ProcessingJob).options(*_JOB_LOAD).where(ProcessingJob.id == job_id)
        )
        return result.scalar_one_or_none()


def _error_code(error: dict[str, Any] | None) -> str | None:
    if not error:
        return None
    code = error.get("code")
    return str(code) if code else None


def _error_message(error: dict[str, Any] | None) -> str | None:
    if not error:
        return None
    message = error.get("message")
    return str(message) if message else None


def _apply_job_fields(row: ProcessingJob, job: Job) -> None:
    previous = row.status
    row.status = job.status
    row.progress = job.progress
    row.stage = job.stage
    row.error_code = _error_code(job.error)
    row.error_message = _error_message(job.error)
    row.request_id = job.request_id
    row.updated_at = job.updated_at
    if job.tool_id:
        row.tool_id = job.tool_id
    if previous != job.status:
        _stamp_status_times(row, job.status, job.updated_at)


def _update_values(updates: dict[str, Any], stamp: Any) -> dict[str, Any]:
    values: dict[str, Any] = {"updated_at": stamp}
    if "status" in updates and updates["status"] is not None:
        status = str(updates["status"])
        values["status"] = status
        _status_time_values(values, status, stamp)
    if "progress" in updates:
        values["progress"] = updates["progress"]
    if "stage" in updates:
        values["stage"] = updates["stage"]
    if "error" in updates:
        values["error_code"] = _error_code(updates["error"])
        values["error_message"] = _error_message(updates["error"])
    if "request_id" in updates:
        values["request_id"] = updates["request_id"]
    return values


def _stamp_status_times(row: ProcessingJob, status: str, stamp: Any) -> None:
    if status == JobStatus.PROCESSING:
        row.started_at = stamp
    elif status == JobStatus.COMPLETED:
        row.completed_at = stamp
    elif status == JobStatus.FAILED:
        row.failed_at = stamp
    elif status == JobStatus.CANCELLED:
        row.cancelled_at = stamp


def _status_time_values(values: dict[str, Any], status: str, stamp: Any) -> None:
    if status == JobStatus.PROCESSING:
        values["started_at"] = stamp
    elif status == JobStatus.COMPLETED:
        values["completed_at"] = stamp
    elif status == JobStatus.FAILED:
        values["failed_at"] = stamp
    elif status == JobStatus.CANCELLED:
        values["cancelled_at"] = stamp


async def _write_inputs(session: AsyncSession, job_id: str, input_data: dict[str, Any]) -> None:
    await session.execute(delete(JobInput).where(JobInput.job_id == job_id))
    stamp = now()
    for position, key in enumerate(input_keys(input_data)):
        session.add(
            JobInput(
                id=str(uuid4()),
                job_id=job_id,
                file_key=key,
                position=position,
                created_at=stamp,
            )
        )


async def _write_result(session: AsyncSession, job_id: str, result: dict[str, Any]) -> None:
    await session.execute(delete(JobOutput).where(JobOutput.job_id == job_id))
    metadata = {key: value for key, value in result.items() if key not in _RESULT_PUBLIC_KEYS}
    session.add(
        JobOutput(
            id=str(uuid4()),
            job_id=job_id,
            storage_key=str(result.get("storageKey") or _storage_key_from_download(result)),
            filename=str(result.get("filename") or "result.bin"),
            content_type=str(result.get("contentType") or "application/octet-stream"),
            size=int(result.get("size") or 0),
            result_metadata=metadata or None,
            created_at=now(),
        )
    )


def _to_job(row: ProcessingJob) -> Job:
    error = None
    if row.error_code:
        error = {"code": row.error_code, "message": row.error_message or ""}
    result = None
    if row.result is not None:
        download_url, expires_at = signed_download_path(row.result.storage_key)
        result = {
            "filename": row.result.filename,
            "contentType": row.result.content_type,
            "size": row.result.size,
            "downloadUrl": download_url,
            "expiresAt": expires_at.isoformat(),
            **(row.result.result_metadata or {}),
        }
    return Job(
        job_id=row.id,
        status=JobStatus(row.status),  # type: ignore[arg-type]
        created_at=aware(row.created_at),
        updated_at=aware(row.updated_at),
        progress=row.progress,
        stage=row.stage,
        error=error,
        result=result,
        tool_id=row.tool_id,
        request_id=row.request_id,
    )


def _storage_key_from_download(result: dict[str, Any]) -> str:
    url = str(result.get("downloadUrl") or "")
    path = url.split("?", 1)[0]
    marker = "/api/v1/downloads/"
    if marker in path:
        return path.split(marker, 1)[1]
    return path.lstrip("/")
