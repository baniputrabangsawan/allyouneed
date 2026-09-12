from collections.abc import Awaitable, Callable
from hashlib import sha256
from time import time

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.exceptions import error_response
from app.core.redis import redis_call


class ApiRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        settings = get_settings()
        path = request.url.path
        if (
            not settings.api_rate_limit_enabled
            or request.method == "OPTIONS"
            or not path.startswith("/api/v1/")
            or path.startswith("/api/v1/admin/")
        ):
            return await call_next(request)

        limit, window_seconds, fail_closed = self._profile(path, request.method)
        identity = self._client_identity(request)
        bucket = int(time() // window_seconds)
        route_group = path.rstrip("/").rsplit("/", 1)[0]
        subject = sha256(identity.encode()).hexdigest()[:24]
        key = f"api-rate:{subject}:{request.method}:{route_group}:{bucket}"
        count = await redis_call("incr", key)
        if count == 1:
            await redis_call("expire", key, window_seconds + 1)
        if count is None and settings.app_env == "production" and fail_closed:
            return error_response(
                request,
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "SERVICE_UNAVAILABLE",
                "This operation is temporarily unavailable.",
            )
        if count is not None and int(count) > limit:
            response = error_response(
                request,
                status.HTTP_429_TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many requests. Try again shortly.",
            )
            response.headers["Retry-After"] = str(window_seconds)
            return response
        return await call_next(request)

    @staticmethod
    def _client_identity(request: Request) -> str:
        settings = get_settings()
        if settings.trust_cloudflare_ip_header:
            connecting_ip = request.headers.get("CF-Connecting-IP", "").strip()
            if connecting_ip:
                return connecting_ip
        return request.client.host if request.client else "anonymous"

    @staticmethod
    def _profile(path: str, method: str) -> tuple[int, int, bool]:
        if path.endswith("/licenses/activate"):
            return 5, 600, True
        if path.endswith(("/licenses/refresh", "/licenses/deactivate")):
            return 15, 600, True
        if path.startswith("/api/v1/uploads/"):
            return 60, 60, True
        if path == "/api/v1/jobs" and method == "POST":
            return 30, 60, True
        if path.startswith("/api/v1/jobs/"):
            return 180, 60, False
        return 120, 60, False
