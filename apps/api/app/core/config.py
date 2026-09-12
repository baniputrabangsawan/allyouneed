from functools import lru_cache
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urlparse

from cryptography.fernet import Fernet
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LICENSE_DATABASE_URL = f"sqlite+aiosqlite:///{API_ROOT / 'data' / 'licenses.db'}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "utility-api"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    database_url: str = ""
    license_database_url: str = DEFAULT_LICENSE_DATABASE_URL
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
    max_pdf_pages: int = 500
    max_media_duration_seconds: int = 7200
    max_result_mb: int = 200
    enable_self_hosted_ai: bool = True
    enable_external_ai: bool = False
    stt_provider: str = "selfhosted"
    tts_provider: str = "selfhosted"
    whisper_model: str = "small"
    stt_max_duration_seconds: int = 1800
    tts_max_chars: int = 5000
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
    trust_cloudflare_ip_header: bool = False
    api_rate_limit_enabled: bool = True
    max_json_body_bytes: int = 1_048_576
    rnnoise_model_path: str = str(API_ROOT / "app" / "assets" / "rnnoise" / "cb.rnnn")

    @model_validator(mode="after")
    def alias_database_url(self) -> "Settings":
        if self.database_url and self.license_database_url == DEFAULT_LICENSE_DATABASE_URL:
            self.license_database_url = self.database_url
        if self.app_env == "production":
            required = {
                "ADMIN_CORS_ORIGINS": self.admin_cors_origins,
                "ADMIN_TOTP_ENCRYPTION_KEY": self.admin_totp_encryption_key,
                "ENTITLEMENT_PRIVATE_KEY": self.entitlement_private_key,
                "LICENSE_DATABASE_URL": self.license_database_url,
                "REDIS_URL": self.redis_url,
                "DOWNLOAD_SIGNING_SECRET": self.download_signing_secret,
            }
            missing = [name for name, value in required.items() if not value]
            if missing:
                raise ValueError(f"Missing production configuration: {', '.join(missing)}")
            if self.inline_jobs:
                raise ValueError("INLINE_JOBS must be false in production for admin rate limiting")
            origins = set(self.cors_origins + self.admin_cors_origins)
            if "https://usekits.online" not in origins:
                raise ValueError("Production CORS must allow https://usekits.online")
            if any(
                origin == "*"
                or urlparse(origin).scheme != "https"
                or (urlparse(origin).hostname or "") in {"localhost", "127.0.0.1", "::1"}
                for origin in origins
            ):
                raise ValueError("Production CORS origins must be explicit HTTPS origins")
            public = urlparse(self.public_base_url)
            if public.scheme != "https" or not public.hostname:
                raise ValueError("PUBLIC_BASE_URL must be an HTTPS origin in production")
            redis = urlparse(self.redis_url)
            if redis.hostname:
                try:
                    redis_is_loopback = ip_address(redis.hostname).is_loopback
                except ValueError:
                    redis_is_loopback = redis.hostname == "localhost"
                if redis_is_loopback:
                    raise ValueError("REDIS_URL must not use a loopback host in production")
            if (
                len(self.download_signing_secret) < 32
                or self.download_signing_secret == "dev-download-secret"
            ):
                raise ValueError("DOWNLOAD_SIGNING_SECRET must be a strong production secret")
            try:
                Fernet(self.admin_totp_encryption_key.encode("ascii"))
            except (UnicodeEncodeError, ValueError) as exc:
                raise ValueError("ADMIN_TOTP_ENCRYPTION_KEY must be a valid Fernet key") from exc
            if not self.api_rate_limit_enabled:
                raise ValueError("API_RATE_LIMIT_ENABLED must be true in production")
            if not 300 <= self.admin_session_ttl_seconds <= 86400:
                raise ValueError("ADMIN_SESSION_TTL_SECONDS must be between 5 minutes and 24 hours")
            if not 60 <= self.download_url_ttl_seconds <= 3600:
                raise ValueError("DOWNLOAD_URL_TTL_SECONDS must be between 1 minute and 1 hour")
        if (
            self.max_json_body_bytes < 1024
            or self.max_upload_mb < 1
            or self.max_pdf_pages < 1
            or self.max_media_duration_seconds < 1
            or self.max_result_mb < 1
        ):
            raise ValueError("Request size limits must be positive")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
