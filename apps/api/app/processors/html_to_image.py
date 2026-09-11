from __future__ import annotations

import asyncio
import contextlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from app.core.config import get_settings
from app.processors.base import (
    ProcessingError,
    Processor,
    ProcessorContext,
    ProcessorResult,
    integer,
)

MAX_INPUT_BYTES = 512 * 1024
MIN_VIEWPORT = 1
MAX_VIEWPORT = 4096
DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 720
DEFAULT_QUALITY = 80
RENDER_TIMEOUT_MS = 30_000
BLOCKED_OPTION_KEYS = ("url", "goto", "src")
ImageType = Literal["png", "jpeg"]


@dataclass(frozen=True)
class RenderRequest:
    html: str
    width: int
    height: int
    image_type: ImageType
    quality: int
    timeout_ms: int


def chromium_available() -> bool:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False
    try:
        with sync_playwright() as playwright:
            executable = Path(playwright.chromium.executable_path)
        return executable.is_file()
    except Exception:
        return False


def prepare_render(inputs: list[Path], options: dict[str, Any]) -> RenderRequest:
    for key in BLOCKED_OPTION_KEYS:
        value = options.get(key)
        if value not in (None, "", False):
            raise ProcessingError("URL rendering is not supported.")

    html = _read_html(inputs, options)
    css = options.get("css", "")
    if css is None:
        css = ""
    if not isinstance(css, str):
        raise ProcessingError("CSS must be a string.")
    if not html.strip():
        raise ProcessingError("HTML is required.")

    encoded = html.encode("utf-8")
    css_encoded = css.encode("utf-8")
    if len(encoded) + len(css_encoded) > MAX_INPUT_BYTES:
        raise ProcessingError("HTML input is too large.")

    width = integer(options, "width", DEFAULT_WIDTH, minimum=MIN_VIEWPORT, maximum=MAX_VIEWPORT)
    height = integer(options, "height", DEFAULT_HEIGHT, minimum=MIN_VIEWPORT, maximum=MAX_VIEWPORT)
    if width * height > get_settings().max_image_pixels:
        raise ProcessingError("Viewport exceeds the megapixel limit.", code="OUT_OF_MEMORY")

    image_type = _image_type(options.get("format", "png"))
    quality = integer(options, "quality", DEFAULT_QUALITY, minimum=1, maximum=100)
    document = assemble_document(html, css)
    return RenderRequest(
        html=document,
        width=width,
        height=height,
        image_type=image_type,
        quality=quality,
        timeout_ms=RENDER_TIMEOUT_MS,
    )


def assemble_document(html: str, css: str) -> str:
    css_block = f"<style>html,body{{margin:0;padding:0;}}{css}</style>"
    stripped = html.lstrip()
    if re.match(r"(?is)<!doctype\s+html|<html\b", stripped):
        if re.search(r"(?is)<head[^>]*>", stripped):
            return re.sub(
                r"(?is)<head[^>]*>",
                lambda match: match.group(0) + css_block,
                stripped,
                count=1,
            )
        if re.search(r"(?is)<html[^>]*>", stripped):
            return re.sub(
                r"(?is)<html[^>]*>",
                lambda match: f"{match.group(0)}<head>{css_block}</head>",
                stripped,
                count=1,
            )
        return f"{css_block}{stripped}"
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"{css_block}</head><body>{html}</body></html>"
    )


class HtmlToImageProcessor(Processor):
    tool_id = "html-to-image"

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        request = prepare_render(inputs, context.options)
        context.raise_if_cancelled()
        await context.report(None, "rendering")
        await _screenshot(request, output, context)
        extension = "png" if request.image_type == "png" else "jpg"
        content_type = "image/png" if request.image_type == "png" else "image/jpeg"
        return ProcessorResult(
            metadata={
                "width": request.width,
                "height": request.height,
                "format": request.image_type,
            },
            extension=extension,
            content_type=content_type,
        )


def _read_html(inputs: list[Path], options: dict[str, Any]) -> str:
    for source in inputs:
        if source.is_file() and source.stat().st_size > 0:
            return source.read_text(encoding="utf-8")
    html = options.get("html", "")
    if html is None:
        return ""
    if not isinstance(html, str):
        raise ProcessingError("HTML must be a string.")
    return html


def _image_type(value: object) -> ImageType:
    raw = str(value or "png").lower().replace("image/", "").strip()
    if raw == "png":
        return "png"
    if raw in {"jpg", "jpeg"}:
        return "jpeg"
    raise ProcessingError("Output format is not supported.")


async def _screenshot(request: RenderRequest, output: Path, context: ProcessorContext) -> None:
    try:
        from playwright.async_api import Error as PlaywrightError
        from playwright.async_api import Route, async_playwright
    except ImportError as exc:
        raise ProcessingError("Playwright is not installed.") from exc

    async def block_route(route: Route) -> None:
        url = route.request.url
        if url.startswith(("about:", "data:", "blob:")):
            await route.continue_()
            return
        await route.fulfill(status=204, body=b"")

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-gpu",
                    "--disable-remote-fonts",
                    "--hide-scrollbars",
                ],
            )
            try:
                browser_context = await browser.new_context(
                    offline=True,
                    viewport={"width": request.width, "height": request.height},
                    java_script_enabled=True,
                    accept_downloads=False,
                    bypass_csp=False,
                )
                await browser_context.route("**/*", block_route)
                page = await browser_context.new_page()
                page.set_default_timeout(request.timeout_ms)
                page.set_default_navigation_timeout(request.timeout_ms)
                context.raise_if_cancelled()
                await page.set_content(
                    request.html,
                    wait_until="domcontentloaded",
                    timeout=request.timeout_ms,
                )
                with contextlib.suppress(Exception):
                    await page.evaluate(
                        "() => new Promise((resolve) => requestAnimationFrame("
                        "() => requestAnimationFrame(resolve)))"
                    )
                context.raise_if_cancelled()
                kwargs: dict[str, Any] = {
                    "path": str(output),
                    "type": request.image_type,
                    "full_page": False,
                    "animations": "disabled",
                    "timeout": request.timeout_ms,
                }
                if request.image_type == "jpeg":
                    kwargs["quality"] = request.quality
                await _capture(page, kwargs)
                await page.close()
                await browser_context.close()
            finally:
                await browser.close()
    except ProcessingError:
        raise
    except PlaywrightError as exc:
        raise ProcessingError("HTML rendering failed.") from exc
    except Exception as exc:
        raise ProcessingError("HTML rendering failed.") from exc


async def _capture(page: Any, kwargs: dict[str, Any]) -> None:
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            await page.screenshot(**kwargs)
            return
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                await asyncio.sleep(0.1)
                continue
            raise
    if last_error is not None:
        raise last_error
