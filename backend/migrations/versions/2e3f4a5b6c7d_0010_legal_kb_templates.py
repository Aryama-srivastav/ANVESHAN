"""0010_legal_kb_templates

Adds Legal Knowledge Base tables (legal_articles, legal_sections,
legal_suggested_sections) and Official Document Template tables
(document_templates, template_fields).

Revision ID: 2e3f4a5b6c7d
Revises: 1d4e2f6a8b3c
Create Date: 2026-10-27 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "2e3f4a5b6c7d"
down_revision: Union[str, Sequence[str], None] = "1d4e2f6a8b3c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create legal KB and template tables."""
    op.create_table(
        "legal_articles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False, index=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("jurisdiction", sa.String(length=120), nullable=False, server_default="India"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_legal_articles_code", "legal_articles", ["code"])

    op.create_table(
        "legal_sections",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("article_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("section_number", sa.String(length=80), nullable=False, index=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("keywords", sa.String(length=500), nullable=True),
        sa.Column("jurisdiction", sa.String(length=120), nullable=False, server_default="India"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["article_id"], ["legal_articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_legal_sections_article_id", "legal_sections", ["article_id"])
    op.create_index("ix_legal_sections_section_number", "legal_sections", ["section_number"])

    op.create_table(
        "legal_suggested_sections",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("section_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("match_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="suggested", index=True),
        sa.Column("verified_by", sa.String(length=36), nullable=True, index=True),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["section_id"], ["legal_sections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["verified_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_legal_suggested_sections_case_id", "legal_suggested_sections", ["case_id"])
    op.create_index("ix_legal_suggested_sections_section_id", "legal_suggested_sections", ["section_id"])
    op.create_index("ix_legal_suggested_sections_status", "legal_suggested_sections", ["status"])

    op.create_table(
        "document_templates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False, unique=True, index=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False, server_default="official-document"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_templates_slug", "document_templates", ["slug"], unique=True)

    op.create_table(
        "template_fields",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("template_id", sa.String(length=36), nullable=False, index=True),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("field_type", sa.String(length=50), nullable=False, server_default="text"),
        sa.Column("required", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("default_value", sa.String(length=500), nullable=True),
        sa.Column("options", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["template_id"], ["document_templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_template_fields_template_id", "template_fields", ["template_id"])


def downgrade() -> None:
    """Drop legal KB and template tables."""
    op.drop_index("ix_template_fields_template_id", table_name="template_fields")
    op.drop_table("template_fields")
    op.drop_index("ix_document_templates_slug", table_name="document_templates")
    op.drop_table("document_templates")
    op.drop_index("ix_legal_suggested_sections_status", table_name="legal_suggested_sections")
    op.drop_index("ix_legal_suggested_sections_section_id", table_name="legal_suggested_sections")
    op.drop_index("ix_legal_suggested_sections_case_id", table_name="legal_suggested_sections")
    op.drop_table("legal_suggested_sections")
    op.drop_index("ix_legal_sections_section_number", table_name="legal_sections")
    op.drop_index("ix_legal_sections_article_id", table_name="legal_sections")
    op.drop_table("legal_sections")
    op.drop_index("ix_legal_articles_code", table_name="legal_articles")
    op.drop_table("legal_articles")