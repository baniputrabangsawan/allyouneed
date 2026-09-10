from httpx import AsyncClient

from tests.helpers import upload_image, wait_for_job


async def test_health_live(api: AsyncClient) -> None:
    response = await api.get("/api/v1/health/live", headers={"X-Request-ID": "req_test"})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req_test"


async def test_health_ready(api: AsyncClient) -> None:
    response = await api.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"


async def test_resize_image_end_to_end(api: AsyncClient) -> None:
    from io import BytesIO

    from PIL import Image

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
    job = await wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed"
    result = await api.get(f"/api/v1/jobs/{job['jobId']}/result")
    downloaded = await api.get(result.json()["data"]["result"]["downloadUrl"])
    assert downloaded.status_code == 200
    with Image.open(BytesIO(downloaded.content)) as image:
        assert image.size == (8, 6)


async def test_idempotency_conflict(api: AsyncClient) -> None:
    file_key = await upload_image(api)
    payload = {
        "toolId": "resize-image",
        "input": {"fileKey": file_key},
        "options": {"width": 8, "height": 6},
    }
    first = await api.post("/api/v1/jobs", json=payload, headers={"Idempotency-Key": "same"})
    second = await api.post("/api/v1/jobs", json=payload, headers={"Idempotency-Key": "same"})
    conflict = await api.post(
        "/api/v1/jobs",
        json={**payload, "options": {"width": 9, "height": 6}},
        headers={"Idempotency-Key": "same"},
    )
    assert first.json()["data"]["jobId"] == second.json()["data"]["jobId"]
    assert conflict.status_code == 409


async def test_reject_invalid_upload(api: AsyncClient) -> None:
    presigned = await api.post(
        "/api/v1/uploads/presign",
        json={
            "filename": "x.png",
            "contentType": "image/png",
            "size": 4,
            "toolId": "resize-image",
        },
    )
    upload = presigned.json()["data"]
    await api.put(upload["uploadUrl"], content=b"nope", headers=upload["headers"])
    response = await api.post("/api/v1/uploads/complete", json={"fileKey": upload["fileKey"]})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_FILE"
