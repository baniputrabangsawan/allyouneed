from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

import httpx
from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.hazmat.primitives.hashes import SHA256
from fastapi import Request, status

from app.core.config import get_settings
from app.core.exceptions import ApiError


@dataclass(frozen=True)
class AdminIdentity:
    admin_id: str
    email: str
    identity_provider: str = "cloudflare-access"


def _decode_segment(value: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except Exception as exc:
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED, "ADMIN_UNAUTHORIZED", "Admin authentication is required."
        ) from exc


@lru_cache(maxsize=1)
def _jwks_client() -> httpx.Client:
    return httpx.Client(timeout=3.0)


def _claims(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
        header = json.loads(_decode_segment(encoded_header))
        payload = json.loads(_decode_segment(encoded_payload))
        if not isinstance(header, dict) or not isinstance(payload, dict):
            raise ValueError
        if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
            raise ValueError
        response = _jwks_client().get(settings.cloudflare_access_jwks_url)
        response.raise_for_status()
        keys = response.json().get("keys", [])
        key = next(
            item for item in keys if item.get("kid") == header["kid"] and item.get("kty") == "RSA"
        )
        modulus = int.from_bytes(_decode_segment(key["n"]), "big")
        exponent = int.from_bytes(_decode_segment(key["e"]), "big")
        public_key = RSAPublicNumbers(exponent, modulus).public_key()
        public_key.verify(
            _decode_segment(encoded_signature),
            f"{encoded_header}.{encoded_payload}".encode(),
            PKCS1v15(),
            SHA256(),
        )
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED, "ADMIN_UNAUTHORIZED", "Admin authentication is required."
        ) from exc

    now = datetime.now(UTC).timestamp()
    audience = payload.get("aud", [])
    audiences = [audience] if isinstance(audience, str) else audience
    if (
        payload.get("iss") != settings.cloudflare_access_issuer
        or settings.cloudflare_access_audience not in audiences
        or not isinstance(payload.get("exp"), (int, float))
        or payload["exp"] <= now
        or not isinstance(payload.get("sub"), str)
        or not isinstance(payload.get("email"), str)
    ):
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED, "ADMIN_UNAUTHORIZED", "Admin authentication is required."
        )
    return payload


def authenticate_admin(request: Request) -> AdminIdentity:
    settings = get_settings()
    if settings.admin_dev_bypass and settings.app_env in {"development", "test"}:
        supplied = request.headers.get("X-Admin-Key")
        if supplied and supplied == settings.admin_api_key:
            return AdminIdentity("local-admin", "admin@localhost", "development")
        if (
            settings.app_env == "development"
            and request.client
            and request.client.host
            in {
                "127.0.0.1",
                "::1",
            }
        ):
            return AdminIdentity("local-admin", "admin@localhost", "development")

    token = request.headers.get("Cf-Access-Jwt-Assertion") or request.cookies.get(
        "CF_Authorization"
    )
    if not token:
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED, "ADMIN_UNAUTHORIZED", "Admin authentication is required."
        )
    claims = _claims(token)
    email = claims["email"].strip().lower()
    if email not in settings.admin_allowed_emails:
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            "ADMIN_FORBIDDEN",
            "This identity is not authorized for administration.",
        )
    return AdminIdentity(claims["sub"], email)
