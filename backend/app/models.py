from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid4())


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user_roles: Mapped[list[UserRole]] = relationship(back_populates="role", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mfa_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    agency: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    clearance_level: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    roles: Mapped[list[UserRole]] = relationship(back_populates="user", cascade="all, delete-orphan")
    identity_verifications: Mapped[list[IdentityVerificationRecord]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    access_grants: Mapped[list[AuthorizedAccess]] = relationship(back_populates="user")
    case_events: Mapped[list[CaseEvent]] = relationship(back_populates="actor")


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), index=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    user: Mapped[User] = relationship(back_populates="roles")
    role: Mapped[Role] = relationship(back_populates="user_roles")


class EmailOtp(Base):
    """Email OTP challenge for viewer registration / login (V1 viewer auth).

    One row per email; a new code overwrites the previous one. The code hash
    (SHA-256 hex) is stored — never the plaintext code.
    """

    __tablename__ = "email_otps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    code_hash: Mapped[str] = mapped_column(String(128))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    documents: Mapped[list[Document]] = relationship(back_populates="case", cascade="all, delete-orphan")
    access_grants: Mapped[list[AuthorizedAccess]] = relationship(back_populates="case")
    external_references: Mapped[list[ExternalRecordReference]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )
    events: Mapped[list[CaseEvent]] = relationship(back_populates="case", cascade="all, delete-orphan")


class CaseEvent(Base):
    __tablename__ = "case_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    action: Mapped[str] = mapped_column(String(255))
    details: Mapped[str] = mapped_column(Text, default="{}")
    previous_event_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    event_hash: Mapped[str] = mapped_column(String(128), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    case: Mapped[Case] = relationship(back_populates="events")
    actor: Mapped[User | None] = relationship()


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    doc_type: Mapped[str] = mapped_column(String(80), index=True)
    sensitivity_level: Mapped[str] = mapped_column(String(30), default="restricted")
    status: Mapped[str] = mapped_column(String(30), default="active")
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    case: Mapped[Case] = relationship(back_populates="documents")
    metadata_items: Mapped[list[DocumentMetadata]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )
    versions: Mapped[list[DocumentVersion]] = relationship(back_populates="document", cascade="all, delete-orphan")
    tag_links: Mapped[list[DocumentTag]] = relationship(back_populates="document", cascade="all, delete-orphan")
    original_record: Mapped[OriginalDocumentRecord | None] = relationship(
        back_populates="document", uselist=False, cascade="all, delete-orphan"
    )
    external_references: Mapped[list[ExternalRecordReference]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )
    access_grants: Mapped[list[AuthorizedAccess]] = relationship(back_populates="document")
    transfers: Mapped[list[DocumentTransfer]] = relationship(back_populates="document", cascade="all, delete-orphan")
    child_links: Mapped[list["EvidenceLink"]] = relationship(
        back_populates="parent", foreign_keys="[EvidenceLink.parent_document_id]", cascade="all, delete-orphan"
    )
    parent_links: Mapped[list["EvidenceLink"]] = relationship(
        back_populates="child", foreign_keys="[EvidenceLink.child_document_id]", cascade="all, delete-orphan"
    )


class DocumentMetadata(Base):
    __tablename__ = "document_metadata"
    __table_args__ = (UniqueConstraint("document_id", "meta_key", name="uq_document_meta_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    meta_key: Mapped[str] = mapped_column(String(120))
    meta_value: Mapped[str] = mapped_column(Text)

    document: Mapped[Document] = relationship(back_populates="metadata_items")


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version_number", name="uq_document_version_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int] = mapped_column(Integer)
    storage_uri: Mapped[str] = mapped_column(String(500))
    content_hash: Mapped[str] = mapped_column(String(128), index=True)
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    document: Mapped[Document] = relationship(back_populates="versions")
    signatures: Mapped[list[DocumentSignature]] = relationship(back_populates="version", cascade="all, delete-orphan")


class DocumentSignature(Base):
    __tablename__ = "document_signatures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_version_id: Mapped[str] = mapped_column(ForeignKey("document_versions.id", ondelete="CASCADE"), index=True)
    signer_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    algorithm: Mapped[str] = mapped_column(String(80), default="RSA-PSS-SHA256")
    signature: Mapped[str] = mapped_column(Text)
    public_key_pem: Mapped[str] = mapped_column(Text)
    signed_hash: Mapped[str] = mapped_column(String(128), index=True)
    # Role whose per-system signing key produced this signature (e.g. "user",
    # "admin"). Null for legacy signatures made with the single system key.
    key_role: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    version: Mapped[DocumentVersion] = relationship(back_populates="signatures")


class RoleSigningKey(Base):
    """Per-system signing key provisioned per role (V2).

    Every evidence upload is signed automatically with the uploader's role
    key, so an investigator signature and an administrator signature are
    cryptographically distinct. The private key is encrypted at rest with a
    key derived from ``APP_SECRET_KEY``; only the public key is exposed.
    """

    __tablename__ = "role_signing_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    role_name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    private_key_encrypted: Mapped[str] = mapped_column(Text)
    public_key_pem: Mapped[str] = mapped_column(Text)
    algorithm: Mapped[str] = mapped_column(String(80), default="RSA-PSS-SHA256")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)


class ClassificationTag(Base):
    __tablename__ = "classification_tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    document_links: Mapped[list[DocumentTag]] = relationship(back_populates="tag", cascade="all, delete-orphan")


class DocumentTag(Base):
    __tablename__ = "document_tags"
    __table_args__ = (UniqueConstraint("document_id", "tag_id", name="uq_document_tag"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    tag_id: Mapped[str] = mapped_column(ForeignKey("classification_tags.id", ondelete="CASCADE"), index=True)

    document: Mapped[Document] = relationship(back_populates="tag_links")
    tag: Mapped[ClassificationTag] = relationship(back_populates="document_links")


class OriginalDocumentRecord(Base):
    __tablename__ = "original_document_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), unique=True, index=True
    )
    source_system: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    acquired_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    immutable_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)

    document: Mapped[Document] = relationship(back_populates="original_record")


class IdentityVerificationRecord(Base):
    __tablename__ = "identity_verification_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    verification_method: Mapped[str] = mapped_column(String(80))
    verifier: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(40), default="pending")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="identity_verifications")


class ExternalRecordReference(Base):
    __tablename__ = "external_record_references"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=True, index=True)
    document_id: Mapped[str | None] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    source_system: Mapped[str] = mapped_column(String(120))
    external_record_id: Mapped[str] = mapped_column(String(255), index=True)
    record_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    case: Mapped[Case | None] = relationship(back_populates="external_references")
    document: Mapped[Document | None] = relationship(back_populates="external_references")


class AuthorizedAccess(Base):
    __tablename__ = "authorized_access"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=True, index=True)
    document_id: Mapped[str | None] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True
    )
    purpose: Mapped[str] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    agency: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    sensitivity_level: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    access_level: Mapped[str] = mapped_column(String(50), default="read")
    valid_from: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship(back_populates="access_grants")
    case: Mapped[Case | None] = relationship(back_populates="access_grants")
    document: Mapped[Document | None] = relationship(back_populates="access_grants")


class AuditLedgerRecord(Base):
    __tablename__ = "audit_ledger_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id", ondelete="SET NULL"), nullable=True, index=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    payload_hash: Mapped[str] = mapped_column(String(128), index=True)
    previous_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    record_hash: Mapped[str] = mapped_column(String(128), unique=True)
    ledger_provider: Mapped[str] = mapped_column(String(40))
    transaction_id: Mapped[str] = mapped_column(String(255), unique=True)
    # Exact timestamp string that was folded into ``record_hash``. Persisting it
    # is what makes the hash independently re-computable for verification.
    hashed_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
class DocumentTransfer(Base):
    """Secure inter-department / inter-agency evidence handoff (V1 Step 10).

    A transfer is *not* a copy of the file: it records who is handing what to
    whom, for what stated purpose, and it seals the request with a transfer
    hash. Accepting a transfer creates the recipient's purpose-bound access
    grant and appends both events to the tamper-evident ledger.
    """

    __tablename__ = "document_transfers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    from_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    to_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    from_department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    to_department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    from_agency: Mapped[str | None] = mapped_column(String(120), nullable=True)
    to_agency: Mapped[str | None] = mapped_column(String(120), nullable=True)
    transfer_purpose: Mapped[str] = mapped_column(String(255))
    access_level: Mapped[str] = mapped_column(String(50), default="read")
    valid_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    transfer_hash: Mapped[str] = mapped_column(String(128), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    transferred_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    document: Mapped[Document] = relationship(back_populates="transfers")
    from_user: Mapped[User | None] = relationship(foreign_keys=[from_user_id])
    to_user: Mapped[User] = relationship(foreign_keys=[to_user_id])


class DepartmentRequest(Base):
    """Cross-department document access request.

    An investigator in one department files a request to access a document held
    by another department.  The request is reviewed and either approved or
    rejected by a member of the destination department (or by an admin).
    """
    __tablename__ = "department_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    from_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    from_department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    to_department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    purpose: Mapped[str] = mapped_column(String(500))
    requested_access_level: Mapped[str] = mapped_column(String(50), default="read")
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    reviewed_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    document: Mapped[Document] = relationship()
    from_user: Mapped[User] = relationship(foreign_keys=[from_user_id])
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_user_id])


class DepartmentRecord(Base):
    """A dataset entry filed under one of the case-lifecycle departments.

    Departments are the standing units that touch a case across its whole
    lifecycle (criminal records, e-forensics, police, legal, judiciary,
    forensics, prison, nyaya). A record is a short structured note, optionally
    anchored to a case, filed by an authorised officer.
    """

    __tablename__ = "department_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department: Mapped[str] = mapped_column(String(80), index=True)
    case_id: Mapped[str | None] = mapped_column(
        ForeignKey("cases.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, default="")
    created_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)


class ComplaintToken(Base):
    """Public complaint raised by a citizen/viewer against the Nyaya docket.

    The token is the only handle a complainant needs to track status; the
    email is stored so the department can reach back. Status moves
    open → acknowledged → closed as the judiciary desk works the complaint.
    """

    __tablename__ = "complaint_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    subject: Mapped[str] = mapped_column(String(255))
    details: Mapped[str] = mapped_column(Text, default="")
    department: Mapped[str] = mapped_column(String(80), default="nyaya", index=True)
    status: Mapped[str] = mapped_column(String(30), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class EvidenceLink(Base):
    """Cross-document derivation link.

    Records that ``child_document_id`` was derived from
    ``parent_document_id`` via ``relation_type`` (e.g. a CCTV frame extracted
    from source footage, a summary written from a witness statement). Together
    with the immutable-version chain, these links form the provenance graph
    that lets an investigator trace any artifact back to its source.
    """

    __tablename__ = "evidence_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    parent_document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    child_document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    relation_type: Mapped[str] = mapped_column(String(80), index=True)
    match_score: Mapped[float | None] = mapped_column(nullable=True)  # AI confidence 0-1
    match_reason: Mapped[str | None] = mapped_column(Text, nullable=True)  # AI reasoning
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    __table_args__ = (
        UniqueConstraint(
            "parent_document_id",
            "child_document_id",
            "relation_type",
            name="uq_evidence_links_parent_child_relation",
        ),
    )

    parent: Mapped[Document] = relationship(
        back_populates="child_links", foreign_keys=[parent_document_id]
    )
    child: Mapped[Document] = relationship(
        back_populates="parent_links", foreign_keys=[child_document_id]
    )
    creator: Mapped[User | None] = relationship(foreign_keys=[created_by_user_id])


# ---------------------------------------------------------------------------
# Legal Knowledge Base — IPC / CrPC / Evidence Act / CPC sections
# Used by AI to suggest applicable legal sections for a case.
# ---------------------------------------------------------------------------


class LegalArticle(Base):
    """A legal code (e.g. Indian Penal Code, CrPC, Evidence Act)."""

    __tablename__ = "legal_articles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(80), index=True)  # e.g. "IPC", "CrPC", "Evidence Act"
    name: Mapped[str] = mapped_column(String(255))  # e.g. "Indian Penal Code, 1860"
    jurisdiction: Mapped[str] = mapped_column(String(120), default="India")
    status: Mapped[str] = mapped_column(String(30), default="active")  # active, voided, amended
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    sections: Mapped[list["LegalSection"]] = relationship(
        back_populates="article", cascade="all, delete-orphan"
    )


class LegalSection(Base):
    """An individual section within a legal article (e.g. IPC 302 - Murder)."""

    __tablename__ = "legal_sections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    article_id: Mapped[str] = mapped_column(
        ForeignKey("legal_articles.id", ondelete="CASCADE"), index=True
    )
    section_number: Mapped[str] = mapped_column(String(80), index=True)  # e.g. "302", "161"
    title: Mapped[str] = mapped_column(String(255))  # e.g. "Murder"
    text: Mapped[str | None] = mapped_column(Text, nullable=True)  # full section text
    keywords: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )  # comma-separated keywords for AI matching
    jurisdiction: Mapped[str] = mapped_column(String(120), default="India")
    status: Mapped[str] = mapped_column(String(30), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    article: Mapped["LegalArticle"] = relationship(back_populates="sections")
    case_suggestions: Mapped[list["LegalSuggestedSection"]] = relationship(
        back_populates="section", cascade="all, delete-orphan"
    )


class LegalSuggestedSection(Base):
    """AI-suggested legal section for a case, pending officer verification."""

    __tablename__ = "legal_suggested_sections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    case_id: Mapped[str] = mapped_column(
        ForeignKey("cases.id", ondelete="CASCADE"), index=True
    )
    section_id: Mapped[str] = mapped_column(
        ForeignKey("legal_sections.id", ondelete="CASCADE"), index=True
    )
    match_score: Mapped[float] = mapped_column(default=0.0)  # AI confidence 0-1
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)  # AI reasoning
    status: Mapped[str] = mapped_column(
        String(30), default="suggested", index=True
    )  # suggested, accepted, dismissed
    verified_by: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    section: Mapped["LegalSection"] = relationship(back_populates="case_suggestions")
    verifier: Mapped[User | None] = relationship(foreign_keys=[verified_by])


# ---------------------------------------------------------------------------
# Official Document Templates — fillable, downloadable gov-style forms
# ---------------------------------------------------------------------------


class DocumentTemplate(Base):
    """An official document template (FIR, charge sheet, judge order, bail order, etc.)."""

    __tablename__ = "document_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)  # FIR, charge_sheet, etc.
    title: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(80), default="official-document")
    body: Mapped[str] = mapped_column(Text)  # HTML/markdown template with {{field}} placeholders
    status: Mapped[str] = mapped_column(String(30), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    fields: Mapped[list["TemplateField"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )


class TemplateField(Base):
    """A fillable field within a document template."""

    __tablename__ = "template_fields"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    template_id: Mapped[str] = mapped_column(
        ForeignKey("document_templates.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(255))
    field_type: Mapped[str] = mapped_column(String(50), default="text")  # text, textarea, select, date, file
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    default_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    options: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array for select options
    template: Mapped["DocumentTemplate"] = relationship(back_populates="fields")
