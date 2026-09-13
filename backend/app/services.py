from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from . import models, schemas


class UserService:
    @staticmethod
    def create(db: Session, payload: schemas.UserCreate) -> models.User:
        user = models.User(email=payload.email.lower(), full_name=payload.full_name)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def list(db: Session) -> list[models.User]:
        stmt: Select[tuple[models.User]] = select(models.User).order_by(models.User.created_at.desc())
        return list(db.scalars(stmt))


class CaseService:
    @staticmethod
    def create(db: Session, payload: schemas.CaseCreate) -> models.Case:
        case = models.Case(
            case_number=payload.case_number,
            title=payload.title,
            description=payload.description,
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def list(db: Session) -> list[models.Case]:
        stmt: Select[tuple[models.Case]] = select(models.Case).order_by(models.Case.created_at.desc())
        return list(db.scalars(stmt))


class DocumentService:
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
    def add_version(db: Session, document_id: str, payload: schemas.DocumentVersionCreate) -> models.DocumentVersion:
        latest_number = db.scalar(
            select(models.DocumentVersion.version_number)
            .where(models.DocumentVersion.document_id == document_id)
            .order_by(models.DocumentVersion.version_number.desc())
            .limit(1)
        )
        version = models.DocumentVersion(
            document_id=document_id,
            version_number=(latest_number or 0) + 1,
            storage_uri=payload.storage_uri,
            content_hash=payload.content_hash,
            created_by_user_id=payload.created_by_user_id,
            notes=payload.notes,
        )
        db.add(version)
        db.commit()
        db.refresh(version)
        return version


class AccessService:
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
