"""Backup and recovery tests (V1 — "Backup & Recovery" requirement)."""

from __future__ import annotations

from pathlib import Path

import pytest


def _prepare(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    from app import backup

    database = tmp_path / "anveshan.db"
    database.write_bytes(b"synthetic-sqlite-bytes")
    storage = tmp_path / "uploads" / "cases" / "c1"
    storage.mkdir(parents=True)
    (storage / "object.bin").write_bytes(b"ANVESHAN-E1-ciphertext")

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database.as_posix()}")
    monkeypatch.setenv("OBJECT_STORAGE_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("BACKUP_DIR", str(tmp_path / "backups"))
    return database


def test_backup_create_verify_and_restore(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app import backup

    database = _prepare(tmp_path, monkeypatch)

    manifest = backup.create_backup()
    assert manifest["database_scheme"] == "sqlite"
    assert manifest["object_count"] == 1
    assert len(manifest["artifacts"]) == 2
    assert backup.verify_backup(manifest["path"])["intact"] is True

    # A modified artifact must fail verification rather than silently restore.
    (Path(manifest["path"]) / "database.sqlite3").write_bytes(b"tampered")
    assert backup.verify_backup(manifest["path"])["intact"] is False
    with pytest.raises(RuntimeError):
        backup.restore_backup(manifest["path"], force=True)

    # A fresh, intact backup restores, but never clobbers without --force.
    database.write_bytes(b"synthetic-sqlite-bytes-v2")
    clean = backup.create_backup()
    with pytest.raises(FileExistsError):
        backup.restore_backup(clean["path"])
    restored = backup.restore_backup(clean["path"], force=True)
    assert str(database) in restored["restored"]
    assert database.read_bytes() == b"synthetic-sqlite-bytes-v2"
    # The evidence store came back too.
    assert (tmp_path / "uploads" / "cases" / "c1" / "object.bin").is_file()


def test_backup_status_reports_inventory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app import backup

    _prepare(tmp_path, monkeypatch)
    assert backup.list_backups() == []
    backup.create_backup()
    state = backup.status()
    assert state["database_scheme"] == "sqlite"
    assert len(state["backups"]) == 1
    assert "objects" not in state["backups"][0]