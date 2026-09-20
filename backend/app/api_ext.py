"""ANVESHAN V1 extension router.

Implements the V1 workflow steps that build on top of the core evidence API:

* Step 8  — semantic / temporal / entity search
* Step 9  — ML classification and tagging (with human confirmation)
* Step 10 — secure inter-department / inter-agency transfer
* Step 11 — government identity verification
* Step 13 — audit-trail listing, record verification and chain verification
* plus the deferred read endpoints (original record, integrity summary,
  signature list, external-record listings) and ops endpoints.

Keeping these in a separate module means ``api.py`` stays the stable core
evidence API while the workflow surface grows here.
"""

from __future__ import annotations


import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import get_current_user
from .backup import status as backup_status
from .classification import ClassificationService
from .db import get_db
from .govid import GovIdError, GovIdVerificationAdapter, mask_identifier
from .ledger import AuditLedger
from .search import SearchService
from .services import (
    AccessService,
    CaseEventService,
    DepartmentRequestService,
    DepartmentService,
    DEPARTMENT_MATRIX,
    DocumentService,
    validate_external_source,
)
from .transfers import TransferError, TransferService

router = APIRouter(prefix="/v1", tags=["v1"], dependencies=[Depends(get_current_user)])

# Unauthenticated surface: citizens raise and track Nyaya complaints with just
# their email and the returned token.
public_router = APIRouter(prefix="/v1", tags=["public"])

DEPARTMENT_KEYS = frozenset(DEPARTMENT_MATRIX.keys())


# ---------------------------------------------------------------------------
# Step 8 — Search and retrieval
# ---------------------------------------------------------------------------


@router.get("/search", response_model=schemas.SearchResponseOut)
def search_evidence(
    q: str = Query("", description="Free-text / natural-language query"),
    case_id: Optional[str] = None,
    from_date: datetime | None = Query(None, description="Only documents active on/after this time"),
    to_date: datetime | None = Query(None, description="Only documents active on/before this time"),
    entity: Optional[str] = Query(None, description="Named entity, tag or metadata value"),
    doc_type: Optional[str] = None,
    sensitivity: Optional[str] = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.SearchResponseOut:
    try:
        return SearchService.search(
            db,
            current_user,
            query=q,
            case_id=case_id,
            from_date=from_date,
            to_date=to_date,
            entity=entity,
            doc_type=doc_type,
            sensitivity=sensitivity,
            limit=limit,
            offset=offset,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Step 13 — Audit trail and blockchain verification
# ---------------------------------------------------------------------------


@router.get("/audit-trail", response_model=list[schemas.AuditTrailRecordOut])
def list_audit_trail(
    case_id: Optional[str] = None,
    document_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.AuditTrailRecordOut]:
    """Full ledger listing — administrator and auditor only."""
    try:
        AccessService.require_role(db, current_user.id, "admin", "auditor")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    stmt = (
        select(models.AuditLedgerRecord)
        .order_by(models.AuditLedgerRecord.created_at.desc(), models.AuditLedgerRecord.id.desc())
        .offset(offset)
        .limit(limit)
    )
    if case_id:
        stmt = stmt.where(models.AuditLedgerRecord.case_id == case_id)
    if document_id:
        stmt = stmt.where(models.AuditLedgerRecord.document_id == document_id)
    return list(db.scalars(stmt))


@router.get("/audit-trail/chain/verify")
def verify_audit_chain(
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> dict:
    """Walk the whole ledger and report every broken hash or broken link."""
    try:
        AccessService.require_role(db, current_user.id, "admin", "auditor")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    problems = AuditLedger.verify_chain(db, limit=limit)
    return {"checked_limit": limit, "intact": not problems, "problems": problems}


@router.get("/audit-trail/{record_id}/verify", response_model=schemas.AuditTrailVerifyOut)
def verify_audit_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.AuditTrailVerifyOut:
    """Re-compute a single ledger record hash and check its chain link.

    Administrators and auditors may verify any record; everybody else may verify
    records belonging to evidence they are authorized to read.
    """
    result = AuditLedger.verify(db, record_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Audit record not found")
    record, verified, observed_hash, chain_linked = result

    if not AccessService.has_role(db, current_user.id, "admin", "auditor"):
        try:
            if record.document_id:
                document = DocumentService.get(db, record.document_id)
                AccessService.require_document_access(db, current_user.id, document)
            elif record.case_id:
                AccessService.require_case_access(db, current_user.id, record.case_id)
            else:
                raise PermissionError("Auditor role required for system-level audit records")
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
    if verified and chain_linked:
        detail = "Record hash matches the stored hash and the chain link is intact."
    elif verified:
        detail = "Record hash matches but the chain link to the previous record is broken."
    else:
        detail = "Record hash does not match — the ledger record has been altered."
    return schemas.AuditTrailVerifyOut(
        record_id=record.id,
        verified=verified,
        expected_hash=record.record_hash,
        observed_hash=observed_hash,
        chain_linked=chain_linked,
        ledger_provider=record.ledger_provider,
        transaction_id=record.transaction_id,
        detail=detail,
    )


@router.get("/cases/{case_id}/ledger", response_model=list[schemas.AuditTrailRecordOut])
def list_case_ledger(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.AuditTrailRecordOut]:
    """Ledger records for one case — available to anybody with case access."""
    case = db.get(models.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        AccessService.require_case_access(db, current_user.id, case_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    stmt = (
        select(models.AuditLedgerRecord)
        .where(models.AuditLedgerRecord.case_id == case_id)
        .order_by(models.AuditLedgerRecord.created_at.desc())
    )
    return list(db.scalars(stmt))


@router.get("/documents/{document_id}/audit-trail", response_model=list[schemas.AuditTrailRecordOut])
def list_document_ledger(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.AuditTrailRecordOut]:
    """Ledger records for one document — requires document read access."""
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    stmt = (
        select(models.AuditLedgerRecord)
        .where(models.AuditLedgerRecord.document_id == document_id)
        .order_by(models.AuditLedgerRecord.created_at.desc())
    )
    return list(db.scalars(stmt))


# ---------------------------------------------------------------------------
# Step 9 — ML classification and tagging
# ---------------------------------------------------------------------------


@router.get("/documents/{document_id}/ml-suggestions", response_model=schemas.MlSuggestionOut)
def get_ml_suggestions(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.MlSuggestionOut:
    """Predicted category, confidence, tags and entities for a document."""
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return schemas.MlSuggestionOut(**ClassificationService.suggestions(db, document))


@router.post("/documents/{document_id}/ml-suggestions/accept", response_model=schemas.MlSuggestionOut)
def accept_ml_suggestions(
    document_id: str,
    payload: schemas.MlAcceptRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.MlSuggestionOut:
    """Human confirmation — applies suggestions into the real tagging system."""
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document, "write")
        ClassificationService.accept(
            db, document, current_user.id, tags=payload.tags, category=payload.category
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return schemas.MlSuggestionOut(**ClassificationService.suggestions(db, document))


@router.post("/documents/{document_id}/classify", response_model=schemas.MlSuggestionOut)
def reclassify_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.MlSuggestionOut:
    """Re-run classification against the latest sealed version's stored bytes."""
    from .storage import StorageError, get_storage

    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document, "write")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    versions = DocumentService.list_versions(db, document_id)
    content: bytes | None = None
    if versions:
        try:
            with get_storage().open(versions[-1].storage_uri) as stream:
                content = stream.read()
        except (FileNotFoundError, StorageError):
            content = None
    ClassificationService.suggest(db, document, content, document.title)
    db.commit()
    return schemas.MlSuggestionOut(**ClassificationService.suggestions(db, document))


# ---------------------------------------------------------------------------
# Step 10 — Secure inter-department / inter-agency transfer
# ---------------------------------------------------------------------------


@router.post("/transfers", response_model=schemas.TransferOut, status_code=201)
def create_transfer(
    payload: schemas.TransferCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.TransferOut:
    """Create a transfer request. Seals a transfer hash and writes to the ledger."""
    document = DocumentService.get(db, payload.document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document, "write")
        return TransferService.create(db, document, current_user, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TransferError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/transfers", response_model=list[schemas.TransferOut])
def list_transfers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.TransferOut]:
    """Transfers the current user is a party to (administrators see all)."""
    return TransferService.list_for_user(db, current_user)


@router.get("/transfers/{transfer_id}", response_model=schemas.TransferDetailOut)
def get_transfer(
    transfer_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.TransferDetailOut:
    """Transfer detail including its ledger references."""
    try:
        transfer = TransferService.get(db, transfer_id, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    document = db.get(models.Document, transfer.document_id)
    case = db.get(models.Case, document.case_id) if document is not None else None
    ledger_rows = list(
        db.scalars(
            select(models.AuditLedgerRecord)
            .where(models.AuditLedgerRecord.document_id == transfer.document_id)
            .where(
                models.AuditLedgerRecord.event_type.in_(
                    ["document_transferred", "transfer_accepted", "transfer_rejected"]
                )
            )
            .order_by(models.AuditLedgerRecord.created_at.asc())
        )
    )
    return schemas.TransferDetailOut(
        **schemas.TransferOut.model_validate(transfer).model_dump(),
        document_title=document.title if document is not None else None,
        case_id=case.id if case is not None else None,
        case_number=case.case_number if case is not None else None,
        audit_reference=[schemas.AuditTrailRecordOut.model_validate(row) for row in ledger_rows],
    )


@router.post("/transfers/{transfer_id}/accept", response_model=schemas.TransferOut)
def accept_transfer(
    transfer_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.TransferOut:
    """Recipient accepts; the purpose-bound access grant is created here."""
    try:
        return TransferService.accept(db, transfer_id, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TransferError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/transfers/{transfer_id}/reject", response_model=schemas.TransferOut)
def reject_transfer(
    transfer_id: str,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.TransferOut:
    """Recipient (or sender) declines the handoff."""
    try:
        return TransferService.reject(db, transfer_id, current_user, reason)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TransferError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Step 11 — Government identity verification
# ---------------------------------------------------------------------------


@router.post("/identity-verifications/gov-api", response_model=schemas.GovIdVerifyOut)
def verify_identity_with_gov_api(
    payload: schemas.GovIdVerifyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.GovIdVerifyOut:
    """Verify an officer/witness identity through the configured Gov API adapter."""
    if payload.user_id != current_user.id and not AccessService._is_admin(db, current_user.id):
        raise HTTPException(status_code=403, detail="Administrator role required to verify another user")
    target = db.get(models.User, payload.user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        result = GovIdVerificationAdapter.verify(payload.id_type, payload.id_number, payload.full_name)
    except GovIdError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    record = models.IdentityVerificationRecord(
        user_id=target.id,
        verification_method=result["method"],
        verifier=GovIdVerificationAdapter.provider_name(),
        status=result["status"],
        verified_at=datetime.now(timezone.utc) if result["status"] == "verified" else None,
        # Only the masked identifier is retained — never the raw number.
        notes=f"{payload.id_type}:{mask_identifier(payload.id_number)} ref={result['reference']} — {result['detail']}",
    )
    db.add(record)
    db.flush()
    AuditLedger.record(
        db,
        event_type="identity_verified",
        actor_user_id=current_user.id,
        payload={
            "verification_id": record.id,
            "subject_user_id": target.id,
            "id_type": payload.id_type,
            "status": result["status"],
            "provider": GovIdVerificationAdapter.provider_name(),
        },
    )
    db.commit()
    db.refresh(record)
    return schemas.GovIdVerifyOut(
        verification_id=record.id,
        user_id=target.id,
        status=result["status"],
        provider=GovIdVerificationAdapter.provider_name(),
        reference=result["reference"],
        detail=result["detail"],
    )


@router.get("/users/{user_id}/identity-verifications", response_model=list[schemas.IdentityVerificationOut])
def list_identity_verifications(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.IdentityVerificationOut]:
    """Verification history for a user."""
    if user_id != current_user.id and not AccessService._is_admin(db, current_user.id):
        raise HTTPException(status_code=403, detail="Administrator role required")
    stmt = (
        select(models.IdentityVerificationRecord)
        .where(models.IdentityVerificationRecord.user_id == user_id)
        .order_by(models.IdentityVerificationRecord.verified_at.desc().nullslast())
    )
    return list(db.scalars(stmt))


# ---------------------------------------------------------------------------
# Step 12 — External record references (Criminal Records / e-Forensics / Nyaya)
# ---------------------------------------------------------------------------


def _validate_external_source(source_system: str) -> str:
    try:
        return validate_external_source(source_system)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/cases/{case_id}/external-records", response_model=list[schemas.ExternalReferenceOut])
def list_case_external_records(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.ExternalReferenceOut]:
    """External NCRBI / Prison / e-Forensics / Nyaya references linked to a case."""
    case = db.get(models.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        # External records carry agency-sensitive metadata: read is limited to
        # admins plus users holding an explicit grant on the case.
        if not (
            AccessService._is_admin(db, current_user.id)
            or AccessService._has_grant(db, current_user.id, case_id=case_id, required_level="read")
        ):
            raise PermissionError("User is not authorized for this case")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    stmt = (
        select(models.ExternalRecordReference)
        .where(models.ExternalRecordReference.case_id == case_id)
        .order_by(models.ExternalRecordReference.created_at.desc())
    )
    return list(db.scalars(stmt))


@router.get("/documents/{document_id}/external-records", response_model=list[schemas.ExternalReferenceOut])
def list_document_external_records(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.ExternalReferenceOut]:
    """External references attached to a single document."""
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    stmt = (
        select(models.ExternalRecordReference)
        .where(models.ExternalRecordReference.document_id == document_id)
        .order_by(models.ExternalRecordReference.created_at.desc())
    )
    return list(db.scalars(stmt))


# ---------------------------------------------------------------------------
# Deferred read endpoints (Steps 5, 6, 7)
# ---------------------------------------------------------------------------


@router.get("/documents/{document_id}/original", response_model=schemas.OriginalRecordOut)
def get_original_record(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.OriginalRecordOut:
    """The sealed original record and its immutable hash."""
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    record = db.scalar(
        select(models.OriginalDocumentRecord).where(
            models.OriginalDocumentRecord.document_id == document_id
        )
    )
    if record is None:
        raise HTTPException(status_code=404, detail="No original record sealed for this document")
    return record


@router.get("/documents/{document_id}/lineage", response_model=schemas.DocumentLineageOut)
def verify_document_lineage(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.DocumentLineageOut:
    """Cross-version tamper verification (V2).

    Three checks per document:
    * **file** — re-hash stored bytes vs the recorded content hash;
    * **record** — compare the recorded content hash against the hash that was
      folded into the hash-chained case event when the version was uploaded
      (detects database-row tampering that keeps file and row consistent);
    * **chain** — recompute every case event hash of the parent case (detects
      event/ledger tampering).
    """
    import hashlib
    from datetime import timezone

    from .storage import get_storage

    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    issues: list[str] = []

    # --- Chain check: recompute every case event hash of the parent case. ---
    # CaseEventService hashes f"{case_id}|{type}|{action}|{details}|{prev}|{actor}|{created_at.isoformat()}";
    # timestamps were aware UTC at write time, so restore tz before re-serialising.
    events = CaseEventService.list_for_case(db, document.case_id)
    chain_broken = False
    for event in events:
        created_at = event.created_at
        if created_at is not None and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        payload_block = (
            f"{event.case_id}|{event.event_type}|{event.action}|{event.details or ''}|{event.previous_event_hash or ''}|"
            f"{event.actor_user_id or ''}|{created_at.isoformat()}"
        )
        if hashlib.sha256(payload_block.encode("utf-8")).hexdigest() != event.event_hash:
            chain_broken = True
            issues.append(f"case event {event.id[:8]} hash mismatch — event chain has been tampered with")

    # --- Anchor map: content hash recorded at upload time, per version. ---
    anchored: dict[str, str] = {}
    for event in events:
        if not event.details:
            continue
        try:
            details = json.loads(event.details)
        except (TypeError, ValueError):
            continue
        if not isinstance(details, dict) or details.get("document_id") != document.id:
            continue
        version_id = details.get("version_id")
        content_hash = details.get("content_hash")
        if version_id and content_hash and version_id not in anchored:
            anchored[version_id] = str(content_hash)

    # --- Per-version: file bytes vs recorded hash, record vs chain anchor. ---
    items: list[schemas.LineageVersionOut] = []
    storage = get_storage()
    for version in DocumentService.list_versions(db, document_id):
        recorded = version.content_hash
        byte_status = "unverified"
        result = DocumentService.verify_integrity(db, document_id, version.id, storage)
        if result is None:
            byte_status = "unreadable"
            issues.append(f"version v{version.version_number}: stored file could not be read")
        elif result.verified:
            byte_status = "verified"
        else:
            byte_status = "tampered-file"
            issues.append(f"version v{version.version_number}: stored file bytes do not match the recorded hash")

        anchored_hash = anchored.get(version.id)
        if anchored_hash is None:
            record_status = "unanchored"
        elif anchored_hash == recorded:
            record_status = "anchored"
        else:
            record_status = "tampered-record"
            issues.append(
                f"version v{version.version_number}: recorded hash no longer matches the hash "
                "sealed in the audit chain at upload time — evidence record has been altered"
            )

        items.append(
            schemas.LineageVersionOut(
                version_id=version.id,
                version_number=version.version_number,
                is_original=version.version_number == 1,
                recorded_hash=recorded,
                anchored_hash=anchored_hash,
                byte_status=byte_status,
                record_status=record_status,
            )
        )

    if chain_broken:
        intact = False
    else:
        intact = not issues
    return schemas.DocumentLineageOut(document_id=document_id, intact=intact, issues=issues, versions=items)


@router.get("/documents/{document_id}/integrity-summary", response_model=schemas.IntegritySummaryOut)
def get_integrity_summary(
    document_id: str,
    verify: bool = Query(False, description="Re-hash stored bytes for every version"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.IntegritySummaryOut:
    """Last known integrity status per version; ``?verify=true`` re-checks the bytes."""
    from .storage import StorageError, get_storage

    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    items: list[schemas.IntegritySummaryItemOut] = []
    intact = True
    for version in DocumentService.list_versions(db, document_id):
        observed: Optional[str] = None
        item_status = "unverified"
        if verify:
            try:
                result = DocumentService.verify_integrity(db, document_id, version.id, get_storage())
            except (LookupError, StorageError):
                result = None
            if result is None:
                item_status = "unreadable"
            else:
                observed = result.observed_hash
                item_status = "verified" if result.verified else "tampered"
        if item_status == "tampered":
            intact = False
        items.append(
            schemas.IntegritySummaryItemOut(
                version_id=version.id,
                version_number=version.version_number,
                is_original=version.version_number == 1,
                expected_hash=version.content_hash,
                observed_hash=observed,
                status=item_status,
                created_at=version.created_at,
            )
        )
    return schemas.IntegritySummaryOut(document_id=document_id, versions=items, intact=intact)


@router.get(
    "/documents/{document_id}/versions/{version_id}/signatures",
    response_model=list[schemas.SignatureOut],
)
def list_version_signatures(
    document_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.SignatureOut]:
    """All digital signatures recorded against a document version."""
    from .signatures import SignatureService

    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if DocumentService.get_version(db, document_id, version_id) is None:
        raise HTTPException(status_code=404, detail="Document version not found")
    return SignatureService.list_for_version(db, version_id)


# ---------------------------------------------------------------------------
# Operations
# ---------------------------------------------------------------------------


@router.get("/ops/backup/status", response_model=schemas.BackupStatusOut)
def get_backup_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.BackupStatusOut:
    """Backup configuration and the local backup inventory (admin only)."""
    try:
        AccessService.require_role(db, current_user.id, "admin")
    except PermissionError as exc:
                raise HTTPException(status_code=403, detail=str(exc)) from exc
    return schemas.BackupStatusOut(**backup_status())


# ---------------------------------------------------------------------------
# Step 10 (extension) — Inter-department document access requests
# ---------------------------------------------------------------------------


@router.post("/department-requests", response_model=schemas.DepartmentRequestOut)
def create_department_request(
    payload: schemas.DepartmentRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.DepartmentRequestOut:
    """File a cross-department document access request.

    Any authenticated user may file a request for a document they can see.
    Members of the destination department (or admins) will review it via
    ``PATCH /department-requests/{request_id}``.
    """
    try:
        req = DepartmentRequestService.create(db, payload, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _department_request_to_out(db, req)


@router.get("/department-requests", response_model=list[schemas.DepartmentRequestOut])
def list_department_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.DepartmentRequestOut]:
    """List department access requests visible to the current user.

    * Admins see every request.
    * Other users see requests they filed or that are addressed to their
      department.
    """
    reqs = DepartmentRequestService.list_for_user(db, current_user.id)
    return [_department_request_to_out(db, r) for r in reqs]


@router.patch("/department-requests/{request_id}", response_model=schemas.DepartmentRequestOut)
def review_department_request(
    request_id: str,
    payload: schemas.DepartmentRequestAction,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.DepartmentRequestOut:
    """Approve or reject a department access request (destination dept or admin)."""
    try:
        req = DepartmentRequestService.action(db, request_id, payload, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return _department_request_to_out(db, req)


def _department_request_to_out(db: Session, req: models.DepartmentRequest) -> schemas.DepartmentRequestOut:
    document = db.get(models.Document, req.document_id)
    from_user = db.get(models.User, req.from_user_id)
    reviewer = db.get(models.User, req.reviewed_by_user_id) if req.reviewed_by_user_id else None
    return schemas.DepartmentRequestOut(
        id=req.id,
        document_id=req.document_id,
        document_title=document.title if document else None,
        from_user_id=req.from_user_id,
        from_user_name=from_user.full_name if from_user else None,
        from_department=req.from_department or (from_user.department if from_user else None),
        to_department=req.to_department,
        purpose=req.purpose,
        requested_access_level=req.requested_access_level,
        status=req.status,
        review_notes=req.review_notes,
        reviewed_by_user_id=req.reviewed_by_user_id,
        reviewed_by_name=reviewer.full_name if reviewer else None,
        created_at=req.created_at,
        reviewed_at=req.reviewed_at,
    )


# ---------------------------------------------------------------------------
# Case-lifecycle departments & public complaint desk (Nyaya)
# ---------------------------------------------------------------------------


def _department_record_to_out(db: Session, record: models.DepartmentRecord) -> schemas.DepartmentRecordOut:
    case = db.get(models.Case, record.case_id) if record.case_id else None
    author = db.get(models.User, record.created_by_user_id) if record.created_by_user_id else None
    return schemas.DepartmentRecordOut(
        id=record.id,
        department=record.department,
        case_id=record.case_id,
        case_number=case.case_number if case else None,
        title=record.title,
        body=record.body,
        created_by_user_id=record.created_by_user_id,
        created_by_name=author.full_name if author else None,
        created_at=record.created_at,
    )


@router.get("/departments", response_model=list[schemas.DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.DepartmentOut]:
    """Lifecycle departments annotated with the caller's permissions."""
    return [schemas.DepartmentOut(**d) for d in DepartmentService.matrix_for(db, current_user)]


@router.get("/departments/{key}/records", response_model=list[schemas.DepartmentRecordOut])
def list_department_records(
    key: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.DepartmentRecordOut]:
    """Records in a department dataset (role matrix enforced)."""
    if key not in DEPARTMENT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown department '{key}'")
    try:
        DepartmentService.assert_can_view(db, current_user, key)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return [_department_record_to_out(db, r) for r in DepartmentService.list_records(db, key)]


@router.post("/departments/{key}/records", response_model=schemas.DepartmentRecordOut)
def create_department_record(
    key: str,
    payload: schemas.DepartmentRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.DepartmentRecordOut:
    """File a new entry into a department dataset (operator roles only)."""
    if key not in DEPARTMENT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown department '{key}'")
    try:
        DepartmentService.assert_can_operate(db, current_user, key)
        record = DepartmentService.create_record(db, key, payload, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return _department_record_to_out(db, record)


# ── Public complaint desk (no authentication: email + token only) ──────


@public_router.post("/complaints", response_model=schemas.ComplaintOut, status_code=201)
def raise_complaint(
    payload: schemas.ComplaintCreate,
    db: Session = Depends(get_db),
) -> schemas.ComplaintOut:
    """Citizens raise a complaint with just their email and get a tracking token."""
    try:
        return DepartmentService.create_complaint(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@public_router.get("/complaints/{token}", response_model=schemas.ComplaintOut)
def track_complaint(
    token: str,
    db: Session = Depends(get_db),
) -> schemas.ComplaintOut:
    """Track a complaint by its token — no login required."""
    complaint = DepartmentService.get_by_token(db, token)
    if complaint is None:
        raise HTTPException(status_code=404, detail="No complaint found for that token")
    return complaint


@router.get("/complaints", response_model=list[schemas.ComplaintOut])
def list_complaints(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.ComplaintOut]:
    """Complaint desk queue (admin + auditor)."""
    try:
        AccessService.require_role(db, current_user.id, "admin", "auditor")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return DepartmentService.list_complaints(db)


@router.patch("/complaints/{complaint_id}", response_model=schemas.ComplaintOut)
def update_complaint_status(
    complaint_id: str,
    payload: schemas.ComplaintStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.ComplaintOut:
    """Move a complaint through open → acknowledged → closed (admin only)."""
    try:
        AccessService.require_role(db, current_user.id, "admin")
        return DepartmentService.set_complaint_status(db, complaint_id, payload.status)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc