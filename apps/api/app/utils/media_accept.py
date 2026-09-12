from pathlib import Path

GENERIC_MIMES = {"", "application/octet-stream", "binary/octet-stream"}

FORMATS: tuple[tuple[frozenset[str], frozenset[str]], ...] = (
    (frozenset({".mp3"}), frozenset({"audio/mpeg", "audio/mp3"})),
    (frozenset({".wav"}), frozenset({"audio/wav", "audio/x-wav", "audio/wave"})),
    (frozenset({".m4a"}), frozenset({"audio/mp4", "audio/x-m4a", "audio/m4a"})),
    (frozenset({".aac"}), frozenset({"audio/aac"})),
    (frozenset({".ogg", ".oga"}), frozenset({"audio/ogg"})),
    (frozenset({".opus"}), frozenset({"audio/opus", "audio/ogg"})),
    (frozenset({".flac"}), frozenset({"audio/flac", "audio/x-flac"})),
    (frozenset({".webm"}), frozenset({"audio/webm", "video/webm"})),
    (frozenset({".mp4", ".m4v"}), frozenset({"video/mp4"})),
    (frozenset({".mov", ".qt"}), frozenset({"video/quicktime"})),
    (frozenset({".gif"}), frozenset({"image/gif"})),
    (frozenset({".jpg", ".jpeg"}), frozenset({"image/jpeg", "image/jpg"})),
    (frozenset({".png"}), frozenset({"image/png"})),
    (frozenset({".webp"}), frozenset({"image/webp"})),
    (frozenset({".pdf"}), frozenset({"application/pdf"})),
)


def normalize_mime(content_type: str) -> str:
    return content_type.lower().split(";", 1)[0].strip()


def _expanded(accepted: set[str]) -> tuple[set[str], set[str]]:
    mimes = {normalize_mime(item) for item in accepted if "/" in item}
    extensions = {item.lower() for item in accepted if item.startswith(".")}
    for format_extensions, format_mimes in FORMATS:
        if mimes & format_mimes or extensions & format_extensions:
            mimes.update(format_mimes)
            extensions.update(format_extensions)
    return mimes, extensions


def content_type_accepted(accepted: set[str], content_type: str, filename: str = "") -> bool:
    if not accepted:
        return True
    mimes, extensions = _expanded(accepted)
    mime = normalize_mime(content_type)
    extension = Path(filename).suffix.lower()
    if extension and extension in extensions:
        return True
    if mime and mime in mimes:
        return True
    if mime in GENERIC_MIMES:
        return False
    return False
