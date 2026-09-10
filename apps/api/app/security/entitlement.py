from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
    load_pem_private_key,
    load_pem_public_key,
)

from app.core.clock import Clock, aware
from app.core.clock import now as default_now
from app.core.config import Settings

TOKEN_VERSION = 1


class EntitlementSigner:
    def __init__(self, settings: Settings, clock: Clock = default_now) -> None:
        self._clock = clock
        self._kid = settings.entitlement_key_id
        self._ttl = settings.entitlement_token_ttl_seconds
        self._private = _load_private_key(settings.entitlement_private_key)
        self._public = _load_public_key(settings.entitlement_public_key, self._private)

    def issue(
        self,
        *,
        license_id: str,
        installation_hash: str,
        plan: str,
        capabilities: list[str],
        license_expires_at: datetime | None,
    ) -> str:
        issued_at = self._clock()
        token_expires = issued_at + timedelta(seconds=self._ttl)
        if license_expires_at is not None:
            license_exp = aware(license_expires_at)
            if license_exp < token_expires:
                token_expires = license_exp
        payload = {
            "license_id": license_id,
            "installation_hash": installation_hash,
            "plan": plan,
            "capabilities": capabilities,
            "iat": int(issued_at.timestamp()),
            "exp": int(token_expires.timestamp()),
            "ver": TOKEN_VERSION,
            "kid": self._kid,
        }
        body = _b64url(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
        signature = _b64url(self._private.sign(body.encode("ascii")))
        return f"{body}.{signature}"

    def verify(self, token: str) -> dict[str, Any]:
        try:
            body, signature = token.split(".", 1)
        except ValueError as exc:
            raise ValueError("token format is invalid") from exc
        try:
            self._public.verify(_b64url_decode(signature), body.encode("ascii"))
        except (InvalidSignature, ValueError) as exc:
            raise ValueError("token signature is invalid") from exc
        try:
            payload = json.loads(_b64url_decode(body))
        except (ValueError, json.JSONDecodeError) as exc:
            raise ValueError("token payload is invalid") from exc
        if not isinstance(payload, dict):
            raise ValueError("token payload is invalid")
        if payload.get("kid") != self._kid or payload.get("ver") != TOKEN_VERSION:
            raise ValueError("token version is invalid")
        exp = payload.get("exp")
        if not isinstance(exp, int) or exp <= int(self._clock().timestamp()):
            raise ValueError("token is expired")
        return payload


def generate_keypair() -> tuple[str, str]:
    private = Ed25519PrivateKey.generate()
    private_pem = private.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()).decode(
        "ascii"
    )
    public_pem = (
        private.public_key()
        .public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
        .decode("ascii")
    )
    return private_pem, public_pem


def _load_private_key(value: str) -> Ed25519PrivateKey:
    if not value:
        raise ValueError("ENTITLEMENT_PRIVATE_KEY is required")
    raw = value.encode("utf-8") if value.startswith("-----") else base64.b64decode(value)
    if value.startswith("-----"):
        loaded = load_pem_private_key(raw, password=None)
        if not isinstance(loaded, Ed25519PrivateKey):
            raise ValueError("ENTITLEMENT_PRIVATE_KEY must be Ed25519")
        return loaded
    return Ed25519PrivateKey.from_private_bytes(raw)


def _load_public_key(value: str, private: Ed25519PrivateKey) -> Ed25519PublicKey:
    if not value:
        return private.public_key()
    raw = value.encode("utf-8") if value.startswith("-----") else base64.b64decode(value)
    if value.startswith("-----"):
        loaded = load_pem_public_key(raw)
        if not isinstance(loaded, Ed25519PublicKey):
            raise ValueError("ENTITLEMENT_PUBLIC_KEY must be Ed25519")
        return loaded
    return Ed25519PublicKey.from_public_bytes(raw)


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
