from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "utility-api"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    database_url: str = ""
    license_database_url: str = "sqlite+aiosqlite:///./data/licenses.db"
    admin_cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    admin_session_cookie_name: str = "kits_admin_session"
    admin_csrf_cookie_name: str = "kits_admin_csrf"
    admin_session_ttl_seconds: int = 28800
    admin_totp_encryption_key: str = ""
    redis_url: str = "redis://localhost:6379/0"
    entitlement_private_key: str = ""
    entitlement_public_key: str = ""
    entitlement_key_id: str = "ent-1"
    entitlement_token_ttl_seconds: int = 86400
    license_status_cache_ttl_seconds: int = 60
    ai_concurrent_jobs: int = 2
    video_concurrent_jobs: int = 1
    r2_endpoint_url: str = ""
    r2_bucket: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    file_ttl_seconds: int = 3600
    max_upload_mb: int = 100
    max_batch_files: int = 20
    default_job_timeout_seconds: int = 300
    max_image_pixels: int = 100_000_000
    enable_self_hosted_ai: bool = True
    enable_external_ai: bool = False
    stt_provider: str = "selfhosted"
    tts_provider: str = "selfhosted"
    background_removal_provider: str = "selfhosted"
    upscale_provider: str = "selfhosted"
    ocr_provider: str = "selfhosted"
    sentry_dsn: str = ""
    storage_root: str = ".data"
    temp_root: str = "/tmp"
    public_base_url: str = "http://localhost:8000"
    download_signing_secret: str = "dev-download-secret"
    download_url_ttl_seconds: int = 900
    inline_jobs: bool = True

    @model_validator(mode="after")
    def alias_database_url(self) -> "Settings":
        if (
            self.database_url
            and self.license_database_url == "sqlite+aiosqlite:///./data/licenses.db"
        ):
            self.license_database_url = self.database_url
        if self.app_env == "production":
            required = {
                "ADMIN_CORS_ORIGINS": self.admin_cors_origins,
                "ADMIN_TOTP_ENCRYPTION_KEY": self.admin_totp_encryption_key,
                "ENTITLEMENT_PRIVATE_KEY": self.entitlement_private_key,
                "LICENSE_DATABASE_URL": self.license_database_url,
                "REDIS_URL": self.redis_url,
            }
            missing = [name for name, value in required.items() if not value]
            if missing:
                raise ValueError(f"Missing production configuration: {', '.join(missing)}")
            if self.inline_jobs:
                raise ValueError("INLINE_JOBS must be false in production for admin rate limiting")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
