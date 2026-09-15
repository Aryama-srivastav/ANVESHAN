from __future__ import annotations

import hashlib
import os
import sys
from datetime import datetime, timedelta, timezone
from collections.abc import Generator
from pathlib import Path

import pytest
import jwt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base, Role, User  # noqa: E402
from app.services import RoleService  # noqa: E402


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    monkeypatch.setenv("OBJECT_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("OBJECT_STORAGE_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("JWT_SECRET", "test-secret-key-that-is-at-least-32-bytes-long")
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", future=True)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)
    Base.metadata.create_all(bind=engine)
    seed_roles = testing_session()
    RoleService.ensure_default_roles(seed_roles)
    seed_roles.close()
    seed_session = testing_session()
    actor = User(email="investigator@example.test", full_name="Synthetic Investigator")
    seed_session.add(actor)
    seed_session.commit()
    seed_session.refresh(actor)
    token = jwt.encode(
        {"sub": actor.id, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "test-secret-key-that-is-at-least-32-bytes-long",
        algorithm="HS256",
    )
    seed_session.close()

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        test_client.headers.update({"Authorization": f"Bearer {token}"})
        test_client.actor_id = actor.id
        test_client.testing_session = testing_session
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_case_document_versions_and_integrity_verification(client: TestClient) -> None:
    case_response = client.post(
        "/v1/cases",
        json={"case_number": "CASE-001", "title": "Synthetic investigation"},
    )
    assert case_response.status_code == 201
    case_id = case_response.json()["id"]

    document_response = client.post(
        "/v1/documents",
        json={
            "case_id": case_id,
            "title": "Synthetic witness statement",
            "doc_type": "statement",
            "metadata": {"source": "synthetic-demo", "page_count": "2"},
        },
    )
    assert document_response.status_code == 201
    document_id = document_response.json()["id"]

    original_content = b"synthetic witness statement v1"
    original_hash = hashlib.sha256(original_content).hexdigest()
    version_response = client.post(
        f"/v1/documents/{document_id}/upload",
        files={"file": ("statement.txt", original_content, "text/plain")},
    )
    assert version_response.status_code == 201
    version_id = version_response.json()["id"]
    assert version_response.json()["version_number"] == 1

    second_response = client.post(
        f"/v1/documents/{document_id}/upload",
        files={"file": ("statement-v2.txt", b"synthetic witness statement v2", "text/plain")},
    )
    assert second_response.status_code == 201
    assert second_response.json()["version_number"] == 2

    detail_response = client.get(f"/v1/documents/{document_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["metadata"]["source"] == "synthetic-demo"
    assert detail_response.json()["version_count"] == 2

    versions_response = client.get(f"/v1/documents/{document_id}/versions")
    assert versions_response.status_code == 200
    assert [version["version_number"] for version in versions_response.json()] == [1, 2]

    verified_response = client.post(
        f"/v1/documents/{document_id}/versions/{version_id}/verify-integrity",
    )
    assert verified_response.status_code == 200
    assert verified_response.json()["verified"] is True

    storage_path = Path(os.environ["OBJECT_STORAGE_DIR"]) / version_response.json()["storage_uri"].removeprefix("local://")
    storage_path.write_bytes(b"tampered stored bytes")
    mismatch_response = client.post(
        f"/v1/documents/{document_id}/versions/{version_id}/verify-integrity",
    )
    assert mismatch_response.status_code == 200
    assert mismatch_response.json()["observed_hash"] != original_hash
    assert mismatch_response.json()["verified"] is False


def test_integrity_verification_rejects_unknown_version(client: TestClient) -> None:
    response = client.post(
        "/v1/documents/missing-document/versions/missing-version/verify-integrity",
    )
    assert response.status_code == 404


def test_upload_calculates_hash_and_stores_bytes(client: TestClient) -> None:
    case_response = client.post(
        "/v1/cases",
        json={"case_number": "CASE-UPLOAD", "title": "Upload test"},
    )
    case_id = case_response.json()["id"]
    document_response = client.post(
        "/v1/documents",
        json={"case_id": case_id, "title": "Uploaded evidence", "doc_type": "text"},
    )
    document_id = document_response.json()["id"]
    content = b"evidence bytes are hashed from the upload stream"
    expected_hash = hashlib.sha256(content).hexdigest()

    response = client.post(
        f"/v1/documents/{document_id}/upload",
        files={"file": ("evidence.txt", content, "text/plain")},
        data={"notes": "Synthetic upload"},
    )

    assert response.status_code == 201
    version = response.json()
    assert version["version_number"] == 1
    assert version["content_hash"] == expected_hash
    assert version["storage_uri"].startswith("local://")

    content_response = client.get(
        f"/v1/documents/{document_id}/versions/{version['id']}/content"
    )
    assert content_response.status_code == 200
    assert content_response.content == content

    detail = client.get(f"/v1/documents/{document_id}").json()
    assert detail["version_count"] == 1


def test_case_custody_events_are_appended_and_chained(client: TestClient) -> None:
    case_response = client.post(
        "/v1/cases",
        json={"case_number": "CASE-CUSTODY", "title": "Custody tracking test"},
    )
    assert case_response.status_code == 201
    case_id = case_response.json()["id"]

    first_event = client.post(
        f"/v1/cases/{case_id}/events",
        json={
            "event_type": "acquisition",
            "action": "Evidence received from source",
            "details": {"source": "evidence locker", "device": "mobile-lab-01"},
        },
    )
    assert first_event.status_code == 201
    first_data = first_event.json()
    assert first_data["previous_event_hash"] is None
    assert first_data["event_hash"]

    second_event = client.post(
        f"/v1/cases/{case_id}/events",
        json={
            "event_type": "review",
            "action": "Supervisor reviewed evidence",
            "details": {"reviewer": "investigator-2"},
        },
    )
    assert second_event.status_code == 201
    second_data = second_event.json()
    assert second_data["previous_event_hash"] == first_data["event_hash"]

    events_response = client.get(f"/v1/cases/{case_id}/events")
    assert events_response.status_code == 200
    event_types = [item["event_type"] for item in events_response.json()]
    assert event_types == ["acquisition", "review"]


def test_mfa_is_required_when_enabled_for_the_environment(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REQUIRE_MFA", "true")
    db = client.testing_session()
    user = db.get(User, client.actor_id)
    assert user is not None
    user.mfa_enabled = True
    db.commit()
    db.close()

    token = jwt.encode(
        {"sub": client.actor_id, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "test-secret-key-that-is-at-least-32-bytes-long",
        algorithm="HS256",
    )
    response = client.get("/v1/cases", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert "MFA" in response.json()["detail"]


def test_default_roles_and_abac_metadata_are_available(client: TestClient) -> None:
    db = client.testing_session()
    assert {role.name for role in db.query(Role).all()} == {"user", "admin", "auditor"}
    db.close()

    case_response = client.post(
        "/v1/cases",
        json={"case_number": "CASE-ABAC", "title": "ABAC metadata test"},
    )
    case_id = case_response.json()["id"]
    grant_response = client.post(
        "/v1/access-grants",
        json={
            "user_id": client.actor_id,
            "case_id": case_id,
            "purpose": "department review",
            "department": "forensics",
            "agency": "lab-a",
            "sensitivity_level": "restricted",
            "access_level": "read",
        },
    )
    assert grant_response.status_code == 201
    grant = grant_response.json()
    assert grant["department"] == "forensics"
    assert grant["agency"] == "lab-a"
    assert grant["sensitivity_level"] == "restricted"


def test_unauthenticated_and_unauthorized_access_is_rejected(client: TestClient) -> None:
    unauthenticated = TestClient(app)
    response = unauthenticated.get("/v1/cases")
    assert response.status_code == 401

    case_response = client.post(
        "/v1/cases",
        json={"case_number": "CASE-AUTH", "title": "Authorization test"},
    )
    case_id = case_response.json()["id"]
    document_response = client.post(
        "/v1/documents",
        json={"case_id": case_id, "title": "Restricted evidence", "doc_type": "text"},
    )
    document_id = document_response.json()["id"]

    db = client.testing_session()
    outsider = User(email="outsider@example.test", full_name="Unauthorized User")
    db.add(outsider)
    db.commit()
    db.refresh(outsider)
    outsider_token = jwt.encode(
        {"sub": outsider.id, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "test-secret-key-that-is-at-least-32-bytes-long",
        algorithm="HS256",
    )
    db.close()

    response = client.get(
        f"/v1/documents/{document_id}",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert response.status_code == 403