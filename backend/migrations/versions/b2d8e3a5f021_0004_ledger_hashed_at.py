"""v1_ledger_hashed_at

Persists the exact timestamp string folded into ``audit_ledger_records.record_hash``
so an audit record hash can be independently re-computed and verified (V1 Step 13).

Revision ID: b2d8e3a5f021
Revises: a1c7d2f4e910
Create Date: 2026-09-16 18:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2d8e3a5f021"
down_revision: Union[str, Sequence[str], None] = "a1c7d2f4e910"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the hashed_at column (batch mode keeps SQLite compatible)."""
    with op.batch_alter_table("audit_ledger_records") as batch_op:
        batch_op.add_column(sa.Column("hashed_at", sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Drop the hashed_at column."""
    with op.batch_alter_table("audit_ledger_records") as batch_op:
        batch_op.drop_column("hashed_at")