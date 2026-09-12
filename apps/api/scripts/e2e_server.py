import asyncio
import os
from pathlib import Path

import uvicorn
from sqlalchemy import delete

from app.db.models import AdminRecoveryCode, AdminSession, AdminUser
from app.db.session import create_schema, get_session_factory
from app.services.admin_auth_service import AdminAuthService
from app.security.entitlement import generate_keypair


async def prepare() -> None:
    await create_schema()
    async with get_session_factory()() as session:
        await session.execute(delete(AdminRecoveryCode))
        await session.execute(delete(AdminSession))
        await session.execute(delete(AdminUser))
        await session.commit()
        await AdminAuthService(session).bootstrap(
            "owner@example.com", "correct horse battery staple"
        )


if __name__ == "__main__":
    Path("/tmp/kits-admin-e2e.db").unlink(missing_ok=True)
    private_key, public_key = generate_keypair()
    os.environ["ENTITLEMENT_PRIVATE_KEY"] = private_key
    os.environ["ENTITLEMENT_PUBLIC_KEY"] = public_key
    asyncio.run(prepare())
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
