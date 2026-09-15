# Kits

Browser-first utility app: compress, convert, generate, and process files without creating an account.

Most tools run in the browser. Pro tools that need a server (AI background removal, upscale, and similar) require a license key activated on one installation at a time.

## What’s in this repo

```text
.
├── apps/web     TanStack Start + React frontend (port 3000)
├── apps/api     FastAPI backend, licenses, jobs, uploads (port 8000)
├── plan/        Product / architecture notes
└── .env.example Shared environment template
```

See [`docs/architecture.md`](docs/architecture.md) for domain boundaries, the processing flow,
and the checklist for adding a tool without duplicating registry or entitlement logic.

- **Web:** tool explorer, workspaces, command palette (`Ctrl/Cmd K`), theme toggle, `/pricing`, `/license`
- **API:** entitlement, admin license CLI, file uploads, background jobs

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 11 (`packageManager` is `pnpm@11.21.0`)
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) for the API (or another installer that can sync `apps/api/pyproject.toml`)

Optional for production-like jobs:

- Redis (`REDIS_URL`)
- Cloudflare R2 (or S3-compatible storage) for uploads

Local development can run jobs inline (`INLINE_JOBS=true` in `.env.example`) without Redis.

## Setup

```bash
git clone https://github.com/baniputrabangsawan/allyouneed.git
cd allyouneed
cp .env.example .env
```

Edit `.env` as needed. Do not commit `.env`.

### Web

```bash
pnpm install
```

Vite reads `VITE_APP_URL` and `VITE_API_BASE_URL` from the environment (defaults in `.env.example` point at `localhost:3000` / `localhost:8000`).

### API

From `apps/api`:

```bash
cd apps/api
uv sync
uv run playwright install chromium
```

The default install keeps admin, licensing, image/PDF/media, and CLI work lightweight. To
run the self-hosted speech-to-text and Piper text-to-speech providers, install the speech
extra instead:

```bash
uv sync --extra speech
```

Optional background-removal/upscale model runtimes remain in the separate `ai` extra.
The API Docker image installs `speech` explicitly so its production behavior is unchanged.

HTML to Image needs Chromium. Skip `playwright install` only if you will not run that tool or its tests.

The API loads `.env` from the working directory. Either run it from the repo root (so the root `.env` is found) or copy the needed variables next to `apps/api`.

On first boot the app creates the SQLite parent folder and schema. Alembic migrations live in `apps/api/alembic/` if you need an explicit upgrade:

```bash
cd apps/api
uv run alembic upgrade head
```

## Run

Use two terminals.

**Frontend** (repo root):

```bash
pnpm dev
```

App: [http://localhost:3000](http://localhost:3000)

**Backend** (from `apps/api`):

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API: [http://localhost:8000](http://localhost:8000)  
OpenAPI: [http://localhost:8000/docs](http://localhost:8000/docs)

Many local tools work with the web app alone. Activate Pro and remote processing need the API running.

## Deploy on Vercel

This app is TanStack Start (SSR). A static Vite publish folder has **no `index.html`**, which is why a default Vercel import returns `404: NOT_FOUND`.

The repo now builds with Nitro’s Vercel preset (`apps/web/.vercel/output`, copied to the repo-root `.vercel/output` that Vercel reads).

In the Vercel project:

1. **Root Directory:** leave as the repository root (`.`)
2. **Framework Preset:** Other (or leave unset — `vercel.json` sets `"framework": null`)
3. Redeploy after pulling these changes
4. Set `VITE_API_BASE_URL` to your public API origin if the backend is hosted elsewhere. Local-only tools still work without it.

Do not set Output Directory to `apps/web/dist` or `apps/web/dist/client`.

## Deploy on Cloudflare

Workers Builds runs `npx wrangler versions upload` from the repository root. A root `wrangler.jsonc` points at the Cloudflare Vite worker (`apps/web/dist/server/index.js`) and client assets.

In the Cloudflare Worker **Settings → Build**:

1. **Root directory:** leave as the repository root (`.`)
2. **Build command:** `pnpm build`
3. **Deploy command:** `npx wrangler deploy` (production) / default `npx wrangler versions upload` (preview)
4. **Install command** (if asked): `pnpm install`
5. **Production variable:** set `VITE_API_BASE_URL=https://api.usekits.online` in the Cloudflare Worker build environment, then rebuild and redeploy. Vite injects `VITE_*` values at build time; restarting FastAPI does not update an already-built frontend bundle.

Do not set Root directory to `apps/web` unless you also change the deploy command to `pnpm exec wrangler versions upload` so it uses `apps/web/wrangler.jsonc`.

### Docker (API)

```bash
cd apps/api
docker build -t kits-api .
docker run --env-file ../../.env -p 8000:8000 kits-api
```

The image installs `ffmpeg` and starts Uvicorn on port 8000.

## Scripts

| Command | Where | What |
|---|---|---|
| `pnpm dev` | root | Vite / TanStack Start dev server |
| `pnpm build` | root | Production web build |
| `pnpm lint` | root | ESLint |
| `pnpm typecheck` | root | `tsc --noEmit` |
| `pnpm test` | root | Vitest |
| `pnpm test:e2e` | root | Playwright |
| `uv run pytest` | `apps/api` | API tests |
| `uv run ruff check .` | `apps/api` | API lint |
| `uv run mypy` | `apps/api` | API types |

## Pro licenses

There is no payment gateway. Keys are issued by an admin after a manual purchase, then activated in the app at `/license`.

Plans (same capabilities, different duration):

| Plan id | Duration |
|---|---|
| `pro_1_month` | 1 month |
| `pro_6_months` | 6 months |
| `pro_12_months` | 12 months |

Expiry starts on **first activation**. One license = one active browser/installation. Deactivate before moving the key.

### Issue a key (CLI)

From `apps/api`, after `uv sync`:

```bash
uv run utility-license create --plan pro_1_month
uv run utility-license create --plan pro_6_months
uv run utility-license create --plan pro_12_months
```

Other commands:

```bash
uv run utility-license list
uv run utility-license inspect KITS-…
uv run utility-license renew KITS-… --months 12
uv run utility-license suspend KITS-…
uv run utility-license resume KITS-…
uv run utility-license revoke KITS-…
uv run utility-license reset-activations KITS-…
```

Admin HTTP routes require the self-hosted owner session. Bootstrap the first owner after running
the migrations:

```bash
uv run utility-admin bootstrap --email owner@example.com
```

Open `/admin/login`; no admin credential is stored in frontend code or browser storage. See
`docs/admin-security.md` for TOTP and production setup.

Users paste the key in the UI (**Activate Pro**). Do not put live keys in git.

## Environment

Copy `.env.example`. Important variables:

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | web | API origin the browser calls |
| `VITE_APP_URL` | web | Public app URL |
| `LICENSE_DATABASE_URL` / `DATABASE_URL` | API | License SQLite/Postgres URL |
| `ADMIN_TOTP_ENCRYPTION_KEY` | API | Encrypts the owner's TOTP seed |
| `ADMIN_SESSION_TTL_SECONDS` | API | Finite admin session lifetime |
| `ENTITLEMENT_PRIVATE_KEY` / `PUBLIC_KEY` | API | Entitlement tokens (generate for anything beyond local play) |
| `REDIS_URL` | API | Job queue (when not using inline jobs) |
| `R2_*` | API | Object storage for uploads |
| `INLINE_JOBS` | API | `true` runs jobs in-process for local dev; production must be `false` |
| `WHISPER_MODEL` | API | faster-whisper size (`tiny`/`base`/`small`/`medium`/`large-v3`); lazy-loaded per worker |
| `STT_MAX_DURATION_SECONDS` | API | Server-side speech-to-text duration cap |
| `TTS_MAX_CHARS` | API | Server-side text-to-speech character cap |
| `STORAGE_ROOT` | API | Uploads, job outputs, and self-hosted models (Piper/Kokoro under `models/tts/`) |
| `MAX_UPLOAD_MB` | API | Upload size cap |

Leave AI/R2 keys empty for a local UI-only pass.

For production, set `VITE_API_BASE_URL=https://api.usekits.online` on the Cloudflare frontend build and set API `CORS_ORIGINS=["https://usekits.online"]`. Do not put secrets in `VITE_*`; those values are public browser config.

## Product map

| Path | Page |
|---|---|
| `/` | Tool explorer (search, categories, favorites, recent) |
| `/tools` | Full catalog |
| `/{tool}` | Tool workspace |
| `/pricing` | Pro plans (manual purchase, no fake checkout) |
| `/license` | Activate / deactivate a key |

Free tools stay available after a Pro license expires.

## Stack

- **Web:** React 19, TanStack Start/Router/Query, Vite 7, Tailwind CSS 4
- **API:** FastAPI, SQLAlchemy async, Alembic, Dramatiq, Redis, R2

## License

Private repository. Not an open-source license grant unless you add one.
