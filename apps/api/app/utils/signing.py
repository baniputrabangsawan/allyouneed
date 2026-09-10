import hashlib
import hmac
from datetime import UTC, datetime, timedelta

from app.core.config import get_settings


def sign_download(key: str, expires: int) -> str:
    secret = get_settings().download_signing_secret.encode()
    return hmac.new(secret, f"{key}:{expires}".encode(), hashlib.sha256).hexdigest()


def download_expiry() -> int:
    ttl = get_settings().download_url_ttl_seconds
    return int((datetime.now(UTC) + timedelta(seconds=ttl)).timestamp())


def signed_download_path(key: str) -> tuple[str, datetime]:
    expires = download_expiry()
    token = sign_download(key, expires)
    expires_at = datetime.fromtimestamp(expires, tz=UTC)
    return f"/api/v1/downloads/{key}?expires={expires}&token={token}", expires_at


def verify_download(key: str, token: str, expires: int) -> bool:
    if expires < int(datetime.now(UTC).timestamp()):
        return False
    expected = sign_download(key, expires)
    return hmac.compare_digest(expected, token)
