from collections.abc import Callable
from pathlib import Path

from fastapi import status

from app.core.exceptions import ApiError

Checker = Callable[[bytes], bool]


def _jpeg(prefix: bytes) -> bool:
    return prefix.startswith(b"\xff\xd8\xff")


def _png(prefix: bytes) -> bool:
    return prefix.startswith(b"\x89PNG\r\n\x1a\n")


def _webp(prefix: bytes) -> bool:
    return prefix.startswith(b"RIFF") and prefix[8:12] == b"WEBP"


def _gif(prefix: bytes) -> bool:
    return prefix.startswith((b"GIF87a", b"GIF89a"))


def _pdf(prefix: bytes) -> bool:
    return prefix.startswith(b"%PDF-")


def _wav(prefix: bytes) -> bool:
    return prefix.startswith(b"RIFF") and prefix[8:12] == b"WAVE"


def _ogg(prefix: bytes) -> bool:
    return prefix.startswith(b"OggS")


def _mp4(prefix: bytes) -> bool:
    return prefix[4:8] == b"ftyp"


SIGNATURES: dict[str, Checker] = {
    "image/jpeg": _jpeg,
    "image/png": _png,
    "image/webp": _webp,
    "image/gif": _gif,
    "application/pdf": _pdf,
    "audio/wav": _wav,
    "audio/x-wav": _wav,
    "audio/ogg": _ogg,
    "video/mp4": _mp4,
    "video/quicktime": _mp4,
}


def validate_magic(path: Path, content_type: str) -> None:
    prefix = path.read_bytes()[:16]
    checker = SIGNATURES.get(content_type)
    if checker is not None and not checker(prefix):
        path.unlink(missing_ok=True)
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "INVALID_FILE", "File signature is invalid."
        )
