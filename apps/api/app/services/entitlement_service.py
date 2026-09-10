from __future__ import annotations

from functools import lru_cache
from typing import Any, TypeGuard, cast

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.core.clock import now as default_now
from app.core.config import Settings, get_settings
from app.core.enums import LicenseStatus
from app.core.exceptions import ApiError
from app.core.license_crypto import hash_installation_id
from app.db.models import License
from app.schemas.licenses import EntitlementPayload, LicenseStatusView
from app.security.entitlement import EntitlementSigner
from app.services.license_cache import LicenseStatusCache, get_license_status_cache
from app.services.license_service import LicenseService


class EntitlementService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings | None = None,
        clock: Clock = default_now,
        signer: EntitlementSigner | None = None,
        cache: LicenseStatusCache | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._clock = clock
        self._cache = cache or get_license_status_cache()
        self._licenses = LicenseService(session, clock=clock, cache=self._cache)
        self._signer = signer or EntitlementSigner(self._settings, clock=clock)

    async def activate(self, license_key: str, installation_id: str) -> EntitlementPayload:
        license, installation_hash = await self._licenses.activate(license_key, installation_id)
        return self._payload(license, installation_hash)

    async def refresh(self, token: str) -> EntitlementPayload:
        license, installation_hash = await self._live_license(token)
        return self._payload(license, installation_hash)

    async def deactivate(self, token: str) -> LicenseStatusView:
        license, installation_hash = await self._live_license(token, require_active=False)
        license = await self._licenses.deactivate_by_hash(license, installation_hash)
        return self._status(license, False)

    async def status(self, token: str) -> LicenseStatusView:
        license, _installation_hash = await self._live_license(token)
        active = self._licenses.active_activation(license)
        return self._status(license, active is not None)

    async def require(self, token: str | None, capability: str | None) -> tuple[str, str]:
        if not token:
            raise ApiError(
                status.HTTP_403_FORBIDDEN,
                "LICENSE_REQUIRED",
                "A Pro license is required for this tool.",
            )
        if not capability:
            raise ApiError(
                status.HTTP_403_FORBIDDEN,
                "CAPABILITY_DENIED",
                "This tool is not entitled.",
            )
        license_id, installation_hash = self._claims(token)
        cached = await self._cache.get(license_id)
        if self._usable_cache(cached):
            self._reject_inactive(
                cached["status"],
                cached["installation_hash"],
                installation_hash,
            )
            capabilities = cast(list[str], cached["capabilities"])
            if capability not in capabilities:
                raise ApiError(
                    status.HTTP_403_FORBIDDEN,
                    "CAPABILITY_DENIED",
                    "This license does not include the required capability.",
                )
            return license_id, installation_hash
        license, installation_hash = await self._load_live(
            license_id, installation_hash, touch=False
        )
        if capability not in self._licenses.capabilities(license):
            raise ApiError(
                status.HTTP_403_FORBIDDEN,
                "CAPABILITY_DENIED",
                "This license does not include the required capability.",
            )
        return license.id, installation_hash

    def _claims(self, token: str) -> tuple[str, str]:
        try:
            claims = self._signer.verify(token)
        except ValueError as exc:
            message = str(exc)
            code = "ENTITLEMENT_EXPIRED" if "expired" in message else "ENTITLEMENT_INVALID"
            raise ApiError(
                status.HTTP_403_FORBIDDEN, code, "Entitlement token is not valid."
            ) from exc
        license_id = claims.get("license_id")
        installation_hash = claims.get("installation_hash")
        if not isinstance(license_id, str) or not isinstance(installation_hash, str):
            raise ApiError(
                status.HTTP_403_FORBIDDEN, "ENTITLEMENT_INVALID", "Entitlement token is not valid."
            )
        return license_id, installation_hash

    async def _live_license(
        self, token: str, *, require_active: bool = True
    ) -> tuple[License, str]:
        license_id, installation_hash = self._claims(token)
        return await self._load_live(license_id, installation_hash, touch=require_active)

    async def _load_live(
        self, license_id: str, installation_hash: str, *, touch: bool
    ) -> tuple[License, str]:
        license = await self._licenses.get_by_id(license_id)
        active = self._licenses.active_activation(license)
        active_hash = active.installation_hash if active is not None else ""
        self._reject_inactive(license.status, active_hash, installation_hash)
        await self._cache.set(
            license.id,
            status=license.status,
            plan=license.plan,
            installation_hash=active_hash,
            expires_at=license.expires_at,
            capabilities=self._licenses.capabilities(license),
        )
        if touch and active is not None:
            active.last_seen_at = self._clock()
            license.updated_at = active.last_seen_at
            await self._licenses._repo.commit()
        return license, installation_hash

    def _reject_inactive(
        self, license_status: str, active_hash: str, installation_hash: str
    ) -> None:
        if license_status == LicenseStatus.EXPIRED.value:
            raise ApiError(
                status.HTTP_403_FORBIDDEN, "LICENSE_EXPIRED", "This license has expired."
            )
        if license_status == LicenseStatus.REVOKED.value:
            raise ApiError(
                status.HTTP_403_FORBIDDEN, "LICENSE_REVOKED", "This license has been revoked."
            )
        if license_status == LicenseStatus.SUSPENDED.value:
            raise ApiError(
                status.HTTP_403_FORBIDDEN, "LICENSE_SUSPENDED", "This license is suspended."
            )
        if license_status != LicenseStatus.ACTIVE.value:
            raise ApiError(
                status.HTTP_403_FORBIDDEN, "LICENSE_NOT_ACTIVE", "This license is not active."
            )
        if not active_hash or active_hash != installation_hash:
            raise ApiError(
                status.HTTP_403_FORBIDDEN,
                "ACTIVATION_REVOKED",
                "This installation is not active for the license.",
            )

    @staticmethod
    def _usable_cache(cached: object) -> TypeGuard[dict[str, Any]]:
        return (
            isinstance(cached, dict)
            and isinstance(cached.get("status"), str)
            and isinstance(cached.get("installation_hash"), str)
            and isinstance(cached.get("capabilities"), list)
        )

    def _payload(self, license: License, installation_hash: str) -> EntitlementPayload:
        capabilities = self._licenses.capabilities(license)
        token = self._signer.issue(
            license_id=license.id,
            installation_hash=installation_hash,
            plan=license.plan,
            capabilities=capabilities,
            license_expires_at=license.expires_at,
        )
        return EntitlementPayload(
            token=token,
            plan=license.plan,  # type: ignore[arg-type]
            status=license.status,  # type: ignore[arg-type]
            expires_at=license.expires_at,
            capabilities=capabilities,
        )

    def _status(self, license: License, installation_active: bool) -> LicenseStatusView:
        return LicenseStatusView(
            plan=license.plan,  # type: ignore[arg-type]
            status=license.status,  # type: ignore[arg-type]
            expires_at=license.expires_at,
            capabilities=self._licenses.capabilities(license),
            installation_active=installation_active,
        )


def hash_for_installation(installation_id: str) -> str:
    return hash_installation_id(installation_id)


@lru_cache
def cached_signer() -> EntitlementSigner:
    return EntitlementSigner(get_settings())
