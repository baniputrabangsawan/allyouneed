import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.core.enums import JobStatus
from app.core.state_machine import ensure_transition
from app.db.session import dispose_engine
from app.repositories.jobs import JobRepository
from app.schemas.jobs import CreateJobRequest, Job
from app.services.job_service import JobService
from app.services.upload_service import get_upload_service
from tests.helpers import upload_image, wait_for_job


def _disable_inline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "inline_jobs", False)
    monkeypatch.setattr("app.workers.tasks.enqueue", lambda queue, job_id: None)


async def test_job_is_visible_to_a_new_repository(api: AsyncClient) -> None:
    file_key = await upload_image(api)
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "resize-image",
            "input": {"fileKey": file_key},
            "options": {"width": 8, "height": 6},
        },
    )
    job_id = created.json()["data"]["jobId"]
    found = await JobRepository().get(job_id)
    assert found is not None
    assert found.job_id == job_id
    payload = await JobRepository().payload(job_id)
    assert payload.tool_id == "resize-image"
    assert payload.input["fileKey"] == file_key


async def test_worker_executes_from_job_id_only(
    api: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _disable_inline(monkeypatch)
    file_key = await upload_image(api)
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "resize-image",
            "input": {"fileKey": file_key},
            "options": {"width": 8, "height": 6},
        },
    )
    assert created.status_code == 202
    job_id = created.json()["data"]["jobId"]
    queued = (await api.get(f"/api/v1/jobs/{job_id}")).json()["data"]
    assert queued["status"] == "queued"

    get_upload_service()._completed.clear()
    get_upload_service()._issued.clear()
    worker = JobService()
    await worker.execute(job_id)
    job = await wait_for_job(api, job_id)
    assert job["status"] == "completed"
    result = (await api.get(f"/api/v1/jobs/{job_id}/result")).json()["data"]["result"]
    assert result["filename"]
    assert result["downloadUrl"]
    assert "storageKey" not in result


async def test_inline_jobs_false_leaves_job_queued(
    api: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _disable_inline(monkeypatch)
    file_key = await upload_image(api)
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "resize-image",
            "input": {"fileKey": file_key},
            "options": {"width": 8, "height": 6},
        },
    )
    job_id = created.json()["data"]["jobId"]
    job = (await api.get(f"/api/v1/jobs/{job_id}")).json()["data"]
    assert job["status"] == "queued"
    await JobService().execute(job_id)
    done = await wait_for_job(api, job_id)
    assert done["status"] == "completed"


async def test_job_survives_engine_restart(
    api: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _disable_inline(monkeypatch)
    file_key = await upload_image(api)
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "resize-image",
            "input": {"fileKey": file_key},
            "options": {"width": 8, "height": 6},
        },
    )
    job_id = created.json()["data"]["jobId"]
    await dispose_engine()
    found = (await api.get(f"/api/v1/jobs/{job_id}")).json()["data"]
    assert found["jobId"] == job_id
    assert found["status"] == "queued"


async def test_cancel_survives_engine_restart(
    api: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _disable_inline(monkeypatch)
    file_key = await upload_image(api)
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "resize-image",
            "input": {"fileKey": file_key},
            "options": {"width": 8, "height": 6},
        },
    )
    job_id = created.json()["data"]["jobId"]
    cancelled = await api.delete(f"/api/v1/jobs/{job_id}")
    assert cancelled.json()["data"]["status"] == "cancelled"
    await dispose_engine()
    found = (await api.get(f"/api/v1/jobs/{job_id}")).json()["data"]
    assert found["status"] == "cancelled"


async def test_result_survives_engine_restart(api: AsyncClient) -> None:
    file_key = await upload_image(api)
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "resize-image",
            "input": {"fileKey": file_key},
            "options": {"width": 8, "height": 6},
        },
    )
    job = await wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed"
    before = (await api.get(f"/api/v1/jobs/{job['jobId']}/result")).json()["data"]["result"]
    await dispose_engine()
    after = (await api.get(f"/api/v1/jobs/{job['jobId']}/result")).json()["data"]["result"]
    assert after["filename"] == before["filename"]
    assert after["contentType"] == before["contentType"]
    assert after["size"] == before["size"]
    assert after["downloadUrl"]


async def test_illegal_status_transition_is_rejected() -> None:
    repo = JobRepository()
    job = Job(
        job_id="job_illegal_transition",
        status=JobStatus.QUEUED.value,
        tool_id="resize-image",
    )
    await repo.save(
        job,
        CreateJobRequest(tool_id="resize-image", input={}, options={}),
        execution_mode="async",
    )
    with pytest.raises(ValueError, match="Illegal job transition"):
        await repo.update_from(
            JobStatus.QUEUED.value,
            job.job_id,
            status=JobStatus.COMPLETED.value,
        )
    with pytest.raises(ValueError, match="Illegal job transition"):
        ensure_transition(JobStatus.COMPLETED, JobStatus.PROCESSING)
    stored = await repo.get(job.job_id)
    assert stored is not None
    assert stored.status == "queued"
