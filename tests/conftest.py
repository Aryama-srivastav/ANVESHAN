"""Pytest bootstrap for the ANVESHAN backend test-suite.

The FastAPI lifespan runs ``alembic upgrade head`` at startup against the
database selected by ``DATABASE_URL``. Without this module the tests would
migrate whatever ``anveshan.db`` happens to sit in the current working
directory — a developer's local database — which is both destructive and the
reason ``pytest tests/`` used to fail with "table roles already exists".

Everything below is configured *before* ``app.*`` is imported so that
``app.db`` binds to a throw-away database in the system temp directory.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

# Make the backend package importable no matter which test file pytest collects.
_BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

_TEST_ROOT = Path(tempfile.mkdtemp(prefix="anveshan-tests-"))

# Database: always a disposable SQLite file, never the repository database.
os.environ["DATABASE_URL"] = f"sqlite:///{(_TEST_ROOT / 'anveshan-test.db').as_posix()}"

# Storage + signing keys: disposable locations outside the repository.
os.environ["OBJECT_STORAGE_PROVIDER"] = "local"
os.environ["OBJECT_STORAGE_DIR"] = str(_TEST_ROOT / "uploads")
os.environ["SIGNING_KEY_PATH"] = str(_TEST_ROOT / "keys" / "document-signing-key.pem")

# Deterministic secrets + providers for the test environment.
os.environ["JWT_SECRET"] = "test-secret-key-that-is-at-least-32-bytes-long"
os.environ["APP_SECRET_KEY"] = "test-application-secret-key"
os.environ["BLOCKCHAIN_PROVIDER"] = "local"
os.environ["APP_ENV"] = "test"

# MFA enforcement is opt-in per test (see test_mfa_is_required_when_enabled_...).
os.environ["REQUIRE_MFA"] = "false"

import pytest  # noqa: E402


class V1Env:
    """Shared V1 test environment: one app, several identities."""

    def __init__(self, client, tokens, ids, session_factory):
        self.client = client
        self.tokens = tokens
        self.ids = ids
        self.session_factory = session_factory

    def as_(self, name: str) -> dict[str, str]:
        """Bearer headers for the named identity."""
        return {"Authorization": f"Bearer {self.tokens[name]}"}


@pytest.fixture()
def v1(tmp_path: "Path", monkeypatch: "pytest.MonkeyPatch") -> "V1Env":
    """Boot the real app against a disposable database with seeded identities.

    Imported lazily so ``tests/conftest.py``'s environment block always executes
    before ``app.db`` binds its engine.
    """
    from datetime import datetime, timedelta, timezone
    from pathlib import Path

    import jwt
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session, sessionmaker

    from app.db import get_db
    from app.main import app
    from app.models import Base, Role, User, UserRole
    from app.services import RoleService

    engine = create_engine(f"sqlite:///{(Path(tmp_path) / 'v1.db').as_posix()}", future=True)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)
    Base.metadata.create_all(bind=engine)

    secret = "test-secret-key-that-is-at-least-32-bytes-long"
    seeding = session_factory()
    RoleService.ensure_default_roles(seeding)
    roles = {role.name: role for role in seeding.query(Role).all()}

    identities = {
        "investigator": ("user", "investigator@example.test", "Forensics", "lab-a"),
        "recipient": ("user", "recipient@example.test", "Cyber Cell", "agency-b"),
        "auditor": ("auditor", "auditor@example.test", "Audit", "agency-c"),
        "admin": ("admin", "admin@example.test", "Administration", "agency-d"),
    }
    ids: dict[str, str] = {}
    for name, (role_name, email, department, agency) in identities.items():
        user = User(email=email, full_name=name.title(), department=department, agency=agency, is_active=True)
        seeding.add(user)
        seeding.flush()
        seeding.add(UserRole(user_id=user.id, role_id=roles[role_name].id))
        ids[name] = user.id
    seeding.commit()
    seeding.close()

    tokens = {
        name: jwt.encode(
            {"sub": user_id, "mfa_verified": True, "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
            secret,
            algorithm="HS256",
        )
        for name, user_id in ids.items()
    }

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        client.headers.update({"Authorization": f"Bearer {tokens['investigator']}"})
        yield V1Env(client, tokens, ids, session_factory)
    app.dependency_overrides.clear()
    engine.dispose()