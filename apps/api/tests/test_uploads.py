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
