"""0006_role_signing_keys

Per-role system signing keys plus the ``key_role`` column on signatures so
every upload is automatically signed with the uploader's role key (V2).

Revision ID: e5a9f7c3d120
Revises: c3f4a9e2b710
Create Date: 2026-09-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5a9f7c3d120"
down_revision: Union[str, Sequence[str], None] = "c3f4a9e2b710"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("document_signatures") as batch_op:
        batch_op.add_column(sa.Column("key_role", sa.String(length=80), nullable=True))

    op.create_table(
        "role_signing_keys",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("role_name", sa.String(length=80), nullable=False, unique=True, index=True),
        sa.Column("private_key_encrypted", sa.Text(), nullable=False),
        sa.Column("public_key_pem", sa.Text(), nullable=False),
        sa.Column("algorithm", sa.String(length=80), nullable=False, server_default="RSA-PSS-SHA256"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("role_signing_keys")
    with op.batch_alter_table("document_signatures") as batch_op:
        batch_op.drop_column("key_role")
