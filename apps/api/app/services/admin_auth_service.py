from dataclasses import dataclass
from datetime import timedelta
from secrets import token_hex
from uuid import uuid4

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import aware, now
from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.db.models import AdminRecoveryCode, AdminSession, AdminUser
from app.repositories.admin_auth import AdminAuthRepository
from app.security.admin import AdminIdentity, new_token, token_hash
from app.security.passwords import hash_password, validate_password, verify_password
from app.security.totp import (
    decrypt_secret,
    encrypt_secret,
    generate_secret,
    provisioning_uri,
    recovery_code_hash,
    verify_totp,
)

_DUMMY_PASSWORD_HASH = hash_password("invalid-admin-password")


@dataclass(frozen=True)
class SessionTokens:
    session: str
    csrf: str
    requires_totp: bool


class AdminAuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = AdminAuthRepository(session)

    async def bootstrap(self, email: str, password: str) -> AdminUser:
        if await self.repo.user_count():
            raise ValueError("An admin owner already exists.")
        validate_password(password)
        timestamp = now()
        user = AdminUser(
            id=str(uuid4()),
            email=email.strip().lower(),
            password_hash=hash_password(password),
            totp_secret_encrypted=None,
            totp_enabled=False,
            is_active=True,
            created_at=timestamp,
            updated_at=timestamp,
            last_login_at=None,
        )
        self.repo.add(user)
        await self.repo.commit()
        return user

    async def login(self, email: str, password: str, request_id: str) -> SessionTokens:
        normalized = email.strip().lower()
        user = await self.repo.user_by_email(normalized)
        valid = verify_password(password, user.password_hash if user else _DUMMY_PASSWORD_HASH)
        if not user or not valid or not user.is_active:
            await self.repo.audit(
                admin_id=user.id if user else "unknown",
                email=normalized,
                action="admin_login_failed",
                request_id=request_id,
                at=now(),
            )
            await self.repo.commit()
            raise ApiError(
                status.HTTP_401_UNAUTHORIZED,
                "INVALID_CREDENTIALS",
                "Invalid email or password.",
            )
        return await self._new_session(user, request_id, pending_totp=user.totp_enabled)

    async def verify_login_totp(
        self, session_token: str, code: str, request_id: str
    ) -> SessionTokens:
        session = await self.repo.session_by_hash(token_hash(session_token))
        timestamp = now()
        if (
            not session
            or not session.pending_totp
            or session.revoked_at
            or aware(session.expires_at) <= timestamp
        ):
            raise ApiError(
                status.HTTP_401_UNAUTHORIZED, "ADMIN_UNAUTHORIZED", "Login session expired."
            )
        user = await self.repo.user_by_id(session.admin_user_id)
        if not user or not user.is_active or not user.totp_secret_encrypted:
            raise ApiError(
                status.HTTP_401_UNAUTHORIZED, "ADMIN_UNAUTHORIZED", "Login session expired."
            )
        valid = verify_totp(decrypt_secret(user.totp_secret_encrypted), code)
        recovery = (
            None if valid else await self.repo.recovery_code(user.id, recovery_code_hash(code))
        )
        if not valid and not recovery:
            await self.repo.audit(
                admin_id=user.id,
                email=user.email,
                action="admin_totp_failed",
                request_id=request_id,
                at=timestamp,
            )
            await self.repo.commit()
            raise ApiError(
                status.HTTP_401_UNAUTHORIZED, "INVALID_TOTP", "Invalid authentication code."
            )
        if recovery:
            recovery.used_at = timestamp
        session.revoked_at = timestamp
        return await self._new_session(user, request_id, pending_totp=False)

    async def resolve(
        self, session_token: str | None
    ) -> tuple[AdminIdentity, AdminSession, AdminUser]:
        if not session_token:
            raise ApiError(
                status.HTTP_401_UNAUTHORIZED,
                "ADMIN_UNAUTHORIZED",
                "Admin authentication is required.",
            )
        session = await self.repo.session_by_hash(token_hash(session_token))
        timestamp = now()
        if (
            not session
            or session.pending_totp
            or session.revoked_at
            or aware(session.expires_at) <= timestamp
        ):
            raise ApiError(
                status.HTTP_401_UNAUTHORIZED,
                "ADMIN_UNAUTHORIZED",
                "Admin authentication is required.",
            )
        user = await self.repo.user_by_id(session.admin_user_id)
        if not user or not user.is_active:
            raise ApiError(
                status.HTTP_403_FORBIDDEN, "ADMIN_FORBIDDEN", "This administrator is disabled."
            )
        if (timestamp - aware(session.last_seen_at)).total_seconds() >= 60:
            session.last_seen_at = timestamp
            await self.repo.commit()
        return AdminIdentity(user.id, user.email), session, user

    async def logout(self, session: AdminSession, user: AdminUser, request_id: str) -> None:
        session.revoked_at = now()
        await self.repo.audit(
            admin_id=user.id,
            email=user.email,
            action="admin_logout",
            request_id=request_id,
            at=now(),
        )
        await self.repo.commit()

    async def change_password(
        self,
        session: AdminSession,
        user: AdminUser,
        current_password: str,
        new_password: str,
        request_id: str,
    ) -> None:
        if not verify_password(current_password, user.password_hash):
            raise ApiError(
                status.HTTP_400_BAD_REQUEST, "INVALID_PASSWORD", "Current password is incorrect."
            )
        validate_password(new_password)
        timestamp = now()
        user.password_hash = hash_password(new_password)
        user.updated_at = timestamp
        await self.repo.revoke_other_sessions(user.id, session.id, timestamp)
        await self.repo.audit(
            admin_id=user.id,
            email=user.email,
            action="admin_password_changed",
            request_id=request_id,
            at=timestamp,
        )
        await self.repo.commit()

    async def setup_totp(self, user: AdminUser, password: str) -> tuple[str, str]:
        if not verify_password(password, user.password_hash):
            raise ApiError(
                status.HTTP_400_BAD_REQUEST, "INVALID_PASSWORD", "Current password is incorrect."
            )
        if user.totp_enabled:
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "TOTP_ALREADY_ENABLED",
                "Disable the current authenticator before replacing it.",
            )
        secret = generate_secret()
        user.totp_secret_encrypted = encrypt_secret(secret)
        user.totp_enabled = False
        user.updated_at = now()
        await self.repo.commit()
        return secret, provisioning_uri(user.email, secret)

    async def confirm_totp(self, user: AdminUser, code: str, request_id: str) -> list[str]:
        if not user.totp_secret_encrypted or not verify_totp(
            decrypt_secret(user.totp_secret_encrypted), code
        ):
            raise ApiError(
                status.HTTP_400_BAD_REQUEST, "INVALID_TOTP", "Invalid authentication code."
            )
        user.totp_enabled = True
        user.updated_at = now()
        codes = [f"{token_hex(4).upper()}-{token_hex(4).upper()}" for _ in range(8)]
        timestamp = now()
        await self.repo.replace_recovery_codes(
            user.id,
            [
                AdminRecoveryCode(
                    id=str(uuid4()),
                    admin_user_id=user.id,
                    code_hash=recovery_code_hash(code),
                    created_at=timestamp,
                    used_at=None,
                )
                for code in codes
            ],
        )
        await self.repo.audit(
            admin_id=user.id,
            email=user.email,
            action="admin_totp_enabled",
            request_id=request_id,
            at=timestamp,
        )
        await self.repo.commit()
        return codes

    async def disable_totp(
        self, user: AdminUser, password: str, code: str | None, request_id: str
    ) -> None:
        if not verify_password(password, user.password_hash):
            raise ApiError(
                status.HTTP_400_BAD_REQUEST, "INVALID_PASSWORD", "Current password is incorrect."
            )
        if user.totp_enabled and (
            not code
            or not user.totp_secret_encrypted
            or not verify_totp(decrypt_secret(user.totp_secret_encrypted), code)
        ):
            raise ApiError(
                status.HTTP_400_BAD_REQUEST, "INVALID_TOTP", "Invalid authentication code."
            )
        user.totp_enabled = False
        user.totp_secret_encrypted = None
        user.updated_at = now()
        await self.repo.replace_recovery_codes(user.id, [])
        await self.repo.audit(
            admin_id=user.id,
            email=user.email,
            action="admin_totp_disabled",
            request_id=request_id,
            at=now(),
        )
        await self.repo.commit()

    async def _new_session(
        self, user: AdminUser, request_id: str, *, pending_totp: bool
    ) -> SessionTokens:
        timestamp = now()
        session_token = new_token()
        csrf_token = new_token()
        ttl = 300 if pending_totp else get_settings().admin_session_ttl_seconds
        self.repo.add(
            AdminSession(
                id=str(uuid4()),
                session_hash=token_hash(session_token),
                csrf_hash=token_hash(csrf_token),
                admin_user_id=user.id,
                pending_totp=pending_totp,
                created_at=timestamp,
                expires_at=timestamp + timedelta(seconds=ttl),
                last_seen_at=timestamp,
                revoked_at=None,
            )
        )
        if not pending_totp:
            user.last_login_at = timestamp
            await self.repo.audit(
                admin_id=user.id,
                email=user.email,
                action="admin_login_success",
                request_id=request_id,
                at=timestamp,
            )
        await self.repo.commit()
        return SessionTokens(session_token, csrf_token, pending_totp)
