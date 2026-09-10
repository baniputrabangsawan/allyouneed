from app.schemas.jobs import CreateJobRequest, Job


class JobRepository:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._payloads: dict[str, CreateJobRequest] = {}
        self._idempotency: dict[str, tuple[str, str]] = {}

    def save(self, job: Job, payload: CreateJobRequest | None = None) -> Job:
        self._jobs[job.job_id] = job
        if payload is not None:
            self._payloads[job.job_id] = payload
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def payload(self, job_id: str) -> CreateJobRequest:
        return self._payloads[job_id]

    def remember_idempotency(self, key: str, fingerprint: str, job_id: str) -> None:
        self._idempotency[key] = (fingerprint, job_id)

    def idempotency(self, key: str) -> tuple[str, str] | None:
        return self._idempotency.get(key)
