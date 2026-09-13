from __future__ import annotations

import base64
import hashlib
import re
import secrets

KEY_PREFIX = "UTL-PRO-"
GROUP_LENGTH = 4
GROUP_COUNT = 3
CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_KEY_PATTERN = re.compile(
    r"^UTL-PRO-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$"
)


def generate_license_key() -> str:
    body = "".join(CROCKFORD[byte % 32] for byte in secrets.token_bytes(GROUP_LENGTH * GROUP_COUNT))
    groups = [body[index : index + GROUP_LENGTH] for index in range(0, len(body), GROUP_LENGTH)]
    return f"{KEY_PREFIX}{'-'.join(groups)}"


def normalize_license_key(value: str) -> str:
    compact = value.strip().upper().replace(" ", "").replace("-", "")
    if compact.startswith("UTLPRO") and len(compact) == 6 + GROUP_LENGTH * GROUP_COUNT:
        body = compact[6:]
        groups = [body[index : index + GROUP_LENGTH] for index in range(0, len(body), GROUP_LENGTH)]
        return f"{KEY_PREFIX}{'-'.join(groups)}"
    return value.strip().upper()


def hash_license_key(value: str) -> str:
    return hashlib.sha256(normalize_license_key(value).encode("utf-8")).hexdigest()


def hash_installation_id(value: str) -> str:
    return hashlib.sha256(value.strip().encode("utf-8")).hexdigest()


def generate_device_secret() -> str:
    return _b64url(secrets.token_bytes(32))


def decode_device_secret(value: str) -> bytes:
    compact = value.strip()
    if not compact or len(compact) > 128:
        raise ValueError("invalid device secret")
    try:
        raw = _b64url_decode(compact)
    except Exception as exc:
        raise ValueError("invalid device secret") from exc
    if len(raw) != 32:
        raise ValueError("invalid device secret")
    return raw


def hash_device_secret(value: str) -> str:
    return hashlib.sha256(decode_device_secret(value)).hexdigest()


def generate_transfer_token() -> str:
    return secrets.token_urlsafe(32)


def hash_transfer_token(value: str) -> str:
    return hashlib.sha256(value.strip().encode("utf-8")).hexdigest()


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def license_key_prefix(value: str) -> str:
    return normalize_license_key(value)[:11]


def is_license_key_format(value: str) -> bool:
    return bool(_KEY_PATTERN.fullmatch(normalize_license_key(value)))
