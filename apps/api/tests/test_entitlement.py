from unittest.mock import MagicMock

from httpx import AsyncClient

from app.core.capabilities import capability_for_tool, capabilities_for_plan
from app.core.config import Settings
from app.core.enums import LicensePlan
from app.services.entitlement_service import EntitlementService
from app.tools.registry import tool_registry
from tests.helpers import png_bytes, upload_image


PRO_TOOL_CAPABILITIES = {
    "blur-face": "image.face_blur",
    "remove-background": "image.ai.background_removal",
    "speech-to-text": "audio.speech_to_text",
    "text-to-speech": "audio.text_to_speech",
    "add-subtitle": "video.add_subtitle",
    "noise-reduction": "audio.noise_reduction",
    "upscale-image": "image.ai.upscale",
    "ocr-pdf": "document.ocr.advanced",
}


def test_entitlement_service_defers_signer_without_keys() -> None:
    service = EntitlementService(
        MagicMock(),
        settings=Settings(entitlement_private_key="", entitlement_public_key=""),
    )
    assert service._signer is None


def test_pro_tools_are_capability_gated() -> None:
    plan_capabilities = set(capabilities_for_plan(LicensePlan.PRO_1_MONTH))
    for tool_id, capability in PRO_TOOL_CAPABILITIES.items():
        tool = tool_registry[tool_id]
        assert tool.premium is True
        assert tool.required_capability == capability
        assert capability_for_tool(tool_id) == capability
        assert capability in plan_capabilities


async def test_status_without_token(api: AsyncClient) -> None:
    response = await api.get("/api/v1/licenses/status")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "ENTITLEMENT_INVALID"


async def test_free_job_does_not_need_license(api: AsyncClient) -> None:
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


async def test_premium_job_requires_activated_license(admin_api: AsyncClient) -> None:
    api = admin_api
    blocked = await api.post(
        "/api/v1/uploads/presign",
        json={
            "filename": "input.png",
            "contentType": "image/png",
            "size": len(png_bytes()),
            "toolId": "remove-background",
        },
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "LICENSE_REQUIRED"

    issued = (
        await api.post(
            "/api/v1/admin/licenses",
            json={"durationMonths": 1},
        )
    ).json()["data"]
    activated = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": issued["licenseKey"], "installationId": "install-a"},
    )
    token = activated.json()["data"]["token"]
    headers = {"X-Entitlement-Token": token}
    allowed = await api.post(
        "/api/v1/uploads/presign",
        json={
            "filename": "input.png",
            "contentType": "image/png",
            "size": len(png_bytes()),
            "toolId": "remove-background",
        },
        headers=headers,
    )
    assert allowed.status_code == 200

    status = await api.get("/api/v1/licenses/status", headers=headers)
    assert status.json()["data"]["installationActive"] is True
    assert "image.ai.upscale" in status.json()["data"]["capabilities"]


async def test_tampered_token_is_rejected(admin_api: AsyncClient) -> None:
    api = admin_api
    issued = (
        await api.post(
            "/api/v1/admin/licenses",
            json={"durationMonths": 1},
        )
    ).json()["data"]
    activated = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": issued["licenseKey"], "installationId": "install-a"},
    )
    token = activated.json()["data"]["token"]
    tampered = token[:-4] + ("AAAA" if token[-4:] != "AAAA" else "BBBB")
    response = await api.get("/api/v1/licenses/status", headers={"X-Entitlement-Token": tampered})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ENTITLEMENT_INVALID"


async def test_revoked_license_rejects_unexpired_token(admin_api: AsyncClient) -> None:
    api = admin_api
    issued = (
        await api.post(
            "/api/v1/admin/licenses",
            json={"durationMonths": 1},
        )
    ).json()["data"]
    activated = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": issued["licenseKey"], "installationId": "install-a"},
    )
    token = activated.json()["data"]["token"]
    await api.post(
        f"/api/v1/admin/licenses/{issued['licenseId']}/revoke",
    )
    blocked = await api.post(
        "/api/v1/uploads/presign",
        json={
            "filename": "input.png",
            "contentType": "image/png",
            "size": len(png_bytes()),
            "toolId": "remove-background",
        },
        headers={"X-Entitlement-Token": token},
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "LICENSE_REVOKED"
