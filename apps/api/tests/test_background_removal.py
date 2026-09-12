from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.processors.base import ProcessingError, ProcessorContext
from app.processors.registry import get_processor
from app.providers import background_removal
from app.providers.background_removal import apply_alpha, parse_mode, refine_mask


def _portrait(path: Path, *, size: int = 160) -> Path:
    image = Image.new("RGB", (size, size), (40, 80, 180))
    draw = ImageDraw.Draw(image)
    draw.ellipse((48, 24, 112, 88), fill=(232, 184, 140))
    draw.rectangle((56, 84, 104, 136), fill=(35, 35, 45))
    for x in range(38, 122, 8):
        draw.line((80, 28, x, 12), fill=(50, 30, 20), width=2)
    image.save(path, "PNG")
    return path


def _context(tmp_path: Path, mode: str) -> ProcessorContext:
    return ProcessorContext(
        job_id=f"job_remove_bg_{mode}",
        tool_id="remove-background",
        options={"mode": mode},
        work_dir=tmp_path,
    )


def test_parse_mode_defaults_to_quality() -> None:
    assert parse_mode({}) == "quality"
    assert parse_mode({"mode": "fast"}) == "fast"
    with pytest.raises(ProcessingError) as caught:
        parse_mode({"mode": "turbo"})
    assert caught.value.code == "VALIDATION_ERROR"


def test_refine_mask_preserves_soft_edges() -> None:
    rgb = np.zeros((48, 48, 3), dtype=np.uint8)
    rgb[:, :] = (20, 40, 80)
    mask = np.zeros((48, 48), dtype=np.uint8)
    mask[10:38, 10:38] = 255
    refined = refine_mask(mask, rgb, mode="quality")
    assert refined.shape == mask.shape
    assert int(refined[24, 24]) > 200
    assert 0 < int(refined[10, 24]) < 255


def test_apply_alpha_keeps_dimensions_and_alpha() -> None:
    rgb = np.zeros((12, 10, 3), dtype=np.uint8)
    mask = np.full((12, 10), 127, dtype=np.uint8)
    result = apply_alpha(rgb, mask)
    assert result.size == (10, 12)
    assert result.mode == "RGBA"
    assert result.getpixel((0, 0))[3] == 127


@pytest.mark.parametrize("mode", ["fast", "quality"])
async def test_remove_background_outputs_transparent_png_same_size(
    tmp_path: Path, mode: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    loads: list[str] = []

    def fake_loader(selected: str):
        loads.append(selected)

        def infer(rgb: np.ndarray) -> np.ndarray:
            mask = np.zeros(rgb.shape[:2], dtype=np.uint8)
            h, w = mask.shape
            mask[h // 5 : h * 4 // 5, w // 4 : w * 3 // 4] = 255
            return mask

        return infer

    monkeypatch.setattr(background_removal, "_MODEL_CACHE", {})
    monkeypatch.setattr(background_removal, "_load_fast_model", lambda: fake_loader("fast"))
    monkeypatch.setattr(background_removal, "_load_quality_model", lambda: fake_loader("quality"))
    source = _portrait(tmp_path / f"input-{mode}.png")
    for suffix in ("first", "second"):
        target = tmp_path / f"output-{mode}-{suffix}.png"
        result = await get_processor("remove-background").process(
            [source], target, context=_context(tmp_path, mode)
        )
        assert target.is_file()
        assert result.extension == "png"
        assert result.content_type == "image/png"
        assert result.metadata["mode"] == mode
        assert result.metadata["width"] == 160
        assert result.metadata["height"] == 160
        assert result.metadata["originalSize"] == source.stat().st_size
        with Image.open(target) as image:
            assert image.format == "PNG"
            assert image.mode == "RGBA"
            assert image.size == (160, 160)
            alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
            assert int(alpha.max()) > 180
            assert int(alpha.min()) < 80
    assert loads == [mode]


async def test_remove_background_reports_model_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(background_removal, "_MODEL_CACHE", {})
    monkeypatch.setattr(background_removal, "_load_fast_model", lambda: None)
    source = _portrait(tmp_path / "input.png")
    with pytest.raises(ProcessingError) as caught:
        await get_processor("remove-background").process(
            [source], tmp_path / "output.png", context=_context(tmp_path, "fast")
        )
    assert caught.value.code == "MODEL_UNAVAILABLE"


async def test_quality_load_failure_is_model_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(background_removal, "_MODEL_CACHE", {})

    def boom() -> None:
        raise RuntimeError("CUDA out of memory")

    monkeypatch.setattr(background_removal, "_load_quality_model", boom)
    source = _portrait(tmp_path / "input.png")
    with pytest.raises(ProcessingError) as caught:
        await get_processor("remove-background").process(
            [source], tmp_path / "output.png", context=_context(tmp_path, "quality")
        )
    assert caught.value.code == "MODEL_UNAVAILABLE"
    assert "CUDA" not in str(caught.value)


def test_select_torch_device_stays_on_cpu_when_cuda_probe_fails() -> None:
    class FakeCuda:
        @staticmethod
        def is_available() -> bool:
            return True

    class FakeTorch:
        cuda = FakeCuda

        class device:
            def __init__(self, name: str) -> None:
                self.type = name

            def __str__(self) -> str:
                return self.type

        @staticmethod
        def zeros(*_args: object, **kwargs: object) -> object:
            if kwargs.get("device") == "cuda":
                raise RuntimeError("CUDA error: out of memory")
            return 0

    selected = background_removal._select_torch_device(FakeTorch)
    assert str(selected) == "cpu"
