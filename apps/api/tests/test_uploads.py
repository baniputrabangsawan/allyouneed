from httpx import AsyncClient

from tests.helpers import png_bytes, upload_image


async def test_get_upload_after_complete(api: AsyncClient) -> None:
    data = png_bytes()
    file_key = await upload_image(api)
    response = await api.get(f"/api/v1/uploads/{file_key}")
    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["fileKey"] == file_key
    assert payload["filename"] == "input.png"
    assert payload["contentType"] == "image/png"
    assert payload["size"] == len(data)


async def test_get_upload_missing(api: AsyncClient) -> None:
    response = await api.get("/api/v1/uploads/uploads/2099/01/01/missing")
    assert response.status_code in {404, 422}
    assert response.json()["error"]["code"] in {"INVALID_FILE", "UPLOAD_FAILED", "NOT_FOUND"}


async def test_completed_upload_cannot_be_overwritten(api: AsyncClient) -> None:
    file_key = await upload_image(api)
    response = await api.put(
        f"/api/v1/uploads/local/{file_key}",
        content=png_bytes(),
        headers={"Content-Type": "image/png"},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "UPLOAD_REPLAYED"
