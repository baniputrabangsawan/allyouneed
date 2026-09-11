from httpx import AsyncClient

ADMIN = {"X-Admin-Key": "test-admin-key", "X-Request-ID": "req_admin_test"}


async def test_admin_create_list_and_audit_do_not_leak_key(api: AsyncClient) -> None:
    created = await api.post(
        "/api/v1/admin/licenses",
        json={"durationMonths": 6, "note": "order-42"},
        headers=ADMIN,
    )
    assert created.status_code == 201
    issued = created.json()["data"]
    assert issued["licenseKey"].startswith("UTL-PRO-")
    assert "licenseHash" not in issued

    listed = await api.get("/api/v1/admin/licenses?status=unused", headers=ADMIN)
    assert listed.status_code == 200
    row = next(
        item for item in listed.json()["data"]["items"] if item["licenseId"] == issued["licenseId"]
    )
    assert "licenseKey" not in row
    assert "licenseHash" not in row
    assert row["note"] == "order-42"

    audit = await api.get(f"/api/v1/admin/audit?license_id={issued['licenseId']}", headers=ADMIN)
    event = audit.json()["data"]["items"][0]
    assert event["action"] == "license_created"
    assert event["requestId"] == "req_admin_test"
    assert issued["licenseKey"] not in audit.text


async def test_admin_security_headers_and_origin(api: AsyncClient) -> None:
    response = await api.get("/api/v1/admin/licenses/me", headers=ADMIN)
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Content-Security-Policy"] == "frame-ancestors 'none'"

    blocked = await api.post(
        "/api/v1/admin/licenses",
        json={"durationMonths": 1},
        headers={**ADMIN, "Origin": "https://attacker.example"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "ADMIN_FORBIDDEN"


async def test_admin_rejects_invalid_duration_and_request_id(api: AsyncClient) -> None:
    response = await api.post(
        "/api/v1/admin/licenses",
        json={"durationMonths": 2},
        headers={"X-Admin-Key": "test-admin-key", "X-Request-ID": "invalid id\n"},
    )
    assert response.status_code == 422
    assert response.headers["X-Request-ID"].startswith("req_")
