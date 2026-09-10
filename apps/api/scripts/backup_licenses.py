from __future__ import annotations

import argparse
import shutil
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import get_settings
from app.db.session import sqlite_path_from_url


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copy the license SQLite file to a backup directory."
    )
    parser.add_argument("--dest", default="./data/backups")
    args = parser.parse_args()
    source = sqlite_path_from_url(get_settings().license_database_url)
    if source is None or not source.exists():
        raise SystemExit("License database file was not found.")
    dest_dir = Path(args.dest)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    dest = dest_dir / f"licenses-{stamp}.db"
    shutil.copy2(source, dest)
    wal = source.with_name(source.name + "-wal")
    shm = source.with_name(source.name + "-shm")
    if wal.exists():
        shutil.copy2(wal, dest.with_name(dest.name + "-wal"))
    if shm.exists():
        shutil.copy2(shm, dest.with_name(dest.name + "-shm"))
    print(dest)


if __name__ == "__main__":
    main()
