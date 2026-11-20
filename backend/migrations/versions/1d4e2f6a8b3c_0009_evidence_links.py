"""0009_evidence_links

Adds the cross-document derivation (provenance link) table used to prove how
an artifact was derived from source evidence — e.g. a CCTV frame extracted
from source footage, or a transcription redacted from the original statement.

Revision ID: 1d4e2f6a8b3c
Revises: a7d2e9f4b340
Create Date: 2026-10-27 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "1d4e2f6a8b3c"
down_revision: Union[str, Sequence[str], None] = "a7d2e9f4b340"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RELATION_TYPES = (
    "extracted_from",
    "frame_from",
    "redacted_from",
    "summarized_from",
    "derived_from",
)


def upgrade() -> None:
    """Create evidence_links and its indexes/constraints."""
    op.create_table(
        "evidence_links",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "parent_document_id",
            sa.String(length=36),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "child_document_id",
            sa.String(length=36),
            nullable=False,
            index=True,
        ),
        sa.Column("relation_type", sa.String(length=80), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_by_user_id",
            sa.String(length=36),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["parent_document_id"], ["documents.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["child_document_id"], ["documents.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "parent_document_id",
            "child_document_id",
            "relation_type",
            name="uq_evidence_links_parent_child_relation",
        ),
    )


def downgrade() -> None:
    """Drop evidence_links."""
    op.drop_table("evidence_links")
