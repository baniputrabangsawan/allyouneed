from collections.abc import Awaitable, Callable

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.exceptions import error_response


class RequestBodyLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method in {"POST", "PUT", "PATCH"}:
            limit = self._limit(request.url.path)
            raw_length = request.headers.get("content-length")
            if raw_length:
                try:
                    length = int(raw_length)
                except ValueError:
                    return error_response(
                        request,
                        status.HTTP_400_BAD_REQUEST,
                        "INVALID_CONTENT_LENGTH",
                        "Content-Length is invalid.",
                    )
                if length < 0 or length > limit:
                    return error_response(
                        request,
                        status.HTTP_413_CONTENT_TOO_LARGE,
                        "PAYLOAD_TOO_LARGE",
                        "Request body is too large.",
                    )
            if not request.url.path.startswith("/api/v1/uploads/local/"):
                data = bytearray()
                async for chunk in request.stream():
                    data.extend(chunk)
                    if len(data) > limit:
                        return error_response(
                            request,
                            status.HTTP_413_CONTENT_TOO_LARGE,
                            "PAYLOAD_TOO_LARGE",
                            "Request body is too large.",
                        )
                request._body = bytes(data)
        return await call_next(request)

    @staticmethod
    def _limit(path: str) -> int:
        settings = get_settings()
        if path.startswith("/api/v1/uploads/local/"):
            return settings.max_upload_mb * 1024 * 1024
        return settings.max_json_body_bytes
