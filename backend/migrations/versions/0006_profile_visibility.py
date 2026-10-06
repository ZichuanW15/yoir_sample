"""Profile visibility for both member roles.

Revision ID: 0006
Revises: 0005
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column(
            "profile_visibility", sa.String(), nullable=False, server_default="public",
        ))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("profile_visibility")
