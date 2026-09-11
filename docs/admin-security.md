# Admin security and deployment

The Kits admin UI is mounted at `/admin` and all browser API calls use the Cloudflare Access session. No admin secret is shipped in frontend code or browser storage.

## Production configuration

Set these server-only values before starting the API with `APP_ENV=production`:

- `ADMIN_ALLOWED_EMAILS`: JSON list of normalized owner/admin emails.
- `ADMIN_CORS_ORIGINS`: JSON list containing the deployed admin frontend origin.
- `CLOUDFLARE_ACCESS_ISSUER`: Access team issuer, including its exact scheme and host.
- `CLOUDFLARE_ACCESS_AUDIENCE`: audience tag for the protected Access application.
- `CLOUDFLARE_ACCESS_JWKS_URL`: Access public certificate/JWKS endpoint.
- `CLOUDFLARE_ACCESS_LOGOUT_URL`: real Access logout endpoint, normally `/cdn-cgi/access/logout` on the protected host.
- Existing database, entitlement, Redis, and storage credentials.

Production startup fails if Access settings are absent or `ADMIN_DEV_BYPASS=true`. The bypass accepts `X-Admin-Key` only in development/test and exists for local automation; never expose that key through `VITE_*`.

## Cloudflare Access

Use one hostname for the dashboard and its API, for example `admin.example.com`. The current
frontend uses same-origin credentials and does not read or copy the Access token in JavaScript.

### 1. Put the hostname behind Cloudflare

1. Add `example.com` to Cloudflare and ensure its nameservers are active.
2. Create `admin.example.com` as a proxied DNS record (orange cloud), or publish it through a
   Cloudflare Tunnel.
3. Route `/admin` and frontend assets to the TanStack application.
4. Route `/api/v1/admin/*` to FastAPI on the same public hostname.
5. Do not expose FastAPI's origin directly. A Cloudflare Tunnel is preferred when the API runs
   on a VM or private host.

Do not use a separate browser-visible API hostname unless the frontend authentication and CORS
flow are redesigned. The Access assertion header is added by Cloudflare at the origin boundary;
browser JavaScript cannot safely manufacture or retrieve it.

### 2. Configure an identity provider

1. Open **Cloudflare dashboard > Zero Trust**.
2. Go to **Settings > Authentication > Login methods**.
3. Add Google, Microsoft, or another existing identity provider. Cloudflare One-time PIN is
   acceptable for a single owner if the mailbox is strongly protected.
4. Test the login method before creating the application.
5. Enable MFA at the identity provider. Access MFA can be added as another policy requirement.

### 3. Create the Access application

1. Go to **Zero Trust > Access controls > Applications**.
2. Select **Create new application**.
3. Select **Self-hosted and private**, then **Add public hostname**.
4. Name it `Kits Admin`.
5. Enter hostname `admin.example.com`.
6. Add path `/admin*`.
7. Add another public hostname entry for the same hostname with path `/api/v1/admin/*`.
8. Set **Session duration** to a finite value, such as 8 hours.
9. Select only the intended identity provider. Enable instant authentication when only one IdP
   is used.
10. Do not add a Bypass policy or a Service Auth policy to this browser application.

Cloudflare Access applications deny by default. A user must match an Allow policy.

### 4. Add the owner-only policy

1. Add an **Allow** policy named `Kits owners`.
2. Set **Include > Emails** to each exact administrator email address.
3. Do not use `Everyone`, broad email domains, IP-only rules, or public groups.
4. Optionally add **Require > Authentication method/MFA** or a managed-device posture check.
5. Save the policy and application.

The same emails must be present in the API's `ADMIN_ALLOWED_EMAILS` setting. Cloudflare's policy
is the first gate; the FastAPI allowlist is the independent second gate.

### 5. Copy the Access values

1. Open **Zero Trust > Access controls > Applications > Kits Admin > Configure**.
2. Open **Additional settings** and copy **Application Audience (AUD) Tag**.
3. Open **Zero Trust > Settings > Custom Pages** or organization settings and note the team
   domain, for example `https://your-team.cloudflareaccess.com`.
4. Build the cert URL as
   `https://your-team.cloudflareaccess.com/cdn-cgi/access/certs`.

Use the exact team-domain URL as the issuer. Do not add a trailing slash unless Cloudflare's JWT
issuer contains one.

### 6. Configure FastAPI production variables

Set these only on the API runtime, not in `VITE_*` variables:

```dotenv
APP_ENV=production
ADMIN_DEV_BYPASS=false
ADMIN_ALLOWED_EMAILS=["owner@example.com"]
ADMIN_CORS_ORIGINS=["https://admin.example.com"]
CLOUDFLARE_ACCESS_ISSUER=https://your-team.cloudflareaccess.com
CLOUDFLARE_ACCESS_AUDIENCE=PASTE_THE_APPLICATION_AUD_TAG
CLOUDFLARE_ACCESS_JWKS_URL=https://your-team.cloudflareaccess.com/cdn-cgi/access/certs
CLOUDFLARE_ACCESS_LOGOUT_URL=/cdn-cgi/access/logout
INLINE_JOBS=false
REDIS_URL=redis://your-production-redis:6379/0
```

Also configure the existing database, entitlement signing key, storage credentials, and other
production secrets. Production startup intentionally fails when Access, Redis, or entitlement
configuration is missing.

### 7. Configure the frontend

Use same-origin API requests in production:

```dotenv
VITE_APP_URL=https://admin.example.com
VITE_API_BASE_URL=
```

Do not set `VITE_ADMIN_API_KEY`, `VITE_CLOUDFLARE_TOKEN`, or any other admin credential. The
browser receives the HttpOnly Access session cookie from Cloudflare and Cloudflare adds
`Cf-Access-Jwt-Assertion` before forwarding the request to FastAPI.

### 8. Run the migration and deploy

Before starting the new API release:

```bash
cd apps/api
uv run alembic upgrade head
```

Then deploy FastAPI, Redis, and the frontend. Confirm that the DNS record remains proxied.

### 9. Verify the edge gate

1. Open a private/incognito browser window.
2. Visit `https://admin.example.com/admin`.
3. Confirm Cloudflare Access prompts for authentication before Kits HTML is shown.
4. Sign in using an allowlisted email and confirm the Overview page loads.
5. Sign out from the dashboard and confirm the Access session is cleared.
6. Try a non-allowlisted identity and confirm it is denied by Cloudflare.

### 10. Verify the backend gate

An origin request without a valid Access assertion must fail even if someone discovers the API
origin:

```bash
curl -i https://admin.example.com/api/v1/admin/licenses
```

Without an Access session, Cloudflare should redirect to login or deny the request. Test the
FastAPI origin separately from a trusted network if it is addressable; it must return
`ADMIN_UNAUTHORIZED` without `Cf-Access-Jwt-Assertion`.

After authenticating, use the dashboard to create a license and verify:

1. The plaintext key appears only in the success dialog.
2. Closing the dialog removes it.
3. Refreshing the page does not reveal it.
4. License list and audit responses contain no plaintext key or digest.
5. Suspend, resume, renew, reset activation, and revoke create audit records.

### 11. Protect and monitor the origin

1. Prefer Cloudflare Tunnel so FastAPI has no public inbound port.
2. If a public origin is unavoidable, allow only Cloudflare IP ranges and authenticated tunnel or
   origin traffic.
3. Enable Access authentication event logging and review denied requests.
4. Alert on repeated `ADMIN_UNAUTHORIZED`, `ADMIN_FORBIDDEN`, and `RATE_LIMITED` responses.
5. Rotate the identity-provider credentials and review the email allowlist periodically.
6. Do not cache `/admin*` or `/api/v1/admin/*` in Cloudflare Cache Rules.

## Request protections

- FastAPI verifies RS256 signature, issuer, audience, expiry, subject, email, and the explicit email allowlist.
- State-changing requests with an `Origin` header must match `ADMIN_CORS_ORIGINS`. Access JWT/cookie verification remains the authorization boundary.
- Admin responses use `Cache-Control: no-store`, anti-framing CSP, no-referrer, nosniff, and a restrictive permissions policy.
- Redis limits reads to 120/minute, mutations to 30/minute, and revoke/reset actions to 10/minute per Access token. Production fails closed when rate limiting is unavailable.
- License changes and append-only audit records commit in one SQL transaction. Audit metadata excludes keys, tokens, installation hashes, and secrets.

## Staging validation

Verify that unauthenticated browser requests receive the Access challenge, allowlisted identities can load `/admin`, non-allowlisted identities receive `ADMIN_FORBIDDEN`, and direct API requests without a valid Access assertion receive `ADMIN_UNAUTHORIZED`. Create a license, close the one-time key dialog, refresh, and confirm the plaintext key cannot be recovered from list, detail, or audit endpoints.
