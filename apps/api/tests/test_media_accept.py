from app.tools.registry import AUDIO
from app.utils.media_accept import content_type_accepted


def test_webm_audio_mime_variants_are_accepted() -> None:
    assert content_type_accepted(AUDIO, "audio/webm", "recording.webm")
    assert content_type_accepted(AUDIO, "audio/webm;codecs=opus", "recording.webm")
    assert content_type_accepted(AUDIO, "video/webm", "recording.webm")
    assert content_type_accepted(AUDIO, "video/webm;codecs=opus", "recording.webm")
    assert content_type_accepted(AUDIO, "", "recording.webm")
    assert content_type_accepted(AUDIO, "application/octet-stream", "recording.webm")


def test_octet_stream_without_supported_extension_is_rejected() -> None:
    assert not content_type_accepted(AUDIO, "application/octet-stream", "malware.exe")
    assert not content_type_accepted(AUDIO, "application/octet-stream", "notes.txt")
