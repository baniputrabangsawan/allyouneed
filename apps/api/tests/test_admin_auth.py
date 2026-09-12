from datetime import timedelta
from time import time

from httpx import AsyncClient
from sqlalchemy import select

from app.core.clock import now
from app.db.models import AdminSession, AdminUser
from app.db.session import get_session_factory
from app.security.passwords import verify_password
from app.security.totp import _code, decrypt_secret, verify_totp


async def test_login_is_generic_and_sets_session(api: AsyncClient) -> None:
    for email, password in [
        ("unknown@example.com", "wrong password value"),
        ("owner@example.com", "wrong password value"),
    ]:
        response = await api.post(
            "/api/v1/admin/auth/login", json={"email": email, "password": password}
        )
        assert response.status_code == 401
        assert response.json()["error"]["message"] == "Invalid email or password."
    response = await api.post(
        "/api/v1/admin/auth/login",
        json={"email": "owner@example.com", "password": "correct horse battery staple"},
    )
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    me = await api.get("/api/v1/admin/auth/me")
    assert me.json()["data"]["email"] == "owner@example.com"
    assert "passwordHash" not in me.text and "sessionHash" not in me.text


async def test_expired_session_is_rejected(admin_api: AsyncClient) -> None:
    factory = get_session_factory()
    async with factory() as db:
        current = await db.scalar(select(AdminSession).order_by(AdminSession.created_at.desc()))
        assert current
        current.expires_at = now() - timedelta(seconds=1)
        await db.commit()
    assert (await admin_api.get("/api/v1/admin/auth/me")).status_code == 401


async def test_disabled_admin_cannot_login(api: AsyncClient) -> None:
    factory = get_session_factory()
    async with factory() as db:
        user = await db.scalar(select(AdminUser).where(AdminUser.email == "owner@example.com"))
        assert user
        user.is_active = False
        await db.commit()
    response = await api.post(
        "/api/v1/admin/auth/login",
        json={"email": "owner@example.com", "password": "correct horse battery staple"},
    )
    assert response.status_code == 401


async def test_csrf_logout_and_password_change(admin_api: AsyncClient) -> None:
    csrf = admin_api.headers.pop("X-CSRF-Token")
    assert (await admin_api.post("/api/v1/admin/auth/logout")).status_code == 403
    admin_api.headers["X-CSRF-Token"] = csrf
    changed = await admin_api.post(
        "/api/v1/admin/auth/password",
        json={
            "currentPassword": "correct horse battery staple",
            "newPassword": "new correct horse battery staple",
        },
    )
    assert changed.status_code == 204
    factory = get_session_factory()
    async with factory() as db:
        user = await db.scalar(select(AdminUser).where(AdminUser.email == "owner@example.com"))
        assert user and verify_password("new correct horse battery staple", user.password_hash)
    assert (await admin_api.post("/api/v1/admin/auth/logout")).status_code == 204
    assert (await admin_api.get("/api/v1/admin/auth/me")).status_code == 401


async def test_totp_setup_login_and_recovery_code(admin_api: AsyncClient) -> None:
    setup = await admin_api.post(
        "/api/v1/admin/auth/totp/setup", json={"password": "correct horse battery staple"}
    )
    secret = setup.json()["data"]["secret"]
    code = _code(secret, int(time() // 30))
    confirmed = await admin_api.post("/api/v1/admin/auth/totp/confirm", json={"code": code})
    recovery = confirmed.json()["data"]["recoveryCodes"][0]
    assert (
        await admin_api.post(
            "/api/v1/admin/auth/totp/setup",
            json={"password": "correct horse battery staple"},
        )
    ).status_code == 409
    await admin_api.post("/api/v1/admin/auth/logout")
    login = await admin_api.post(
        "/api/v1/admin/auth/login",
        json={"email": "owner@example.com", "password": "correct horse battery staple"},
    )
    assert login.json()["data"]["requiresTotp"] is True
    assert (await admin_api.get("/api/v1/admin/auth/me")).status_code == 401
    assert (
        await admin_api.post("/api/v1/admin/auth/totp/verify", json={"code": "000000"})
    ).status_code == 401
    assert (
        await admin_api.post("/api/v1/admin/auth/totp/verify", json={"code": recovery})
    ).status_code == 200
    factory = get_session_factory()
    async with factory() as db:
        user = await db.scalar(select(AdminUser).where(AdminUser.email == "owner@example.com"))
        assert user and user.totp_secret_encrypted
        assert decrypt_secret(user.totp_secret_encrypted) == secret
        assert verify_totp(secret, code)
        assert secret not in user.totp_secret_encrypted
