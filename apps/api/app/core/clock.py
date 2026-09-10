from collections.abc import Callable
from datetime import UTC, datetime

Clock = Callable[[], datetime]


def now() -> datetime:
    return datetime.now(UTC)


def aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value
