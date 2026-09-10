from httpx import AsyncClient

from tests.helpers import upload_pdf, wait_for_job


async def test_pdf_to_text_job(api: AsyncClient) -> None:
    file_key = await upload_pdf(api, tool_id="pdf-to-text")
    created = await api.post(
        "/api/v1/jobs",
        json={"toolId": "pdf-to-text", "input": {"fileKey": file_key}, "options": {}},
    )
    job = await wait_for_job(api, created.json()["data"]["jobId"])
    assert job["status"] == "completed"
    result = await api.get(f"/api/v1/jobs/{job['jobId']}/result")
    downloaded = await api.get(result.json()["data"]["result"]["downloadUrl"])
    assert downloaded.status_code == 200
    assert b"hello" in downloaded.content
