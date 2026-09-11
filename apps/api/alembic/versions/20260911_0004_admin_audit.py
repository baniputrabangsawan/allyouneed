"""admin audit log

Revision ID: 20260911_0004
Revises: 20260910_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260911_0004"
down_revision: str | Sequence[str] | None = "20260910_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("admin_id", sa.String(length=255), nullable=False),
        sa.Column("admin_email", sa.String(length=320), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_license_id", sa.String(length=36), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=True),
    )
    for column in ("admin_id", "action", "target_license_id", "request_id", "at"):
        op.create_index(f"ix_admin_audit_logs_{column}", "admin_audit_logs", [column])


def downgrade() -> None:
    op.drop_table("admin_audit_logs")
