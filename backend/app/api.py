from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import select

from . import models
from .db import get_db
from .auth import get_current_user
from .models import User
from .schemas import (
    AccessGrantCreate,
    AccessGrantOut,
    CaseCreate,
    CaseEventCreate,
    CaseEventOut,
    CaseOut,
    DocumentCreate,
    DocumentDetailOut,
    DocumentOut,
    DocumentVersionOut,
    ExternalReferenceCreate,
    IdentityVerificationCreate,
    IntegrityVerifyOut,
    MessageOut,
    MfaSetupOut,
    OriginalRecordCreate,
    TagCreate,
    TagOut,
    SignatureOut,
    SignatureVerifyOut,
    UserCreate,
    UserOut,
    UserMeOut,
    RoleAssignRequest,
)
from .services import (
    AccessService,
    CaseEventService,
    CaseService,
    ClassificationService,
    DocumentService,
    RecordService,
    UserService,
)
from .storage import StorageError, get_storage
from .signatures import SignatureService
from .ledger import AuditLedger, LedgerError

router = APIRouter(prefix="/v1", tags=["v1"], dependencies=[Depends(get_current_user)])


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> UserOut:
    try:
        if not AccessService._is_admin(db, current_user.id):
            raise PermissionError("Administrator role required")
        return UserService.create(db, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="User already exists") from exc


@router.get("/users/me", response_model=UserMeOut)
def get_current_user_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> UserMeOut:
    roles = [ur.role.name for ur in current_user.roles] if current_user.roles else []
    return UserMeOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        mfa_enabled=current_user.mfa_enabled,
        department=current_user.department,
        agency=current_user.agency,
        clearance_level=current_user.clearance_level,
        roles=roles,
    )


@router.post("/roles/{user_id}/assign", response_model=MessageOut)
def assign_role(user_id: str, payload: RoleAssignRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> MessageOut:
    if not AccessService._is_admin(db, current_user.id):
        raise HTTPException(status_code=403, detail="Administrator role required")
    
    target_user = db.get(models.User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    role = db.scalar(select(models.Role).where(models.Role.name == payload.role_name))
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    existing = db.scalar(select(models.UserRole).where(models.UserRole.user_id == user_id, models.UserRole.role_id == role.id))
    if existing:
        return MessageOut(message="Role already assigned")
        
    db.add(models.UserRole(user_id=user_id, role_id=role.id))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to assign role") from exc
        
    return MessageOut(message=f"Role '{payload.role_name}' assigned successfully")


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[UserOut]:
    if not AccessService._is_admin(db, current_user.id):
        raise HTTPException(status_code=403, detail="Administrator role required")
    return UserService.list(db)


@router.get("/users/{user_id}/mfa-enrollment", response_model=MfaSetupOut)
def get_mfa_enrollment(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> MfaSetupOut:
    if not AccessService._is_admin(db, current_user.id):
        raise HTTPException(status_code=403, detail="Administrator role required")
    user = db.get(User, user_id)
    if user is None or not user.mfa_secret:
        raise HTTPException(status_code=404, detail="MFA enrollment is unavailable")
    return MfaSetupOut(
        secret=user.mfa_secret,
        provisioning_uri=f"otpauth://totp/ANVESHAN:{user.email}?secret={user.mfa_secret}&issuer=ANVESHAN",
    )


@router.post("/cases", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CaseOut:
    try:
        return CaseService.create(db, payload, current_user.id)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Case number already exists") from exc


@router.get("/cases", response_model=list[CaseOut])
def list_cases(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[CaseOut]:
    return CaseService.list_for_user(db, current_user.id)


@router.get("/cases/{case_id}", response_model=CaseOut)
def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CaseOut:
    case = db.get(models.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        AccessService.require_case_access(db, current_user.id, case_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return case


@router.put("/cases/{case_id}", response_model=CaseOut)
def update_case(
    case_id: str,
    payload: CaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CaseOut:
    case = db.get(models.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        AccessService.require_case_access(db, current_user.id, case_id, required_level="write")
        
        updates_made = False
        if payload.title is not None and payload.title != case.title:
            case.title = payload.title
            updates_made = True
        if payload.description is not None and payload.description != case.description:
            case.description = payload.description
            updates_made = True
        if payload.status is not None and payload.status != case.status:
            case.status = payload.status
            updates_made = True
            
        if updates_made:
            db.commit()
            db.refresh(case)
            # Log the edit/status change
            event = CaseEventCreate(
                event_type="case_updated",
                action=f"Case updated. Status: {case.status}",
                details={"title": case.title, "status": case.status}
            )
            CaseEventService.create(db, case_id, current_user.id, event)
            
        return case
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/cases/{case_id}/documents", response_model=list[DocumentOut])
def list_case_documents(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentOut]:
    case = db.get(models.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        AccessService.require_case_access(db, current_user.id, case_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    stmt = select(models.Document).where(models.Document.case_id == case_id).order_by(models.Document.created_at.desc())
    return list(db.scalars(stmt))


@router.get("/cases/{case_id}/audit-trail", response_model=list[CaseEventOut])
def get_case_audit_trail(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CaseEventOut]:
    case = db.get(models.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        AccessService.require_case_access(db, current_user.id, case_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    events = CaseEventService.list_for_case(db, case_id)
    return [
        CaseEventOut(
            id=event.id,
            case_id=event.case_id,
            actor_user_id=event.actor_user_id,
            event_type=event.event_type,
            action=event.action,
            details=json.loads(event.details) if event.details else {},
            previous_event_hash=event.previous_event_hash,
            event_hash=event.event_hash,
            created_at=event.created_at,
        )
        for event in events
    ]



@router.post("/cases/{case_id}/events", response_model=CaseEventOut, status_code=status.HTTP_201_CREATED)
def create_case_event(
    case_id: str,
    payload: CaseEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CaseEventOut:
    case = db.get(models.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        AccessService.require_case_access(db, current_user.id, case_id, "write")
        event = CaseEventService.create(db, case_id, current_user.id, payload)
        return CaseEventOut(
            id=event.id,
            case_id=event.case_id,
            actor_user_id=event.actor_user_id,
            event_type=event.event_type,
            action=event.action,
            details=json.loads(event.details) if event.details else {},
            previous_event_hash=event.previous_event_hash,
            event_hash=event.event_hash,
            created_at=event.created_at,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to append case event") from exc
    except LedgerError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/cases/{case_id}/events", response_model=list[CaseEventOut])
def list_case_events(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CaseEventOut]:
    case = db.get(models.Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        AccessService.require_case_access(db, current_user.id, case_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    events = CaseEventService.list_for_case(db, case_id)
    return [
        CaseEventOut(
            id=event.id,
            case_id=event.case_id,
            actor_user_id=event.actor_user_id,
            event_type=event.event_type,
            action=event.action,
            details=json.loads(event.details) if event.details else {},
            previous_event_hash=event.previous_event_hash,
            event_hash=event.event_hash,
            created_at=event.created_at,
        )
        for event in events
    ]


@router.post("/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentOut:
    try:
        AccessService.require_case_access(db, current_user.id, payload.case_id, "write")
        return DocumentService.create(db, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid document payload") from exc


@router.get("/documents/{document_id}", response_model=DocumentDetailOut)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentDetailOut:
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
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
def list_document_versions(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentVersionOut]:
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return DocumentService.list_versions(db, document_id)


@router.post(
    "/documents/{document_id}/upload",
    response_model=DocumentVersionOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_document_version(
    document_id: str,
    file: UploadFile = File(...),
    created_by_user_id: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentVersionOut:
    try:
        document = DocumentService.get(db, document_id)
        if document is None:
            raise LookupError("Document not found")
        AccessService.require_document_access(db, current_user.id, document, "write")
        return DocumentService.upload_version(
            db,
            document_id,
            file.file,
            file.content_type,
            get_storage(),
            current_user.id,
            notes,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to persist uploaded evidence") from exc
    except LedgerError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/documents/{document_id}/versions/{version_id}/verify-integrity",
    response_model=IntegrityVerifyOut,
)
def verify_document_integrity(
    document_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrityVerifyOut:
    try:
        document = DocumentService.get(db, document_id)
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")
        AccessService.require_document_access(db, current_user.id, document)
        result = DocumentService.verify_integrity(db, document_id, version_id, get_storage())
    except LookupError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Document version not found")
    return result


@router.post("/documents/{document_id}/versions/{version_id}/sign", response_model=SignatureOut, status_code=status.HTTP_201_CREATED)
def sign_document_version(document_id: str, version_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> SignatureOut:
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document, "write")
        version = DocumentService.get_version(db, document_id, version_id)
        if version is None:
            raise HTTPException(status_code=404, detail="Document version not found")
        signature = SignatureService.sign(db, version, current_user.id)
        AuditLedger.record(db, event_type="document_signed", actor_user_id=current_user.id, case_id=document.case_id,
                           document_id=document.id, payload={"signature_id": signature.id, "version_id": version_id})
        db.commit()
        db.refresh(signature)
        return signature
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LedgerError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/documents/{document_id}/versions/{version_id}/signatures/{signature_id}/verify", response_model=SignatureVerifyOut)
def verify_signature(document_id: str, version_id: str, signature_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> SignatureVerifyOut:
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    result = SignatureService.verify(db, signature_id)
    if result is None or result[0].document_version_id != version_id:
        raise HTTPException(status_code=404, detail="Signature not found")
    signature, verified = result
    return SignatureVerifyOut(signature_id=signature.id, verified=verified, signed_hash=signature.signed_hash)


@router.get("/documents/{document_id}/versions/{version_id}/content")
def download_document_version(
    document_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    version = DocumentService.get_version(db, document_id, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Document version not found")
    try:
        content = get_storage().open(version.storage_uri)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail="Stored evidence was not found") from exc
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return StreamingResponse(content, media_type="application/octet-stream")


@router.post("/access-grants", response_model=AccessGrantOut, status_code=status.HTTP_201_CREATED)
def grant_access(
    payload: AccessGrantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccessGrantOut:
    if not payload.case_id and not payload.document_id:
        raise HTTPException(status_code=400, detail="Either case_id or document_id is required")
    try:
        if payload.document_id:
            document = DocumentService.get(db, payload.document_id)
            if document is None:
                raise HTTPException(status_code=404, detail="Document not found")
            AccessService.require_document_access(db, current_user.id, document, "admin")
        else:
            AccessService.require_case_access(db, current_user.id, payload.case_id, "admin")
        return AccessService.grant(db, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to create access grant") from exc


@router.post("/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def create_tag(payload: TagCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> TagOut:
    try:
        if not AccessService._is_admin(db, current_user.id):
            raise PermissionError("Administrator role required")
        return ClassificationService.create_tag(db, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Tag already exists") from exc


@router.get("/tags", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[TagOut]:
    stmt = select(models.ClassificationTag).order_by(models.ClassificationTag.name)
    return list(db.scalars(stmt))


@router.get("/documents/{document_id}/tags", response_model=list[TagOut])
def list_document_tags(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TagOut]:
    document = DocumentService.get(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        AccessService.require_document_access(db, current_user.id, document)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    stmt = (
        select(models.ClassificationTag)
        .join(models.DocumentTag, models.DocumentTag.tag_id == models.ClassificationTag.id)
        .where(models.DocumentTag.document_id == document_id)
    )
    return list(db.scalars(stmt))



@router.post("/documents/{document_id}/tags/{tag_id}", response_model=MessageOut)
def add_tag_to_document(
    document_id: str,
    tag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    try:
        document = DocumentService.get(db, document_id)
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")
        AccessService.require_document_access(db, current_user.id, document, "write")
        ClassificationService.link_tag(db, document_id, tag_id)
        return MessageOut(message="Tag linked to document", data={"document_id": document_id, "tag_id": tag_id})
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to link tag") from exc


@router.post("/documents/{document_id}/original-record", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def attach_original_record(
    document_id: str,
    payload: OriginalRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    try:
        document = DocumentService.get(db, document_id)
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")
        AccessService.require_document_access(db, current_user.id, document, "write")
        record = RecordService.attach_original_record(db, document_id, payload)
        return MessageOut(message="Original record saved", data={"id": record.id, "document_id": document_id})
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to attach original record") from exc


@router.post("/identity-verifications", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_identity_verification(
    payload: IdentityVerificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    try:
        if payload.user_id != current_user.id and not AccessService._is_admin(db, current_user.id):
            raise PermissionError("Administrator role required to verify another user")
        record = RecordService.create_identity_verification(db, payload)
        return MessageOut(message="Identity verification record saved", data={"id": record.id})
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to save identity verification") from exc


@router.post("/external-records", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_external_reference(
    payload: ExternalReferenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    if not payload.case_id and not payload.document_id:
        raise HTTPException(status_code=400, detail="Either case_id or document_id is required")
    try:
        if payload.document_id:
            document = DocumentService.get(db, payload.document_id)
            if document is None:
                raise HTTPException(status_code=404, detail="Document not found")
            AccessService.require_document_access(db, current_user.id, document, "write")
        else:
            AccessService.require_case_access(db, current_user.id, payload.case_id, "write")
        record = RecordService.create_external_reference(db, payload)
        return MessageOut(message="External reference saved", data={"id": record.id})
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to save external reference") from exc
