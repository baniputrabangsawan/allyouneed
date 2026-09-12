# Admin security and deployment

Kits Admin uses self-hosted FastAPI authentication. Cloudflare Access is not required.
Cloudflare may still provide DNS, HTTPS, CDN, WAF, and origin protection.

## Security model

- Passwords are hashed with Argon2id.
- TOTP secrets are encrypted with a backend-only Fernet key.
- Recovery codes are shown once and stored as SHA-256 digests.
- Browser sessions are opaque random values stored only in an HttpOnly cookie.
- SQLite stores only the session digest, CSRF digest, metadata, expiry, and revocation state.
- Sessions expire after eight hours by default.
- Unsafe requests require `SameSite=Strict`, an allowed `Origin`, and a session-bound CSRF token.
- Redis limits password/TOTP attempts to five per ten minutes and limits authenticated admin traffic.
- There is no public registration or password-reset endpoint.

## Initial owner bootstrap

Generate a Fernet key once:

```bash
cd apps/api
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Store it as `ADMIN_TOTP_ENCRYPTION_KEY`, run the migration, then create the owner:

```bash
uv run alembic upgrade head
uv run utility-admin --email owner@example.com
```

The command prompts for the password twice. It refuses to overwrite an existing owner.
The password must contain 12-128 characters.

## Production configuration

```dotenv
APP_ENV=production
ADMIN_CORS_ORIGINS=["https://admin.example.com"]
ADMIN_SESSION_COOKIE_NAME=kits_admin_session
ADMIN_CSRF_COOKIE_NAME=kits_admin_csrf
ADMIN_SESSION_TTL_SECONDS=28800
ADMIN_TOTP_ENCRYPTION_KEY=PASTE_THE_FERNET_KEY
INLINE_JOBS=false
REDIS_URL=redis://your-production-redis:6379/0
```

Also configure the existing database, entitlement signing, storage, and download secrets.
Production fails startup when critical admin, database, entitlement, or Redis configuration is absent.
No admin secret may use a `VITE_*` or `PUBLIC_*` name.

## Login and TOTP

Open `/admin`. An unauthenticated browser redirects to `/admin/login`.

1. Submit the bootstrapped email and password.
2. If TOTP is enabled, submit a six-digit authenticator code or unused recovery code.
3. FastAPI rotates the pending login into a fresh full session.
4. The browser receives `kits_admin_session` as HttpOnly, Secure in production, SameSite Strict.
5. The non-secret CSRF cookie is echoed in `X-CSRF-Token` and matched against the session digest.

Enable or disable TOTP and change the password under `/admin/system`. Initial TOTP setup returns
the seed and provisioning URI once. Confirmation returns eight recovery codes once. Changing the
password revokes every other active admin session.

Logout posts to `/api/v1/admin/auth/logout`, revokes the database session, and clears both cookies.

## Rate limits

- Login and TOTP verification: 5 per 10 minutes per session/IP bucket.
- Admin reads: 120 per minute.
- Admin mutations: 30 per minute.
- Revoke and activation reset: 10 per minute.

Production fails closed if Redis cannot enforce an admin limit.

## Deployment

Prefer one origin for the browser and API:

```text
https://admin.example.com/admin*          -> TanStack application
https://admin.example.com/api/v1/admin/*  -> FastAPI
```

Run `uv run alembic upgrade head` before starting each API release. Do not expose the SQLite
database or FastAPI origin publicly when a private network or Cloudflare Tunnel is available.
Bypass edge caching for `/admin*` and `/api/v1/admin/*`.

## Validation

Verify invalid and unknown emails return the same message, expired/revoked sessions fail, bad
Origin and CSRF values fail, and logout makes `/admin` inaccessible. Create a license, close the
success dialog, refresh, and confirm the plaintext key cannot be recovered from list, detail,
audit, database, logs, or browser storage.
