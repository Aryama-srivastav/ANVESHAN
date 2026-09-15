from __future__ import annotations

import hashlib
import json
import os
from typing import BinaryIO
from uuid import uuid4

from datetime import datetime, timezone

from sqlalchemy import Select, exists, select
from sqlalchemy.orm import Session

from . import models, schemas
from .storage import StorageProvider


class _HashingReader:
    def __init__(self, source: BinaryIO, maximum_bytes: int) -> None:
        self.source = source
        self.maximum_bytes = maximum_bytes
        self.hasher = hashlib.sha256()
        self.size = 0

    def read(self, size: int = -1) -> bytes:
        chunk = self.source.read(size)
        if chunk:
            self.size += len(chunk)
            if self.size > self.maximum_bytes:
                raise ValueError("Uploaded file exceeds the configured size limit")
            self.hasher.update(chunk)
        return chunk


class UserService:
    @staticmethod
    def create(db: Session, payload: schemas.UserCreate) -> models.User:
        user = models.User(email=payload.email.lower(), full_name=payload.full_name)
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
        for name, description in {
            "user": "Standard investigator",
            "admin": "Case and system administrator",
            "auditor": "Evidence audit reviewer",
        }.items():
            if db.scalar(select(models.Role).where(models.Role.name == name)) is None:
                db.add(models.Role(name=name, description=description))
        db.commit()


class CaseService:
    @staticmethod
    def create(db: Session, payload: schemas.CaseCreate, actor_id: str) -> models.Case:
        case = models.Case(
            case_number=payload.case_number,
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
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def list(db: Session) -> list[models.Case]:
        stmt: Select[tuple[models.Case]] = select(models.Case).order_by(models.Case.created_at.desc())
        return list(db.scalars(stmt))

    @staticmethod
    def list_for_user(db: Session, user_id: str) -> list[models.Case]:
        if AccessService._is_admin(db, user_id):
            return CaseService.list(db)
        stmt: Select[tuple[models.Case]] = (
            select(models.Case)
            .join(models.AuthorizedAccess, models.AuthorizedAccess.case_id == models.Case.id)
            .where(models.AuthorizedAccess.user_id == user_id)
            .order_by(models.Case.created_at.desc())
        )
        return list(db.scalars(stmt).unique())


class CaseEventService:
    @staticmethod
    def create(
        db: Session,
        case_id: str,
        actor_user_id: str | None,
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
        content_type: str | None,
        storage: StorageProvider,
        created_by_user_id: str | None = None,
        notes: str | None = None,
    ) -> models.DocumentVersion:
        document = db.get(models.Document, document_id)
        if document is None:
            raise LookupError("Document not found")

        latest_number = db.scalar(
            select(models.DocumentVersion.version_number)
            .where(models.DocumentVersion.document_id == document_id)
            .order_by(models.DocumentVersion.version_number.desc())
            .limit(1)
        )
        version_number = (latest_number or 0) + 1
        key = f"cases/{document.case_id}/documents/{document_id}/versions/{uuid4()}"
        reader = _HashingReader(source, int(os.getenv("MAX_UPLOAD_BYTES", str(100 * 1024 * 1024))))
        storage_uri: str | None = None
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
    @staticmethod
    def require_case_access(db: Session, user_id: str, case_id: str, required_level: str = "read") -> None:
        if AccessService._is_admin(db, user_id):
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
        department: str | None = None,
        agency: str | None = None,
        sensitivity_level: str | None = None,
    ) -> None:
        if AccessService._is_admin(db, user_id):
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
    def _has_grant(
        db: Session,
        user_id: str,
        *,
        case_id: str | None = None,
        document_id: str | None = None,
        required_level: str,
        department: str | None = None,
        agency: str | None = None,
        sensitivity_level: str | None = None,
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
            if department is not None and grant.department is not None and grant.department != department:
                continue
            if agency is not None and grant.agency is not None and grant.agency != agency:
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


class ClassificationService:
    @staticmethod
    def create_tag(db: Session, payload: schemas.TagCreate) -> models.ClassificationTag:
        tag = models.ClassificationTag(name=payload.name, category=payload.category)
        db.add(tag)
        db.commit()
        db.refresh(tag)
        return tag

    @staticmethod
    def link_tag(db: Session, document_id: str, tag_id: str) -> models.DocumentTag:
        link = models.DocumentTag(document_id=document_id, tag_id=tag_id)
        db.add(link)
        db.commit()
        db.refresh(link)
        return link


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
