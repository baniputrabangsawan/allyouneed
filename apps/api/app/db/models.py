from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base


class License(Base):
    __tablename__ = "licenses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    license_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(16), index=True)
    plan: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), index=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    max_activations: Mapped[int] = mapped_column(Integer, default=1)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_source: Mapped[str | None] = mapped_column(String(32), nullable=True)

    activations: Mapped[list[LicenseActivation]] = relationship(
        back_populates="license", cascade="all, delete-orphan"
    )
    events: Mapped[list[LicenseEvent]] = relationship(
        back_populates="license", cascade="all, delete-orphan"
    )


class LicenseActivation(Base):
    __tablename__ = "license_activations"
    __table_args__ = (
        Index(
            "uq_license_activations_active_license",
            "license_id",
            unique=True,
            sqlite_where=text("revoked_at IS NULL"),
        ),
        Index("ix_license_activations_installation_hash", "installation_hash"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    license_id: Mapped[str] = mapped_column(ForeignKey("licenses.id"), index=True)
    installation_hash: Mapped[str] = mapped_column(String(64))
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    license: Mapped[License] = relationship(back_populates="activations")


class LicenseEvent(Base):
    __tablename__ = "license_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    license_id: Mapped[str] = mapped_column(ForeignKey("licenses.id"), index=True)
    type: Mapped[str] = mapped_column(String(32))
    installation_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    license: Mapped[License] = relationship(back_populates="events")
