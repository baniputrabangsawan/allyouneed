import base64
import hmac
import struct
from hashlib import sha1, sha256
from secrets import token_bytes
from time import time
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def generate_secret() -> str:
    return base64.b32encode(token_bytes(20)).decode().rstrip("=")


def provisioning_uri(email: str, secret: str) -> str:
    label = quote(f"Kits:{email}")
    return f"otpauth://totp/{label}?secret={secret}&issuer=Kits&algorithm=SHA1&digits=6&period=30"


def encrypt_secret(secret: str) -> str:
    key = get_settings().admin_totp_encryption_key
    if not key:
        raise RuntimeError("ADMIN_TOTP_ENCRYPTION_KEY is required for TOTP setup")
    return Fernet(key.encode()).encrypt(secret.encode()).decode()


def decrypt_secret(value: str) -> str:
    try:
        return (
            Fernet(get_settings().admin_totp_encryption_key.encode())
            .decrypt(value.encode())
            .decode()
        )
    except (InvalidToken, ValueError) as exc:
        raise RuntimeError("Unable to decrypt the admin TOTP secret") from exc


def _code(secret: str, counter: int) -> str:
    padded = secret + "=" * (-len(secret) % 8)
    digest = hmac.new(base64.b32decode(padded), struct.pack(">Q", counter), sha1).digest()
    offset = digest[-1] & 15
    number = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{number:06d}"


def verify_totp(secret: str, code: str, at: float | None = None) -> bool:
    if len(code) != 6 or not code.isdigit():
        return False
    counter = int((at if at is not None else time()) // 30)
    return any(hmac.compare_digest(_code(secret, counter + drift), code) for drift in (-1, 0, 1))


def recovery_code_hash(code: str) -> str:
    return sha256(code.upper().encode()).hexdigest()
