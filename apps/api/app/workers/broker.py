import dramatiq
from dramatiq.brokers.redis import RedisBroker
from dramatiq.brokers.stub import StubBroker

from app.core.config import get_settings


def build_broker() -> dramatiq.Broker:
    settings = get_settings()
    if settings.inline_jobs or not settings.redis_url:
        broker: dramatiq.Broker = StubBroker()
        broker.emit_after("process_boot")
        return broker
    return RedisBroker(url=settings.redis_url)  # type: ignore[no-untyped-call]


broker = build_broker()
dramatiq.set_broker(broker)
