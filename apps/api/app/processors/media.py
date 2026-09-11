import json
import re
import shutil
from pathlib import Path
from typing import Any

from app.processors.base import (
    ProcessingError,
    Processor,
    ProcessorContext,
    ProcessorResult,
    integer,
)
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
    "noise-reduction",
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

SUBTITLE_EXTENSIONS = {".srt", ".vtt", ".ass", ".ssa"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".qt", ".m4v"}
SUBTITLE_CONTAINERS = {"mp4", "webm"}
_NAMED_RGB = {
    "white": "FFFFFF",
    "black": "000000",
    "yellow": "FFFF00",
    "red": "FF0000",
    "cyan": "00FFFF",
}
_SUBTITLE_TIMESTAMP = re.compile(
    r"\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}",
)


def looks_like_subtitle_text(text: str) -> bool:
    sample = text.lstrip("﻿").lstrip()
    if sample.startswith("WEBVTT"):
        return True
    if "[Script Info]" in sample or "Dialogue:" in sample:
        return True
    return _SUBTITLE_TIMESTAMP.search(sample) is not None


def looks_like_subtitle_file(path: Path) -> bool:
    try:
        sample = path.read_bytes()[:4096]
    except OSError:
        return False
    if b"\x00" in sample[:512]:
        return False
    return looks_like_subtitle_text(sample.decode("utf-8", errors="ignore"))


def classify_media_input(path: Path) -> str:
    extension = path.suffix.lower()
    if extension in SUBTITLE_EXTENSIONS:
        return "subtitle"
    if extension in VIDEO_EXTENSIONS:
        return "video"
    if looks_like_subtitle_file(path):
        return "subtitle"
    return "video"


def subtitle_extension_from_content(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="ignore").lstrip("﻿").lstrip()
    if text.startswith("WEBVTT"):
        return ".vtt"
    if "[Script Info]" in text or "Dialogue:" in text:
        return ".ass"
    return ".srt"


def materialize_subtitle(subtitle: Path, work_dir: Path) -> Path:
    extension = subtitle.suffix.lower()
    if extension in SUBTITLE_EXTENSIONS:
        return subtitle
    dest = work_dir / f"{subtitle.name}{subtitle_extension_from_content(subtitle)}"
    if dest.resolve() != subtitle.resolve():
        shutil.copy2(subtitle, dest)
    return dest


# afftdn presets (ffmpeg-filters.html#afftdn): noise_reduction (nr) 0.01–97 default 12,
# noise_floor (nf) −80…−20 default −50. Deterministic FFT denoise; not arnndn.
NOISE_REDUCTION_PRESETS: dict[str, tuple[float, float]] = {
    "light": (8, -50),
    "medium": (12, -50),
    "strong": (24, -40),
}


def split_video_and_subtitle(inputs: list[Path]) -> tuple[Path, Path]:
    videos = [path for path in inputs if classify_media_input(path) == "video"]
    subtitles = [path for path in inputs if classify_media_input(path) == "subtitle"]
    if len(videos) != 1 or len(subtitles) != 1:
        raise ProcessingError(
            "Add Subtitle needs one video file and one subtitle file (.srt, .vtt, or .ass)."
        )
    return videos[0], subtitles[0]


def escape_subtitles_path(path: Path) -> str:
    return (
        path.as_posix()
        .replace("\\", "\\\\")
        .replace(":", "\\:")
        .replace("'", "\\'")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


def subtitle_mode(options: dict[str, Any]) -> str:
    mode = str(options.get("mode", "burn")).strip().lower()
    if mode in {"embed", "mux", "track"}:
        return "mux"
    if mode != "burn":
        raise ProcessingError("Subtitle mode must be burn or mux.")
    return mode


def keep_audio(options: dict[str, Any]) -> bool:
    if "keepAudio" in options:
        return bool(options["keepAudio"])
    if "keep_audio" in options:
        return bool(options["keep_audio"])
    return True


def output_container(output: Path) -> str:
    container = output.suffix.lower().lstrip(".")
    if container not in SUBTITLE_CONTAINERS:
        raise ProcessingError("Output container must be mp4 or webm.")
    return container


def burn_force_style(options: dict[str, Any], subtitle: Path) -> str | None:
    if subtitle.suffix.lower() in {".ass", ".ssa"}:
        return None
    parts: list[str] = []
    if "fontName" in options:
        font = str(options.get("fontName", "")).strip()
        if not re.fullmatch(r"[A-Za-z0-9 _-]+", font):
            raise ProcessingError("Invalid subtitle font name.")
        parts.append(f"FontName={font}")
    if "fontSize" in options:
        parts.append(f"FontSize={integer(options, 'fontSize', 24, minimum=8, maximum=96)}")
    if "fontColor" in options:
        parts.append(f"PrimaryColour={css_to_ass_color(str(options.get('fontColor', '')))}")
    return ",".join(parts) or None


def css_to_ass_color(color: str) -> str:
    raw = color.strip().lower().lstrip("#")
    rgb = _NAMED_RGB.get(raw)
    if rgb is None and re.fullmatch(r"[0-9a-f]{6}", raw):
        rgb = raw
    if rgb is None:
        raise ProcessingError("Invalid subtitle color.")
    return f"&H00{rgb[4:6]}{rgb[2:4]}{rgb[0:2]}"


def mux_subtitle_codec(container: str, subtitle: Path) -> list[str]:
    if container == "mp4":
        return ["-c:s", "mov_text"]
    if container == "webm":
        return ["-c:s", "webvtt"]
    extension = subtitle.suffix.lower()
    if extension in {".ass", ".ssa"}:
        return ["-c:s", "ass"]
    if extension == ".vtt":
        return ["-c:s", "webvtt"]
    return ["-c:s", "srt"]


def _encode_args(container: str, *, copy_video: bool, audio: bool) -> list[str]:
    args: list[str] = []
    if copy_video:
        args += ["-c:v", "copy"]
    elif container == "webm":
        args += ["-c:v", "libvpx", "-crf", "32", "-b:v", "0"]
    else:
        args += ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
    if not audio:
        return args
    if copy_video or container != "webm":
        args += ["-c:a", "copy"]
    else:
        args += ["-c:a", "libopus"]
    return args


def _can_copy_video(video: Path, container: str) -> bool:
    source = video.suffix.lower().lstrip(".")
    return source == container or (container == "mp4" and source in {"mp4", "mov", "m4v"})


def subtitle_ffmpeg_args(inputs: list[Path], options: dict[str, Any], output: Path) -> list[str]:
    video, subtitle = split_video_and_subtitle(inputs)
    subtitle = materialize_subtitle(subtitle, output.parent)
    mode = subtitle_mode(options)
    container = output_container(output)
    audio = keep_audio(options)
    args = ["ffmpeg", "-y", "-i", str(video)]
    if mode == "mux":
        args += ["-i", str(subtitle), "-map", "0:v:0"]
        if audio:
            args += ["-map", "0:a?"]
        else:
            args += ["-an"]
        args += ["-map", "1:0"]
        args += _encode_args(container, copy_video=_can_copy_video(video, container), audio=audio)
        args += mux_subtitle_codec(container, subtitle)
        args.append(str(output))
        return args

    path = escape_subtitles_path(subtitle)
    style = burn_force_style(options, subtitle)
    vf = f"subtitles='{path}'" if not style else f"subtitles='{path}':force_style='{style}'"
    args += ["-map", "0:v:0"]
    if audio:
        args += ["-map", "0:a?"]
    else:
        args += ["-an"]
    args += ["-sn", "-vf", vf]
    args += _encode_args(container, copy_video=False, audio=audio)
    args.append(str(output))
    return args


def stream_types(info: dict[str, Any]) -> list[str]:
    streams = info.get("streams")
    if not isinstance(streams, list):
        return []
    kinds: list[str] = []
    for stream in streams:
        if isinstance(stream, dict) and isinstance(stream.get("codec_type"), str):
            kinds.append(stream["codec_type"])
    return kinds


def validate_subtitle_output(info: dict[str, Any], *, mode: str, audio: bool) -> None:
    kinds = stream_types(info)
    if "video" not in kinds:
        raise ProcessingError("Output file has no video stream.")
    if audio and "audio" not in kinds:
        raise ProcessingError("Output file is missing audio.")
    if not audio and "audio" in kinds:
        raise ProcessingError("Audio was requested to be removed.")
    if mode == "mux" and "subtitle" not in kinds:
        raise ProcessingError("Output file is missing a subtitle track.")


def noise_reduction_filter(options: dict[str, Any]) -> str:
    strength = str(options.get("strength", "medium")).strip().lower()
    preset = NOISE_REDUCTION_PRESETS.get(strength)
    if preset is None:
        raise ProcessingError("Noise reduction strength must be light, medium, or strong.")
    nr, nf = preset
    return f"afftdn=nr={nr}:nf={nf}:nt=w"


def ffmpeg_args(
    tool_id: str, inputs: list[Path], options: dict[str, Any], output: Path
) -> list[str]:
    if tool_id == "add-subtitle":
        return subtitle_ffmpeg_args(inputs, options, output)
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
    elif tool_id == "noise-reduction":
        args += ["-map", "0:a:0", "-af", noise_reduction_filter(options)]
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
        probed = inputs[0]
        if self.tool_id == "add-subtitle":
            probed, _subtitle = split_video_and_subtitle(inputs)
        source = await probe(probed, cancel_event=context.cancel_event)
        total = duration_seconds(source)
        args = ffmpeg_args(self.tool_id, inputs, context.options, output)
        await context.report(None if total is None else 10, "processing")
        await run_command(args, cancel_event=context.cancel_event, timeout=600)
        if self.tool_id not in {"generate-thumbnail", "video-screenshot", "video-to-gif"}:
            info = await probe(output, cancel_event=context.cancel_event)
            validate_media_output(info)
            if self.tool_id == "add-subtitle":
                validate_subtitle_output(
                    info,
                    mode=subtitle_mode(context.options),
                    audio=keep_audio(context.options),
                )
        await context.report(100 if total is not None else None, "encoding")
        return ProcessorResult(metadata={"duration": total})
