"""0001_initial_v1_schema

Creates all V1 ANVESHAN tables from scratch. This is the baseline migration
for every new environment (PostgreSQL in production, SQLite in development).

Revision ID: 5be49f6ebf03
Revises:
Create Date: 2026-09-16
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# ---------------------------------------------------------------------------
# Revision identifiers
# ---------------------------------------------------------------------------
revision: str = "5be49f6ebf03"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # roles
    # ------------------------------------------------------------------
    op.create_table(
        "roles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
    )
    op.create_index("ix_roles_name", "roles", ["name"], unique=True)

    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("mfa_enabled", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("mfa_secret", sa.String(64), nullable=True),
        sa.Column("department", sa.String(120), nullable=True),
        sa.Column("agency", sa.String(120), nullable=True),
        sa.Column("clearance_level", sa.String(30), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_department", "users", ["department"])
    op.create_index("ix_users_agency", "users", ["agency"])
    op.create_index("ix_users_clearance_level", "users", ["clearance_level"])

    # ------------------------------------------------------------------
    # user_roles
    # ------------------------------------------------------------------
    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role_id",
            sa.String(36),
            sa.ForeignKey("roles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "granted_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"])
    op.create_index("ix_user_roles_role_id", "user_roles", ["role_id"])

    # ------------------------------------------------------------------
    # cases
    # ------------------------------------------------------------------
    op.create_table(
        "cases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("case_number", sa.String(100), nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="open"),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_cases_case_number", "cases", ["case_number"], unique=True)

    # ------------------------------------------------------------------
    # case_events  (append-only audit chain)
    # ------------------------------------------------------------------
    op.create_table(
        "case_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "case_id",
            sa.String(36),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("action", sa.String(255), nullable=False),
        sa.Column("details", sa.Text, nullable=False, server_default="{}"),
        sa.Column("previous_event_hash", sa.String(128), nullable=True),
        sa.Column("event_hash", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_case_events_case_id", "case_events", ["case_id"])
    op.create_index("ix_case_events_event_type", "case_events", ["event_type"])
    op.create_index("ix_case_events_actor_user_id", "case_events", ["actor_user_id"])
    op.create_index("ix_case_events_previous_event_hash", "case_events", ["previous_event_hash"])
    op.create_index("ix_case_events_event_hash", "case_events", ["event_hash"])

    # ------------------------------------------------------------------
    # documents
    # ------------------------------------------------------------------
    op.create_table(
        "documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "case_id",
            sa.String(36),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("doc_type", sa.String(80), nullable=False),
        sa.Column("sensitivity_level", sa.String(30), nullable=False, server_default="restricted"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column(
            "created_by_user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_documents_case_id", "documents", ["case_id"])
    op.create_index("ix_documents_doc_type", "documents", ["doc_type"])

    # ------------------------------------------------------------------
    # document_metadata
    # ------------------------------------------------------------------
    op.create_table(
        "document_metadata",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("meta_key", sa.String(120), nullable=False),
        sa.Column("meta_value", sa.Text, nullable=False),
        sa.UniqueConstraint("document_id", "meta_key", name="uq_document_meta_key"),
    )
    op.create_index("ix_document_metadata_document_id", "document_metadata", ["document_id"])

    # ------------------------------------------------------------------
    # document_versions
    # ------------------------------------------------------------------
    op.create_table(
        "document_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("storage_uri", sa.String(500), nullable=False),
        sa.Column("content_hash", sa.String(128), nullable=False),
        sa.Column(
            "created_by_user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.UniqueConstraint("document_id", "version_number", name="uq_document_version_number"),
    )
    op.create_index("ix_document_versions_document_id", "document_versions", ["document_id"])
    op.create_index("ix_document_versions_content_hash", "document_versions", ["content_hash"])

    # ------------------------------------------------------------------
    # document_signatures
    # ------------------------------------------------------------------
    op.create_table(
        "document_signatures",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_version_id",
            sa.String(36),
            sa.ForeignKey("document_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "signer_user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("algorithm", sa.String(80), nullable=False, server_default="RSA-PSS-SHA256"),
        sa.Column("signature", sa.Text, nullable=False),
        sa.Column("public_key_pem", sa.Text, nullable=False),
        sa.Column("signed_hash", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_document_signatures_document_version_id", "document_signatures", ["document_version_id"])
    op.create_index("ix_document_signatures_signed_hash", "document_signatures", ["signed_hash"])

    # ------------------------------------------------------------------
    # classification_tags
    # ------------------------------------------------------------------
    op.create_table(
        "classification_tags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("category", sa.String(100), nullable=True),
    )
    op.create_index("ix_classification_tags_name", "classification_tags", ["name"], unique=True)

    # ------------------------------------------------------------------
    # document_tags
    # ------------------------------------------------------------------
    op.create_table(
        "document_tags",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tag_id",
            sa.String(36),
            sa.ForeignKey("classification_tags.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("document_id", "tag_id", name="uq_document_tag"),
    )
    op.create_index("ix_document_tags_document_id", "document_tags", ["document_id"])
    op.create_index("ix_document_tags_tag_id", "document_tags", ["tag_id"])

    # ------------------------------------------------------------------
    # original_document_records
    # ------------------------------------------------------------------
    op.create_table(
        "original_document_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("source_system", sa.String(120), nullable=True),
        sa.Column("source_reference", sa.String(255), nullable=True),
        sa.Column("acquired_at", sa.DateTime, nullable=True),
        sa.Column("immutable_hash", sa.String(128), nullable=True),
    )
    op.create_index("ix_original_document_records_document_id", "original_document_records", ["document_id"], unique=True)

    # ------------------------------------------------------------------
    # identity_verification_records
    # ------------------------------------------------------------------
    op.create_table(
        "identity_verification_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("verification_method", sa.String(80), nullable=False),
        sa.Column("verifier", sa.String(255), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("verified_at", sa.DateTime, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("ix_identity_verification_records_user_id", "identity_verification_records", ["user_id"])

    # ------------------------------------------------------------------
    # external_record_references
    # ------------------------------------------------------------------
    op.create_table(
        "external_record_references",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "case_id",
            sa.String(36),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("source_system", sa.String(120), nullable=False),
        sa.Column("external_record_id", sa.String(255), nullable=False),
        sa.Column("record_url", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_external_record_references_case_id", "external_record_references", ["case_id"])
    op.create_index("ix_external_record_references_document_id", "external_record_references", ["document_id"])
    op.create_index("ix_external_record_references_external_record_id", "external_record_references", ["external_record_id"])

    # ------------------------------------------------------------------
    # authorized_access
    # ------------------------------------------------------------------
    op.create_table(
        "authorized_access",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "case_id",
            sa.String(36),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("purpose", sa.String(255), nullable=False),
        sa.Column("department", sa.String(120), nullable=True),
        sa.Column("agency", sa.String(120), nullable=True),
        sa.Column("sensitivity_level", sa.String(30), nullable=True),
        sa.Column("access_level", sa.String(50), nullable=False, server_default="read"),
        sa.Column(
            "valid_from",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("valid_until", sa.DateTime, nullable=True),
    )
    op.create_index("ix_authorized_access_user_id", "authorized_access", ["user_id"])
    op.create_index("ix_authorized_access_case_id", "authorized_access", ["case_id"])
    op.create_index("ix_authorized_access_document_id", "authorized_access", ["document_id"])
    op.create_index("ix_authorized_access_department", "authorized_access", ["department"])
    op.create_index("ix_authorized_access_agency", "authorized_access", ["agency"])
    op.create_index("ix_authorized_access_sensitivity_level", "authorized_access", ["sensitivity_level"])

    # ------------------------------------------------------------------
    # audit_ledger_records  (blockchain-linked, append-only)
    # ------------------------------------------------------------------
    op.create_table(
        "audit_ledger_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "case_id",
            sa.String(36),
            sa.ForeignKey("cases.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "actor_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("payload_hash", sa.String(128), nullable=False),
        sa.Column("previous_hash", sa.String(128), nullable=True),
        sa.Column("record_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("ledger_provider", sa.String(40), nullable=False),
        sa.Column("transaction_id", sa.String(255), nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_audit_ledger_records_case_id", "audit_ledger_records", ["case_id"])
    op.create_index("ix_audit_ledger_records_document_id", "audit_ledger_records", ["document_id"])
    op.create_index("ix_audit_ledger_records_event_type", "audit_ledger_records", ["event_type"])
    op.create_index("ix_audit_ledger_records_record_hash", "audit_ledger_records", ["record_hash"], unique=True)


def downgrade() -> None:
    # Drop in reverse dependency order.
    op.drop_table("audit_ledger_records")
    op.drop_table("authorized_access")
    op.drop_table("external_record_references")
    op.drop_table("identity_verification_records")
    op.drop_table("original_document_records")
    op.drop_table("document_tags")
    op.drop_table("classification_tags")
    op.drop_table("document_signatures")
    op.drop_table("document_versions")
    op.drop_table("document_metadata")
    op.drop_table("documents")
    op.drop_table("case_events")
    op.drop_table("cases")
    op.drop_table("user_roles")
    op.drop_table("users")
    op.drop_table("roles")
