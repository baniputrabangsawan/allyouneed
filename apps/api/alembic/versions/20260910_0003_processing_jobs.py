"""processing jobs, inputs, and results

Revision ID: 20260910_0003
Revises: 20260910_0002
Create Date: 2026-09-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260910_0003"
down_revision: Union[str, Sequence[str], None] = "20260910_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "processing_jobs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("tool_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("execution_mode", sa.String(length=16), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("stage", sa.String(length=32), nullable=True),
        sa.Column("input_payload", sa.JSON(), nullable=False),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("idempotency_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_processing_jobs_tool_id", "processing_jobs", ["tool_id"])
    op.create_index("ix_processing_jobs_status", "processing_jobs", ["status"])
    op.create_index("ix_processing_jobs_created_at", "processing_jobs", ["created_at"])
    op.create_index(
        "ix_processing_jobs_idempotency_key",
        "processing_jobs",
        ["idempotency_key"],
        unique=True,
    )

    op.create_table(
        "job_inputs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "job_id",
            sa.String(length=64),
            sa.ForeignKey("processing_jobs.id"),
            nullable=False,
        ),
        sa.Column("file_key", sa.String(length=512), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_job_inputs_job_id", "job_inputs", ["job_id"])
    op.create_index("ix_job_inputs_file_key", "job_inputs", ["file_key"])

    op.create_table(
        "job_results",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "job_id",
            sa.String(length=64),
            sa.ForeignKey("processing_jobs.id"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_job_results_job_id", "job_results", ["job_id"], unique=True)


def downgrade() -> None:
    op.drop_table("job_results")
    op.drop_table("job_inputs")
    op.drop_table("processing_jobs")
