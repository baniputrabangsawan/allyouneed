import base64
import json
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
from cryptography.hazmat.primitives.hashes import SHA256

from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.security import admin


def encoded(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


class JwksResponse:
    def __init__(self, body: dict[str, Any]) -> None:
        self.body = body

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict[str, Any]:
        return self.body


class JwksClient:
    def __init__(self, body: dict[str, Any]) -> None:
        self.body = body

    def get(self, _: str) -> JwksResponse:
        return JwksResponse(self.body)


def token(claims: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    numbers = private.public_key().public_numbers()
    header = encoded(json.dumps({"alg": "RS256", "kid": "test-key"}).encode())
    payload = encoded(json.dumps(claims).encode())
    signing_input = f"{header}.{payload}".encode()
    signature = encoded(private.sign(signing_input, PKCS1v15(), SHA256()))
    jwk = {
        "kid": "test-key",
        "kty": "RSA",
        "n": encoded(numbers.n.to_bytes((numbers.n.bit_length() + 7) // 8, "big")),
        "e": encoded(numbers.e.to_bytes((numbers.e.bit_length() + 7) // 8, "big")),
    }
    return f"{header}.{payload}.{signature}", {"keys": [jwk]}


def claims(**overrides: Any) -> dict[str, Any]:
    return {
        "iss": "https://team.cloudflareaccess.com",
        "aud": ["admin-audience"],
        "sub": "admin-subject",
        "email": "owner@example.com",
        "exp": (datetime.now(UTC) + timedelta(minutes=5)).timestamp(),
        **overrides,
    }


def configure(monkeypatch: pytest.MonkeyPatch, jwks: dict[str, Any]) -> None:
    monkeypatch.setenv("CLOUDFLARE_ACCESS_ISSUER", "https://team.cloudflareaccess.com")
    monkeypatch.setenv("CLOUDFLARE_ACCESS_AUDIENCE", "admin-audience")
    monkeypatch.setenv("CLOUDFLARE_ACCESS_JWKS_URL", "https://example.test/certs")
    get_settings.cache_clear()
    monkeypatch.setattr(admin, "_jwks_client", lambda: JwksClient(jwks))


def test_cloudflare_jwt_signature_and_claims(monkeypatch: pytest.MonkeyPatch) -> None:
    value, jwks = token(claims())
    configure(monkeypatch, jwks)
    assert admin._claims(value)["sub"] == "admin-subject"
    get_settings.cache_clear()


@pytest.mark.parametrize(
    "override",
    [
        {"aud": ["wrong"]},
        {"exp": (datetime.now(UTC) - timedelta(minutes=1)).timestamp()},
        {"iss": "https://attacker.example"},
    ],
)
def test_cloudflare_jwt_rejects_invalid_claims(
    monkeypatch: pytest.MonkeyPatch, override: dict[str, Any]
) -> None:
    value, jwks = token(claims(**override))
    configure(monkeypatch, jwks)
    with pytest.raises(ApiError) as error:
        admin._claims(value)
    assert error.value.code == "ADMIN_UNAUTHORIZED"
    get_settings.cache_clear()
