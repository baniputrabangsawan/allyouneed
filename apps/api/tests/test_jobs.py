import pytest
from httpx import AsyncClient

from tests.helpers import upload_image, wait_for_job


async def test_unknown_tool(api: AsyncClient) -> None:
    response = await api.post(
        "/api/v1/jobs",
        json={"toolId": "does-not-exist", "input": {"fileKey": "uploads/x"}, "options": {}},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "JOB_NOT_FOUND"


async def test_job_not_found(api: AsyncClient) -> None:
    response = await api.get("/api/v1/jobs/job_missing")
    assert response.status_code == 404


async def test_result_not_ready(api: AsyncClient) -> None:
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
    result = await api.get(f"/api/v1/jobs/{job_id}/result")
    if result.status_code == 409:
        assert result.json()["error"]["code"] == "JOB_NOT_READY"
    else:
        job = await wait_for_job(api, job_id)
        assert job["status"] == "completed"


async def test_cancel_completed_job_is_noop(api: AsyncClient) -> None:
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
    cancelled = await api.delete(f"/api/v1/jobs/{job['jobId']}")
    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "completed"


async def test_unsigned_download_is_rejected(api: AsyncClient) -> None:
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
    result = (await api.get(f"/api/v1/jobs/{job['jobId']}/result")).json()["data"]["result"]
    unsigned = result["downloadUrl"].split("?")[0]
    response = await api.get(unsigned)
    assert response.status_code == 404


async def test_enqueue_failure_returns_queue_unavailable(
    api: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(
        "app.services.job_service.get_settings",
        lambda: settings.model_copy(update={"inline_jobs": False}),
    )
    monkeypatch.setattr(
        "app.workers.tasks.enqueue",
        lambda _queue, _job_id: (_ for _ in ()).throw(ConnectionError("redis down")),
    )
    file_key = await upload_image(api)
    created = await api.post(
        "/api/v1/jobs",
        json={
            "toolId": "resize-image",
            "input": {"fileKey": file_key},
            "options": {"width": 8, "height": 6},
        },
    )
    assert created.status_code == 503
    assert created.json()["error"]["code"] == "PROCESSING_QUEUE_UNAVAILABLE"
