from __future__ import annotations

import hashlib
import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))

from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture()
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", future=True)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
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
        f"/v1/documents/{document_id}/versions",
        json={"storage_uri": "local://synthetic/v1", "content_hash": original_hash},
    )
    assert version_response.status_code == 201
    version_id = version_response.json()["id"]
    assert version_response.json()["version_number"] == 1

    second_response = client.post(
        f"/v1/documents/{document_id}/versions",
        json={
            "storage_uri": "local://synthetic/v2",
            "content_hash": hashlib.sha256(b"synthetic witness statement v2").hexdigest(),
        },
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
        json={"observed_hash": original_hash},
    )
    assert verified_response.status_code == 200
    assert verified_response.json()["verified"] is True

    mismatch_response = client.post(
        f"/v1/documents/{document_id}/versions/{version_id}/verify-integrity",
        json={"observed_hash": hashlib.sha256(b"tampered").hexdigest()},
    )
    assert mismatch_response.status_code == 200
    assert mismatch_response.json()["verified"] is False


def test_integrity_verification_rejects_unknown_version(client: TestClient) -> None:
    response = client.post(
        "/v1/documents/missing-document/versions/missing-version/verify-integrity",
        json={"observed_hash": "a" * 64},
    )
    assert response.status_code == 404