"""v1_document_transfers

Adds the secure inter-department / inter-agency transfer table (V1 Step 10).

Revision ID: a1c7d2f4e910
Revises: 389d3f11d880
Create Date: 2026-09-16 18:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1c7d2f4e910"
down_revision: Union[str, Sequence[str], None] = "389d3f11d880"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create document_transfers and its indexes."""
    op.create_table(
        "document_transfers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("from_user_id", sa.String(length=36), nullable=True),
        sa.Column("to_user_id", sa.String(length=36), nullable=False),
        sa.Column("from_department", sa.String(length=120), nullable=True),
        sa.Column("to_department", sa.String(length=120), nullable=True),
        sa.Column("from_agency", sa.String(length=120), nullable=True),
        sa.Column("to_agency", sa.String(length=120), nullable=True),
        sa.Column("transfer_purpose", sa.String(length=255), nullable=False),
        sa.Column("access_level", sa.String(length=50), nullable=False, server_default="read"),
        sa.Column("valid_until", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("transfer_hash", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("transferred_at", sa.DateTime(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["to_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_transfers_document_id", "document_transfers", ["document_id"])
    op.create_index("ix_document_transfers_to_user_id", "document_transfers", ["to_user_id"])
    op.create_index("ix_document_transfers_from_user_id", "document_transfers", ["from_user_id"])
    op.create_index("ix_document_transfers_status", "document_transfers", ["status"])
    op.create_index("ix_document_transfers_transfer_hash", "document_transfers", ["transfer_hash"])


def downgrade() -> None:
    """Drop document_transfers."""
    op.drop_index("ix_document_transfers_transfer_hash", table_name="document_transfers")
    op.drop_index("ix_document_transfers_status", table_name="document_transfers")
    op.drop_index("ix_document_transfers_from_user_id", table_name="document_transfers")
    op.drop_index("ix_document_transfers_to_user_id", table_name="document_transfers")
    op.drop_index("ix_document_transfers_document_id", table_name="document_transfers")
    op.drop_table("document_transfers")