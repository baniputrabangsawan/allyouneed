from typing import Any


def input_keys(input_data: dict[str, Any]) -> list[str]:
    """Return the ordered storage keys from the public job input shape."""
    file_key = input_data.get("fileKey")
    if isinstance(file_key, str):
        return [file_key]

    files = input_data.get("files")
    if isinstance(files, list) and all(isinstance(item, str) for item in files):
        return list(files)
    return []
