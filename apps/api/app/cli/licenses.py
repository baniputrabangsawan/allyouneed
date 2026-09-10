from __future__ import annotations

import argparse
import asyncio

from app.core.config import get_settings
from app.core.enums import LicensePlan
from app.db.session import create_schema, dispose_engine, ensure_sqlite_parent, get_session_factory
from app.schemas.licenses import LicenseView
from app.services.license_service import MONTHS_TO_PLAN, LicenseService


def main() -> None:
    parser = argparse.ArgumentParser(prog="utility-license", description="Admin license CLI.")
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create")
    create.add_argument("--plan", choices=[plan.value for plan in LicensePlan], required=True)
    create.add_argument("--note", default=None)

    inspect = sub.add_parser("inspect")
    inspect.add_argument("license_key")

    renew = sub.add_parser("renew")
    renew.add_argument("license_key")
    renew.add_argument("--months", type=int, choices=[1, 6, 12], required=True)

    for name in ("suspend", "resume", "revoke", "reset-activations"):
        command = sub.add_parser(name)
        command.add_argument("license_key")

    sub.add_parser("list")
    args = parser.parse_args()
    asyncio.run(_run(args))


async def _run(args: argparse.Namespace) -> None:
    settings = get_settings()
    ensure_sqlite_parent(settings.license_database_url)
    await create_schema()
    factory = get_session_factory()
    try:
        async with factory() as session:
            service = LicenseService(session)
            if args.command == "create":
                issued = await service.issue(
                    LicensePlan(args.plan), note=args.note, created_source="cli"
                )
                print(f"Plan: {issued.plan}")
                print(f"License: {issued.license_key}")
                print(f"Max Activations: {issued.max_activations}")
                print("Expiry: Starts on first activation")
                return
            if args.command == "list":
                for view in await service.list_licenses():
                    _print_view(view)
                return
            if args.command == "inspect":
                views = await service.inspect_key_or_prefix(args.license_key)
                if not views:
                    raise SystemExit("License was not found.")
                for view in views:
                    _print_view(view)
                return
            view = await service.inspect(args.license_key)
            if args.command == "renew":
                result = await service.renew(view.license_id, MONTHS_TO_PLAN[args.months])
                _print_view(result)
                return
            actions = {
                "suspend": service.suspend,
                "resume": service.resume,
                "revoke": service.revoke,
                "reset-activations": service.reset_activations,
            }
            result = await actions[args.command](view.license_id)
            _print_view(result)
    finally:
        await dispose_engine()


def _print_view(view: LicenseView) -> None:
    expiry = view.expires_at.isoformat() if view.expires_at else "starts on first activation"
    print(
        f"{view.license_id} prefix={view.key_prefix} plan={view.plan} "
        f"status={view.status} expires={expiry} active_install={view.installation_active}"
    )
