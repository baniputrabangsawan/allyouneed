from datetime import UTC, datetime, timedelta

from dateutil.relativedelta import relativedelta
from httpx import AsyncClient
from sqlalchemy import select

from app.core.enums import LicensePlan
from app.core.license_crypto import generate_license_key, hash_license_key, is_license_key_format
from app.db.models import License
from app.db.session import get_session_factory
from app.services.license_service import LicenseService


def test_license_key_format() -> None:
    key = generate_license_key()
    assert is_license_key_format(key)
    assert key.startswith("UTL-PRO-")
    assert hash_license_key(key) != key
    assert is_license_key_format(key.lower().replace("-", ""))


async def test_issue_activate_one_installation(api: AsyncClient) -> None:
    issued = await api.post(
        "/api/v1/admin/licenses",
        json={"durationMonths": 1},
        headers={"X-Admin-Key": "test-admin-key"},
    )
    assert issued.status_code == 201
    data = issued.json()["data"]
    key = data["licenseKey"]
    assert is_license_key_format(key)
    assert data["expiresAt"] is None

    first = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": key, "installationId": "install-a"},
    )
    assert first.status_code == 200
    body = first.json()["data"]
    assert body["token"]
    assert body["plan"] == "pro_1_month"
    assert "image.ai.background_removal" in body["capabilities"]

    second = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": key, "installationId": "install-b"},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "ACTIVATION_LIMIT_REACHED"

    same = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": key, "installationId": "install-a"},
    )
    assert same.status_code == 200

    deactivated = await api.post(
        "/api/v1/licenses/deactivate",
        headers={"X-Entitlement-Token": body["token"]},
    )
    assert deactivated.status_code == 200
    moved = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": key, "installationId": "install-b"},
    )
    assert moved.status_code == 200
    assert moved.json()["data"]["token"]


async def test_admin_required(api: AsyncClient) -> None:
    response = await api.post("/api/v1/admin/licenses", json={"durationMonths": 1})
    assert response.status_code == 401


async def test_renew_suspend_revoke(api: AsyncClient) -> None:
    issued = (
        await api.post(
            "/api/v1/admin/licenses",
            json={"durationMonths": 1},
            headers={"X-Admin-Key": "test-admin-key"},
        )
    ).json()["data"]
    license_id = issued["licenseId"]

    activated = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": issued["licenseKey"], "installationId": "install-a"},
    )
    original_expiry = activated.json()["data"]["expiresAt"]

    renewed = await api.post(
        f"/api/v1/admin/licenses/{license_id}/renew",
        json={"durationMonths": 6},
        headers={"X-Admin-Key": "test-admin-key"},
    )
    assert renewed.status_code == 200
    assert renewed.json()["data"]["plan"] == "pro_6_months"
    assert renewed.json()["data"]["expiresAt"] > original_expiry

    suspended = await api.post(
        f"/api/v1/admin/licenses/{license_id}/suspend",
        headers={"X-Admin-Key": "test-admin-key"},
    )
    assert suspended.json()["data"]["status"] == "suspended"

    activate = await api.post(
        "/api/v1/licenses/activate",
        json={"licenseKey": issued["licenseKey"], "installationId": "install-a"},
    )
    assert activate.status_code == 403
    assert activate.json()["error"]["code"] == "LICENSE_SUSPENDED"

    await api.post(
        f"/api/v1/admin/licenses/{license_id}/resume",
        headers={"X-Admin-Key": "test-admin-key"},
    )
    revoked = await api.post(
        f"/api/v1/admin/licenses/{license_id}/revoke",
        headers={"X-Admin-Key": "test-admin-key"},
    )
    assert revoked.json()["data"]["status"] == "revoked"
    renew_revoked = await api.post(
        f"/api/v1/admin/licenses/{license_id}/renew",
        json={"durationMonths": 1},
        headers={"X-Admin-Key": "test-admin-key"},
    )
    assert renew_revoked.status_code == 409


async def test_expired_license_cannot_activate() -> None:
    factory = get_session_factory()
    async with factory() as session:
        service = LicenseService(session)
        issued = await service.issue(LicensePlan.PRO_1_MONTH)
        await service.activate(issued.license_key, "install-a")
        result = await session.execute(select(License).where(License.id == issued.license_id))
        license = result.scalar_one()
        license.expires_at = datetime.now(UTC) - timedelta(days=1)
        await session.commit()

    async with factory() as session:
        service = LicenseService(session)
        try:
            await service.activate(issued.license_key, "install-a")
            raise AssertionError("expired license activated")
        except Exception as exc:
            assert getattr(exc, "code", None) == "LICENSE_EXPIRED"


async def test_calendar_month_duration() -> None:
    start = datetime(2024, 1, 31, tzinfo=UTC)
    factory = get_session_factory()

    async with factory() as session:
        service = LicenseService(session, clock=lambda: start)
        issued = await service.issue(LicensePlan.PRO_1_MONTH)
        license, _ = await service.activate(issued.license_key, "install-a")
        assert license.activated_at == start
        assert license.expires_at == start + relativedelta(months=1)
        assert license.expires_at == datetime(2024, 2, 29, tzinfo=UTC)
