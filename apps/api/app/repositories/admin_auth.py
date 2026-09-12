from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AdminAuditLog, AdminRecoveryCode, AdminSession, AdminUser


class AdminAuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def user_by_email(self, email: str) -> AdminUser | None:
        result = await self.session.execute(select(AdminUser).where(AdminUser.email == email))
        return result.scalar_one_or_none()

    async def user_by_id(self, user_id: str) -> AdminUser | None:
        return await self.session.get(AdminUser, user_id)

    async def user_count(self) -> int:
        from sqlalchemy import func

        return int(await self.session.scalar(select(func.count()).select_from(AdminUser)) or 0)

    def add(self, value: object) -> None:
        self.session.add(value)

    async def session_by_hash(self, value: str) -> AdminSession | None:
        result = await self.session.execute(
            select(AdminSession).where(AdminSession.session_hash == value)
        )
        return result.scalar_one_or_none()

    async def revoke_other_sessions(self, user_id: str, current_id: str, now: datetime) -> None:
        await self.session.execute(
            update(AdminSession)
            .where(
                AdminSession.admin_user_id == user_id,
                AdminSession.id != current_id,
                AdminSession.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )

    async def replace_recovery_codes(self, user_id: str, values: list[AdminRecoveryCode]) -> None:
        await self.session.execute(
            delete(AdminRecoveryCode).where(AdminRecoveryCode.admin_user_id == user_id)
        )
        self.session.add_all(values)

    async def recovery_code(self, user_id: str, code_hash: str) -> AdminRecoveryCode | None:
        result = await self.session.execute(
            select(AdminRecoveryCode).where(
                AdminRecoveryCode.admin_user_id == user_id,
                AdminRecoveryCode.code_hash == code_hash,
                AdminRecoveryCode.used_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def commit(self) -> None:
        await self.session.commit()

    async def audit(
        self,
        *,
        admin_id: str,
        email: str,
        action: str,
        request_id: str,
        at: datetime,
        meta: dict[str, str] | None = None,
    ) -> None:
        from uuid import uuid4

        self.add(
            AdminAuditLog(
                id=str(uuid4()),
                admin_id=admin_id,
                admin_email=email,
                action=action,
                target_license_id=None,
                request_id=request_id,
                at=at,
                meta=meta,
            )
        )
