import os
from pathlib import Path

from app.security.entitlement import generate_keypair

TEST_DB = Path("/tmp/utility-api-tests.db")
TEST_DB.unlink(missing_ok=True)
private_pem, public_pem = generate_keypair()
os.environ["LICENSE_DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB}"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB}"
os.environ["ADMIN_API_KEY"] = "test-admin-key"
os.environ["ADMIN_DEV_BYPASS"] = "true"
os.environ["APP_ENV"] = "test"
os.environ["INLINE_JOBS"] = "true"
os.environ["ENTITLEMENT_PRIVATE_KEY"] = private_pem
os.environ["ENTITLEMENT_PUBLIC_KEY"] = public_pem
os.environ["ENTITLEMENT_KEY_ID"] = "test-ent-1"

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.db.session import create_schema  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
async def _schema() -> None:
    await create_schema()


@pytest.fixture
async def api() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
