from __future__ import annotations

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


def license_key_prefix(value: str) -> str:
    return normalize_license_key(value)[:11]


def is_license_key_format(value: str) -> bool:
    return bool(_KEY_PATTERN.fullmatch(normalize_license_key(value)))
