from collections.abc import Awaitable, Callable
from hashlib import sha256
from time import time

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.exceptions import error_response
from app.core.redis import redis_call


class AdminRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not request.url.path.startswith("/api/v1/admin/") or request.method == "OPTIONS":
            return await call_next(request)

        token = request.headers.get("Cf-Access-Jwt-Assertion") or request.cookies.get(
            "CF_Authorization", "anonymous"
        )
        subject = sha256(token.encode()).hexdigest()[:24]
        destructive = request.url.path.endswith(("/revoke", "/reset-activations"))
        limit = 10 if destructive else 30 if request.method not in {"GET", "HEAD"} else 120
        window = int(time() // 60)
        key = f"admin-rate:{subject}:{request.method}:{window}"
        count = await redis_call("incr", key)
        if count == 1:
            await redis_call("expire", key, 61)
        if count is None and get_settings().app_env == "production":
            return error_response(
                request,
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "SERVICE_UNAVAILABLE",
                "Administrative requests are temporarily unavailable.",
            )
        if count is not None and int(count) > limit:
            response = error_response(
                request,
                status.HTTP_429_TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many administrative requests. Try again shortly.",
            )
            response.headers["Retry-After"] = "60"
            return response
        return await call_next(request)
