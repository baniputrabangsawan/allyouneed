from __future__ import annotations

from uuid import uuid4

from dateutil.relativedelta import relativedelta
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.capabilities import capabilities_for_plan
from app.core.clock import Clock, aware
from app.core.clock import now as default_now
from app.core.enums import LicenseEventType, LicensePlan, LicenseStatus
from app.core.exceptions import ApiError
from app.core.license_crypto import (
    generate_license_key,
    hash_installation_id,
    hash_license_key,
    is_license_key_format,
    license_key_prefix,
    normalize_license_key,
)
from app.db.models import License, LicenseActivation, LicenseEvent
from app.repositories.licenses import LicenseRepository
from app.schemas.licenses import IssuedLicense, LicenseView
from app.services.license_cache import LicenseStatusCache, get_license_status_cache

PLAN_DURATIONS = {
    LicensePlan.PRO_1_MONTH: relativedelta(months=1),
    LicensePlan.PRO_6_MONTHS: relativedelta(months=6),
    LicensePlan.PRO_12_MONTHS: relativedelta(months=12),
}

MONTHS_TO_PLAN = {
    1: LicensePlan.PRO_1_MONTH,
    6: LicensePlan.PRO_6_MONTHS,
    12: LicensePlan.PRO_12_MONTHS,
}

LICENSE_TRANSITIONS: dict[LicenseStatus, frozenset[LicenseStatus]] = {
    LicenseStatus.ACTIVE: frozenset(
        {LicenseStatus.SUSPENDED, LicenseStatus.REVOKED, LicenseStatus.EXPIRED}
    ),
    LicenseStatus.SUSPENDED: frozenset({LicenseStatus.ACTIVE, LicenseStatus.REVOKED}),
    LicenseStatus.EXPIRED: frozenset({LicenseStatus.ACTIVE, LicenseStatus.REVOKED}),
    LicenseStatus.REVOKED: frozenset(),
}


class LicenseService:
    def __init__(
        self,
        session: AsyncSession,
        clock: Clock = default_now,
        cache: LicenseStatusCache | None = None,
    ) -> None:
        self._repo = LicenseRepository(session)
        self._clock = clock
        self._cache = cache or get_license_status_cache()

    async def issue(
        self, plan: LicensePlan, *, note: str | None = None, created_source: str = "admin"
    ) -> IssuedLicense:
        now = self._clock()
        raw_key = generate_license_key()
        license = License(
            id=str(uuid4()),
            license_hash=hash_license_key(raw_key),
            key_prefix=license_key_prefix(raw_key),
            plan=plan.value,
            status=LicenseStatus.ACTIVE.value,
            activated_at=None,
            expires_at=None,
            created_at=now,
            updated_at=now,
            max_activations=1,
            note=note,
            created_source=created_source,
        )
        await self._repo.add(license)
        await self._event(license, LicenseEventType.ISSUED, meta={"plan": plan.value})
        await self._repo.commit()
        return IssuedLicense(
            license_id=license.id,
            plan=license.plan,  # type: ignore[arg-type]
            status=license.status,  # type: ignore[arg-type]
            expires_at=license.expires_at,
            activated_at=license.activated_at,
            license_key=raw_key,
            key_prefix=license.key_prefix,
            max_activations=license.max_activations,
        )

    async def activate(self, license_key: str, installation_id: str) -> tuple[License, str]:
        license = await self._require_by_key(license_key)
        self._refresh_expiry(license)
        if license.status != LicenseStatus.ACTIVE.value:
            raise self._inactive_error(license)
        installation_hash = hash_installation_id(installation_id)
        now = self._clock()
        active = self._repo.active_activation(license)
        if active is not None and active.installation_hash != installation_hash:
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "ACTIVATION_LIMIT_REACHED",
                "This license is already active on another installation.",
            )
        if active is not None:
            active.last_seen_at = now
        else:
            if license.activated_at is None:
                license.activated_at = now
                license.expires_at = now + PLAN_DURATIONS[LicensePlan(license.plan)]
            activation = LicenseActivation(
                id=str(uuid4()),
                license_id=license.id,
                installation_hash=installation_hash,
                activated_at=now,
                last_seen_at=now,
                created_at=now,
            )
            await self._repo.add_activation(activation)
            await self._event(
                license, LicenseEventType.ACTIVATED, installation_hash=installation_hash
            )
        license.updated_at = now
        await self._commit(license)
        return license, installation_hash

    async def deactivate_by_hash(self, license: License, installation_hash: str) -> License:
        active = self._repo.active_activation(license)
        if active is None or active.installation_hash != installation_hash:
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "ACTIVATION_REVOKED",
                "This installation is not active for the license.",
            )
        now = self._clock()
        active.revoked_at = now
        license.updated_at = now
        await self._event(
            license, LicenseEventType.DEACTIVATED, installation_hash=installation_hash
        )
        await self._commit(license)
        return license

    async def get(self, license_id: str) -> LicenseView:
        license = await self._require_id(license_id)
        self._refresh_expiry(license)
        return self._view(license)

    async def list_licenses(self, prefix: str | None = None) -> list[LicenseView]:
        licenses = await self._repo.list_by_prefix(prefix)
        views: list[LicenseView] = []
        for license in licenses:
            self._refresh_expiry(license)
            views.append(self._view(license))
        return views

    async def get_by_id(self, license_id: str) -> License:
        license = await self._require_id(license_id)
        self._refresh_expiry(license)
        return license

    async def inspect(self, license_key: str) -> LicenseView:
        license = await self._require_by_key(license_key)
        self._refresh_expiry(license)
        return self._view(license)

    async def inspect_key_or_prefix(self, value: str) -> list[LicenseView]:
        if is_license_key_format(value):
            return [await self.inspect(value)]
        return await self.list_licenses(value)

    async def renew(
        self,
        license_id: str,
        plan: LicensePlan | None = None,
        months: int | None = None,
    ) -> LicenseView:
        license = await self._require_id(license_id)
        if license.status == LicenseStatus.REVOKED.value:
            raise ApiError(
                status.HTTP_409_CONFLICT, "LICENSE_REVOKED", "A revoked license cannot be renewed."
            )
        now = self._clock()
        next_plan = plan or (MONTHS_TO_PLAN[months] if months else LicensePlan(license.plan))
        duration = PLAN_DURATIONS[next_plan]
        expires_at = aware(license.expires_at) if license.expires_at else None
        base = expires_at if expires_at is not None and expires_at > now else now
        if license.status in {LicenseStatus.EXPIRED.value, LicenseStatus.SUSPENDED.value}:
            self._transition(license, LicenseStatus.ACTIVE)
        license.plan = next_plan.value
        license.expires_at = base + duration
        if license.activated_at is None:
            license.activated_at = now
        license.updated_at = now
        await self._event(license, LicenseEventType.RENEWED, meta={"plan": next_plan.value})
        await self._commit(license)
        return self._view(license)

    async def suspend(self, license_id: str) -> LicenseView:
        return await self._set_status(
            license_id, LicenseStatus.SUSPENDED, LicenseEventType.SUSPENDED
        )

    async def resume(self, license_id: str) -> LicenseView:
        license = await self._require_id(license_id)
        if license.expires_at is not None and aware(license.expires_at) <= self._clock():
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "LICENSE_EXPIRED",
                "Renew this license instead of resuming it.",
            )
        return await self._set_status(license_id, LicenseStatus.ACTIVE, LicenseEventType.RESUMED)

    async def revoke(self, license_id: str) -> LicenseView:
        license = await self._require_id(license_id)
        now = self._clock()
        self._transition(license, LicenseStatus.REVOKED)
        active = self._repo.active_activation(license)
        if active is not None:
            active.revoked_at = now
        license.updated_at = now
        await self._event(license, LicenseEventType.REVOKED)
        await self._commit(license)
        return self._view(license)

    async def reset_activations(self, license_id: str) -> LicenseView:
        license = await self._require_id(license_id)
        now = self._clock()
        active = self._repo.active_activation(license)
        if active is not None:
            active.revoked_at = now
        license.updated_at = now
        await self._event(license, LicenseEventType.ACTIVATION_RESET)
        await self._commit(license)
        return self._view(license)

    def capabilities(self, license: License) -> list[str]:
        return capabilities_for_plan(license.plan)

    def active_activation(self, license: License) -> LicenseActivation | None:
        return self._repo.active_activation(license)

    def _refresh_expiry(self, license: License) -> None:
        if (
            license.status == LicenseStatus.ACTIVE.value
            and license.expires_at is not None
            and aware(license.expires_at) <= self._clock()
        ):
            self._transition(license, LicenseStatus.EXPIRED)
            license.updated_at = self._clock()

    def _transition(self, license: License, target: LicenseStatus) -> None:
        current = LicenseStatus(license.status)
        if current == target:
            return
        if target not in LICENSE_TRANSITIONS[current]:
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "LICENSE_NOT_ACTIVE",
                f"Cannot change license from {current.value} to {target.value}.",
            )
        license.status = target.value

    async def _set_status(
        self, license_id: str, target: LicenseStatus, event: LicenseEventType
    ) -> LicenseView:
        license = await self._require_id(license_id)
        self._refresh_expiry(license)
        self._transition(license, target)
        license.updated_at = self._clock()
        await self._event(license, event)
        await self._commit(license)
        return self._view(license)

    async def _commit(self, license: License) -> None:
        await self._repo.commit()
        await self._cache.invalidate(license.id)

    async def _require_by_key(self, license_key: str) -> License:
        if not is_license_key_format(license_key):
            raise ApiError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "INVALID_LICENSE",
                "License key format is invalid.",
            )
        license = await self._repo.get_by_hash(hash_license_key(normalize_license_key(license_key)))
        if license is None:
            raise ApiError(status.HTTP_404_NOT_FOUND, "INVALID_LICENSE", "License was not found.")
        return license

    async def _require_id(self, license_id: str) -> License:
        license = await self._repo.get(license_id)
        if license is None:
            raise ApiError(status.HTTP_404_NOT_FOUND, "INVALID_LICENSE", "License was not found.")
        return license

    async def _event(
        self,
        license: License,
        event_type: LicenseEventType,
        *,
        installation_hash: str | None = None,
        meta: dict[str, str] | None = None,
    ) -> None:
        await self._repo.add_event(
            LicenseEvent(
                id=str(uuid4()),
                license_id=license.id,
                type=event_type.value,
                installation_hash=installation_hash,
                at=self._clock(),
                meta=meta,
            )
        )

    def _inactive_error(self, license: License) -> ApiError:
        if license.status == LicenseStatus.EXPIRED.value:
            return ApiError(
                status.HTTP_403_FORBIDDEN, "LICENSE_EXPIRED", "This license has expired."
            )
        if license.status == LicenseStatus.REVOKED.value:
            return ApiError(
                status.HTTP_403_FORBIDDEN, "LICENSE_REVOKED", "This license has been revoked."
            )
        if license.status == LicenseStatus.SUSPENDED.value:
            return ApiError(
                status.HTTP_403_FORBIDDEN, "LICENSE_SUSPENDED", "This license is suspended."
            )
        return ApiError(
            status.HTTP_403_FORBIDDEN, "LICENSE_NOT_ACTIVE", "This license is not active."
        )

    def _view(self, license: License) -> LicenseView:
        active = self._repo.active_activation(license)
        return LicenseView(
            license_id=license.id,
            plan=license.plan,  # type: ignore[arg-type]
            status=license.status,  # type: ignore[arg-type]
            expires_at=license.expires_at,
            activated_at=license.activated_at,
            key_prefix=license.key_prefix,
            max_activations=license.max_activations,
            installation_active=active is not None,
        )
