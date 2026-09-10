from app.core.enums import JobStatus

TRANSITIONS: dict[JobStatus, frozenset[JobStatus]] = {
    JobStatus.QUEUED: frozenset({JobStatus.PROCESSING, JobStatus.CANCELLED}),
    JobStatus.PROCESSING: frozenset({JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED}),
    JobStatus.COMPLETED: frozenset({JobStatus.EXPIRED}),
    JobStatus.FAILED: frozenset({JobStatus.EXPIRED}),
    JobStatus.CANCELLED: frozenset({JobStatus.EXPIRED}),
    JobStatus.EXPIRED: frozenset(),
}

TERMINAL = frozenset(
    {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED, JobStatus.EXPIRED}
)


def can_transition(current: str, target: str) -> bool:
    if current == target:
        return True
    return JobStatus(target) in TRANSITIONS[JobStatus(current)]


def ensure_transition(current: str, target: str) -> None:
    if not can_transition(current, target):
        raise ValueError(f"Illegal job transition {current} -> {target}")
