from collections.abc import Awaitable, Callable

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.exceptions import error_response
from app.security.admin import token_hash


class AdminSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        is_admin = request.url.path.startswith("/api/v1/admin/")
        if is_admin and request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("Origin")
            allowed = get_settings().admin_cors_origins
            if origin and origin not in allowed:
                return error_response(
                    request,
                    status.HTTP_403_FORBIDDEN,
                    "ADMIN_FORBIDDEN",
                    "The request origin is not allowed.",
                )
            settings = get_settings()
            session_cookie = request.cookies.get(settings.admin_session_cookie_name)
            csrf_cookie = request.cookies.get(settings.admin_csrf_cookie_name)
            csrf_header = request.headers.get("X-CSRF-Token")
            exempt = request.url.path in {
                "/api/v1/admin/auth/login",
                "/api/v1/admin/auth/totp/verify",
            }
            if (
                session_cookie
                and not exempt
                and (
                    not csrf_cookie
                    or not csrf_header
                    or token_hash(csrf_cookie) != token_hash(csrf_header)
                )
            ):
                return error_response(
                    request,
                    status.HTTP_403_FORBIDDEN,
                    "CSRF_INVALID",
                    "The CSRF token is invalid.",
                )
        response = await call_next(request)
        if is_admin:
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Referrer-Policy"] = "no-referrer"
            response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
            response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
        return response
