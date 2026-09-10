from datetime import UTC, datetime, timedelta

from app.core.config import Settings
from app.security.entitlement import EntitlementSigner, generate_keypair


def _settings() -> Settings:
    private_pem, public_pem = generate_keypair()
    return Settings(
        entitlement_private_key=private_pem,
        entitlement_public_key=public_pem,
        entitlement_key_id="unit",
        entitlement_token_ttl_seconds=60,
    )


def test_issue_and_verify_roundtrip() -> None:
    signer = EntitlementSigner(_settings())
    token = signer.issue(
        license_id="lic-1",
        installation_hash="hash-1",
        plan="pro_1_month",
        capabilities=["image.ai.upscale"],
        license_expires_at=datetime.now(UTC) + timedelta(days=10),
    )
    claims = signer.verify(token)
    assert claims["license_id"] == "lic-1"
    assert claims["installation_hash"] == "hash-1"
    assert "image.ai.upscale" in claims["capabilities"]
    assert "license_key" not in claims


def test_expired_token_is_rejected() -> None:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    settings = _settings()
    signer = EntitlementSigner(settings, clock=lambda: start)
    token = signer.issue(
        license_id="lic-1",
        installation_hash="hash-1",
        plan="pro_1_month",
        capabilities=[],
        license_expires_at=None,
    )
    later = EntitlementSigner(settings, clock=lambda: start + timedelta(seconds=120))
    try:
        later.verify(token)
        raise AssertionError("expired token verified")
    except ValueError as exc:
        assert "expired" in str(exc)


def test_wrong_signature_is_rejected() -> None:
    signer = EntitlementSigner(_settings())
    other = EntitlementSigner(_settings())
    token = signer.issue(
        license_id="lic-1",
        installation_hash="hash-1",
        plan="pro_1_month",
        capabilities=[],
        license_expires_at=None,
    )
    try:
        other.verify(token)
        raise AssertionError("foreign signature verified")
    except ValueError:
        pass
