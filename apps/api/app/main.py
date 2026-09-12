from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as v1_router
from app.core.config import get_settings
from app.core.exceptions import install_exception_handlers
from app.core.logging import configure_logging
from app.db.session import create_schema, dispose_engine, ensure_sqlite_parent
from app.middleware.admin_rate_limit import AdminRateLimitMiddleware
from app.middleware.admin_security import AdminSecurityMiddleware
from app.middleware.request_id import RequestIDMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings)
    ensure_sqlite_parent(settings.license_database_url)
    if settings.app_env != "production":
        await create_schema()
    from app.processors.media import warn_if_rnnoise_model_missing

    warn_if_rnnoise_model_missing()
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    api = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    api.add_middleware(AdminRateLimitMiddleware)
    api.add_middleware(AdminSecurityMiddleware)
    api.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(set(settings.cors_origins + settings.admin_cors_origins)),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=[
            "Content-Type",
            "X-Entitlement-Token",
            "X-Request-ID",
            "X-CSRF-Token",
        ],
    )
    api.add_middleware(RequestIDMiddleware)
    install_exception_handlers(api)
    api.include_router(v1_router, prefix="/api/v1")
    return api


app = create_app()
