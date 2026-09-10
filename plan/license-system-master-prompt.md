# MASTER IMPLEMENTATION PROMPT — ACCOUNTLESS LICENSE SYSTEM FOR AN EXISTING UTILITY WEB APP

## ROLE

Act as a **Senior Full-Stack Architect, Senior Backend Engineer, Senior Frontend Engineer, Security Engineer, and Licensing System Architect**.

You are working on an **existing All-in-One Utility Web App** whose frontend and backend are already implemented.

Your task is to **retrofit a commercial Free/Pro license system without user accounts** into the existing application.

Do **not** rebuild the project. Do **not** replace the current frontend or backend architecture. Do **not** introduce login, registration, profiles, passwords, or user accounts.

The licensing system must be modular, secure, production-minded, and compatible with the existing application.

---

# 1. EXISTING PROJECT STACK

## Frontend

```text
TanStack Start
React
TypeScript
Vite
pnpm
Tailwind CSS
shadcn/ui
Radix UI
Lucide
TanStack Query
TanStack Router
TanStack Form
Zod
```

## Backend

```text
Python 3.12+
FastAPI
Pydantic v2
Uvicorn
Redis
Dramatiq
Cloudflare R2 / S3-compatible object storage
Python processing workers
```

Preserve all valid existing code and architecture.

Use:

```text
EXTEND EXISTING ARCHITECTURE
```

not:

```text
REWRITE EXISTING ARCHITECTURE
```

---

# 2. COMMERCIAL MODEL

Support:

```text
FREE
PRO — 1 MONTH
PRO — 6 MONTHS
PRO — 12 MONTHS
```

No account system:

```text
NO REGISTER
NO LOGIN
NO PASSWORD
NO EMAIL LOGIN
NO USER PROFILE
NO ACCOUNT DASHBOARD
NO OAUTH
NO FORGOT PASSWORD
```

Commercial rule:

```text
1 License
=
1 Active Installation
```

Each Pro license must support:

```text
activation
expiration
renewal
deactivation
suspension
revocation
activation limit
capability-based access
```

---

# 3. PAYMENT MODEL

Do **not** implement a payment gateway yet.

Use:

```text
MANUAL / ADMIN-ISSUED LICENSE KEYS
```

Initial sales flow:

```text
Customer pays manually / QRIS / bank transfer
↓
Admin verifies payment
↓
Admin creates or renews license through CLI
↓
Customer receives License Key
↓
Customer activates license in the web app
```

The architecture must remain ready for future payment gateway webhook integration, but payment integration is not part of this implementation.

Do not create fake checkout success.

---

# 4. AUDIT BEFORE IMPLEMENTATION

Before changing code:

1. Inspect the entire repository.
2. Identify the existing frontend architecture.
3. Identify the existing backend architecture.
4. Identify the existing Tool Registry.
5. Identify the existing API client abstraction.
6. Identify existing FastAPI routers and dependencies.
7. Identify the existing job service.
8. Identify Dramatiq queues and workers.
9. Identify Redis usage.
10. Identify Cloudflare R2 usage.
11. Identify environment/configuration handling.
12. Identify whether SQLAlchemy or Alembic already exists.
13. Identify current error response contracts.
14. Identify existing tests.
15. Identify which tools run client-side and which use backend processing.

Before implementation, produce a concise migration plan showing:

```text
Files to create
Files to modify
Files that should remain untouched
```

Do not invent parallel abstractions if equivalent ones already exist.

---

# 5. TARGET ARCHITECTURE

```text
                         USER
                           |
                           v
                 TanStack Frontend
                           |
              +------------+------------+
              |                         |
              v                         v
        Free Client Tools          Premium Tools
                                          |
                                          v
                                  Entitlement Token
                                          |
                                          v
                                      FastAPI
                                          |
                                 require_entitlement()
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
                 License Service                          Redis
                        |                          cache / rate limit /
                        |                          concurrency control
                        v
                Persistent SQLite DB
                        |
                        v
                 Existing Job Service
                        |
                        v
                 Redis + Dramatiq
                        |
                        v
                  Existing Workers
                        |
                        v
                 Cloudflare R2
```

Responsibility split:

```text
SQLite
→ license source of truth

Redis
→ cache, rate limiting, concurrency, temporary state

R2
→ user files and processing results

FastAPI
→ license validation and premium enforcement

Frontend
→ license UX only, never final authority
```

---

# 6. LICENSE PERSISTENCE

Use:

```text
SQLite
SQLAlchemy 2
aiosqlite
Alembic
```

Do not use PostgreSQL for this licensing MVP.

Do not use Redis as the source of truth for licenses.

Do not use JSON files as the production license database.

SQLite is acceptable because the current deployment assumes a single backend/VPS or a single writer with persistent storage.

Use a repository abstraction so SQLite can later be replaced by PostgreSQL without changing:

```text
LicenseService
EntitlementService
public API contracts
frontend code
```

---

# 7. SQLITE PRODUCTION REQUIREMENTS

Use:

```env
LICENSE_DATABASE_URL=sqlite+aiosqlite:///./data/licenses.db
```

Production requirements:

```text
persistent volume
WAL mode
foreign_keys=ON
busy timeout
automatic backups
```

Do not place the production SQLite file on ephemeral container storage.

Add local DB files to `.gitignore`:

```text
data/*.db
```

---

# 8. DATABASE TABLES

## licenses

```text
id
license_hash
plan
status
activated_at
expires_at
max_activations
created_at
updated_at
```

Optional:

```text
note
created_source
```

Never store raw license keys.

## license_activations

```text
id
license_id
installation_hash
activated_at
last_seen_at
revoked_at
created_at
```

Relationship:

```text
license_activations.license_id
→
licenses.id
```

Default:

```text
max_activations = 1
```

---

# 9. LICENSE STATUS

Support only:

```text
active
suspended
revoked
expired
```

Do not accept arbitrary status strings.

---

# 10. LICENSE PLANS

Support:

```text
pro_1_month
pro_6_months
pro_12_months
```

Future-ready but not required now:

```text
pro_lifetime
pro_business
```

The 1/6/12-month plans may share the same Pro capabilities; their main difference is duration.

---

# 11. LICENSE DURATION

Use calendar-month arithmetic:

```python
relativedelta(months=1)
relativedelta(months=6)
relativedelta(months=12)
```

Do not hardcode:

```text
1 month = 30 days
6 months = 180 days
12 months = 365 days
```

All backend time calculations use UTC.

Do not trust the browser clock.

---

# 12. LICENSE START DATE

License duration starts on first activation, not key creation.

Example:

```text
License created:
September 1

License activated:
September 10

activated_at = September 10
expires_at = activated_at + plan duration
```

---

# 13. LICENSE KEY FORMAT

Use a user-friendly format such as:

```text
UTL-PRO-7KQ9-A28M-JX4P
```

Generate it using cryptographically secure randomness.

Do not use:

```text
Math.random()
timestamps
sequential IDs
email addresses
predictable counters
```

Normalize before lookup:

```text
trim
uppercase
normalize separators
validate prefix
validate length
```

Creation and validation must use identical normalization.

---

# 14. LICENSE KEY STORAGE

Never store raw license keys in the database.

Store only a digest.

For high-entropy random keys, SHA-256 is acceptable. A server-side keyed HMAC may also be used.

Do not use:

```text
MD5
SHA-1
plaintext
```

The raw key should only be shown during explicit creation/admin operations.

---

# 15. INSTALLATION MODEL

Because this is a browser-based web app, do not try to read:

```text
MAC address
motherboard serial
disk serial
hardware ID
```

Use a browser-generated Installation ID:

```ts
crypto.randomUUID()
```

Generate once and persist in:

```text
localStorage
```

Recommended key:

```text
utility:installation-id
```

---

# 16. INSTALLATION PRIVACY

Do not implement invasive fingerprinting.

Do not use:

```text
canvas fingerprint
WebGL fingerprint
font fingerprint
audio fingerprint
GPU fingerprint
aggressive browser fingerprinting
```

The frontend sends Installation ID to the backend during activation/refresh.

The backend should store only a hash or keyed digest of it.

---

# 17. ONE LICENSE = ONE ACTIVE INSTALLATION

Enforce:

```text
max_activations = 1
```

Example:

```text
License A + Installation A
→ allowed

License A + Installation B
→ rejected
```

Return:

```text
ACTIVATION_LIMIT_REACHED
```

Do not silently kick out the original installation when another installation activates.

---

# 18. ACTIVATION IDEMPOTENCY

If the same license is activated again from the same active installation:

```text
do not create another activation row
```

Return a fresh entitlement token.

Activation must be idempotent for:

```text
license + installation
```

---

# 19. LICENSE ACTIVATION FLOW

```text
User enters License Key
↓
Frontend obtains Installation ID
↓
POST /api/v1/licenses/activate
↓
Backend normalizes license
↓
Backend hashes license
↓
Lookup license
↓
Validate status
↓
Validate expiry
↓
Check existing activation
↓
Check activation limit
↓
Create activation if allowed
↓
Set activated_at / expires_at on first activation
↓
Issue signed entitlement token
↓
Frontend stores entitlement token
↓
Premium UI becomes active
```

---

# 20. ACTIVATION ERRORS

Support:

```text
INVALID_LICENSE
LICENSE_EXPIRED
LICENSE_REVOKED
LICENSE_SUSPENDED
ACTIVATION_LIMIT_REACHED
ACTIVATION_REVOKED
LICENSE_NOT_ACTIVE
```

Use the existing backend error contract if available.

---

# 21. DEACTIVATION

Implement:

```text
POST /api/v1/licenses/deactivate
```

Behavior:

```text
validate entitlement
locate current activation
mark activation revoked/deactivated
invalidate license cache
clear entitlement on frontend
free one activation slot
```

After deactivation, the same license may activate on another installation.

---

# 22. DEVICE MOVING

Supported flow:

```text
Old Device
↓
Deactivate This Device
↓
Activation slot becomes free
↓
New Device
↓
Activate same License Key
```

The key remains unchanged.

---

# 23. LOST DEVICE

Because there is no account, use an admin CLI mechanism:

```text
reset activations
```

This allows support to free a license slot when the old device/browser is unavailable.

---

# 24. RENEWAL

Do not create a new key during renewal.

If the license is still active:

```text
new_expiry =
current_expiry + purchased_duration
```

If already expired:

```text
new_expiry =
current_server_time + purchased_duration
```

Do not discard remaining paid time.

---

# 25. SUSPEND / RESUME / REVOKE

Support admin operations:

```text
suspend
resume
revoke
```

Premium APIs must reject suspended or revoked licenses.

---

# 26. ENTITLEMENT TOKEN

Do not use the license key for every premium request.

After activation:

```text
License Key
↓
Backend
↓
Signed Entitlement Token
```

Default TTL:

```text
24 hours
```

Use:

```env
ENTITLEMENT_TOKEN_TTL_SECONDS=86400
```

---

# 27. ENTITLEMENT SIGNING

Prefer asymmetric signing:

```text
Ed25519
```

Use backend-only secrets:

```env
ENTITLEMENT_PRIVATE_KEY=
ENTITLEMENT_PUBLIC_KEY=
```

Never expose the private signing key to:

```text
VITE_*
frontend bundle
public repository
client configuration
```

Support key versioning / `kid` for future rotation.

---

# 28. ENTITLEMENT TOKEN CONTENT

Include only:

```text
license_id
installation reference/hash
plan
capabilities
issued_at
expires_at
token_version
key_id
```

Do not include:

```text
raw license key
private signing secret
private customer data
payment secret
```

---

# 29. LICENSE SERVICE

Create:

```text
LicenseService
```

Responsibilities:

```text
create_license()
activate()
deactivate()
validate()
renew()
suspend()
resume()
revoke()
check_expiry()
check_activation_limit()
```

Do not put FastAPI Request objects into LicenseService.

---

# 30. ENTITLEMENT SERVICE

Create:

```text
EntitlementService
```

Responsibilities:

```text
build capabilities
issue signed token
verify token
validate expiry
validate installation binding
validate required capability
```

Keep signing logic separate from persistence.

---

# 31. REPOSITORIES

Create or extend:

```text
LicenseRepository
LicenseActivationRepository
```

Keep direct SQLAlchemy access out of route handlers.

---

# 32. SUGGESTED BACKEND STRUCTURE

Adapt to the existing project:

```text
app/
├── api/
│   └── v1/
│       └── licenses.py
├── services/
│   ├── license_service.py
│   └── entitlement_service.py
├── repositories/
│   ├── licenses.py
│   └── license_activations.py
├── db/
│   └── models/
│       ├── license.py
│       └── license_activation.py
├── schemas/
│   └── licenses.py
├── security/
│   └── entitlement.py
└── cli/
    └── licenses.py
```

Reuse equivalent existing layers rather than duplicating them.

---

# 33. LICENSE API

Add:

```text
POST /api/v1/licenses/activate
POST /api/v1/licenses/refresh
POST /api/v1/licenses/deactivate
GET  /api/v1/licenses/status
```

---

# 34. ACTIVATE REQUEST

```json
{
  "licenseKey": "UTL-PRO-7KQ9-A28M-JX4P",
  "installationId": "a-valid-installation-uuid"
}
```

---

# 35. ACTIVATE RESPONSE

```json
{
  "data": {
    "token": "signed-entitlement-token",
    "plan": "pro_12_months",
    "expiresAt": "2027-09-10T05:00:00Z",
    "capabilities": [
      "image.ai.background_removal",
      "image.ai.upscale",
      "document.ocr.advanced",
      "audio.speech_to_text",
      "media.subtitle.generate",
      "video.processing"
    ]
  }
}
```

Adapt casing to the existing API contract.

---

# 36. REFRESH

Implement:

```text
POST /api/v1/licenses/refresh
```

Flow:

```text
verify current entitlement
↓
check license
↓
check status
↓
check expiration
↓
check active installation
↓
issue new entitlement token
```

---

# 37. LICENSE STATUS

Implement:

```text
GET /api/v1/licenses/status
```

Return only:

```text
plan
effective status
expiresAt
capabilities
installation active
```

Do not expose license hashes or internal secrets.

---

# 38. CAPABILITY-BASED ACCESS

Do not rely only on:

```text
is_pro = true
```

Use explicit capabilities:

```text
image.ai.background_removal
image.ai.upscale
document.ocr.advanced
audio.speech_to_text
audio.tts.premium
media.subtitle.generate
video.processing
pdf.large_processing
batch.large
```

---

# 39. PLAN CAPABILITY CONFIG

Centralize capability definitions.

The three Pro durations can reuse the same capability set.

Do not duplicate identical capability configuration.

---

# 40. PREMIUM BACKEND ENFORCEMENT

Create a centralized FastAPI dependency such as:

```python
require_entitlement(
    capability="image.ai.background_removal"
)
```

Premium flow:

```text
Request
↓
Verify token signature
↓
Validate token expiry
↓
Validate current license state
↓
Validate license expiration
↓
Validate active installation
↓
Validate capability
↓
Apply rate/concurrency control
↓
Call existing service/job processor
```

Do not copy-paste license validation into each route.

---

# 41. DO NOT APPLY LICENSE GLOBALLY

Do not create a global middleware that requires a license for the entire backend.

Free endpoints must remain accessible.

Only premium/resource-controlled endpoints require entitlement.

---

# 42. EXISTING PROCESSORS AND WORKERS

Do not rewrite processors or workers.

Correct layering:

```text
route
↓
entitlement dependency
↓
existing service
↓
existing job service
↓
existing processor / worker
```

Preserve:

```text
Redis
Dramatiq
worker queues
Cloudflare R2 flow
```

Never send raw license keys to Redis or Dramatiq.

---

# 43. REDIS ROLE

Redis may be used for:

```text
license status cache
rate limiting
concurrency limits
temporary entitlement state
abuse protection
```

Redis is not the durable license authority.

---

# 44. LICENSE STATUS CACHE

Optional cache:

```text
30–120 seconds
```

Invalidate on:

```text
renew
suspend
resume
revoke
deactivate
reset activations
```

---

# 45. REVOCATION BEHAVIOR

Premium requests should perform:

```text
verify signed token
+
validate cached/current license state
```

so revoked/suspended licenses stop working quickly.

---

# 46. RATE LIMIT AND CONCURRENCY

Use:

```text
license_id
installation hash
IP only as secondary signal
```

Do not permanently bind a license to an IP.

Example limits:

```text
AI concurrent jobs: 2
Video concurrent jobs: 1
```

Use Redis TTL-backed counters/semaphores and release slots on:

```text
success
failure
cancellation
timeout
```

---

# 47. LICENSE SHARING PROTECTION

Assume license keys may be shared.

Protection should come from:

```text
one active installation
backend entitlement validation
rate limiting
concurrency control
revocation
suspension
```

Do not rely on key secrecy alone.

---

# 48. FRONTEND TOOL REGISTRY

Do not replace the existing Tool Registry.

Extend it:

```ts
type AccessTier = "free" | "pro";

interface ToolDefinition {
  id: string;
  name: string;
  accessTier: AccessTier;
  requiredCapability?: string;
}
```

Example free tool:

```ts
{
  id: "compress-image",
  accessTier: "free"
}
```

Example premium tool:

```ts
{
  id: "remove-background",
  accessTier: "pro",
  requiredCapability: "image.ai.background_removal"
}
```

---

# 49. FREE TOOL STRATEGY

Keep simple client-side deterministic tools free whenever practical:

```text
basic image compression
resize
crop
rotate
flip
basic image conversion
basic watermark
QR generator
barcode generator
JSON formatter
Base64
UUID
password generator
text utilities
developer utilities
```

Do not move them to the backend just to enforce payment.

---

# 50. PREMIUM TOOL STRATEGY

Prefer backend/resource-heavy capabilities for Pro:

```text
AI Background Removal
AI Upscale
Advanced OCR
Speech to Text
Premium TTS
Subtitle Generator
Video Processing
Large PDF Processing
Large Batch Processing
Higher Server Limits
Priority Processing
```

---

# 51. FRONTEND INSTALLATION ID

Create one centralized helper:

```ts
getOrCreateInstallationId()
```

Behavior:

```text
existing localStorage ID
→ return

otherwise
→ crypto.randomUUID()
→ persist
→ return
```

Do not duplicate this logic.

---

# 52. FRONTEND LICENSE STATE

Create or extend:

```text
LicenseProvider
or
EntitlementProvider
```

Expose:

```ts
status
plan
expiresAt
capabilities
installationId
isPro
hasCapability()
activate()
refresh()
deactivate()
```

Do not spread token/localStorage logic throughout components.

---

# 53. TANSTACK QUERY

Use the existing API client and TanStack Query for:

```text
activation
refresh
status
deactivation
```

Do not create ad-hoc fetch logic if a typed API abstraction exists.

---

# 54. FRONTEND TOKEN STORAGE

Persist only:

```text
installation ID
entitlement token
minimal cached display data
```

After activation, clear the raw License Key from form/component state.

Do not persist the raw License Key unless absolutely necessary.

---

# 55. FRONTEND STARTUP

```text
load cached entitlement
↓
restore UI quickly
↓
refresh entitlement when needed
```

Do not block the homepage waiting for license validation.

Free tools must remain fast.

---

# 56. FRONTEND FAILURE HANDLING

If backend returns:

```text
LICENSE_EXPIRED
LICENSE_REVOKED
LICENSE_SUSPENDED
ACTIVATION_REVOKED
```

then:

```text
clear entitlement
switch to Free
show accurate status
```

Handle temporary network errors separately.

---

# 57. LICENSE UI

Add:

```text
Activate License
```

Do not add login/account UI.

Activation UI:

```text
Activate Pro

License Key
[ UTL-PRO-____-____-____ ]

[ Activate License ]
```

States:

```text
idle
activating
success
invalid
expired
suspended
revoked
activation limit reached
```

Use existing shadcn/ui and design tokens.

Do not redesign the website.

---

# 58. ACTIVE LICENSE UI

Example:

```text
Pro Active

Plan:
Pro 12 Months

Active Device:
This Device

Expires:
10 September 2027

[ Deactivate This Device ]
```

Use a confirmation dialog before deactivation.

---

# 59. PREMIUM TOOL UI

Premium tools should show a simple:

```text
PRO
```

badge.

Locked state:

```text
Activate a Pro license to use this tool.
```

CTA:

```text
Activate License
```

Frontend locking is UX only. Backend enforcement is mandatory.

---

# 60. ADMIN CLI

Do not build an admin dashboard for MVP.

Implement CLI commands:

```text
create
inspect
renew
suspend
resume
revoke
reset-activations
list
```

Examples:

```bash
uv run utility-license create --plan pro_1_month
uv run utility-license create --plan pro_6_months
uv run utility-license create --plan pro_12_months

uv run utility-license inspect <license-key>
uv run utility-license renew <license-key> --months 6
uv run utility-license suspend <license-key>
uv run utility-license resume <license-key>
uv run utility-license revoke <license-key>
uv run utility-license reset-activations <license-key>
```

Adapt the command name to the existing project.

---

# 61. ADMIN CREATE OUTPUT

Example:

```text
Plan: Pro 12 Months
License: UTL-PRO-7KQ9-A28M-JX4P
Max Activations: 1
Expiry: Starts on first activation
```

Do not log raw License Keys during normal application operation.

---

# 62. PAYMENT GATEWAY FUTURE COMPATIBILITY

Do not implement now.

Future flow:

```text
Payment Gateway
↓
Webhook
↓
Payment verified
↓
LicenseService.create_license()
```

or:

```text
LicenseService.renew()
```

Payment adapters must not directly manipulate license tables.

---

# 63. SECURITY RULES

Mandatory:

```text
No raw license in database
No raw license in Redis
No raw license in worker payloads
No private signing key in frontend
No frontend-only premium enforcement
No invasive hardware/browser fingerprinting
No permanent IP binding
No predictable license generation
No fake payment success
No trust in browser clock
No global license middleware for free APIs
```

---

# 64. LOGGING

Log:

```text
license_created
license_activated
license_activation_rejected
license_deactivated
license_renewed
license_suspended
license_resumed
license_revoked
activation_reset
```

Log only safe metadata such as:

```text
license_id
request_id
timestamp
result
```

Do not log:

```text
raw license key
full entitlement token
private signing key
payment secrets
```

---

# 65. BACKUP

The SQLite database contains commercial entitlement state.

Minimum requirement:

```text
automatic daily backup
```

Document:

```text
database path
persistent volume
backup location
restore procedure
```

---

# 66. MULTI-REPLICA FUTURE

SQLite is acceptable for the current single-writer deployment.

If later running multiple writable FastAPI replicas:

```text
replace SQLite repository
→ PostgreSQL
```

Do not change:

```text
LicenseService
EntitlementService
public API
frontend entitlement model
```

---

# 67. BACKEND TESTS

Add tests for:

```text
secure license generation
normalization
hash lookup
first activation
activation idempotency
activation limit
same installation reactivation
second installation rejection
deactivation
new installation after deactivation
1-month expiry
6-month expiry
12-month expiry
month-end edge cases
leap year
renew active license
renew expired license
suspend
resume
revoke
entitlement issuance
entitlement validation
expired entitlement
invalid signature
wrong installation
missing capability
revoked license access
suspended license access
```

Use a controllable clock if possible. Do not use sleep-based expiry tests.

---

# 68. FRONTEND TESTS

Test:

```text
Installation ID generation
Installation ID persistence
activation form
successful activation
invalid license
expired license
activation limit reached
Pro state
premium badge
locked tool
unlock after activation
deactivation
token refresh
switch to Free after revoke/expiry
```

---

# 69. END-TO-END TEST

Critical flow:

```text
Free visitor opens app
↓
Free tool works

Open premium tool
↓
locked

Activate valid license
↓
premium unlocks

Reload browser
↓
premium remains active

Second browser context
↓
same license activation rejected

Deactivate first installation
↓
activate second installation
↓
success

Expire license fixture
↓
premium request rejected
```

Use Playwright if already available.

---

# 70. IMPLEMENTATION PHASES

## Phase 1 — Audit

```text
inspect repository
map existing architecture
identify extension points
write migration plan
```

## Phase 2 — Persistence

```text
SQLite engine
SQLAlchemy models
Alembic
licenses table
license_activations table
repositories
```

## Phase 3 — License Domain

```text
LicenseService
creation
activation
expiration
renewal
deactivation
suspension
revocation
activation limits
```

## Phase 4 — Entitlement

```text
EntitlementService
Ed25519 signing
token issuance
token verification
capabilities
cache invalidation
```

## Phase 5 — FastAPI Integration

```text
license router
activate
refresh
status
deactivate
require_entitlement()
premium endpoint protection
```

## Phase 6 — Frontend Integration

```text
Installation ID
EntitlementProvider
TanStack Query integration
activation UI
status UI
PRO badges
locked states
deactivation
```

## Phase 7 — Admin CLI

```text
create
inspect
renew
suspend
resume
revoke
reset activations
list
```

## Phase 8 — Abuse Protection

```text
Redis rate limiting
concurrency limits
cache
activation abuse detection
```

## Phase 9 — Tests and Hardening

```text
backend tests
frontend tests
E2E
migration validation
backup documentation
production validation
```

---

# 71. DO NOT REWRITE OR REPLACE

Do not make unnecessary stack changes such as:

```text
TanStack Start → Next.js
FastAPI → Node.js
pnpm → npm
Dramatiq → Celery
Redis → another broker
Cloudflare R2 → permanent local storage
```

---

# 72. DO NOT ADD USER ACCOUNTS

Explicitly prohibited:

```text
users table for licensing
register route
login route
email verification
password reset
OAuth
account profile
account dashboard
user session system
```

---

# 73. FINAL FREE FLOW

```text
Free Tool
↓
Browser/client processing when possible
↓
Result
```

No license. No login. No account.

---

# 74. FINAL PREMIUM FLOW

```text
Premium Tool
↓
Frontend checks entitlement for UX
↓
FastAPI request
↓
verify signed entitlement
↓
check current license state
↓
check expiration
↓
check active installation
↓
check required capability
↓
check rate/concurrency limits
↓
existing service/job layer
↓
Redis + Dramatiq
↓
existing worker
↓
R2
↓
result
```

---

# 75. FINAL LICENSE MODEL

```text
PRO 1 MONTH
Duration: 1 calendar month
Max active installations: 1

PRO 6 MONTHS
Duration: 6 calendar months
Max active installations: 1

PRO 12 MONTHS
Duration: 12 calendar months
Max active installations: 1
```

No account required.

---

# 76. FINAL COMMERCIAL FLOW

For the first release:

```text
Customer
↓
Manual payment / QRIS / transfer
↓
Admin verifies payment
↓
Admin CLI create or renew
↓
Customer receives License Key
↓
Customer activates in browser
↓
1 active installation
↓
Premium enabled
```

Later:

```text
Payment Gateway
↓
Webhook
↓
LicenseService
```

without redesigning licensing.

---

# 77. VALIDATION COMMANDS

Use existing project scripts where available.

Backend:

```bash
uv run alembic upgrade head
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run pytest
```

Frontend:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If Playwright exists:

```bash
pnpm test:e2e
```

Do not claim completion while migration, lint, type checking, tests, or builds still fail.

---

# 78. FINAL ACCEPTANCE CRITERIA

The implementation is complete only when:

```text
1. Existing frontend remains intact.
2. Existing backend remains intact.
3. No login/register system is added.
4. SQLite licensing persistence is implemented.
5. SQLite uses persistent production storage.
6. Alembic migrations exist.
7. Secure random license generation works.
8. Raw license keys are not stored in DB.
9. Installation ID is generated by frontend.
10. One active installation is enforced.
11. Same-installation activation is idempotent.
12. Second installation is rejected.
13. Deactivation works.
14. License can move after deactivation.
15. 1-month plan works.
16. 6-month plan works.
17. 12-month plan works.
18. Calendar-month expiration is correct.
19. Renewal extends the same license.
20. Suspension works.
21. Resume works.
22. Revocation works.
23. Signed entitlement tokens work.
24. Private signing key remains backend-only.
25. Token expiration works.
26. Refresh works.
27. Capability-based premium enforcement works.
28. Premium endpoints cannot be unlocked through frontend modification.
29. Raw license keys never enter Redis/Dramatiq payloads.
30. Rate/concurrency limits work per license/installation.
31. Free tools remain accessible without license.
32. Existing processors/workers are not rewritten.
33. Admin CLI works.
34. Backend tests pass.
35. Frontend tests pass.
36. Critical E2E licensing flow passes.
37. Production build passes.
38. SQLite backup strategy is documented.
39. Future payment gateway integration can call LicenseService without redesign.
```

---

# 79. CORE PRINCIPLE

Implement licensing as a **modular entitlement layer** over the existing application.

Final model:

```text
NO ACCOUNT
+
MANUAL PAYMENT FIRST
+
SECURE LICENSE KEY
+
1 ACTIVE INSTALLATION
+
1 / 6 / 12 MONTH EXPIRATION
+
RENEWABLE
+
DEACTIVATABLE
+
SUSPENDABLE
+
REVOCABLE
+
SIGNED ENTITLEMENT TOKEN
+
BACKEND CAPABILITY ENFORCEMENT
+
REDIS RATE / CONCURRENCY CONTROL
+
SQLITE AS LICENSE SOURCE OF TRUTH
+
FUTURE PAYMENT-GATEWAY READY
```

Do not rebuild the product.

Preserve the existing TanStack frontend, FastAPI backend, Redis/Dramatiq job system, workers, and Cloudflare R2 flow.

Only add the components necessary to support secure commercial licensing without user accounts.
