import argparse
import asyncio
import getpass

from app.core.config import get_settings
from app.db.session import ensure_sqlite_parent, get_session_factory
from app.services.admin_auth_service import AdminAuthService


async def bootstrap(email: str) -> None:
    password = getpass.getpass("Admin password: ")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match.")
    ensure_sqlite_parent(get_settings().license_database_url)
    async with get_session_factory()() as session:
        user = await AdminAuthService(session).bootstrap(email, password)
    print(f"Created owner account: {user.email}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap the single Kits owner account.")
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    asyncio.run(bootstrap(args.email))
