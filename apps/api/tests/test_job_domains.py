from pathlib import Path

import pytest

from app.core.exceptions import ApiError
from app.core.job_payload import input_keys
from app.services.job_output import output_format


def test_input_keys_accepts_only_the_public_job_input_shapes() -> None:
    batch = ["uploads/one", "uploads/two"]

    assert input_keys({"fileKey": "uploads/single"}) == ["uploads/single"]
    assert input_keys({"files": batch}) == batch
    assert input_keys({"files": ["uploads/one", 2]}) == []
    assert input_keys({"other": "uploads/one"}) == []
    assert input_keys({"files": batch}) is not batch


def test_output_format_uses_fixed_and_dynamic_tool_rules() -> None:
    assert output_format("pdf-to-text", {}, Path("source.pdf")) == (
        "json",
        "application/json",
    )
    assert output_format("image-converter", {"format": "image/jpeg"}, Path("source.png")) == (
        "jpg",
        "image/jpeg",
    )
    assert output_format("resize-image", {}, Path("source.jpeg")) == (
        "jpg",
        "image/jpeg",
    )


def test_output_format_rejects_unapproved_extensions() -> None:
    with pytest.raises(ApiError) as error:
        output_format("html-to-image", {"format": "svg"}, Path("source.html"))

    assert error.value.status_code == 422
    assert error.value.code == "UNSUPPORTED_FORMAT"
