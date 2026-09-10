# License SQLite backup

The license source of truth is a SQLite file, not Redis and not job storage.

## Path

Default:

```text
LICENSE_DATABASE_URL=sqlite+aiosqlite:///./data/licenses.db
```

On disk that is `apps/api/data/licenses.db` (or `/app/data/licenses.db` in the API container). Persist `/app/data` with a volume. Do not put this file on ephemeral container storage.

`.data` remains file/job scratch storage. `data/` is the license database directory.

## Daily backup

From `apps/api`:

```bash
uv run python scripts/backup_licenses.py --dest ./data/backups
```

Run that once per day (cron or the host scheduler). The script copies the `.db` file and WAL/SHM sidecars when present.

## Restore

1. Stop the API process.
2. Replace `data/licenses.db` with the chosen backup copy (and WAL/SHM if those files were copied).
3. Start the API.
4. Confirm `GET /api/v1/health/ready` returns 200.

Do not restore into Redis. Do not mix this file with job state; jobs stay in memory.

Redis is optional. License status may be cached for 30–120 seconds (`LICENSE_STATUS_CACHE_TTL_SECONDS`). Cache and job-concurrency counters fail open when Redis is down or `INLINE_JOBS=true`. Entitlement checks still fail closed against SQLite.
