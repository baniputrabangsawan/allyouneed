"""device credentials and one-time license transfers

Revision ID: 20260912_0006
Revises: 20260911_0005
Create Date: 2026-09-12
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260912_0006"
down_revision: str | Sequence[str] | None = "20260911_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("license_activations") as batch:
        batch.add_column(sa.Column("device_credential_hash", sa.String(length=64), nullable=True))
    op.create_table(
        "license_transfers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("license_id", sa.String(length=36), sa.ForeignKey("licenses.id"), nullable=False),
        sa.Column("from_activation_id", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_license_transfers_token_hash", "license_transfers", ["token_hash"], unique=True)
    op.create_index("ix_license_transfers_license_id", "license_transfers", ["license_id"])
    op.create_index("ix_license_transfers_expires_at", "license_transfers", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_license_transfers_expires_at", table_name="license_transfers")
    op.drop_index("ix_license_transfers_license_id", table_name="license_transfers")
    op.drop_index("ix_license_transfers_token_hash", table_name="license_transfers")
    op.drop_table("license_transfers")
    with op.batch_alter_table("license_activations") as batch:
        batch.drop_column("device_credential_hash")
