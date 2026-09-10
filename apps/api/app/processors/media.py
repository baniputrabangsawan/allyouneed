import json
from pathlib import Path
from typing import Any

from app.processors.base import Processor, ProcessorContext, ProcessorResult, integer
from app.utils.media import duration_seconds, probe, validate_media_output
from app.utils.subprocess import run_command

AUDIO_TOOLS = {
    "audio-converter",
    "audio-compressor",
    "audio-cutter",
    "audio-trimmer",
    "audio-merger",
    "change-audio-speed",
    "change-volume",
    "remove-silence",
    "extract-audio-from-video",
}
VIDEO_TOOLS = {
    "video-compressor",
    "video-converter",
    "video-to-gif",
    "gif-to-video",
    "video-cutter",
    "video-trimmer",
    "video-merger",
    "resize-video",
    "crop-video",
    "rotate-video",
    "remove-audio",
    "extract-audio",
    "add-audio",
    "change-video-speed",
    "generate-thumbnail",
    "video-screenshot",
    "video-metadata-viewer",
    "add-watermark",
    "add-subtitle",
}
MEDIA_TOOLS = AUDIO_TOOLS | VIDEO_TOOLS


def ffmpeg_args(
    tool_id: str, inputs: list[Path], options: dict[str, Any], output: Path
) -> list[str]:
    if tool_id in {"audio-merger", "video-merger"}:
        listing = output.with_suffix(".txt")
        listing.write_text("".join(f"file '{path}'\n" for path in inputs), encoding="utf-8")
        return [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(listing),
            "-c",
            "copy",
            str(output),
        ]

    args = ["ffmpeg", "-y", "-i", str(inputs[0])]
    if tool_id == "add-audio" and len(inputs) > 1:
        args += [
            "-i",
            str(inputs[1]),
            "-c:v",
            "copy",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-shortest",
        ]
    elif tool_id in {"audio-cutter", "audio-trimmer", "video-cutter", "video-trimmer"}:
        args += ["-ss", str(options.get("start", 0)), "-t", str(options.get("duration", 10))]
    elif tool_id == "change-volume":
        args += ["-af", f"volume={float(options.get('volume', 1))}"]
    elif tool_id == "change-audio-speed":
        args += ["-filter:a", f"atempo={float(options.get('speed', 1))}"]
    elif tool_id == "remove-silence":
        args += ["-af", "silenceremove=start_periods=1:start_threshold=-50dB"]
    elif tool_id in {"extract-audio", "extract-audio-from-video"}:
        args += ["-vn"]
    elif tool_id == "remove-audio":
        args += ["-an", "-c:v", "copy"]
    elif tool_id == "resize-video":
        width = integer(options, "width", 1280)
        height = integer(options, "height", 720)
        args += ["-vf", f"scale={width}:{height}"]
    elif tool_id == "crop-video":
        args += ["-vf", f"crop={integer(options, 'width', 640)}:{integer(options, 'height', 360)}"]
    elif tool_id == "rotate-video":
        args += ["-vf", "transpose=1"]
    elif tool_id == "change-video-speed":
        speed = float(options.get("speed", 1))
        args += [
            "-filter_complex",
            f"[0:v]setpts={1 / speed}*PTS[v];[0:a]atempo={speed}[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
        ]
    elif tool_id in {"generate-thumbnail", "video-screenshot"}:
        args += ["-ss", str(options.get("time", 0)), "-frames:v", "1"]
    elif tool_id in {"video-compressor", "audio-compressor"}:
        args += (
            ["-crf", str(integer(options, "crf", 28))]
            if tool_id == "video-compressor"
            else ["-b:a", str(options.get("bitrate", "128k"))]
        )
    elif tool_id == "add-watermark":
        text = str(options.get("text", "Watermark")).replace(":", "\\:").replace("'", "")
        args += ["-vf", f"drawtext=text='{text}':x=24:y=24:fontsize=24:fontcolor=white"]
    args.append(str(output))
    return args


class MediaProcessor(Processor):
    def __init__(self, tool_id: str) -> None:
        self.tool_id = tool_id

    async def process(
        self,
        inputs: list[Path],
        output: Path,
        *,
        context: ProcessorContext,
    ) -> ProcessorResult:
        if self.tool_id == "video-metadata-viewer":
            info = await probe(inputs[0], cancel_event=context.cancel_event)
            output.write_text(json.dumps(info), encoding="utf-8")
            return ProcessorResult(metadata={"duration": duration_seconds(info)})

        await context.report(None, "decoding")
        source = await probe(inputs[0], cancel_event=context.cancel_event)
        total = duration_seconds(source)
        args = ffmpeg_args(self.tool_id, inputs, context.options, output)
        await context.report(None if total is None else 10, "processing")
        await run_command(args, cancel_event=context.cancel_event, timeout=600)
        if self.tool_id not in {"generate-thumbnail", "video-screenshot", "video-to-gif"}:
            info = await probe(output, cancel_event=context.cancel_event)
            validate_media_output(info)
        await context.report(100 if total is not None else None, "encoding")
        return ProcessorResult(metadata={"duration": total})
