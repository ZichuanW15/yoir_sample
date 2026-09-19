"""Email verification, the verification review trail, and meeting links.

Revision ID: 0003
Revises: 0002
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(
            sa.Column("sessions_invalidated_at", sa.DateTime(timezone=True), nullable=True),
        )
        batch.add_column(
            sa.Column("verification_submitted_at", sa.DateTime(timezone=True), nullable=True),
        )
        batch.add_column(
            sa.Column("verification_decided_at", sa.DateTime(timezone=True), nullable=True),
        )
        batch.add_column(sa.Column("verification_decision_reason", sa.String(), nullable=True))

    with op.batch_alter_table("services") as batch:
        batch.add_column(sa.Column("meeting_url", sa.String(), nullable=True))

    with op.batch_alter_table("bookings") as batch:
        batch.add_column(sa.Column("meeting_url", sa.String(), nullable=True))

    # Counsellors already carrying a LinkedIn URL had effectively submitted for review
    # before there was a column to record it, so the queue does not start empty and
    # forget them.
    op.execute(
        """
        UPDATE users
        SET verification_submitted_at = created_at
        WHERE role = 'counsellor'
          AND linkedin_url IS NOT NULL
          AND linkedin_url <> ''
        """
    )
    # A counsellor already approved has been decided, whenever that happened.
    op.execute(
        """
        UPDATE users
        SET verification_decided_at = created_at
        WHERE role = 'counsellor' AND verification_status IN ('verified', 'rejected')
        """
    )

    op.create_table(
        "single_use_tokens",
        sa.Column("token_digest", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("purpose", sa.String(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_single_use_tokens_user_id", "single_use_tokens", ["user_id"])
    op.create_index("ix_single_use_tokens_expires_at", "single_use_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_table("single_use_tokens")
    with op.batch_alter_table("bookings") as batch:
        batch.drop_column("meeting_url")
    with op.batch_alter_table("services") as batch:
        batch.drop_column("meeting_url")
    with op.batch_alter_table("users") as batch:
        for column in (
            "verification_decision_reason", "verification_decided_at",
            "verification_submitted_at", "sessions_invalidated_at", "email_verified_at",
        ):
            batch.drop_column(column)
