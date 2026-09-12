from pathlib import Path

from app.processors.base import Processor, ProcessorContext, ProcessorResult
from app.providers.background_removal import get_background_removal_provider
from app.providers.stt import get_stt_provider, resolve_stt_format
from app.providers.tts import get_tts_provider, resolve_tts_format
from app.providers.upscale import get_upscale_provider

_STT_OUTPUT = {
    "txt": ("text", "txt", "text/plain"),
    "srt": ("srt", "srt", "application/x-subrip"),
    "vtt": ("vtt", "vtt", "text/vtt"),
}


class BackgroundRemovalProcessor(Processor):
    tool_id = "remove-background"

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        await context.report(None, "queued")
        provider = get_background_removal_provider()
        metadata = await provider.remove(inputs[0], output, context=context)
        return ProcessorResult(metadata=metadata, extension="png", content_type="image/png")


class UpscaleProcessor(Processor):
    tool_id = "upscale-image"

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        await context.report(None, "processing")
        scale = int(context.options.get("scale", 2))
        metadata = await get_upscale_provider().upscale(
            inputs[0], output, scale=scale, context=context
        )
        return ProcessorResult(metadata=metadata)


class SpeechToTextProcessor(Processor):
    tool_id = "speech-to-text"

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        await context.report(None, "processing")
        result = await get_stt_provider().transcribe(inputs[0], context=context)
        fmt = resolve_stt_format(context.options)
        field, extension, content_type = _STT_OUTPUT[fmt]
        body = str(result.get(field, "") or "")
        output.write_text(body if body else "\n", encoding="utf-8")
        metadata = {key: value for key, value in result.items() if key != "segments"}
        return ProcessorResult(metadata=metadata, extension=extension, content_type=content_type)


class TextToSpeechProcessor(Processor):
    tool_id = "text-to-speech"

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        await context.report(None, "processing")
        text = str(context.options.get("text", ""))
        if not text and inputs:
            text = inputs[0].read_text(encoding="utf-8")
        fmt = resolve_tts_format(context.options)
        metadata = await get_tts_provider().synthesize(text, output, context=context)
        extension = str(metadata.get("format") or fmt)
        content_type = "audio/mpeg" if extension == "mp3" else "audio/wav"
        return ProcessorResult(metadata=metadata, extension=extension, content_type=content_type)
