import os
from pathlib import Path

from app.security.entitlement import generate_keypair

TEST_DB = Path(f"/tmp/utility-api-tests-{os.getpid()}.db")
for sqlite_file in (TEST_DB, Path(f"{TEST_DB}-shm"), Path(f"{TEST_DB}-wal")):
    sqlite_file.unlink(missing_ok=True)
private_pem, public_pem = generate_keypair()
os.environ["LICENSE_DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB}"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB}"
os.environ["APP_ENV"] = "test"
os.environ["ADMIN_TOTP_ENCRYPTION_KEY"] = "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE="
os.environ["INLINE_JOBS"] = "true"
os.environ["ENTITLEMENT_PRIVATE_KEY"] = private_pem
os.environ["ENTITLEMENT_PUBLIC_KEY"] = public_pem
os.environ["ENTITLEMENT_KEY_ID"] = "test-ent-1"

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from app.db.models import AdminRecoveryCode, AdminSession, AdminUser  # noqa: E402
from app.db.session import create_schema, get_session_factory  # noqa: E402
from app.main import app  # noqa: E402
from app.services.admin_auth_service import AdminAuthService  # noqa: E402


@pytest.fixture(autouse=True)
async def _schema() -> None:
    await create_schema()
    async with get_session_factory()() as session:
        await session.execute(delete(AdminRecoveryCode))
        await session.execute(delete(AdminSession))
        await session.execute(delete(AdminUser))
        await session.commit()
        service = AdminAuthService(session)
        await service.bootstrap("owner@example.com", "correct horse battery staple")


@pytest.fixture
async def api() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.fixture
async def admin_api(api: AsyncClient) -> AsyncClient:
    response = await api.post(
        "/api/v1/admin/auth/login",
        json={"email": "owner@example.com", "password": "correct horse battery staple"},
    )
    assert response.status_code == 200
    csrf = api.cookies.get("kits_admin_csrf")
    api.headers["X-CSRF-Token"] = csrf
    return api
