import asyncio
from io import BytesIO

from httpx import AsyncClient
from PIL import Image

from app.core.license_crypto import generate_device_secret

DEVICE_SECRET = generate_device_secret()


def activate_json(
    license_key: str, installation_id: str, secret: str | None = None
) -> dict[str, str]:
    return {
        "licenseKey": license_key,
        "installationId": installation_id,
        "deviceSecret": secret or DEVICE_SECRET,
    }


async def upload_bytes(
    api: AsyncClient,
    data: bytes,
    *,
    filename: str,
    content_type: str,
    tool_id: str,
    headers: dict[str, str] | None = None,
) -> str:
    presigned = await api.post(
        "/api/v1/uploads/presign",
        json={
            "filename": filename,
            "contentType": content_type,
            "size": len(data),
            "toolId": tool_id,
        },
        headers=headers or {},
    )
    upload = presigned.json()["data"]
    put = await api.put(upload["uploadUrl"], content=data, headers=upload["headers"])
    assert put.status_code == 204
    complete = await api.post("/api/v1/uploads/complete", json={"fileKey": upload["fileKey"]})
    assert complete.status_code == 200
    return upload["fileKey"]


async def upload_image(api: AsyncClient, tool_id: str = "resize-image") -> str:
    buffer = BytesIO()
    Image.new("RGB", (40, 20), "red").save(buffer, "PNG")
    return await upload_bytes(
        api, buffer.getvalue(), filename="input.png", content_type="image/png", tool_id=tool_id
    )


async def upload_pdf(api: AsyncClient, tool_id: str = "compress-pdf") -> str:
    import fitz

    document = fitz.open()
    page = document.new_page(width=200, height=200)
    page.insert_text((20, 40), "hello")
    data = document.tobytes()
    document.close()
    return await upload_bytes(
        api, data, filename="input.pdf", content_type="application/pdf", tool_id=tool_id
    )


async def pro_headers(api: AsyncClient, installation_id: str = "install-test") -> dict[str, str]:
    issued = (await api.post("/api/v1/admin/licenses", json={"durationMonths": 1})).json()["data"]
    activated = await api.post(
        "/api/v1/licenses/activate",
        json=activate_json(issued["licenseKey"], installation_id),
    )
    return {"X-Entitlement-Token": activated.json()["data"]["token"]}


async def wait_for_job(api: AsyncClient, job_id: str) -> dict[str, object]:
    for _ in range(200):
        job = (await api.get(f"/api/v1/jobs/{job_id}")).json()["data"]
        if job["status"] in {"completed", "failed", "cancelled"}:
            return job
        await asyncio.sleep(0.01)
    raise AssertionError("job did not finish")


def png_bytes(size: tuple[int, int] = (40, 20)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, "red").save(buffer, "PNG")
    return buffer.getvalue()
