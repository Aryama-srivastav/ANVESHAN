"""Tests for the UI-gap features added on top of the V1/V2 surface.

Covers:

* evidence file-type allow-listing (malicious upload rejection);
* cross-department access requests (create → list → approve/reject → authz);
* the cross-version lineage verification endpoint now wired into the UI.
"""

from __future__ import annotations

import hashlib

FIR_TEXT = (
    b"FIRST INFORMATION REPORT\n"
    b"Police Station: Connaught Place\n"
    b"Complainant: Shri Rajesh Kumar\n"
    b"Recovered cash Rs. 5,00,000 from the accused.\n"
)


def _create_case(env, number: str = "CASE-GAP-001") -> str:
    response = env.client.post(
        "/v1/cases", json={"case_number": number, "title": "UI gap coverage"}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _create_document(env, case_id: str, title: str = "Gap-coverage evidence") -> str:
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


# ---------------------------------------------------------------------------
# Evidence upload hardening — malicious file types must be rejected
# ---------------------------------------------------------------------------


def test_upload_rejects_executable_and_script_types(v1) -> None:
    """Executables, scripts and archives must never enter the evidence vault."""
    case_id = _create_case(v1)
    document_id = _create_document(v1, case_id)

    for name, content in (
        ("payload.exe", b"MZ\x90\x00\x03\x00\x00\x00"),
        ("payload.sh", b"#!/bin/sh\nrm -rf /\n"),
        ("payload.bat", b"@echo off\nformat C:\n"),
        ("payload.zip", b"PK\x03\x04"),
        ("payload.js", b"alert(document.cookie)"),
        ("payload.docx.exe", b"MZ\x90\x00"),
    ):
        rejected = _upload(v1, document_id, content, name)
        assert rejected.status_code == 400, f"{name} should be rejected: {rejected.text}"
        assert "not an allowed evidence format" in rejected.json()["detail"]

    # Nothing was written: the document still has no versions.
    assert v1.client.get(f"/v1/documents/{document_id}/versions").json() == []


def test_upload_accepts_allowed_evidence_types(v1) -> None:
    """Legitimate evidence formats still upload normally."""
    case_id = _create_case(v1, "CASE-GAP-AOK")
    document_id = _create_document(v1, case_id)

    accepted = _upload(v1, document_id, FIR_TEXT, "fir.txt")
    assert accepted.status_code == 201, accepted.text
    assert accepted.json()["version_number"] == 1

    pdf = _upload(v1, document_id, b"%PDF-1.4 fake evidence", "scan.pdf")
    assert pdf.status_code == 201, pdf.text
    assert pdf.json()["version_number"] == 2


# ---------------------------------------------------------------------------
# Cross-department access requests
# ---------------------------------------------------------------------------


def test_department_request_lifecycle_approve(v1) -> None:
    """Investigator files a request; the holding unit (admin) approves it."""
    case_id = _create_case(v1, "CASE-GAP-DEPT")
    document_id = _create_document(v1, case_id)
    assert _upload(v1, document_id).status_code == 201

    created = v1.client.post(
        "/v1/department-requests",
        json={
            "document_id": document_id,
            "purpose": "Cross-department money trail comparison",
            "requested_access_level": "read",
            "to_department": "Administration",
        },
    )
    assert created.status_code == 200, created.text
    payload = created.json()
    assert payload["status"] == "pending"
    assert payload["document_id"] == document_id
    assert payload["from_user_name"] == "Investigator"
    assert payload["to_department"] == "Administration"
    assert payload["reviewed_by_name"] is None
    request_id = payload["id"]

    # The filer sees their own request in the listing.
    mine = v1.client.get("/v1/department-requests")
    assert mine.status_code == 200
    assert [r["id"] for r in mine.json()] == [request_id]

    # A member of the destination department approves it.
    approved = v1.client.patch(
        f"/v1/department-requests/{request_id}",
        json={"status": "approved", "review_notes": "Legitimate investigative need"},
        headers=v1.as_("admin"),
    )
    assert approved.status_code == 200, approved.text
    result = approved.json()
    assert result["status"] == "approved"
    assert result["review_notes"] == "Legitimate investigative need"
    assert result["reviewed_by_name"] == "Admin"
    assert result["reviewed_at"] is not None


def test_department_request_rejection(v1) -> None:
    """The destination department can reject, and the reason is recorded."""
    case_id = _create_case(v1, "CASE-GAP-REJ")
    document_id = _create_document(v1, case_id)
    assert _upload(v1, document_id).status_code == 201

    request_id = v1.client.post(
        "/v1/department-requests",
        json={
            "document_id": document_id,
            "purpose": "Speculative fishing expedition",
            "to_department": "Administration",
        },
    ).json()["id"]

    rejected = v1.client.patch(
        f"/v1/department-requests/{request_id}",
        json={"status": "rejected", "review_notes": "No stated investigative nexus"},
        headers=v1.as_("admin"),
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["review_notes"] == "No stated investigative nexus"


def test_department_request_review_requires_destination_department(v1) -> None:
    """An unrelated officer cannot review somebody else's request."""
    case_id = _create_case(v1, "CASE-GAP-AUTHZ")
    document_id = _create_document(v1, case_id)
    assert _upload(v1, document_id).status_code == 201

    request_id = v1.client.post(
        "/v1/department-requests",
        json={
            "document_id": document_id,
            "purpose": "Need to review the file",
            "to_department": "Administration",
        },
    ).json()["id"]

    # The "recipient" identity belongs to Cyber Cell, not Administration.
    forbidden = v1.client.patch(
        f"/v1/department-requests/{request_id}",
        json={"status": "approved"},
        headers=v1.as_("recipient"),
    )
    assert forbidden.status_code == 403, forbidden.text
    assert "destination department" in forbidden.json()["detail"]

    # It is still pending — the unauthorized call changed nothing.
    still_pending = v1.client.get("/v1/department-requests")
    assert still_pending.json()[0]["status"] == "pending"


def test_department_request_unknown_document_is_404(v1) -> None:
    missing = v1.client.post(
        "/v1/department-requests",
        json={"document_id": "00000000-0000-0000-0000-000000000000", "purpose": "Ghost file"},
    )
    assert missing.status_code == 404


# ---------------------------------------------------------------------------
# Cross-version lineage verification (wired into the evidence detail modal)
# ---------------------------------------------------------------------------


def test_lineage_verification_reports_intact_chain(v1) -> None:
    """A pristine document must verify across file, record and chain checks."""
    case_id = _create_case(v1, "CASE-GAP-LIN")
    document_id = _create_document(v1, case_id)
    assert _upload(v1, document_id).status_code == 201
    assert _upload(v1, document_id, FIR_TEXT + b"Amendment\n", "fir-v2.txt").status_code == 201

    lineage = v1.client.get(f"/v1/documents/{document_id}/lineage")
    assert lineage.status_code == 200, lineage.text
    body = lineage.json()
    assert body["document_id"] == document_id
    assert body["intact"] is True, body["issues"]
    assert body["issues"] == []

    versions = sorted(body["versions"], key=lambda v: v["version_number"])
    assert [v["version_number"] for v in versions] == [1, 2]
    assert versions[0]["is_original"] is True
    for version in versions:
        assert version["byte_status"] == "verified"
        assert version["record_status"] == "anchored"
        assert version["anchored_hash"] == version["recorded_hash"]

    # The first version's recorded hash is the SHA-256 of the original bytes.
    assert versions[0]["recorded_hash"] == hashlib.sha256(FIR_TEXT).hexdigest()

