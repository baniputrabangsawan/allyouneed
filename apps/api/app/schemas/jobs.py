from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import ApiModel

JobStatusValue = Literal["queued", "processing", "completed", "failed", "cancelled", "expired"]


class CreateJobRequest(ApiModel):
    tool_id: str = Field(min_length=1, max_length=100)
    input: dict[str, Any]
    options: dict[str, Any] = Field(default_factory=dict)


class Job(ApiModel):
    job_id: str
    status: JobStatusValue
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    progress: int | None = None
    stage: str | None = None
    error: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    tool_id: str | None = None
    request_id: str | None = None


class JobResult(ApiModel):
    job_id: str
    result: dict[str, Any]
