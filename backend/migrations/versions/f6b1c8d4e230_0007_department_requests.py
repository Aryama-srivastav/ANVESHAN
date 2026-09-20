"""0007_department_requests

Adds the department_requests table backing cross-department evidence access
requests (an investigator in one unit asks the holding unit for access; the
destination department or an administrator approves or rejects the request).

SQLite-compatible; downgrade drops the table and its indexes.

Revision ID: f6b1c8d4e230
Revises: e5a9f7c3d120
Create Date: 2026-09-19 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f6b1c8d4e230"
down_revision: Union[str, Sequence[str], None] = "e5a9f7c3d120"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create department_requests and its indexes."""
    op.create_table(
        "department_requests",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("from_user_id", sa.String(length=36), nullable=False),
        sa.Column("from_department", sa.String(length=120), nullable=True),
        sa.Column("to_department", sa.String(length=120), nullable=True),
        sa.Column("purpose", sa.String(length=500), nullable=False),
        sa.Column("requested_access_level", sa.String(length=50), nullable=False, server_default="read"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("reviewed_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_department_requests_document_id", "department_requests", ["document_id"])
    op.create_index("ix_department_requests_from_user_id", "department_requests", ["from_user_id"])
    op.create_index("ix_department_requests_status", "department_requests", ["status"])


def downgrade() -> None:
    """Drop department_requests."""
    op.drop_index("ix_department_requests_status", table_name="department_requests")
    op.drop_index("ix_department_requests_from_user_id", table_name="department_requests")
    op.drop_index("ix_department_requests_document_id", table_name="department_requests")
    op.drop_table("department_requests")
