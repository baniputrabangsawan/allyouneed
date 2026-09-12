import warnings
from collections.abc import Callable
from pathlib import Path

import fitz  # type: ignore[import-untyped]
from fastapi import status
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
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
    if content_type.startswith("image/"):
        _validate_image(path)
    elif content_type == "application/pdf":
        _validate_pdf(path)


def _invalid_file(path: Path, message: str) -> ApiError:
    path.unlink(missing_ok=True)
    return ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "INVALID_FILE", message)


def _validate_image(path: Path) -> None:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as image:
                width, height = image.size
                if width <= 0 or height <= 0 or width * height > get_settings().max_image_pixels:
                    raise _invalid_file(path, "Image dimensions exceed the safety limit.")
                image.verify()
    except ApiError:
        raise
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
    ) as exc:
        raise _invalid_file(path, "Image data is malformed or unsafe.") from exc


def _validate_pdf(path: Path) -> None:
    try:
        with fitz.open(path) as document:
            if document.page_count < 1 or document.page_count > get_settings().max_pdf_pages:
                raise _invalid_file(path, "PDF page count exceeds the safety limit.")
    except ApiError:
        raise
    except Exception as exc:
        raise _invalid_file(path, "PDF data is malformed or unsafe.") from exc
