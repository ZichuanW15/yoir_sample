"""Private Job Seeker diagnosis answers and optimistic revision control.

Revision ID: 0009
Revises: 0008
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "diagnoses",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("job_seeker_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("questionnaire_version", sa.String(64), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("job_seeker_id", name="uq_diagnoses_job_seeker_id"),
    )


def downgrade() -> None:
    op.drop_table("diagnoses")
