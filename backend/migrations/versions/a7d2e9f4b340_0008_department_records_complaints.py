"""0008_department_records_complaints

Adds the case-lifecycle department datasets (department_records) and the
public complaint desk (complaint_tokens) used by citizens/viewers to raise a
Nyaya complaint with just their email.

Revision ID: a7d2e9f4b340
Revises: f6b1c8d4e230
Create Date: 2026-09-19 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7d2e9f4b340"
down_revision: Union[str, Sequence[str], None] = "f6b1c8d4e230"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "department_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("department", sa.String(length=80), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_department_records_department", "department_records", ["department"])
    op.create_index("ix_department_records_case_id", "department_records", ["case_id"])

    op.create_table(
        "complaint_tokens",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("details", sa.Text(), nullable=False, server_default=""),
        sa.Column("department", sa.String(length=80), nullable=False, server_default="nyaya"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token", name="uq_complaint_tokens_token"),
    )
    op.create_index("ix_complaint_tokens_token", "complaint_tokens", ["token"], unique=True)
    op.create_index("ix_complaint_tokens_email", "complaint_tokens", ["email"])
    op.create_index("ix_complaint_tokens_department", "complaint_tokens", ["department"])
    op.create_index("ix_complaint_tokens_status", "complaint_tokens", ["status"])


def downgrade() -> None:
    op.drop_index("ix_complaint_tokens_status", table_name="complaint_tokens")
    op.drop_index("ix_complaint_tokens_department", table_name="complaint_tokens")
    op.drop_index("ix_complaint_tokens_email", table_name="complaint_tokens")
    op.drop_index("ix_complaint_tokens_token", table_name="complaint_tokens")
    op.drop_table("complaint_tokens")
    op.drop_index("ix_department_records_case_id", table_name="department_records")
    op.drop_index("ix_department_records_department", table_name="department_records")
    op.drop_table("department_records")
