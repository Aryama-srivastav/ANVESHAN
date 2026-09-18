"""Secure inter-department / inter-agency evidence transfer (V1 Step 10).

Handoff rules encoded here:

* A transfer is an *authorization* event, never a copy of the bytes. The
  original evidence object and its hash never change, so the chain of custody
  stays intact.
* Every transfer carries a deterministic ``transfer_hash`` over the document,
  the immutable content hash, both parties, the stated purpose and the time.
  Tampering with any of those fields invalidates the hash.
* Both the request and the acceptance are appended to the tamper-evident audit
  ledger **and** to the case event trail.
* Only the named recipient (or an administrator) can accept, and acceptance is
  what actually creates the recipient's purpose-bound access grant.
"""

from __future__ import annotations


import hashlib
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from . import models, schemas
from .ledger import AuditLedger


class TransferError(RuntimeError):
    pass


def _transfer_hash(
    document_id: str,
    content_hash: str,
    from_user_id: Optional[str],
    to_user_id: str,
    purpose: str,
    timestamp: str,
) -> str:
    """Deterministic sealing hash for a transfer request."""
    material = "|".join(
        [
            document_id,
            content_hash,
            from_user_id or "",
            to_user_id,
            purpose.strip().lower(),
            timestamp,
        ]
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TransferService:
    """Create, accept, reject and list evidence transfers."""

    @staticmethod
    def create(
        db: Session,
        document: models.Document,
        actor: models.User,
        payload: schemas.TransferCreate,
    ) -> models.DocumentTransfer:
        recipient = db.get(models.User, payload.to_user_id)
        if recipient is None or not recipient.is_active:
            raise TransferError("Recipient is not an active user")
        if recipient.id == actor.id:
            raise TransferError("A document cannot be transferred to its current holder")

        latest_version = db.scalar(
            select(models.DocumentVersion)
            .where(models.DocumentVersion.document_id == document.id)
            .order_by(models.DocumentVersion.version_number.desc())
            .limit(1)
        )
        if latest_version is None:
            raise TransferError("Document has no sealed version to transfer")

        timestamp = _utc_now().isoformat()
        transfer_hash = _transfer_hash(
            document.id, latest_version.content_hash, actor.id, recipient.id, payload.transfer_purpose, timestamp
        )

        transfer = models.DocumentTransfer(
            document_id=document.id,
            from_user_id=actor.id,
            to_user_id=recipient.id,
            from_department=actor.department,
            to_department=recipient.department,
            from_agency=actor.agency,
            to_agency=recipient.agency,
            transfer_purpose=payload.transfer_purpose,
            access_level=payload.access_level,
            valid_until=payload.valid_until,
            status="pending",
            transfer_hash=transfer_hash,
            transferred_at=_utc_now(),
        )
        db.add(transfer)
        db.flush()

        AuditLedger.record(
            db,
            event_type="document_transferred",
            actor_user_id=actor.id,
            case_id=document.case_id,
            document_id=document.id,
            payload={
                "transfer_id": transfer.id,
                "transfer_hash": transfer_hash,
                "to_user_id": recipient.id,
                "to_department": recipient.department,
                "to_agency": recipient.agency,
                "purpose": payload.transfer_purpose,
                "access_level": payload.access_level,
                "content_hash": latest_version.content_hash,
            },
        )
        db.commit()
        db.refresh(transfer)
        return transfer

    @staticmethod
    def _authorize_party(db: Session, transfer: models.DocumentTransfer, actor: models.User) -> None:
        from .services import AccessService

        if transfer.to_user_id != actor.id and transfer.from_user_id != actor.id:
            if not AccessService._is_admin(db, actor.id):
                raise PermissionError("Not a party to this transfer")

    @staticmethod
    def accept(db: Session, transfer_id: str, actor: models.User) -> models.DocumentTransfer:
        """Recipient accepts: creates the purpose-bound grant and seals the event."""
        transfer = db.get(models.DocumentTransfer, transfer_id)
        if transfer is None:
            raise LookupError("Transfer not found")

        from .services import AccessService

        if transfer.to_user_id != actor.id and not AccessService._is_admin(db, actor.id):
            raise PermissionError("Only the named recipient can accept this transfer")
        if transfer.status != "pending":
            raise TransferError(f"Transfer is already {transfer.status}")

        document = db.get(models.Document, transfer.document_id)
        recipient = db.get(models.User, transfer.to_user_id)
        if document is None or recipient is None:
            raise TransferError("Transfer references a missing document or user")

        existing = db.scalar(
            select(models.AuthorizedAccess).where(
                models.AuthorizedAccess.user_id == transfer.to_user_id,
                models.AuthorizedAccess.document_id == transfer.document_id,
                models.AuthorizedAccess.purpose == f"transfer {transfer.id}",
            )
        )
        if existing is None:
            db.add(
                models.AuthorizedAccess(
                    user_id=transfer.to_user_id,
                    case_id=document.case_id,
                    document_id=transfer.document_id,
                    purpose=f"transfer {transfer.id}",
                    department=recipient.department,
                    agency=recipient.agency,
                    access_level=transfer.access_level,
                    valid_until=transfer.valid_until,
                )
            )

        transfer.status = "accepted"
        transfer.accepted_at = _utc_now()
        db.flush()

        AuditLedger.record(
            db,
            event_type="transfer_accepted",
            actor_user_id=actor.id,
            case_id=document.case_id,
            document_id=document.id,
            payload={
                "transfer_id": transfer.id,
                "transfer_hash": transfer.transfer_hash,
                "from_user_id": transfer.from_user_id,
                "access_level": transfer.access_level,
            },
        )
        db.commit()
        db.refresh(transfer)
        return transfer

    @staticmethod
    def reject(db: Session, transfer_id: str, actor: models.User, reason: Optional[str] = None) -> models.DocumentTransfer:
        transfer = db.get(models.DocumentTransfer, transfer_id)
        if transfer is None:
            raise LookupError("Transfer not found")
        TransferService._authorize_party(db, transfer, actor)
        if transfer.status != "pending":
            raise TransferError(f"Transfer is already {transfer.status}")

        transfer.status = "rejected"
        db.flush()
        document = db.get(models.Document, transfer.document_id)
        AuditLedger.record(
            db,
            event_type="transfer_rejected",
            actor_user_id=actor.id,
            case_id=document.case_id if document is not None else None,
            document_id=transfer.document_id,
            payload={"transfer_id": transfer.id, "reason": reason or "not stated"},
        )
        db.commit()
        db.refresh(transfer)
        return transfer

    @staticmethod
    def list_for_user(db: Session, user: models.User) -> list[models.DocumentTransfer]:
        from .services import AccessService

        stmt = select(models.DocumentTransfer).order_by(models.DocumentTransfer.created_at.desc())
        if not AccessService._is_admin(db, user.id):
            stmt = stmt.where(
                or_(
                    models.DocumentTransfer.to_user_id == user.id,
                    models.DocumentTransfer.from_user_id == user.id,
                )
            )
        return list(db.scalars(stmt))

    @staticmethod
    def get(db: Session, transfer_id: str, actor: models.User) -> models.DocumentTransfer:
        transfer = db.get(models.DocumentTransfer, transfer_id)
        if transfer is None:
            raise LookupError("Transfer not found")
        TransferService._authorize_party(db, transfer, actor)
        return transfer