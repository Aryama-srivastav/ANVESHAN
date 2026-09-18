"""V1 end-to-end and feature tests.

Covers the complete Step 15 journey plus the V1 features added on top of the
core evidence API: search, ML classification/tagging, transfer, audit
verification, government identity verification and backup/recovery.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

FIR_TEXT = (
    b"FIRST INFORMATION REPORT\n"
    b"Police Station: Connaught Place\n"
    b"Complainant: Shri Rajesh Kumar\n"
    b"FIR No 123/2026 dated 12/03/2026\n"
    b"Recovered cash Rs. 5,00,000 from the accused.\n"
    b"Case diary forwarded to the Court of the Sessions Judge.\n"
)


def _create_case(env, number: str = "CASE-V1-001") -> str:
    response = env.client.post(
        "/v1/cases", json={"case_number": number, "title": "Synthetic V1 investigation"}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_document(env, case_id: str, title: str = "First information report") -> str:
    response = env.client.post(
        "/v1/documents",
        json={
            "case_id": case_id,
            "title": title,
            "doc_type": "fir",
            "sensitivity_level": "restricted",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _upload(env, document_id: str, content: bytes = FIR_TEXT, name: str = "fir.txt"):
    return env.client.post(
        f"/v1/documents/{document_id}/upload",
        files={"file": (name, content, "text/plain")},
    )


def test_full_v1_journey(v1) -> None:
    """Login -> case -> upload -> classification -> integrity -> signature ->
    search -> version -> transfer -> audit -> blockchain verification."""
    # --- Steps 1-3: case + document ---------------------------------------
    case_id = _create_case(v1)
    assert v1.client.get(f"/v1/cases/{case_id}").json()["case_number"] == "CASE-V1-001"
    document_id = _create_document(v1, case_id)

    # --- Steps 4/6: upload, server-side SHA-256, encrypted storage --------
    upload = _upload(v1, document_id)
    assert upload.status_code == 201, upload.text
    version = upload.json()
    assert version["version_number"] == 1
    assert version["content_hash"] == hashlib.sha256(FIR_TEXT).hexdigest()

    # --- Step 5: original preserved ---------------------------------------
    original = v1.client.get(f"/v1/documents/{document_id}/original")
    assert original.status_code == 200
    assert original.json()["document_id"] == document_id

    # --- Step 6: integrity verification -----------------------------------
    verify = v1.client.post(
        f"/v1/documents/{document_id}/versions/{version['id']}/verify-integrity"
    )
    assert verify.status_code == 200
    assert verify.json()["verified"] is True

    # --- Step 7: digital signature ----------------------------------------
    signature = v1.client.post(
        f"/v1/documents/{document_id}/versions/{version['id']}/sign"
    )
    assert signature.status_code == 201
    signature_id = signature.json()["id"]
    signature_verify = v1.client.post(
        f"/v1/documents/{document_id}/versions/{version['id']}/signatures/{signature_id}/verify"
    )
    assert signature_verify.json()["verified"] is True
    listed = v1.client.get(
        f"/v1/documents/{document_id}/versions/{version['id']}/signatures"
    )
    assert listed.status_code == 200 and len(listed.json()) == 1

    # --- Step 9: ML classification and tagging ----------------------------
    suggestions = v1.client.get(f"/v1/documents/{document_id}/ml-suggestions")
    assert suggestions.status_code == 200
    body = suggestions.json()
    assert body["status"] == "pending", "suggestions must stay pending until accepted"
    assert body["category"] == "fir", body
    assert body["confidence"] > 0
    assert body["tags"]

    accepted = v1.client.post(
        f"/v1/documents/{document_id}/ml-suggestions/accept", json={}
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    document_tags = v1.client.get(f"/v1/documents/{document_id}/tags").json()
    assert document_tags, "accepted tags should be linked to the document"

    # --- Step 8: search ----------------------------------------------------
    hit = v1.client.get("/v1/search", params={"q": "first information report"})
    assert hit.status_code == 200
    payload = hit.json()
    assert payload["total"] >= 1
    assert payload["hits"][0]["document_id"] == document_id
    assert payload["hits"][0]["case_number"] == "CASE-V1-001"
    assert payload["hits"][0]["matched_fields"]

    nothing = v1.client.get("/v1/search", params={"q": "quantum blockchain saigon"})
    assert nothing.json()["total"] == 0

    by_entity = v1.client.get("/v1/search", params={"entity": "police station"})
    assert by_entity.json()["total"] >= 1

    by_doc_type = v1.client.get("/v1/search", params={"doc_type": "fir"})
    assert by_doc_type.json()["total"] >= 1

    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    assert v1.client.get("/v1/search", params={"from_date": future}).json()["total"] == 0
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert v1.client.get("/v1/search", params={"to_date": past}).json()["total"] == 0
    assert v1.client.get("/v1/search", params={"q": "court"}).json()["facets"]["doc_types"]

    # --- Steps 5/6: new version, original still retrievable ---------------
    second = _upload(
        v1, document_id, FIR_TEXT + b"\nAddendum: second statement recorded.\n", "fir_v2.txt"
    )
    assert second.status_code == 201 and second.json()["version_number"] == 2
    summary = v1.client.get(
        f"/v1/documents/{document_id}/integrity-summary", params={"verify": "true"}
    ).json()
    assert len(summary["versions"]) == 2
    assert summary["intact"] is True
    assert summary["versions"][0]["is_original"] is True
    original_bytes = v1.client.get(
        f"/v1/documents/{document_id}/versions/{version['id']}/content"
    ).content
    assert original_bytes == FIR_TEXT

    # --- Step 10: secure transfer -----------------------------------------
    assert len(v1.client.get("/v1/transfers").json()) == 0
    transfer = v1.client.post(
        "/v1/transfers",
        json={
            "document_id": document_id,
            "to_user_id": v1.ids["recipient"],
            "transfer_purpose": "Cyber cell forensic review",
            "access_level": "read",
        },
    )
    assert transfer.status_code == 201, transfer.text
    transfer_id = transfer.json()["id"]
    assert transfer.json()["status"] == "pending"
    assert len(transfer.json()["transfer_hash"]) == 64

    # The recipient has no access until the transfer is accepted.
    assert (
        v1.client.get(f"/v1/documents/{document_id}", headers=v1.as_("recipient")).status_code
        == 403
    )

    accepted_transfer = v1.client.post(
        f"/v1/transfers/{transfer_id}/accept", headers=v1.as_("recipient")
    )
    assert accepted_transfer.status_code == 200, accepted_transfer.text
    assert accepted_transfer.json()["status"] == "accepted"
    assert (
        v1.client.get(f"/v1/documents/{document_id}", headers=v1.as_("recipient")).status_code
        == 200
    )

    detail = v1.client.get(f"/v1/transfers/{transfer_id}").json()
    assert detail["document_title"] == "First information report"
    assert len(detail["audit_reference"]) >= 2

    # --- Step 13: audit trail + blockchain verification -------------------
    ledger = v1.client.get(f"/v1/documents/{document_id}/audit-trail")
    assert ledger.status_code == 200
    records = ledger.json()
    assert len(records) >= 5
    assert all(record["ledger_provider"] == "local" for record in records)
    assert all(record["transaction_id"] for record in records)

    verification = v1.client.get(f"/v1/audit-trail/{records[0]['id']}/verify")
    assert verification.status_code == 200
    assert verification.json()["verified"] is True
    assert verification.json()["chain_linked"] is True

    chain = v1.client.get("/v1/audit-trail/chain/verify", headers=v1.as_("auditor"))
    assert chain.status_code == 200
    assert chain.json()["intact"] is True

    # Ledger listing is restricted to administrators and auditors.
    assert v1.client.get("/v1/audit-trail").status_code == 403
    assert v1.client.get("/v1/audit-trail", headers=v1.as_("auditor")).status_code == 200


def test_ml_suggestions_require_human_confirmation_and_allow_override(v1) -> None:
    """Suggestions never touch the document until an officer confirms them."""
    case_id = _create_case(v1, "CASE-ML-001")
    document_id = _create_document(v1, case_id, "Witness deposition")
    assert _upload(v1, document_id, FIR_TEXT, "statement.txt").status_code == 201

    assert v1.client.get(f"/v1/documents/{document_id}/tags").json() == []
    pending = v1.client.get(f"/v1/documents/{document_id}/ml-suggestions").json()
    assert pending["status"] == "pending"

    overridden = v1.client.post(
        f"/v1/documents/{document_id}/ml-suggestions/accept",
        json={"tags": ["Custom Review Tag"], "category": "charge_sheet"},
    )
    assert overridden.status_code == 200
    body = overridden.json()
    assert body["status"] == "accepted"
    assert body["category"] == "charge_sheet"
    assert "custom review tag" in body["tags"]

    linked = {tag["name"] for tag in v1.client.get(f"/v1/documents/{document_id}/tags").json()}
    assert "custom review tag" in linked

    # Re-classification resets the review state back to pending.
    again = v1.client.post(f"/v1/documents/{document_id}/classify")
    assert again.status_code == 200
    assert again.json()["status"] == "pending"


def test_government_identity_verification_masks_and_audits(v1) -> None:
    good = v1.client.post(
        "/v1/identity-verifications/gov-api",
        json={
            "user_id": v1.ids["investigator"],
            "id_type": "aadhaar",
            "id_number": "234567890123",
            "full_name": "Investigator",
        },
    )
    assert good.status_code == 200, good.text
    assert good.json()["status"] == "verified"
    assert good.json()["reference"].startswith("LOCAL-")

    bad = v1.client.post(
        "/v1/identity-verifications/gov-api",
        json={"user_id": v1.ids["investigator"], "id_type": "aadhaar", "id_number": "123456789012"},
    )
    assert bad.json()["status"] == "failed"

    history = v1.client.get(f"/v1/users/{v1.ids['investigator']}/identity-verifications")
    assert history.status_code == 200
    assert len(history.json()) == 2
    # The raw identifier must never be persisted.
    assert all("234567890123" not in (row["notes"] or "") for row in history.json())
    assert any("0123" in (row["notes"] or "") for row in history.json())

    # Another user cannot verify somebody else.
    assert (
        v1.client.post(
            "/v1/identity-verifications/gov-api",
            json={"user_id": v1.ids["investigator"], "id_type": "pan", "id_number": "ABCDE1234F"},
            headers=v1.as_("recipient"),
        ).status_code
        == 403
    )


def test_external_records_are_allow_listed_and_scoped(v1) -> None:
    case_id = _create_case(v1, "CASE-EXT-001")
    rejected = v1.client.post(
        "/v1/external-records",
        json={"case_id": case_id, "source_system": "random_source", "external_record_id": "X-1"},
    )
    assert rejected.status_code == 400

    accepted = v1.client.post(
        "/v1/external-records",
        json={"case_id": case_id, "source_system": "Nyaya", "external_record_id": "NY-2026-77"},
    )
    assert accepted.status_code == 201, accepted.text

    listed = v1.client.get(f"/v1/cases/{case_id}/external-records")
    assert listed.status_code == 200
    assert [row["source_system"] for row in listed.json()] == ["nyaya"]

    # Users without a grant on the case cannot read its external records.
    assert (
        v1.client.get(f"/v1/cases/{case_id}/external-records", headers=v1.as_("recipient")).status_code
        == 403
    )


def test_search_is_scoped_to_authorized_cases(v1) -> None:
    own_case = _create_case(v1, "CASE-SCOPE-A")
    own_document = _create_document(v1, own_case, "Shared keyword alpha report")
    assert _upload(v1, own_document, b"shared keyword alpha evidence", "alpha.txt").status_code == 201

    other_case = _create_case(v1, "CASE-SCOPE-B")
    other_document = _create_document(v1, other_case, "Shared keyword alpha report two")
    assert _upload(v1, other_document, b"shared keyword alpha evidence", "alpha2.txt").status_code == 201

    # Move the second case out of the investigator's reach.
    db = v1.session_factory()
    from app.models import AuthorizedAccess

    for grant in db.query(AuthorizedAccess).filter(AuthorizedAccess.case_id == other_case).all():
        db.delete(grant)
    db.commit()
    db.close()

    investigator = v1.client.get("/v1/search", params={"q": "shared keyword alpha"}).json()
    assert investigator["total"] == 1
    assert investigator["hits"][0]["document_id"] == own_document

    everything = v1.client.get(
        "/v1/search", params={"q": "shared keyword alpha"}, headers=v1.as_("admin")
    ).json()
    assert everything["total"] == 2


def test_ledger_tampering_is_detected(v1) -> None:
    case_id = _create_case(v1, "CASE-TAMPER-001")
    document_id = _create_document(v1, case_id, "Tamper detection")
    assert _upload(v1, document_id).status_code == 201

    records = v1.client.get(f"/v1/documents/{document_id}/audit-trail").json()
    target = records[0]
    assert v1.client.get(f"/v1/audit-trail/{target['id']}/verify").json()["verified"] is True

    db = v1.session_factory()
    from app.models import AuditLedgerRecord

    row = db.get(AuditLedgerRecord, target["id"])
    row.payload_hash = "0" * 64
    db.commit()
    db.close()

    tampered = v1.client.get(f"/v1/audit-trail/{target['id']}/verify").json()
    assert tampered["verified"] is False
    assert "altered" in tampered["detail"]
    assert v1.client.get("/v1/audit-trail/chain/verify", headers=v1.as_("auditor")).json()["intact"] is False


def test_backup_status_endpoint_is_admin_only(v1) -> None:
    assert v1.client.get("/v1/ops/backup/status").status_code == 403
    admin = v1.client.get("/v1/ops/backup/status", headers=v1.as_("admin"))
    assert admin.status_code == 200
    assert "backup_dir" in admin.json()
    assert admin.json()["database_scheme"] in {"sqlite", "postgresql"}


def test_versioned_health_endpoint(v1) -> None:
    assert v1.client.get("/v1/health").json()["status"] in {"ok", "degraded"}