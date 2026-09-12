"""self-hosted admin authentication

Revision ID: 20260911_0005
Revises: 20260911_0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260911_0005"
down_revision: str | Sequence[str] | None = "20260911_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("admin_audit_logs") as batch:
        batch.alter_column("target_license_id", existing_type=sa.String(36), nullable=True)
    op.create_table(
        "admin_users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("totp_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_admin_users_email", "admin_users", ["email"], unique=True)
    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_hash", sa.String(64), nullable=False),
        sa.Column("csrf_hash", sa.String(64), nullable=False),
        sa.Column("admin_user_id", sa.String(36), sa.ForeignKey("admin_users.id"), nullable=False),
        sa.Column("pending_totp", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_admin_sessions_session_hash", "admin_sessions", ["session_hash"], unique=True
    )
    op.create_index("ix_admin_sessions_admin_user_id", "admin_sessions", ["admin_user_id"])
    op.create_index("ix_admin_sessions_expires_at", "admin_sessions", ["expires_at"])
    op.create_table(
        "admin_recovery_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("admin_user_id", sa.String(36), sa.ForeignKey("admin_users.id"), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_admin_recovery_codes_admin_user_id", "admin_recovery_codes", ["admin_user_id"]
    )


def downgrade() -> None:
    op.drop_table("admin_recovery_codes")
    op.drop_table("admin_sessions")
    op.drop_table("admin_users")
    with op.batch_alter_table("admin_audit_logs") as batch:
        batch.alter_column("target_license_id", existing_type=sa.String(36), nullable=False)
