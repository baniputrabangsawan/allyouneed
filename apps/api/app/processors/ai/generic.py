import json
from pathlib import Path

from app.processors.base import Processor, ProcessorContext, ProcessorResult
from app.providers.background_removal import get_background_removal_provider
from app.providers.stt import get_stt_provider
from app.providers.tts import get_tts_provider
from app.providers.upscale import get_upscale_provider


class BackgroundRemovalProcessor(Processor):
    tool_id = "remove-background"

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        await context.report(None, "processing")
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
        output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        return ProcessorResult(
            metadata={"language": result.get("language"), "duration": result.get("duration")}
        )


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
        metadata = await get_tts_provider().synthesize(text, output, context=context)
        return ProcessorResult(metadata=metadata, extension="wav", content_type="audio/wav")
