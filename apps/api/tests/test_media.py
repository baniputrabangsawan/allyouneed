import shutil
from pathlib import Path

import pytest

from app.processors.base import ProcessorContext
from app.processors.registry import get_processor
from app.utils.media import probe, validate_media_output
from app.utils.subprocess import run_command

needs_ffmpeg = shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_ffprobe_reads_streams(tmp_path: Path) -> None:
    path = tmp_path / "clip.mp4"
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=32x32:d=0.2",
            "-pix_fmt",
            "yuv420p",
            str(path),
        ]
    )
    info = await probe(path)
    validate_media_output(info)
    assert info["streams"]


@pytest.mark.skipif(needs_ffmpeg, reason="ffmpeg")
async def test_video_metadata_processor(tmp_path: Path) -> None:
    path = tmp_path / "clip.mp4"
    await run_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=32x32:d=0.2",
            "-pix_fmt",
            "yuv420p",
            str(path),
        ]
    )
    output = tmp_path / "meta.json"
    context = ProcessorContext(
        job_id="job_media", tool_id="video-metadata-viewer", options={}, work_dir=tmp_path
    )
    result = await get_processor("video-metadata-viewer").process([path], output, context=context)
    assert output.is_file()
    assert "duration" in result.metadata
