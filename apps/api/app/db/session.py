from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.db import models as _models  # noqa: F401
from app.db.base import Base

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def sqlite_path_from_url(url: str) -> Path | None:
    prefixes = ("sqlite+aiosqlite:///", "sqlite:///")
    for prefix in prefixes:
        if url.startswith(prefix):
            path = url.removeprefix(prefix)
            if path in {"", ":memory:"} or path.startswith(":memory:"):
                return None
            return Path(path)
    return None


def ensure_sqlite_parent(url: str) -> None:
    path = sqlite_path_from_url(url)
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)


def _apply_sqlite_pragmas(dbapi_connection: object, _connection_record: object) -> None:
    cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


def get_engine() -> AsyncEngine:
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        url = settings.license_database_url
        ensure_sqlite_parent(url)
        _engine = create_async_engine(url)
        event.listen(_engine.sync_engine, "connect", _apply_sqlite_pragmas)
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        get_engine()
    assert _session_factory is not None
    return _session_factory


async def get_session() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def create_schema() -> None:
    engine = get_engine()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.execute(text("PRAGMA foreign_keys=ON"))


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        sync_engine: Engine = _engine.sync_engine
        if event.contains(sync_engine, "connect", _apply_sqlite_pragmas):
            event.remove(sync_engine, "connect", _apply_sqlite_pragmas)
        await _engine.dispose()
    _engine = None
    _session_factory = None
