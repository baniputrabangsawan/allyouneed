import pytest

from app.core.enums import JobStatus
from app.core.state_machine import can_transition, ensure_transition


def test_allowed_transitions() -> None:
    assert can_transition(JobStatus.QUEUED, JobStatus.PROCESSING)
    assert can_transition(JobStatus.PROCESSING, JobStatus.COMPLETED)
    assert can_transition(JobStatus.PROCESSING, JobStatus.FAILED)
    assert can_transition(JobStatus.QUEUED, JobStatus.FAILED)
    assert can_transition(JobStatus.QUEUED, JobStatus.CANCELLED)
    assert can_transition(JobStatus.COMPLETED, JobStatus.EXPIRED)
    assert not can_transition(JobStatus.COMPLETED, JobStatus.QUEUED)
    assert not can_transition(JobStatus.FAILED, JobStatus.PROCESSING)


def test_illegal_transition_raises() -> None:
    with pytest.raises(ValueError):
        ensure_transition(JobStatus.COMPLETED, JobStatus.PROCESSING)
