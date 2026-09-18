"""Backup and recovery automation (V1 — "Backup & Recovery" requirement).

What gets backed up
-------------------
1. **Database** — SQLite files are copied; PostgreSQL is dumped with ``pg_dump``
   when it is available on ``PATH`` (point-in-time recovery remains the managed
   instance's job; this module produces the logical snapshot).
2. **Evidence objects** — the local object-storage directory is archived. For
   Supabase/S3 storage the manifest records the provider and object count so the
   provider's own versioning can be reconciled against it.
3. **Manifest** — SHA-256 of every artifact, so a restore can prove it is
   replaying intact bytes rather than trusting a filename.

Everything here is dependency-free and safe by default: a restore refuses to
overwrite a live database unless ``--force`` is passed.

Usage (from ``backend/``)::

    python -m app.backup create
    python -m app.backup list
    python -m app.backup verify  <backup-dir>
    python -m app.backup restore <backup-dir> --force
"""


import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_BACKUP_DIR = "backups"
MANIFEST_NAME = "manifest.json"


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _database_url() -> str:
    return os.getenv("DATABASE_URL", "sqlite:///./anveshan.db")


def _storage_root() -> Path:
    return Path(os.getenv("OBJECT_STORAGE_DIR", "backend/uploads"))


def _sqlite_path(url: str) -> Path | None:
    if not url.startswith("sqlite"):
        return None
    return Path(url.split("sqlite:///")[-1])


def database_scheme() -> str:
    return "sqlite" if _database_url().startswith("sqlite") else "postgresql"


def backup_root() -> Path:
    return Path(os.getenv("BACKUP_DIR", DEFAULT_BACKUP_DIR))


def list_backups() -> list[dict]:
    """Return every backup on disk, newest first."""
    root = backup_root()
    if not root.is_dir():
        return []
    found: list[dict] = []
    for entry in sorted(root.iterdir(), reverse=True):
        manifest = entry / MANIFEST_NAME
        if not (entry.is_dir() and manifest.is_file()):
            continue
        try:
            payload = json.loads(manifest.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        payload["path"] = str(entry)
        found.append(payload)
    return found


def create_backup(destination: Optional[str] = None) -> dict:
    """Create a timestamped backup of the database and the evidence store."""
    root = Path(destination) if destination else backup_root()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    target = root / f"anveshan-{stamp}"
    target.mkdir(parents=True, exist_ok=True)

    artifacts: list[dict] = []

    if database_scheme() == "sqlite":
        source = _sqlite_path(_database_url())
        if source is None or not source.is_file():
            raise FileNotFoundError(f"SQLite database not found: {source}")
        copied = target / "database.sqlite3"
        shutil.copy2(source, copied)
        artifacts.append({"name": copied.name, "sha256": _sha256_file(copied), "bytes": copied.stat().st_size})
    else:
        dump_path = target / "database.sql"
        with dump_path.open("wb") as handle:
            try:
                subprocess.run(["pg_dump", "--no-owner", _database_url()], check=True, stdout=handle)
            except (OSError, subprocess.CalledProcessError) as exc:
                raise RuntimeError(
                    "pg_dump is required to back up PostgreSQL, or use the managed instance snapshot"
                ) from exc
        artifacts.append({"name": dump_path.name, "sha256": _sha256_file(dump_path), "bytes": dump_path.stat().st_size})

    storage = _storage_root()
    objects: list[dict] = []
    if storage.is_dir():
        archive = target / "evidence-store.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
            for path in storage.rglob("*"):
                if path.is_file():
                    bundle.write(path, path.relative_to(storage).as_posix())
                    objects.append({"path": path.relative_to(storage).as_posix(), "sha256": _sha256_file(path)})
        artifacts.append({"name": archive.name, "sha256": _sha256_file(archive), "bytes": archive.stat().st_size})

    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "database_scheme": database_scheme(),
        "storage_root": str(storage.resolve()),
        "storage_provider": os.getenv("OBJECT_STORAGE_PROVIDER", "local").lower(),
        "encryption_enabled": os.getenv("DOCUMENT_ENCRYPTION_ENABLED", "true").lower() in {"1", "true", "yes", "on"},
        "object_count": len(objects),
        "artifacts": artifacts,
    }
    (target / MANIFEST_NAME).write_text(json.dumps({**manifest, "objects": objects}, indent=2), encoding="utf-8")
    manifest["path"] = str(target)
    return manifest


def verify_backup(backup_dir: str) -> dict:
    """Re-hash every artifact and confirm the backup is internally consistent."""
    directory = Path(backup_dir)
    manifest_path = directory / MANIFEST_NAME
    if not manifest_path.is_file():
        raise FileNotFoundError(f"No {MANIFEST_NAME} in {directory}")
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))

    problems: list[dict] = []
    for artifact in payload.get("artifacts", []):
        candidate = directory / artifact["name"]
        if not candidate.is_file():
            problems.append({"name": artifact["name"], "issue": "missing"})
        elif _sha256_file(candidate) != artifact["sha256"]:
            problems.append({"name": artifact["name"], "issue": "hash_mismatch"})
    return {"path": str(directory), "intact": not problems, "problems": problems}


def restore_backup(backup_dir: str, force: bool = False) -> dict:
    """Restore the database (and the evidence store when ``force``) from a backup."""
    verification = verify_backup(backup_dir)
    if not verification["intact"]:
        raise RuntimeError(f"Backup failed verification: {verification['problems']}")

    directory = Path(backup_dir)
    payload = json.loads((directory / MANIFEST_NAME).read_text(encoding="utf-8"))
    restored: list[str] = []

    if payload.get("database_scheme") == "sqlite":
        target = _sqlite_path(_database_url())
        source = directory / "database.sqlite3"
        if target is None:
            raise RuntimeError("Configured DATABASE_URL is not a SQLite URL")
        if not source.is_file():
            raise FileNotFoundError("Backup does not contain database.sqlite3")
        if target.exists() and not force:
            raise FileExistsError(f"{target} already exists — pass --force to overwrite")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        restored.append(str(target))
    else:
        raise RuntimeError("Restore PostgreSQL with psql from database.sql, or from the managed snapshot")

    archive = directory / "evidence-store.zip"
    if archive.is_file() and force:
        storage = _storage_root()
        storage.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(storage)
        restored.append(str(storage))

    return {"path": str(directory), "restored": restored}


def status() -> dict:
    return {
        "storage_provider": os.getenv("OBJECT_STORAGE_PROVIDER", "local").lower(),
        "encryption_enabled": os.getenv("DOCUMENT_ENCRYPTION_ENABLED", "true").lower() in {"1", "true", "yes", "on"},
        "backup_dir": str(backup_root().resolve()),
        "database_scheme": database_scheme(),
        "backups": [{key: value for key, value in item.items() if key != "objects"} for item in list_backups()],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.backup", description="ANVESHAN backup and recovery")
    sub = parser.add_subparsers(dest="command", required=True)

    create_parser = sub.add_parser("create", help="create a new backup")
    create_parser.add_argument("--destination", default=None)

    sub.add_parser("list", help="list backups")

    verify_parser = sub.add_parser("verify", help="verify a backup")
    verify_parser.add_argument("directory")

    restore_parser = sub.add_parser("restore", help="restore from a backup")
    restore_parser.add_argument("directory")
    restore_parser.add_argument("--force", action="store_true")

    args = parser.parse_args(argv)

    if args.command == "create":
        print(json.dumps(create_backup(args.destination), indent=2))
    elif args.command == "list":
        print(json.dumps(list_backups(), indent=2))
    elif args.command == "verify":
        print(json.dumps(verify_backup(args.directory), indent=2))
    elif args.command == "restore":
        print(json.dumps(restore_backup(args.directory, force=args.force), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())