from pydantic import Field, field_validator

from app.schemas.common import ApiModel


class AdminLoginRequest(ApiModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("Invalid email address")
        return normalized


class AdminTotpRequest(ApiModel):
    code: str = Field(min_length=6, max_length=32)


class AdminPasswordRequest(ApiModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class AdminSensitiveRequest(ApiModel):
    password: str = Field(min_length=1, max_length=128)
    code: str | None = Field(default=None, min_length=6, max_length=32)


class AdminAuthView(ApiModel):
    authenticated: bool
    email: str | None = None
    requires_totp: bool = False
    totp_enabled: bool = False


class TotpSetupView(ApiModel):
    provisioning_uri: str
    secret: str


class RecoveryCodesView(ApiModel):
    recovery_codes: list[str]
