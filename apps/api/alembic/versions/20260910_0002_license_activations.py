"""license activations and hashed installations

Revision ID: 20260910_0002
Revises: 20260910_0001
Create Date: 2026-09-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260910_0002"
down_revision: Union[str, Sequence[str], None] = "20260910_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("license_events")
    op.drop_table("license_installations")
    op.drop_table("licenses")

    op.create_table(
        "licenses",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("license_hash", sa.String(length=64), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("plan", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_activations", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("created_source", sa.String(length=32), nullable=True),
    )
    op.create_index("ix_licenses_license_hash", "licenses", ["license_hash"], unique=True)
    op.create_index("ix_licenses_key_prefix", "licenses", ["key_prefix"])
    op.create_index("ix_licenses_status", "licenses", ["status"])

    op.create_table(
        "license_activations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("license_id", sa.String(length=36), sa.ForeignKey("licenses.id"), nullable=False),
        sa.Column("installation_hash", sa.String(length=64), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_license_activations_license_id", "license_activations", ["license_id"])
    op.create_index(
        "ix_license_activations_installation_hash", "license_activations", ["installation_hash"]
    )
    op.create_index(
        "uq_license_activations_active_license",
        "license_activations",
        ["license_id"],
        unique=True,
        sqlite_where=sa.text("revoked_at IS NULL"),
    )

    op.create_table(
        "license_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("license_id", sa.String(length=36), sa.ForeignKey("licenses.id"), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("installation_hash", sa.String(length=64), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=True),
    )
    op.create_index("ix_license_events_license_id", "license_events", ["license_id"])


def downgrade() -> None:
    op.drop_table("license_events")
    op.drop_table("license_activations")
    op.drop_table("licenses")
