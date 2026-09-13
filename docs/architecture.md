# Kits architecture

Kits is a local-first utility application with a React/TanStack frontend and a FastAPI
processing service. The browser remains the default processing boundary. The API is used
only for tools whose registry metadata declares remote or hybrid processing.

## Frontend boundaries

- `features/tools/tool-registry.ts` is the canonical browser catalog. Navigation, search,
  categories, Popular, Pro, SEO, and related-tool lists must be derived from it.
- `features/licensing/` owns entitlement state, capability checks, query keys, and shared
  license domain types. UI code should use `canUseTool`; it must not invent alternative
  `isPro` flags or treat browser state as authorization.
- `lib/api/client.ts` owns API origin resolution, credentials, timeouts, cancellation,
  JSON/error parsing, and trusted API headers. Feature API modules contain endpoint-specific
  request and response types. Configured secrets are never attached to external upload URLs.
- `processing/client/` contains browser algorithms and workers. React workspaces coordinate
  validation and presentation but should not contain reusable processing algorithms.
- TanStack Query owns server state. Query keys are defined beside their feature so invalidation
  does not depend on repeated string arrays.

## Backend boundaries

Requests flow through thin handlers in `api/v1/`, then domain services. SQLAlchemy access is
isolated in `repositories/`; API schemas remain separate from database models.

Remote processing follows this sequence:

```text
route -> JobService -> validation -> durable JobRepository row -> worker/inline task
      -> processor -> storage provider -> signed result metadata
```

- `services/job_service.py` owns orchestration and durable state transitions.
- `services/job_validation.py` owns request and media-duration rules.
- `services/job_output.py` owns the approved output-extension mapping.
- `core/job_payload.py` owns the public job input shape shared by services and repositories.
- `processors/` own tool algorithms. `utils/subprocess.py` is the only FFmpeg/ffprobe process
  boundary and enforces executable allowlisting, safe argument arrays, timeout, cancellation,
  progress parsing, and bounded error logging.
- `providers/storage/` is the storage boundary. Processors must not reach into R2 or local
  storage implementations directly.

FastAPI remains authoritative for entitlements, upload validation, job state, and downloads.
Frontend capability checks are presentation gates only.

## Adding a tool

1. Add its browser metadata to the Tool Registry, including processing mode and capability.
2. Add a workspace mapping for client tools, or a backend `Tool` and processor registration for
   remote tools.
3. Reuse the shared API, upload, job-progress, result-preview, and entitlement boundaries.
4. Add registry integrity tests plus unit tests for pure processing/validation logic.
5. Run all frontend and backend quality gates listed in the root README.

Do not add separate Popular, Pro, category, search, navigation, or sitemap arrays. Extend the
registry metadata and derive the new view instead.
