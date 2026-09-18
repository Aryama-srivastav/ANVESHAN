from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from . import models


class LedgerError(RuntimeError):
    pass


class AuditLedger:
    """Writes audit hashes locally or through a deployed Fabric REST gateway."""

    @staticmethod
    def compute_hash(
        event_type: str,
        payload_hash: str,
        previous_hash: str | None,
        actor_user_id: str | None,
        timestamp: str,
    ) -> str:
        """Deterministic record hash — the single source of truth for verification."""
        return hashlib.sha256(
            f"{event_type}|{payload_hash}|{previous_hash or ''}|{actor_user_id or ''}|{timestamp}".encode()
        ).hexdigest()

    @staticmethod
    def record(db: Session, *, event_type: str, actor_user_id: str | None, case_id: str | None = None,
               document_id: str | None = None, payload: dict | None = None) -> models.AuditLedgerRecord:
        payload_json = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"), default=str)
        payload_hash = hashlib.sha256(payload_json.encode()).hexdigest()
        previous = db.scalar(select(models.AuditLedgerRecord).order_by(models.AuditLedgerRecord.created_at.desc()).limit(1))
        previous_hash = previous.record_hash if previous else None
        timestamp = datetime.now(timezone.utc).isoformat()
        record_hash = AuditLedger.compute_hash(event_type, payload_hash, previous_hash, actor_user_id, timestamp)
        provider = os.getenv("BLOCKCHAIN_PROVIDER", "local").lower()
        transaction_id = AuditLedger._submit(provider, record_hash, event_type, payload_hash, timestamp)
        record = models.AuditLedgerRecord(
            case_id=case_id, document_id=document_id, actor_user_id=actor_user_id,
            event_type=event_type, payload_hash=payload_hash, previous_hash=previous_hash,
            record_hash=record_hash, ledger_provider=provider, transaction_id=transaction_id,
            hashed_at=timestamp,
        )
        db.add(record)
        db.flush()
        db.refresh(record)
        return record

    @staticmethod
    def verify(db: Session, record_id: str) -> tuple[models.AuditLedgerRecord, bool, str, bool] | None:
        """Re-compute a record hash and check its link to the previous record.

        Returns ``(record, verified, observed_hash, chain_linked)`` or ``None``
        when the record does not exist.
        """
        record = db.get(models.AuditLedgerRecord, record_id)
        if record is None:
            return None
        timestamp = record.hashed_at or (
            record.created_at.isoformat() if record.created_at is not None else ""
        )
        observed_hash = AuditLedger.compute_hash(
            record.event_type, record.payload_hash, record.previous_hash, record.actor_user_id, timestamp
        )
        verified = observed_hash == record.record_hash

        chain_linked = True
        previous = db.scalar(
            select(models.AuditLedgerRecord)
            .where(
                or_(
                    models.AuditLedgerRecord.created_at < record.created_at,
                    and_(
                        models.AuditLedgerRecord.created_at == record.created_at,
                        models.AuditLedgerRecord.id != record.id,
                    ),
                )
            )
            .order_by(models.AuditLedgerRecord.created_at.desc())
            .limit(1)
        )
        if previous is not None:
            chain_linked = record.previous_hash == previous.record_hash
        elif record.previous_hash is not None:
            chain_linked = False
        return record, verified, observed_hash, chain_linked

    @staticmethod
    def verify_chain(db: Session, limit: int = 500) -> list[dict]:
        """Walk the ledger oldest-first and report every broken link."""
        records = list(
            db.scalars(
                select(models.AuditLedgerRecord)
                .order_by(models.AuditLedgerRecord.created_at.asc(), models.AuditLedgerRecord.id.asc())
                .limit(limit)
            )
        )
        problems: list[dict] = []
        expected_previous: str | None = None
        for record in records:
            timestamp = record.hashed_at or (record.created_at.isoformat() if record.created_at else "")
            observed = AuditLedger.compute_hash(
                record.event_type, record.payload_hash, record.previous_hash, record.actor_user_id, timestamp
            )
            if observed != record.record_hash:
                problems.append({"record_id": record.id, "issue": "hash_mismatch", "event_type": record.event_type})
            if record.previous_hash != expected_previous:
                problems.append({"record_id": record.id, "issue": "broken_chain_link", "event_type": record.event_type})
            expected_previous = record.record_hash
        return problems

    @staticmethod
    def _submit(provider: str, record_hash: str, event_type: str, payload_hash: str, timestamp: str) -> str:
        if provider == "local":
            return f"local-{uuid4()}"
        if provider != "fabric":
            raise LedgerError(f"Unsupported blockchain provider: {provider}")
        gateway_url = os.getenv("FABRIC_GATEWAY_URL")
        if not gateway_url:
            raise LedgerError("FABRIC_GATEWAY_URL is required when BLOCKCHAIN_PROVIDER=fabric")
        headers = {"Authorization": f"Bearer {os.getenv('FABRIC_GATEWAY_TOKEN', '')}"}
        try:
            response = httpx.post(
                gateway_url.rstrip("/") + "/audit-events",
                json={"record_hash": record_hash, "event_type": event_type, "payload_hash": payload_hash, "timestamp": timestamp},
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()
            transaction_id = response.json().get("transaction_id")
            if not transaction_id:
                raise LedgerError("Fabric gateway response did not include transaction_id")
            return str(transaction_id)
        except (httpx.HTTPError, ValueError) as exc:
            raise LedgerError("Fabric audit transaction was not committed") from exc
