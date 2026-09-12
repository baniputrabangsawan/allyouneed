from __future__ import annotations

import asyncio
import threading
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from app.core.config import get_settings
from app.processors.base import ProcessingError, ProcessorContext
from app.utils.media import duration_seconds, probe, validate_media_output
from app.utils.subprocess import run_command

TTS_SPEEDS = (0.75, 1.0, 1.25, 1.5)
TTS_FORMATS = frozenset({"mp3", "wav"})
_KOKORO: Any = None
_PIPER: dict[str, Any] = {}
_LOAD_LOCK = threading.Lock()
_INFER_LOCK = threading.Lock()


@dataclass(frozen=True)
class TtsVoice:
    key: str
    name: str
    language: str
    kokoro_id: str
    piper_id: str


TTS_VOICES: dict[str, TtsVoice] = {
    "sarah": TtsVoice("sarah", "Sarah", "en", "af_sarah", "en_US-lessac-medium"),
    "adam": TtsVoice("adam", "Adam", "en", "am_adam", "en_US-lessac-medium"),
    "maya": TtsVoice("maya", "Maya", "id", "af_nicole", "en_US-lessac-medium"),
}


class TextToSpeechProvider(Protocol):
    async def synthesize(
        self, text: str, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]: ...


def resolve_tts_text(text: str) -> str:
    value = text.strip()
    if not value:
        raise ProcessingError("Enter text to convert into speech.")
    maximum = get_settings().tts_max_chars
    if len(value) > maximum:
        raise ProcessingError(f"Text must be {maximum} characters or fewer.", code="TEXT_TOO_LONG")
    return value


def resolve_tts_voice(options: dict[str, Any]) -> TtsVoice:
    raw = str(options.get("voice", "sarah")).strip().lower()
    voice = TTS_VOICES.get(raw)
    if voice is None:
        raise ProcessingError("That voice is not available.", code="VOICE_UNAVAILABLE")
    language = str(options.get("language", voice.language)).strip().lower()
    if language in {"", "auto"}:
        return voice
    if language in {"en", "eng", "english"}:
        language = "en"
    elif language in {"id", "ind", "bahasa", "bahasa indonesia", "indonesian"}:
        language = "id"
    if language != voice.language:
        matched = next((item for item in TTS_VOICES.values() if item.language == language), None)
        if matched is None:
            raise ProcessingError("That voice is not available.", code="VOICE_UNAVAILABLE")
        return matched
    return voice


def resolve_tts_speed(options: dict[str, Any]) -> float:
    raw = options.get("speed", 1)
    try:
        speed = float(raw)
    except (TypeError, ValueError) as exc:
        raise ProcessingError("Speed must be 0.75x, 1x, 1.25x, or 1.5x.") from exc
    for preset in TTS_SPEEDS:
        if abs(speed - preset) < 0.001:
            return preset
    raise ProcessingError("Speed must be 0.75x, 1x, 1.25x, or 1.5x.")


def resolve_tts_format(options: dict[str, Any]) -> str:
    raw = str(options.get("format", "mp3")).split("/")[-1].lower().lstrip(".")
    if raw in {"mpeg", "mpga"}:
        raw = "mp3"
    if raw not in TTS_FORMATS:
        raise ProcessingError("Output format must be MP3 or WAV.")
    return raw


def write_wav(path: Path, pcm: bytes, *, sample_rate: int, channels: int = 1) -> None:
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(channels)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(pcm)


class UnavailableTtsProvider:
    async def synthesize(
        self, text: str, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]:
        raise ProcessingError(
            "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
        )


class KokoroProvider:
    async def synthesize(
        self, text: str, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]:
        return await _synthesize_with(text, output, context, engine="kokoro")


class PiperProvider:
    async def synthesize(
        self, text: str, output: Path, *, context: ProcessorContext
    ) -> dict[str, Any]:
        return await _synthesize_with(text, output, context, engine="piper")


async def _synthesize_with(
    text: str, output: Path, context: ProcessorContext, *, engine: str
) -> dict[str, Any]:
    value = resolve_tts_text(text)
    voice = resolve_tts_voice(context.options)
    speed = resolve_tts_speed(context.options)
    fmt = resolve_tts_format(context.options)
    await context.report(15, "synthesizing")
    wav = output if fmt == "wav" else context.work_dir / "tts.wav"
    try:
        sample_rate = await asyncio.to_thread(_synthesize_wav, value, wav, voice, speed, engine)
    except ProcessingError:
        raise
    except Exception as exc:
        raise ProcessingError("Speech could not be generated.", code="TTS_FAILED") from exc
    if fmt == "mp3":
        await context.report(70, "encoding")
        try:
            await run_command(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(wav),
                    "-c:a",
                    "libmp3lame",
                    "-b:a",
                    "192k",
                    str(output),
                ],
                cancel_event=context.cancel_event,
                timeout=120,
            )
        except ProcessingError as exc:
            if exc.code == "FFMPEG_FAILED":
                raise
            raise ProcessingError("Speech could not be encoded.", code="FFMPEG_FAILED") from exc
    await context.report(90, "finalizing")
    info = await probe(output, cancel_event=context.cancel_event)
    validate_media_output(info)
    duration = duration_seconds(info)
    if duration is None or duration <= 0:
        raise ProcessingError("Speech could not be generated.", code="TTS_FAILED")
    return {
        "voice": voice.key,
        "voiceName": voice.name,
        "language": voice.language,
        "speed": speed,
        "format": fmt,
        "duration": duration,
        "sampleRate": sample_rate,
        "size": output.stat().st_size,
        "engine": engine,
    }


def _synthesize_wav(
    text: str, wav: Path, voice: TtsVoice, speed: float, engine: str
) -> int:
    if engine == "kokoro":
        return _kokoro_wav(text, wav, voice, speed)
    return _piper_wav(text, wav, voice, speed)


def _kokoro_wav(text: str, wav: Path, voice: TtsVoice, speed: float) -> int:
    kokoro = _load_kokoro()
    lang = "en-us" if voice.language == "en" else "en-us"
    with _INFER_LOCK:
        samples, sample_rate = kokoro.create(text, voice=voice.kokoro_id, speed=speed, lang=lang)
    pcm = _float_to_pcm16(samples)
    write_wav(wav, pcm, sample_rate=int(sample_rate))
    return int(sample_rate)


def _piper_wav(text: str, wav: Path, voice: TtsVoice, speed: float) -> int:
    piper = _load_piper(voice)
    length_scale = 1.0 / speed if speed else 1.0
    with _INFER_LOCK, wave.open(str(wav), "wb") as handle:
        try:
            from piper.config import SynthesisConfig

            piper.synthesize_wav(
                text, handle, syn_config=SynthesisConfig(length_scale=length_scale)
            )
        except TypeError:
            try:
                piper.synthesize_wav(text, handle)
            except TypeError:
                try:
                    piper.synthesize(text, handle, length_scale=length_scale)
                except TypeError:
                    piper.synthesize(text, handle)
    with wave.open(str(wav), "rb") as handle:
        return int(handle.getframerate())


def _float_to_pcm16(samples: Any) -> bytes:
    try:
        import numpy as np
    except ImportError as exc:
        raise ProcessingError(
            "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
        ) from exc
    clipped = np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0)
    return (clipped * 32767).astype("<i2").tobytes()


def _load_kokoro() -> Any:
    global _KOKORO
    with _LOAD_LOCK:
        if _KOKORO is not None:
            return _KOKORO
        try:
            from kokoro_onnx import Kokoro  # type: ignore[import-not-found]
        except ImportError as exc:
            raise ProcessingError(
                "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
            ) from exc
        model_path = Path(get_settings().storage_root) / "models" / "tts" / "kokoro-v1.0.onnx"
        voices_path = Path(get_settings().storage_root) / "models" / "tts" / "voices-v1.0.bin"
        if not model_path.is_file() or not voices_path.is_file():
            raise ProcessingError(
                "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
            )
        try:
            _KOKORO = Kokoro(str(model_path), str(voices_path))
        except Exception as exc:
            raise ProcessingError(
                "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
            ) from exc
        return _KOKORO


def _load_piper(voice: TtsVoice) -> Any:
    with _LOAD_LOCK:
        cached = _PIPER.get(voice.piper_id)
        if cached is not None:
            return cached
        try:
            from piper import PiperVoice
        except ImportError as exc:
            raise ProcessingError(
                "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
            ) from exc
        model_path = Path(get_settings().storage_root) / "models" / "tts" / f"{voice.piper_id}.onnx"
        if not model_path.is_file():
            raise ProcessingError(
                "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
            )
        try:
            loaded = PiperVoice.load(str(model_path))
        except Exception as exc:
            raise ProcessingError(
                "The speech model is not available on this server.", code="MODEL_UNAVAILABLE"
            ) from exc
        _PIPER[voice.piper_id] = loaded
        return loaded


def _kokoro_available() -> bool:
    try:
        import kokoro_onnx  # noqa: F401
    except ImportError:
        return False
    root = Path(get_settings().storage_root) / "models" / "tts"
    return (root / "kokoro-v1.0.onnx").is_file() and (root / "voices-v1.0.bin").is_file()


def _piper_available() -> bool:
    try:
        import piper  # noqa: F401
    except ImportError:
        return False
    root = Path(get_settings().storage_root) / "models" / "tts"
    return any(root.glob("*.onnx")) if root.is_dir() else False


def get_tts_provider() -> TextToSpeechProvider:
    settings = get_settings()
    if not settings.enable_self_hosted_ai:
        return UnavailableTtsProvider()
    requested = settings.tts_provider.strip().lower()
    if requested in {"selfhosted", "kokoro"} and _kokoro_available():
        return KokoroProvider()
    if requested in {"selfhosted", "kokoro", "piper"} and _piper_available():
        return PiperProvider()
    if requested == "piper":
        return PiperProvider() if _piper_available() else UnavailableTtsProvider()
    if requested == "kokoro":
        return KokoroProvider()
    return UnavailableTtsProvider()
