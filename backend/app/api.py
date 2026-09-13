from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import get_db
from .schemas import (
    AccessGrantCreate,
    AccessGrantOut,
    CaseCreate,
    CaseOut,
    DocumentCreate,
    DocumentDetailOut,
    DocumentOut,
    DocumentVersionCreate,
    DocumentVersionOut,
    ExternalReferenceCreate,
    IdentityVerificationCreate,
    IntegrityVerifyCreate,
    IntegrityVerifyOut,
    MessageOut,
    OriginalRecordCreate,
    TagCreate,
    TagOut,
    UserCreate,
    UserOut,
)
from .services import (
    AccessService,
    CaseService,
    ClassificationService,
    DocumentService,
    RecordService,
    UserService,
)

router = APIRouter(prefix="/v1", tags=["v1"])


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    try:
        return UserService.create(db, payload)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="User already exists") from exc


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[UserOut]:
    return UserService.list(db)


@router.post("/cases", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)) -> CaseOut:
    try:
        return CaseService.create(db, payload)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Case number already exists") from exc


@router.get("/cases", response_model=list[CaseOut])
def list_cases(db: Session = Depends(get_db)) -> list[CaseOut]:
    return CaseService.list(db)


@router.post("/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(payload: DocumentCreate, db: Session = Depends(get_db)) -> DocumentOut:
    try:
        return DocumentService.create(db, payload)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid document payload") from exc


@router.get("/documents/{document_id}", response_model=DocumentDetailOut)
def get_document(document_id: str, db: Session = Depends(get_db)) -> DocumentDetailOut:
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentDetailOut(
        id=document.id,
        case_id=document.case_id,
        title=document.title,
        doc_type=document.doc_type,
        sensitivity_level=document.sensitivity_level,
        status=document.status,
        metadata={item.meta_key: item.meta_value for item in document.metadata_items},
        version_count=len(document.versions),
    )


@router.get("/documents/{document_id}/versions", response_model=list[DocumentVersionOut])
def list_document_versions(document_id: str, db: Session = Depends(get_db)) -> list[DocumentVersionOut]:
    if DocumentService.get(db, document_id) is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentService.list_versions(db, document_id)


@router.post("/documents/{document_id}/versions", response_model=DocumentVersionOut, status_code=status.HTTP_201_CREATED)
def create_document_version(
    document_id: str,
    payload: DocumentVersionCreate,
    db: Session = Depends(get_db),
) -> DocumentVersionOut:
    try:
        return DocumentService.add_version(db, document_id, payload)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to create document version") from exc


@router.post(
    "/documents/{document_id}/versions/{version_id}/verify-integrity",
    response_model=IntegrityVerifyOut,
)
def verify_document_integrity(
    document_id: str,
    version_id: str,
    payload: IntegrityVerifyCreate,
    db: Session = Depends(get_db),
) -> IntegrityVerifyOut:
    result = DocumentService.verify_integrity(db, document_id, version_id, payload)
    if result is None:
        raise HTTPException(status_code=404, detail="Document version not found")
    return result


@router.post("/access-grants", response_model=AccessGrantOut, status_code=status.HTTP_201_CREATED)
def grant_access(payload: AccessGrantCreate, db: Session = Depends(get_db)) -> AccessGrantOut:
    if not payload.case_id and not payload.document_id:
        raise HTTPException(status_code=400, detail="Either case_id or document_id is required")
    try:
        return AccessService.grant(db, payload)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to create access grant") from exc


@router.post("/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def create_tag(payload: TagCreate, db: Session = Depends(get_db)) -> TagOut:
    try:
        return ClassificationService.create_tag(db, payload)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Tag already exists") from exc


@router.post("/documents/{document_id}/tags/{tag_id}", response_model=MessageOut)
def add_tag_to_document(document_id: str, tag_id: str, db: Session = Depends(get_db)) -> MessageOut:
    try:
        ClassificationService.link_tag(db, document_id, tag_id)
        return MessageOut(message="Tag linked to document", data={"document_id": document_id, "tag_id": tag_id})
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to link tag") from exc


@router.post("/documents/{document_id}/original-record", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def attach_original_record(
    document_id: str,
    payload: OriginalRecordCreate,
    db: Session = Depends(get_db),
) -> MessageOut:
    try:
        record = RecordService.attach_original_record(db, document_id, payload)
        return MessageOut(message="Original record saved", data={"id": record.id, "document_id": document_id})
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to attach original record") from exc


@router.post("/identity-verifications", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_identity_verification(
    payload: IdentityVerificationCreate,
    db: Session = Depends(get_db),
) -> MessageOut:
    try:
        record = RecordService.create_identity_verification(db, payload)
        return MessageOut(message="Identity verification record saved", data={"id": record.id})
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to save identity verification") from exc


@router.post("/external-records", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_external_reference(payload: ExternalReferenceCreate, db: Session = Depends(get_db)) -> MessageOut:
    if not payload.case_id and not payload.document_id:
        raise HTTPException(status_code=400, detail="Either case_id or document_id is required")
    try:
        record = RecordService.create_external_reference(db, payload)
        return MessageOut(message="External reference saved", data={"id": record.id})
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to save external reference") from exc
