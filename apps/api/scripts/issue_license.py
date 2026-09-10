from __future__ import annotations

import argparse
import asyncio

from app.core.config import get_settings
from app.core.enums import LicensePlan
from app.db.session import create_schema, dispose_engine, ensure_sqlite_parent, get_session_factory
from app.services.license_service import LicenseService


async def main() -> None:
    parser = argparse.ArgumentParser(description="Issue a Pro license key. Shown once.")
    parser.add_argument(
        "--plan",
        choices=[plan.value for plan in LicensePlan],
        default=LicensePlan.PRO_1_MONTH.value,
    )
    args = parser.parse_args()
    settings = get_settings()
    ensure_sqlite_parent(settings.license_database_url)
    await create_schema()
    factory = get_session_factory()
    async with factory() as session:
        issued = await LicenseService(session).issue(LicensePlan(args.plan), created_source="cli")
    await dispose_engine()
    print(f"Plan: {issued.plan}")
    print(f"License: {issued.license_key}")
    print(f"Max Activations: {issued.max_activations}")
    print("Expiry: Starts on first activation")


if __name__ == "__main__":
    asyncio.run(main())
