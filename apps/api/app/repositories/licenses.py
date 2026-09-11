from datetime import datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import AdminAuditLog, License, LicenseActivation, LicenseEvent


class LicenseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, license: License) -> License:
        self._session.add(license)
        await self._session.flush()
        return license

    async def add_activation(self, activation: LicenseActivation) -> LicenseActivation:
        self._session.add(activation)
        await self._session.flush()
        return activation

    async def add_event(self, event: LicenseEvent) -> LicenseEvent:
        self._session.add(event)
        await self._session.flush()
        return event

    async def get(self, license_id: str) -> License | None:
        result = await self._session.execute(
            select(License)
            .options(selectinload(License.activations), selectinload(License.events))
            .where(License.id == license_id)
        )
        return result.scalar_one_or_none()

    async def get_by_hash(self, license_hash: str) -> License | None:
        result = await self._session.execute(
            select(License)
            .options(selectinload(License.activations))
            .where(License.license_hash == license_hash)
        )
        return result.scalar_one_or_none()

    async def list_by_prefix(self, prefix: str | None = None, limit: int = 50) -> list[License]:
        statement = (
            select(License)
            .options(selectinload(License.activations))
            .order_by(License.created_at.desc())
            .limit(limit)
        )
        if prefix:
            statement = statement.where(License.key_prefix == prefix.upper())
        result = await self._session.execute(statement)
        return list(result.scalars().all())

    def _filtered(
        self,
        *,
        status: str | None = None,
        search: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> Select[tuple[License]]:
        statement = select(License)
        if status == "unused":
            statement = statement.where(License.status == "active", License.activated_at.is_(None))
        elif status:
            statement = statement.where(License.status == status)
        if search:
            term = search.strip()
            statement = statement.where(
                or_(
                    License.id == term,
                    License.key_prefix == term.upper(),
                    License.note.ilike(f"%{term}%"),
                )
            )
        if created_from:
            statement = statement.where(License.created_at >= created_from)
        if created_to:
            statement = statement.where(License.created_at <= created_to)
        return statement

    async def list_admin(
        self,
        *,
        page: int,
        page_size: int,
        status: str | None,
        search: str | None,
        sort: str,
        created_from: datetime | None,
        created_to: datetime | None,
    ) -> tuple[list[License], int]:
        filtered = self._filtered(
            status=status, search=search, created_from=created_from, created_to=created_to
        )
        total = await self._session.scalar(select(func.count()).select_from(filtered.subquery()))
        sort_columns = {
            "created_at": License.created_at,
            "updated_at": License.updated_at,
            "expires_at": License.expires_at,
            "status": License.status,
        }
        descending = sort.startswith("-")
        column = sort_columns[sort.removeprefix("-")]
        order = column.desc() if descending else column.asc()
        result = await self._session.execute(
            filtered.options(selectinload(License.activations))
            .order_by(order, License.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().all()), int(total or 0)

    async def add_audit(self, event: AdminAuditLog) -> None:
        self._session.add(event)
        await self._session.flush()

    async def list_audit(
        self, *, page: int, page_size: int, action: str | None, license_id: str | None
    ) -> tuple[list[AdminAuditLog], int]:
        statement = select(AdminAuditLog)
        if action:
            statement = statement.where(AdminAuditLog.action == action)
        if license_id:
            statement = statement.where(AdminAuditLog.target_license_id == license_id)
        total = await self._session.scalar(select(func.count()).select_from(statement.subquery()))
        result = await self._session.execute(
            statement.order_by(AdminAuditLog.at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().all()), int(total or 0)

    async def overview(
        self, now: datetime, month_start: datetime, soon: datetime
    ) -> dict[str, int]:
        statements = {
            "active": select(func.count())
            .select_from(License)
            .where(License.status == "active", License.activated_at.is_not(None)),
            "unused": select(func.count())
            .select_from(License)
            .where(License.status == "active", License.activated_at.is_(None)),
            "expiring_soon": select(func.count())
            .select_from(License)
            .where(
                License.status == "active", License.expires_at > now, License.expires_at <= soon
            ),
            "revoked": select(func.count()).select_from(License).where(License.status == "revoked"),
            "created_this_month": select(func.count())
            .select_from(License)
            .where(License.created_at >= month_start),
        }
        return {
            name: int(await self._session.scalar(statement) or 0)
            for name, statement in statements.items()
        }

    def active_activation(self, license: License) -> LicenseActivation | None:
        for activation in license.activations:
            if activation.revoked_at is None:
                return activation
        return None

    async def commit(self) -> None:
        await self._session.commit()

    async def refresh(self, license: License) -> License:
        await self._session.refresh(license, attribute_names=["activations", "events"])
        return license
