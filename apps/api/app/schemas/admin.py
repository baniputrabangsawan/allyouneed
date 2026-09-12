from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import ApiModel
from app.schemas.licenses import LicenseView

DurationMonths = Literal[1, 6, 12]


class AdminIdentityView(ApiModel):
    admin_id: str
    email: str
    identity_provider: str
    logout_url: str


class CreateAdminLicenseRequest(ApiModel):
    duration_months: DurationMonths
    note: str | None = Field(default=None, max_length=200)


class RenewAdminLicenseRequest(ApiModel):
    duration_months: DurationMonths


class AdminLicenseView(LicenseView):
    created_at: datetime
    updated_at: datetime
    note: str | None = None


class IssuedAdminLicense(AdminLicenseView):
    license_key: str


class AdminLicensePage(ApiModel):
    items: list[AdminLicenseView]
    page: int
    page_size: int
    total: int
    pages: int


class AdminAuditView(ApiModel):
    id: str
    admin_email: str
    action: str
    target_license_id: str | None = None
    request_id: str
    at: datetime
    meta: dict[str, str] | None = None


class AdminAuditPage(ApiModel):
    items: list[AdminAuditView]
    page: int
    page_size: int
    total: int
    pages: int


class AdminOverview(ApiModel):
    active: int
    unused: int
    expiring_soon: int
    revoked: int
    created_this_month: int


class AdminSystemHealth(ApiModel):
    api: Literal["healthy", "degraded", "unavailable"]
    database: Literal["healthy", "degraded", "unavailable"]
    redis: Literal["healthy", "degraded", "unavailable"]
    workers: Literal["healthy", "degraded", "unavailable"]
    storage: Literal["healthy", "degraded", "unavailable"]
