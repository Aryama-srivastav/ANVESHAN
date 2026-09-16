from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=12)
    department: str | None = None
    agency: str | None = None
    clearance_level: str | None = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    mfa_enabled: bool = False
    department: str | None = None
    agency: str | None = None
    clearance_level: str | None = None

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
    challenge_token: str | None = None
    access_token: str | None = None
    token_type: str = "bearer"


class MfaVerifyRequest(BaseModel):
    challenge_token: str
    code: str = Field(pattern=r"^\d{6}$")


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetRequestOut(BaseModel):
    message: str
    development_reset_token: str | None = None


class PasswordResetConfirm(BaseModel):
    reset_token: str
    new_password: str = Field(min_length=12)


class MfaSetupOut(BaseModel):
    secret: str
    provisioning_uri: str


class CaseCreate(BaseModel):
    case_number: str
    title: str
    description: str | None = None


class CaseOut(BaseModel):
    id: str
    case_number: str
    title: str
    description: str | None
    status: str

    model_config = {"from_attributes": True}


class CaseEventCreate(BaseModel):
    event_type: str
    action: str
    details: dict[str, Any] = Field(default_factory=dict)


class CaseEventOut(BaseModel):
    id: str
    case_id: str
    actor_user_id: str | None
    event_type: str
    action: str
    details: dict[str, Any]
    previous_event_hash: str | None
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
    signer_user_id: str | None
    algorithm: str
    signed_hash: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SignatureVerifyOut(BaseModel):
    signature_id: str
    verified: bool
    signed_hash: str


class AccessGrantCreate(BaseModel):
    user_id: str
    case_id: str | None = None
    document_id: str | None = None
    purpose: str
    department: str | None = None
    agency: str | None = None
    sensitivity_level: str | None = None
    access_level: str = "read"
    valid_until: datetime | None = None


class AccessGrantOut(BaseModel):
    id: str
    user_id: str
    case_id: str | None
    document_id: str | None
    purpose: str
    department: str | None = None
    agency: str | None = None
    sensitivity_level: str | None = None
    access_level: str
    valid_from: datetime
    valid_until: datetime | None

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str
    category: str | None = None


class TagOut(BaseModel):
    id: str
    name: str
    category: str | None

    model_config = {"from_attributes": True}


class OriginalRecordCreate(BaseModel):
    source_system: str | None = None
    source_reference: str | None = None
    acquired_at: datetime | None = None
    immutable_hash: str | None = None


class IdentityVerificationCreate(BaseModel):
    user_id: str
    verification_method: str
    verifier: str
    status: str = "pending"
    verified_at: datetime | None = None
    notes: str | None = None


class ExternalReferenceCreate(BaseModel):
    case_id: str | None = None
    document_id: str | None = None
    source_system: str
    external_record_id: str
    record_url: str | None = None


class MessageOut(BaseModel):
    message: str
    data: dict[str, Any] | None = None
