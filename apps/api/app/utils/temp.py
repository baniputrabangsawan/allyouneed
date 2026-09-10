import shutil
from pathlib import Path

from app.core.config import get_settings


def job_work_dir(job_id: str) -> Path:
    path = Path(get_settings().temp_root) / "utility" / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def cleanup_work_dir(job_id: str) -> None:
    path = Path(get_settings().temp_root) / "utility" / job_id
    shutil.rmtree(path, ignore_errors=True)
