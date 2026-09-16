from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models


class LedgerError(RuntimeError):
    pass


class AuditLedger:
    """Writes audit hashes locally or through a deployed Fabric REST gateway."""

    @staticmethod
    def record(db: Session, *, event_type: str, actor_user_id: str | None, case_id: str | None = None,
               document_id: str | None = None, payload: dict | None = None) -> models.AuditLedgerRecord:
        payload_json = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"), default=str)
        payload_hash = hashlib.sha256(payload_json.encode()).hexdigest()
        previous = db.scalar(select(models.AuditLedgerRecord).order_by(models.AuditLedgerRecord.created_at.desc()).limit(1))
        previous_hash = previous.record_hash if previous else None
        timestamp = datetime.now(timezone.utc).isoformat()
        record_hash = hashlib.sha256(
            f"{event_type}|{payload_hash}|{previous_hash or ''}|{actor_user_id or ''}|{timestamp}".encode()
        ).hexdigest()
        provider = os.getenv("BLOCKCHAIN_PROVIDER", "local").lower()
        transaction_id = AuditLedger._submit(provider, record_hash, event_type, payload_hash, timestamp)
        record = models.AuditLedgerRecord(
            case_id=case_id, document_id=document_id, actor_user_id=actor_user_id,
            event_type=event_type, payload_hash=payload_hash, previous_hash=previous_hash,
            record_hash=record_hash, ledger_provider=provider, transaction_id=transaction_id,
        )
        db.add(record)
        db.flush()
        db.refresh(record)
        return record

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
