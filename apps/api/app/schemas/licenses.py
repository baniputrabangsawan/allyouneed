from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.enums import LicensePlan
from app.schemas.common import ApiModel

PlanValue = Literal["pro_1_month", "pro_6_months", "pro_12_months"]
StatusValue = Literal["active", "expired", "suspended", "revoked"]


class ActivateLicenseRequest(ApiModel):
    license_key: str = Field(min_length=8, max_length=64)
    installation_id: str = Field(min_length=8, max_length=128)
    device_secret: str = Field(min_length=32, max_length=128)


class RestoreEntitlementRequest(ApiModel):
    installation_id: str = Field(min_length=8, max_length=128)
    device_secret: str = Field(min_length=32, max_length=128)


class RedeemTransferRequest(ApiModel):
    token: str = Field(min_length=16, max_length=128)
    installation_id: str = Field(min_length=8, max_length=128)
    device_secret: str = Field(min_length=32, max_length=128)


class TransferTokenView(ApiModel):
    token: str
    expires_at: datetime


class LicenseView(ApiModel):
    license_id: str
    plan: PlanValue
    status: StatusValue
    expires_at: datetime | None = None
    activated_at: datetime | None = None
    key_prefix: str | None = None
    max_activations: int = 1
    installation_active: bool = False


class IssuedLicense(LicenseView):
    license_key: str


class EntitlementPayload(ApiModel):
    token: str
    plan: PlanValue
    status: StatusValue
    expires_at: datetime | None = None
    capabilities: list[str]


class LicenseStatusView(ApiModel):
    plan: PlanValue
    status: StatusValue
    expires_at: datetime | None = None
    capabilities: list[str]
    installation_active: bool


class IssueLicenseRequest(ApiModel):
    plan: LicensePlan
    note: str | None = None


class RenewLicenseRequest(ApiModel):
    plan: LicensePlan | None = None
    months: Literal[1, 6, 12] | None = None
