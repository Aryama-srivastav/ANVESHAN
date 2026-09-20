
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=12)
    department: Optional[str] = None
    agency: Optional[str] = None
    clearance_level: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    mfa_enabled: bool = False
    department: Optional[str] = None
    agency: Optional[str] = None
    clearance_level: Optional[str] = None

    model_config = {"from_attributes": True}


class UserMeOut(UserOut):
    """Extended user info returned by GET /v1/users/me — includes the role list."""
    roles: list[str] = Field(default_factory=list)


class RoleAssignRequest(BaseModel):
    """Body for POST /v1/users/{user_id}/roles."""
    role_name: str


class PrototypeLoginRequest(BaseModel):
    role: str
    password: str


class ViewerRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)


class ViewerLoginRequest(BaseModel):
    email: EmailStr
    password: str


class ViewerVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class ViewerAuthOut(BaseModel):
    message: str
    mfa_required: bool = True
    development_code: Optional[str] = None


class PrototypeLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginChallengeOut(BaseModel):
    mfa_required: bool
    challenge_token: Optional[str] = None
    access_token: Optional[str] = None
    token_type: str = "bearer"


class MfaVerifyRequest(BaseModel):
    challenge_token: str
    code: str = Field(pattern=r"^\d{6}$")


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetRequestOut(BaseModel):
    message: str
    development_reset_token: Optional[str] = None


class PasswordResetConfirm(BaseModel):
    reset_token: str
    new_password: str = Field(min_length=12)


class MfaSetupOut(BaseModel):
    secret: str
    provisioning_uri: str


class CaseCreate(BaseModel):
    case_number: Optional[str] = None
    title: str
    description: Optional[str] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class CaseOut(BaseModel):
    id: str
    case_number: str
    title: str
    description: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CaseEventCreate(BaseModel):
    event_type: str
    action: str
    details: dict[str, Any] = Field(default_factory=dict)


class CaseEventOut(BaseModel):
    id: str
    case_id: str
    actor_user_id: Optional[str]
    event_type: str
    action: str
    details: dict[str, Any]
    previous_event_hash: Optional[str]
    event_hash: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentCreate(BaseModel):
    case_id: str
    title: str
    doc_type: str
    sensitivity_level: str = "restricted"
    metadata: dict[str, str] = Field(default_factory=dict)


class DocumentOut(BaseModel):
    id: str
    case_id: str
    title: str
    doc_type: str
    sensitivity_level: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentDetailOut(DocumentOut):
    metadata: dict[str, str]
    version_count: int


class DocumentVersionOut(BaseModel):
    id: str
    document_id: str
    version_number: int
    storage_uri: str
    content_hash: str
    created_at: datetime

    model_config = {"from_attributes": True}


class IntegrityVerifyOut(BaseModel):
    document_id: str
    version_id: str
    version_number: int
    expected_hash: str
    observed_hash: str
    verified: bool


class SignatureOut(BaseModel):
    id: str
    document_version_id: str
    signer_user_id: Optional[str]
    algorithm: str
    signed_hash: str
    key_role: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Document lineage verification (V2) — cross-version tamper detection
# ---------------------------------------------------------------------------


class LineageVersionOut(BaseModel):
    version_id: str
    version_number: int
    is_original: bool
    recorded_hash: str
    anchored_hash: Optional[str] = None
    byte_status: str = "unverified"
    record_status: str = "unanchored"


class DocumentLineageOut(BaseModel):
    document_id: str
    intact: bool
    issues: list[str] = Field(default_factory=list)
    versions: list[LineageVersionOut] = Field(default_factory=list)


class SignatureVerifyOut(BaseModel):
    signature_id: str
    verified: bool
    signed_hash: str


class AccessGrantCreate(BaseModel):
    user_id: str
    case_id: Optional[str] = None
    document_id: Optional[str] = None
    purpose: str
    department: Optional[str] = None
    agency: Optional[str] = None
    sensitivity_level: Optional[str] = None
    access_level: str = "read"
    valid_until: datetime | None = None


class AccessGrantOut(BaseModel):
    id: str
    user_id: str
    case_id: Optional[str]
    document_id: Optional[str]
    purpose: str
    department: Optional[str] = None
    agency: Optional[str] = None
    sensitivity_level: Optional[str] = None
    access_level: str
    valid_from: datetime
    valid_until: datetime | None

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str
    category: Optional[str] = None


class TagOut(BaseModel):
    id: str
    name: str
    category: Optional[str]

    model_config = {"from_attributes": True}


class OriginalRecordCreate(BaseModel):
    source_system: Optional[str] = None
    source_reference: Optional[str] = None
    acquired_at: datetime | None = None
    immutable_hash: Optional[str] = None


class IdentityVerificationCreate(BaseModel):
    user_id: str
    verification_method: str
    verifier: str
    status: str = "pending"
    verified_at: datetime | None = None
    notes: Optional[str] = None


class ExternalReferenceCreate(BaseModel):
    case_id: Optional[str] = None
    document_id: Optional[str] = None
    source_system: str
    external_record_id: str
    record_url: Optional[str] = None


class MessageOut(BaseModel):
    message: str
    data: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Search (V1 Step 8)
# ---------------------------------------------------------------------------


class SearchHitOut(BaseModel):
    document_id: str
    case_id: str
    case_number: str
    case_title: str
    title: str
    doc_type: str
    sensitivity_level: str
    score: float
    excerpt: str
    tags: list[str] = Field(default_factory=list)
    entities: dict[str, list[str]] = Field(default_factory=dict)
    matched_fields: list[str] = Field(default_factory=list)
    activity_at: datetime
    version_count: int = 0


class SearchFacetsOut(BaseModel):
    entities: dict[str, list[str]] = Field(default_factory=dict)
    doc_types: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    sensitivity_levels: list[str] = Field(default_factory=list)


class SearchResponseOut(BaseModel):
    query: str = ""
    total: int = 0
    limit: int = 25
    offset: int = 0
    took_ms: int = 0
    hits: list[SearchHitOut] = Field(default_factory=list)
    facets: SearchFacetsOut = Field(default_factory=SearchFacetsOut)


# ---------------------------------------------------------------------------
# ML classification & tagging (V1 Step 9)
# ---------------------------------------------------------------------------


class MlSuggestionOut(BaseModel):
    document_id: str
    engine: str
    status: str
    category: str
    confidence: float = 0.0
    tags: list[str] = Field(default_factory=list)
    entities: dict[str, list[str]] = Field(default_factory=dict)
    scores: dict[str, float] = Field(default_factory=dict)
    excerpt: str = ""
    scored_at: Optional[str] = None


class MlAcceptRequest(BaseModel):
    """Human confirmation. Omit ``tags`` to accept every suggestion."""

    tags: list[str] | None = None
    category: Optional[str] = None


# ---------------------------------------------------------------------------
# Tamper-evident audit ledger (V1 Step 13)
# ---------------------------------------------------------------------------


class AuditTrailRecordOut(BaseModel):
    id: str
    case_id: Optional[str]
    document_id: Optional[str]
    actor_user_id: Optional[str]
    event_type: str
    payload_hash: str
    previous_hash: Optional[str]
    record_hash: str
    ledger_provider: str
    transaction_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Secure inter-department / inter-agency transfer (V1 Step 10)
# ---------------------------------------------------------------------------


class TransferCreate(BaseModel):
    document_id: str
    to_user_id: str
    transfer_purpose: str = Field(min_length=3)
    access_level: str = "read"
    valid_until: datetime | None = None


class TransferOut(BaseModel):
    id: str
    document_id: str
    from_user_id: Optional[str]
    to_user_id: str
    from_department: Optional[str]
    to_department: Optional[str]
    from_agency: Optional[str]
    to_agency: Optional[str]
    transfer_purpose: str
    access_level: str
    status: str
    transfer_hash: str
    created_at: datetime
    transferred_at: datetime | None
    accepted_at: datetime | None

    model_config = {"from_attributes": True}


class TransferDetailOut(TransferOut):
    document_title: Optional[str] = None
    case_id: Optional[str] = None
    case_number: Optional[str] = None
    audit_reference: list[AuditTrailRecordOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Audit trail / blockchain verification (V1 Step 13)
# ---------------------------------------------------------------------------


class AuditTrailVerifyOut(BaseModel):
    record_id: str
    verified: bool
    expected_hash: str
    observed_hash: str
    chain_linked: bool
    ledger_provider: str
    transaction_id: str
    detail: str


# ---------------------------------------------------------------------------
# Government identity verification (V1 Step 11)
# ---------------------------------------------------------------------------


class GovIdVerifyRequest(BaseModel):
    user_id: str
    id_type: str = "aadhaar"
    id_number: str = Field(min_length=4)
    full_name: Optional[str] = None


class GovIdVerifyOut(BaseModel):
    verification_id: str
    user_id: str
    status: str
    provider: str
    reference: Optional[str] = None
    detail: str


class IdentityVerificationOut(BaseModel):
    id: str
    user_id: str
    verification_method: str
    verifier: str
    status: str
    verified_at: datetime | None
    notes: Optional[str]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Original record, integrity summary, external records
# ---------------------------------------------------------------------------


class OriginalRecordOut(BaseModel):
    id: str
    document_id: str
    source_system: Optional[str]
    source_reference: Optional[str]
    acquired_at: datetime | None
    immutable_hash: Optional[str]

    model_config = {"from_attributes": True}


class IntegritySummaryItemOut(BaseModel):
    version_id: str
    version_number: int
    is_original: bool
    expected_hash: str
    observed_hash: Optional[str] = None
    status: str
    created_at: datetime


class IntegritySummaryOut(BaseModel):
    document_id: str
    versions: list[IntegritySummaryItemOut] = Field(default_factory=list)
    intact: bool


class ExternalReferenceOut(BaseModel):
    id: str
    case_id: Optional[str]
    document_id: Optional[str]
    source_system: str
    external_record_id: str
    record_url: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Operations
# ---------------------------------------------------------------------------


class BackupStatusOut(BaseModel):
    storage_provider: str
    encryption_enabled: bool
    backup_dir: str
    database_scheme: str
    backups: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Inter-department document access requests
# ---------------------------------------------------------------------------


class DepartmentRequestCreate(BaseModel):
    document_id: str
    purpose: str = Field(min_length=3)
    requested_access_level: str = "read"
    to_department: Optional[str] = Field(
        default=None,
        description="Destination department that owns the evidence; defaults to the document holder's department.",
    )
    from_department: Optional[str] = None


class DepartmentRequestOut(BaseModel):
    id: str
    document_id: str
    document_title: Optional[str] = None
    from_user_id: str
    from_user_name: Optional[str] = None
    from_department: Optional[str] = None
    to_department: Optional[str] = None
    purpose: str
    requested_access_level: str
    status: str
    review_notes: Optional[str] = None
    reviewed_by_user_id: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DepartmentRequestAction(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    review_notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Case-lifecycle departments & public complaint tokens (Nyaya)
# ---------------------------------------------------------------------------


class DepartmentOut(BaseModel):
    key: str
    name: str
    description: str
    can_operate: bool
    can_view: bool


class DepartmentRecordCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    body: str = ""
    case_id: Optional[str] = None


class DepartmentRecordOut(BaseModel):
    id: str
    department: str
    case_id: Optional[str]
    case_number: Optional[str] = None
    title: str
    body: str
    created_by_user_id: Optional[str]
    created_by_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ComplaintCreate(BaseModel):
    email: EmailStr
    subject: str = Field(min_length=5, max_length=255)
    details: str = ""
    department: str = "nyaya"


class ComplaintOut(BaseModel):
    id: str
    token: str
    email: str
    subject: str
    details: str
    department: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ComplaintStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|acknowledged|closed)$")


