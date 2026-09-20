
from __future__ import annotations

import hashlib
import base64
import builtins
import logging
from secrets import token_bytes, token_hex
import json
import os
from typing import Optional,  BinaryIO
from uuid import uuid4

from datetime import datetime, timezone

from sqlalchemy import Select, exists, select
from sqlalchemy.orm import Session

from . import models, schemas
from .classification import ClassificationService
from .storage import StorageError, StorageProvider
from .ledger import AuditLedger
from .signatures import SignatureService

logger = logging.getLogger("anveshan.services")
# Step 12 — external record sources accepted by the integration layer.
EXTERNAL_SOURCE_ALLOWLIST = ("criminal_records", "e_forensics", "nyaya")

# Evidence file type allow-list.  Executable / script / archive / macro-enabled
# types are deliberately excluded to stop malicious-upload vectors.
ALLOWED_EVIDENCE_EXTENSIONS = frozenset({
    # Documents
    ".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt",
    # Images
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp",
    # Audio
    ".mp3", ".wav", ".ogg", ".m4a", ".flac",
    # Video
    ".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv",
    # Data
    ".csv", ".json", ".xml", ".xlsx", ".xls", ".ppt", ".pptx",
})
ALLOWED_EVIDENCE_CONTENT_TYPES = frozenset({
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
    "text/plain", "text/csv", "application/json", "application/xml",
    "application/rtf",
    "image/jpeg", "image/png", "image/gif", "image/bmp", "image/tiff",
    "image/webp",
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/flac",
    "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska",
    "video/webm", "video/x-ms-wmv",
    "application/octet-stream",  # sometimes sent for uploads; we validate by extension too
})


class EvidenceFileTypeError(ValueError):
    """Raised when an upload is not an allowed evidence format.

    Subclasses ``ValueError`` so existing call sites keep working, but callers
    can distinguish a rejected *format* (HTTP 400) from a rejected *size*
    (HTTP 413).
    """


def _validate_evidence_file(filename: str | None, content_type: str | None) -> None:
    """Reject executable, script, archive and other non-evidence file types."""
    if filename is None:
        raise EvidenceFileTypeError("Filename is required for evidence uploads")
    import os as _os
    ext = _os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EVIDENCE_EXTENSIONS:
        raise EvidenceFileTypeError(
            f"File type '{ext or '(no extension)'}' is not an allowed evidence format. "
            f"Allowed: documents (pdf, doc, docx, txt, rtf), images (jpg, png, gif, bmp, tiff, webp), "
            f"audio (mp3, wav, ogg, m4a, flac), video (mp4, mov, avi, mkv, webm, wmv), "
            f"and data (csv, json, xml, xlsx, xls, ppt, pptx)."
        )
    if content_type and content_type not in ALLOWED_EVIDENCE_CONTENT_TYPES:
        raise EvidenceFileTypeError(f"Content type '{content_type}' is not an allowed evidence format")


def validate_external_source(source_system: str) -> str:
    """Normalize and allow-list an external record source system."""
    normalized = (source_system or "").strip().lower().replace("-", "_")
    if normalized not in EXTERNAL_SOURCE_ALLOWLIST:
        raise ValueError(f"source_system must be one of: {', '.join(EXTERNAL_SOURCE_ALLOWLIST)}")
    return normalized


def _hash_password(password: str) -> str:
    salt = token_bytes(16)
    return base64.urlsafe_b64encode(salt + hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)).decode()


def _mfa_secret() -> str:
    return base64.b32encode(token_bytes(20)).decode().rstrip("=")


class _HashingReader:
    def __init__(self, source: BinaryIO, maximum_bytes: int, capture_bytes: int = 0) -> None:
        self.source = source
        self.maximum_bytes = maximum_bytes
        self.hasher = hashlib.sha256()
        self.size = 0
        # Bounded plaintext prefix used for ML classification / text extraction.
        # Captured before the encryption wrapper sees the bytes, so extraction
        # never needs a second (decrypting) pass over stored evidence.
        self.capture_limit = capture_bytes
        self.captured = bytearray()

    def read(self, size: int = -1) -> bytes:
        chunk = self.source.read(size)
        if chunk:
            self.size += len(chunk)
            if self.size > self.maximum_bytes:
                raise ValueError("Uploaded file exceeds the configured size limit")
            self.hasher.update(chunk)
            remaining = self.capture_limit - len(self.captured)
            if remaining > 0:
                self.captured.extend(chunk[:remaining])
        return chunk

    def captured_bytes(self) -> bytes:
        return bytes(self.captured)


class UserService:
    @staticmethod
    def create(db: Session, payload: schemas.UserCreate) -> models.User:
        user = models.User(
            email=payload.email.lower(), full_name=payload.full_name, password_hash=_hash_password(payload.password),
            department=payload.department, agency=payload.agency, clearance_level=payload.clearance_level,
            mfa_enabled=True, mfa_secret=_mfa_secret(),
        )
        db.add(user)
        db.flush()
        default_role = db.scalar(select(models.Role).where(models.Role.name == "user"))
        if default_role is None:
            default_role = models.Role(name="user", description="Standard investigator")
            db.add(default_role)
            db.flush()
        db.add(models.UserRole(user_id=user.id, role_id=default_role.id))
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def list(db: Session) -> list[models.User]:
        stmt: Select[tuple[models.User]] = select(models.User).order_by(models.User.created_at.desc())
        return list(db.scalars(stmt))


class RoleService:
    @staticmethod
    def ensure_default_roles(db: Session) -> None:
        import logging
        log = logging.getLogger("anveshan.services")
        log.info("RoleService: ensuring default roles exist")
        for name, description in {
            "user": "Standard investigator",
            "admin": "Case and system administrator",
            "auditor": "Evidence audit reviewer",
            "viewer": "Read-only case viewer",
        }.items():
            if db.scalar(select(models.Role).where(models.Role.name == name)) is None:
                log.info("RoleService: creating role '%s'", name)
                db.add(models.Role(name=name, description=description))
            else:
                log.debug("RoleService: role '%s' already exists", name)
        db.commit()
        log.info("RoleService: default roles check complete")


class CaseService:
    @staticmethod
    def create(db: Session, payload: schemas.CaseCreate, actor_id: str) -> models.Case:
        case_number = payload.case_number or f"CASE-{token_hex(2).upper()}-{token_hex(2).upper()}"
        case = models.Case(
            case_number=case_number,
            title=payload.title,
            description=payload.description,
        )
        db.add(case)
        db.flush()
        db.add(
            models.AuthorizedAccess(
                user_id=actor_id,
                case_id=case.id,
                purpose="case creation",
                access_level="admin",
            )
        )
        db.flush()
        # Seal the creation itself into the case's tamper-evident event chain:
        # what was created, by whom, from which system instance and under which
        # signing configuration.
        ledger_provider = os.getenv("BLOCKCHAIN_PROVIDER", "local").lower()
        signing_key_path = os.getenv("SIGNING_KEY_PATH", "")
        signing_reference = (
            hashlib.sha256(f"{case.case_number}|{signing_key_path}|{ledger_provider}".encode()).hexdigest()
            if signing_key_path
            else None
        )
        CaseEventService.create(
            db,
            case.id,
            actor_id,
            schemas.CaseEventCreate(
                event_type="case_created",
                action=f"Case created: {case.title}",
                details={
                    "case_number": case.case_number,
                    "title": case.title,
                    "description": case.description,
                    "created_at": case.created_at.isoformat() if case.created_at else None,
                    "system": "ANVESHAN evidence vault",
                    "ledger_provider": ledger_provider,
                    "signing_reference": signing_reference,
                },
            ),
        )
        db.refresh(case)
        return case

    @staticmethod
    def list(db: Session) -> list[models.Case]:
        stmt: Select[tuple[models.Case]] = select(models.Case).order_by(models.Case.created_at.desc())
        return list(db.scalars(stmt))

    @staticmethod
    def list_for_user(db: Session, user_id: str) -> "builtins.list[models.Case]":
        # V2 — cases are a shared register: every role sees every case. Write
        # access is still controlled by AccessService.require_case_access.
        return CaseService.list(db)


class CaseEventService:
    @staticmethod
    def create(
        db: Session,
        case_id: str,
        actor_user_id: Optional[str],
        payload: schemas.CaseEventCreate,
    ) -> models.CaseEvent:
        previous_event = db.scalar(
            select(models.CaseEvent)
            .where(models.CaseEvent.case_id == case_id)
            .order_by(models.CaseEvent.created_at.desc(), models.CaseEvent.id.desc())
            .limit(1)
        )
        previous_hash = previous_event.event_hash if previous_event is not None else None
        details_json = json.dumps(payload.details, sort_keys=True, separators=(",", ":"), default=str)
        created_at = datetime.now(timezone.utc)
        payload_block = (
            f"{case_id}|{payload.event_type}|{payload.action}|{details_json}|{previous_hash or ''}|"
            f"{actor_user_id or ''}|{created_at.isoformat()}"
        )
        event_hash = hashlib.sha256(payload_block.encode("utf-8")).hexdigest()
        event = models.CaseEvent(
            case_id=case_id,
            actor_user_id=actor_user_id,
            event_type=payload.event_type,
            action=payload.action,
            details=details_json,
            previous_event_hash=previous_hash,
            event_hash=event_hash,
            created_at=created_at,
        )
        db.add(event)
        db.flush()
        AuditLedger.record(db, event_type="case_event", actor_user_id=actor_user_id, case_id=case_id,
                           payload={"event_hash": event.event_hash, "event_type": event.event_type})
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def list_for_case(db: Session, case_id: str) -> list[models.CaseEvent]:
        stmt: Select[tuple[models.CaseEvent]] = (
            select(models.CaseEvent)
            .where(models.CaseEvent.case_id == case_id)
            .order_by(models.CaseEvent.created_at.asc(), models.CaseEvent.id.asc())
        )
        return list(db.scalars(stmt))


class DocumentService:
    @staticmethod
    def get(db: Session, document_id: str) -> models.Document | None:
        return db.get(models.Document, document_id)

    @staticmethod
    def list_versions(db: Session, document_id: str) -> list[models.DocumentVersion]:
        stmt: Select[tuple[models.DocumentVersion]] = (
            select(models.DocumentVersion)
            .where(models.DocumentVersion.document_id == document_id)
            .order_by(models.DocumentVersion.version_number.asc())
        )
        return list(db.scalars(stmt))

    @staticmethod
    def create(db: Session, payload: schemas.DocumentCreate) -> models.Document:
        document = models.Document(
            case_id=payload.case_id,
            title=payload.title,
            doc_type=payload.doc_type,
            sensitivity_level=payload.sensitivity_level,
        )
        db.add(document)
        db.flush()

        for key, value in payload.metadata.items():
            db.add(models.DocumentMetadata(document_id=document.id, meta_key=key, meta_value=value))

        db.commit()
        db.refresh(document)
        return document

    @staticmethod
    def upload_version(
        db: Session,
        document_id: str,
        source: BinaryIO,
        content_type: Optional[str],
        storage: StorageProvider,
        created_by_user_id: Optional[str] = None,
        notes: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> models.DocumentVersion:
        document = db.get(models.Document, document_id)
        if document is None:
            raise LookupError("Document not found")

        # Security: reject executable / script / archive uploads before we touch storage.
        _validate_evidence_file(filename, content_type)

        latest_number = db.scalar(
            select(models.DocumentVersion.version_number)
            .where(models.DocumentVersion.document_id == document_id)
            .order_by(models.DocumentVersion.version_number.desc())
            .limit(1)
        )
        version_number = (latest_number or 0) + 1
        key = f"cases/{document.case_id}/documents/{document_id}/versions/{uuid4()}"
        reader = _HashingReader(
            source,
            int(os.getenv("MAX_UPLOAD_BYTES", str(100 * 1024 * 1024))),
            int(os.getenv("MAX_CLASSIFY_BYTES", str(1024 * 1024))),
        )
        storage_uri: Optional[str] = None
        try:
            storage_uri = storage.put(key, reader, content_type)
            if reader.size == 0:
                raise ValueError("Uploaded file is empty")
            version = models.DocumentVersion(
                document_id=document_id,
                version_number=version_number,
                storage_uri=storage_uri,
                content_hash=reader.hasher.hexdigest(),
                created_by_user_id=created_by_user_id,
                notes=notes,
            )
            db.add(version)
            if version_number == 1:
                db.add(
                    models.OriginalDocumentRecord(
                        document_id=document_id,
                        source_system="anveshan-upload",
                        source_reference=storage_uri,
                        immutable_hash=version.content_hash,
                    )
                )
            db.flush()
            AuditLedger.record(db, event_type="document_version_uploaded", actor_user_id=created_by_user_id,
                               case_id=document.case_id, document_id=document_id,
                               payload={"version_id": version.id, "content_hash": version.content_hash})
            # Every upload is automatically signed with the uploader's role key
            # (per-system keys: investigator and administrator signatures are
            # cryptographically distinct). The signature identity, key role and
            # algorithm are folded into the audit event below.
            signer_role = AccessService.role_name_for(db, created_by_user_id)
            signature = SignatureService.sign(db, version, created_by_user_id, key_role=signer_role)
            # Append the upload to the case's tamper-evident event chain so the
            # case audit trail shows every piece of evidence, who filed it and
            # when — including later updates (version_number > 1). Version 1 is
            # the preserved original; every subsequent version is an amendment.
            CaseEventService.create(
                db,
                document.case_id,
                created_by_user_id,
                schemas.CaseEventCreate(
                    event_type="document_uploaded" if version_number == 1 else "document_version_added",
                    action=(
                        f"Evidence uploaded: {document.title}"
                        if version_number == 1
                        else f"Evidence updated: {document.title} (v{version_number})"
                    ),
                    details={
                        "document_id": document.id,
                        "document_title": document.title,
                        "version_id": version.id,
                        "version_number": version_number,
                        "is_original": version_number == 1,
                        "content_hash": version.content_hash,
                        "filename": filename,
                        "notes": notes,
                        "uploaded_at": version.created_at.isoformat() if version.created_at else None,
                        "signature_id": signature.id,
                        "signed_by_role": signer_role,
                        "signature_algorithm": signature.algorithm,
                    },
                ),
            )
            # V1 Step 9 — ML classification + tagging on ingestion. Suggestions are
            # stored as pending metadata; a human still has to accept them.
            if os.getenv("CLASSIFY_ON_UPLOAD", "true").lower() in {"1", "true", "yes", "on"}:
                try:
                    ClassificationService.suggest(
                        db, document, reader.captured_bytes(), filename or document.title
                    )
                except Exception:  # noqa: BLE001 - classification must never block ingestion
                    logger.warning("Classification failed for document %s", document_id, exc_info=True)
            db.commit()
            db.refresh(version)
            return version
        except Exception:
            db.rollback()
            if storage_uri is not None:
                storage.delete(storage_uri)
            raise

    @staticmethod
    def verify_integrity(
        db: Session,
        document_id: str,
        version_id: str,
        storage: StorageProvider,
    ) -> schemas.IntegrityVerifyOut | None:
        version = db.get(models.DocumentVersion, version_id)
        if version is None or version.document_id != document_id:
            return None

        expected_hash = version.content_hash.lower()
        hasher = hashlib.sha256()
        try:
            with storage.open(version.storage_uri) as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    hasher.update(chunk)
        except FileNotFoundError as exc:
            raise LookupError("Stored evidence was not found") from exc
        except StorageError:
            return schemas.IntegrityVerifyOut(
                document_id=document_id, version_id=version.id, version_number=version.version_number,
                expected_hash=expected_hash, observed_hash="unreadable", verified=False,
            )
        observed_hash = hasher.hexdigest()
        return schemas.IntegrityVerifyOut(
            document_id=document_id,
            version_id=version.id,
            version_number=version.version_number,
            expected_hash=expected_hash,
            observed_hash=observed_hash,
            verified=expected_hash == observed_hash,
        )

    @staticmethod
    def get_version(db: Session, document_id: str, version_id: str) -> models.DocumentVersion | None:
        version = db.get(models.DocumentVersion, version_id)
        if version is None or version.document_id != document_id:
            return None
        return version


class AccessService:
    # Roles that may read every case / document without an explicit grant.
    UNIVERSAL_READ_ROLES = ("admin", "auditor", "viewer")

    @staticmethod
    def require_case_access(db: Session, user_id: str, case_id: str, required_level: str = "read") -> None:
        if AccessService._is_admin(db, user_id):
            return
        if required_level == "read":
            # Cases are a shared register — any authenticated officer may read.
            # Investigators additionally get a durable case grant minted on
            # first open, so they can immediately read/edit the case evidence.
            if AccessService.has_role(db, user_id, "user") and not AccessService._has_grant(
                db, user_id, case_id=case_id, required_level="read"
            ):
                db.add(
                    models.AuthorizedAccess(
                        user_id=user_id,
                        case_id=case_id,
                        purpose="role-based case access",
                        access_level="write",
                    )
                )
                db.commit()
            return
        # Write access: investigators ("user" role) and above operate on any
        # case; the first write-touch mints a durable case grant so every
        # subsequent document-level check (uploads, reads, transfers) passes.
        if AccessService.has_role(db, user_id, "user"):
            if not AccessService._has_grant(db, user_id, case_id=case_id, required_level=required_level):
                db.add(
                    models.AuthorizedAccess(
                        user_id=user_id,
                        case_id=case_id,
                        purpose="role-based case access",
                        access_level="write",
                    )
                )
                db.commit()
            return
        if not AccessService._has_grant(db, user_id, case_id=case_id, required_level=required_level):
            raise PermissionError("User is not authorized for this case")

    @staticmethod
    def require_document_access(
        db: Session,
        user_id: str,
        document: models.Document,
        required_level: str = "read",
        *,
        department: Optional[str] = None,
        agency: Optional[str] = None,
        sensitivity_level: Optional[str] = None,
    ) -> None:
        if AccessService._is_admin(db, user_id):
            return
        # Viewers and auditors can inspect any evidence; other roles need a
        # grant (their own, one on the document, or one on the parent case).
        if required_level == "read" and AccessService.has_role(db, user_id, *AccessService.UNIVERSAL_READ_ROLES):
            return
        if AccessService._has_grant(
            db,
            user_id,
            document_id=document.id,
            required_level=required_level,
            department=department,
            agency=agency,
            sensitivity_level=sensitivity_level or document.sensitivity_level,
        ):
            return
        if AccessService._has_grant(
            db,
            user_id,
            case_id=document.case_id,
            required_level=required_level,
            department=department,
            agency=agency,
            sensitivity_level=sensitivity_level or document.sensitivity_level,
        ):
            return
        raise PermissionError("User is not authorized for this document")

    @staticmethod
    def _is_admin(db: Session, user_id: str) -> bool:
        return bool(
            db.scalar(
                select(
                    exists().where(
                        models.UserRole.user_id == user_id,
                        models.UserRole.role_id == models.Role.id,
                        models.Role.name == "admin",
                    )
                )
            )
        )

    @staticmethod
    def has_role(db: Session, user_id: str, *role_names: str) -> bool:
        """Public role check used by admin/auditor-only endpoints."""
        wanted = [name.lower() for name in role_names if name]
        if not wanted:
            return False
        return bool(
            db.scalar(
                select(
                    exists().where(
                        models.UserRole.user_id == user_id,
                        models.UserRole.role_id == models.Role.id,
                        models.Role.name.in_(wanted),
                    )
                )
            )
        )

    @staticmethod
    def role_name_for(db: Session, user_id: str | None) -> str | None:
        """Primary role name of a user (deterministic); None when role-less."""
        if user_id is None:
            return None
        name = db.scalar(
            select(models.Role.name)
            .join(models.UserRole, models.UserRole.role_id == models.Role.id)
            .where(models.UserRole.user_id == user_id)
            .order_by(models.Role.name)
            .limit(1)
        )
        return name

    @staticmethod
    def require_role(db: Session, user_id: str, *role_names: str) -> None:
        if not AccessService.has_role(db, user_id, *role_names):
            raise PermissionError(f"One of these roles is required: {', '.join(role_names)}")

    @staticmethod
    def _has_grant(
        db: Session,
        user_id: str,
        *,
        case_id: Optional[str] = None,
        document_id: Optional[str] = None,
        required_level: str,
        department: Optional[str] = None,
        agency: Optional[str] = None,
        sensitivity_level: Optional[str] = None,
    ) -> bool:
        levels = {"read": 1, "write": 2, "admin": 3}
        minimum = levels[required_level]
        now = datetime.now(timezone.utc)
        grants = db.scalars(
            select(models.AuthorizedAccess).where(
                models.AuthorizedAccess.user_id == user_id,
                models.AuthorizedAccess.case_id == case_id if case_id is not None else True,
                models.AuthorizedAccess.document_id == document_id if document_id is not None else True,
            )
        )
        for grant in grants:
            valid_from = grant.valid_from.replace(tzinfo=timezone.utc) if grant.valid_from.tzinfo is None else grant.valid_from
            valid_until = grant.valid_until
            if valid_until is not None and valid_until.tzinfo is None:
                valid_until = valid_until.replace(tzinfo=timezone.utc)
            user = db.get(models.User, user_id)
            if grant.department is not None and (user is None or grant.department != user.department):
                continue
            if grant.agency is not None and (user is None or grant.agency != user.agency):
                continue
            if sensitivity_level is not None and grant.sensitivity_level is not None and grant.sensitivity_level != sensitivity_level:
                continue
            if levels.get(grant.access_level, 0) >= minimum and valid_from <= now and (
                valid_until is None or now <= valid_until
            ):
                return True
        return False

    @staticmethod
    def grant(db: Session, payload: schemas.AccessGrantCreate) -> models.AuthorizedAccess:
        grant = models.AuthorizedAccess(**payload.model_dump())
        db.add(grant)
        db.commit()
        db.refresh(grant)
        return grant


# NOTE: ``ClassificationService`` lives in ``app.classification`` and is imported
# at the top of this module. It must not be re-defined here: a local definition
# shadows the import (and the ML hook below then fails with AttributeError).


class RecordService:
    @staticmethod
    def attach_original_record(
        db: Session,
        document_id: str,
        payload: schemas.OriginalRecordCreate,
    ) -> models.OriginalDocumentRecord:
        record = models.OriginalDocumentRecord(document_id=document_id, **payload.model_dump())
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def create_identity_verification(
        db: Session, payload: schemas.IdentityVerificationCreate
    ) -> models.IdentityVerificationRecord:
        record = models.IdentityVerificationRecord(**payload.model_dump())
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def create_external_reference(
        db: Session, payload: schemas.ExternalReferenceCreate
    ) -> models.ExternalRecordReference:
        record = models.ExternalRecordReference(**payload.model_dump())
        db.add(record)
        db.commit()
        db.refresh(record)
        return record


class DepartmentRequestService:
    """Workflow for cross-department document access requests."""

    @staticmethod
    def list(db: Session) -> list[models.DepartmentRequest]:
        return list(db.scalars(
            select(models.DepartmentRequest).order_by(models.DepartmentRequest.created_at.desc())
        ))

    @staticmethod
    def list_for_user(db: Session, user_id: str) -> list[models.DepartmentRequest]:
        user = db.get(models.User, user_id)
        if user is None:
            return []
        dept = user.department
        return list(db.scalars(
            select(models.DepartmentRequest)
            .where(
                (models.DepartmentRequest.from_user_id == user_id)
                | (models.DepartmentRequest.to_department == dept)
                | (models.DepartmentRequest.from_department == dept)
            )
            .order_by(models.DepartmentRequest.created_at.desc())
        ))

    @staticmethod
    def create(
        db: Session, payload: schemas.DepartmentRequestCreate, actor_id: str
    ) -> models.DepartmentRequest:
        document = DocumentService.get(db, payload.document_id)
        if document is None:
            raise LookupError("Document not found")
        actor = db.get(models.User, actor_id)

        # Destination department: explicit choice wins, otherwise infer it from
        # the officer who filed the latest version of the evidence.
        to_department = payload.to_department
        if not to_department:
            holder_id = db.scalar(
                select(models.DocumentVersion.created_by_user_id)
                .where(models.DocumentVersion.document_id == document.id)
                .order_by(models.DocumentVersion.version_number.desc())
                .limit(1)
            )
            holder = db.get(models.User, holder_id) if holder_id else None
            to_department = holder.department if holder else None

        req = models.DepartmentRequest(
            document_id=payload.document_id,
            from_user_id=actor_id,
            from_department=payload.from_department or (actor.department if actor else None),
            to_department=to_department,
            purpose=payload.purpose,
            requested_access_level=payload.requested_access_level,
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def action(
        db: Session, request_id: str, payload: schemas.DepartmentRequestAction, actor_id: str
    ) -> models.DepartmentRequest:
        req = db.get(models.DepartmentRequest, request_id)
        if req is None:
            raise LookupError("Request not found")
        # Only a member of the destination department (to_department matches the
        # actor's department) or an admin may approve/reject.
        actor = db.get(models.User, actor_id)
        is_admin = AccessService._is_admin(db, actor_id)
        if not is_admin:
            actor_dept = actor.department if actor else None
            if req.to_department and req.to_department != actor_dept:
                raise PermissionError("Only a member of the destination department may review this request")
        req.status = payload.status
        req.review_notes = payload.review_notes
        req.reviewed_by_user_id = actor_id
        req.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(req)
        return req


# Departments that touch a case across its whole lifecycle, with the role
# matrix the user specified: who operates the dataset and who may view it.
# ``user`` is the investigator role, ``viewer`` the read-only citizen role.
DEPARTMENT_MATRIX: dict[str, dict[str, tuple[str, ...]]] = {
    "criminal_records": {"operate": ("admin",), "view": ("admin", "user")},
    "e_forensics": {"operate": ("admin",), "view": ("admin", "user", "auditor")},
    "police": {"operate": ("admin",), "view": ("admin", "user", "auditor")},
    "legal": {"operate": ("admin",), "view": ("admin", "user", "auditor")},
    "judiciary": {"operate": ("admin",), "view": ("admin", "user", "auditor")},
    "forensics": {"operate": ("admin",), "view": ("admin", "user", "auditor")},
    "prison": {"operate": ("admin",), "view": ("admin", "user")},
    "nyaya": {"operate": ("admin",), "view": ("admin", "user", "auditor", "viewer")},
}

DEPARTMENT_LABELS: dict[str, tuple[str, str]] = {
    "criminal_records": ("Criminal Records", "First-information and charge-sheet register."),
    "e_forensics": ("E-Forensics", "Digital exhibits, device imaging and hash manifests."),
    "police": ("Police", "Station diaries, arrests and investigation notes."),
    "legal": ("Legal", "Opinions, drafts and department legal advice."),
    "judiciary": ("Judiciary", "Court filings, hearings and interim orders."),
    "forensics": ("Forensics", "Lab reports, exhibits and expert opinions."),
    "prison": ("Prison", "Custody, remand and jail admission records."),
    "nyaya": ("Nyaya", "Judicial verdicts and final judgements; citizen complaints."),
}


class DepartmentService:
    """Case-lifecycle department datasets and the public complaint desk."""

    @staticmethod
    def matrix_for(db: Session, user: models.User | None) -> list[dict]:
        """Department descriptors annotated with the caller's permissions."""
        from .services import AccessService

        roles: set[str] = set()
        if user is not None:
            for user_role in user.roles:
                roles.add(user_role.role.name)
        is_admin = user is not None and AccessService._is_admin(db, user.id)
        out: list[dict] = []
        for key, (name, description) in DEPARTMENT_LABELS.items():
            matrix = DEPARTMENT_MATRIX[key]
            out.append({
                "key": key,
                "name": name,
                "description": description,
                "can_view": is_admin or bool(roles & set(matrix["view"])),
                "can_operate": is_admin or bool(roles & set(matrix["operate"])),
            })
        return out

    @staticmethod
    def assert_can_view(db: Session, user: models.User, department: str) -> None:
        from .services import AccessService

        if AccessService._is_admin(db, user.id):
            return
        matrix = DEPARTMENT_MATRIX.get(department)
        if matrix is None or not AccessService.has_role(db, user.id, *matrix["view"]):
            raise PermissionError(f"You are not authorised to view the {department} dataset")

    @staticmethod
    def assert_can_operate(db: Session, user: models.User, department: str) -> None:
        from .services import AccessService

        if AccessService._is_admin(db, user.id):
            return
        matrix = DEPARTMENT_MATRIX.get(department)
        if matrix is None or not AccessService.has_role(db, user.id, *matrix["operate"]):
            raise PermissionError(f"You are not authorised to operate the {department} dataset")

    @staticmethod
    def list_records(db: Session, department: str) -> list[models.DepartmentRecord]:
        return list(db.scalars(
            select(models.DepartmentRecord)
            .where(models.DepartmentRecord.department == department)
            .order_by(models.DepartmentRecord.created_at.desc())
        ))

    @staticmethod
    def create_record(
        db: Session, department: str, payload: schemas.DepartmentRecordCreate, actor_id: str
    ) -> models.DepartmentRecord:
        record = models.DepartmentRecord(
            department=department,
            case_id=payload.case_id,
            title=payload.title,
            body=payload.body,
            created_by_user_id=actor_id,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    # ── Public complaint desk ──────────────────────────────────────────
    @staticmethod
    def create_complaint(db: Session, payload: schemas.ComplaintCreate) -> models.ComplaintToken:
        from secrets import token_hex

        if payload.department not in DEPARTMENT_MATRIX:
            raise ValueError(f"Unknown department '{payload.department}'")
        complaint = models.ComplaintToken(
            token=f"CMP-{token_hex(4).upper()}-{token_hex(4).upper()}",
            email=payload.email.lower().strip(),
            subject=payload.subject.strip(),
            details=payload.details,
            department=payload.department,
        )
        db.add(complaint)
        db.commit()
        db.refresh(complaint)
        return complaint

    @staticmethod
    def get_by_token(db: Session, token: str) -> models.ComplaintToken | None:
        return db.scalar(
            select(models.ComplaintToken).where(models.ComplaintToken.token == token.strip().upper())
        )

    @staticmethod
    def list_complaints(db: Session) -> list[models.ComplaintToken]:
        return list(db.scalars(
            select(models.ComplaintToken).order_by(models.ComplaintToken.created_at.desc())
        ))

    @staticmethod
    def set_complaint_status(db: Session, complaint_id: str, status: str) -> models.ComplaintToken:
        complaint = db.get(models.ComplaintToken, complaint_id)
        if complaint is None:
            raise LookupError("Complaint not found")
        complaint.status = status
        complaint.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(complaint)
        return complaint
