"""licenses

Revision ID: 20260910_0001
Revises:
Create Date: 2026-09-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260910_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "licenses",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("plan", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_installations", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_licenses_key_hash", "licenses", ["key_hash"], unique=True)
    op.create_index("ix_licenses_key_prefix", "licenses", ["key_prefix"])
    op.create_index("ix_licenses_status", "licenses", ["status"])

    op.create_table(
        "license_installations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("license_id", sa.String(length=36), sa.ForeignKey("licenses.id"), nullable=False),
        sa.Column("installation_id", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_agent", sa.String(length=200), nullable=True),
    )
    op.create_index("ix_license_installations_license_id", "license_installations", ["license_id"])
    op.create_index(
        "ix_license_installations_installation_id", "license_installations", ["installation_id"]
    )
    op.create_index(
        "uq_license_installations_active_license",
        "license_installations",
        ["license_id"],
        unique=True,
        sqlite_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "license_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("license_id", sa.String(length=36), sa.ForeignKey("licenses.id"), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("installation_id", sa.String(length=128), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=True),
    )
    op.create_index("ix_license_events_license_id", "license_events", ["license_id"])


def downgrade() -> None:
    op.drop_table("license_events")
    op.drop_table("license_installations")
    op.drop_table("licenses")
