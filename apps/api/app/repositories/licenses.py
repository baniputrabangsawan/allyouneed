from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import License, LicenseActivation, LicenseEvent


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
