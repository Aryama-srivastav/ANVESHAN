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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    version: Mapped[DocumentVersion] = relationship(back_populates="signatures")


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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
