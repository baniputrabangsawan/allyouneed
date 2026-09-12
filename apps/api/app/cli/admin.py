import argparse
import asyncio
import getpass

from app.core.config import get_settings
from app.db.session import ensure_sqlite_parent, get_session_factory
from app.security.passwords import hash_password
from app.services.admin_auth_service import AdminAuthService


async def bootstrap(email: str) -> None:
    password = getpass.getpass("Admin password: ")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match.")
    ensure_sqlite_parent(get_settings().license_database_url)
    async with get_session_factory()() as session:
        user = await AdminAuthService(session).bootstrap(email, password)
    print(f"Created owner account: {user.email}")


async def reset_password(email: str) -> None:
    password = getpass.getpass("New admin password: ")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match.")
    ensure_sqlite_parent(get_settings().license_database_url)
    async with get_session_factory()() as session:
        service = AdminAuthService(session)
        user = await service.repo.user_by_email(email.strip().lower())
        if user is None:
            raise SystemExit("Admin account was not found.")
        user.password_hash = hash_password(password)
        await service.repo.commit()
    print(f"Updated owner password: {email.strip().lower()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap the single Kits owner account.")
    subcommands = parser.add_subparsers(dest="command")
    bootstrap_parser = subcommands.add_parser("bootstrap", help="Create the first owner account.")
    bootstrap_parser.add_argument("--email", required=True)
    reset_parser = subcommands.add_parser(
        "reset-password", help="Reset an existing owner password."
    )
    reset_parser.add_argument("--email", required=True)
    args = parser.parse_args()
    if args.command == "reset-password":
        asyncio.run(reset_password(args.email))
    elif args.command == "bootstrap":
        asyncio.run(bootstrap(args.email))
    else:
        parser.print_help()
        raise SystemExit(2)
