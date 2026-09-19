"""A Career Professional's qualifications, skills and expertise, and languages.

Revision ID: 0005
Revises: 0004
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("qualifications", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("expertise", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("languages", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("languages")
        batch.drop_column("expertise")
        batch.drop_column("qualifications")
