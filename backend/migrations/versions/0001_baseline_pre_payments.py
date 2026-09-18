"""Baseline: the schema as it stood before payments, windows and refresh tokens.

Revision ID: 0001
Revises:
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# This revision deliberately reproduces a schema the models no longer describe. It
# exists so a database created before migrations were adopted can be stamped at a
# known point and carried forward by 0002, rather than being rebuilt. A fresh
# database runs this and then 0002, landing in the same place.


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("introduction", sa.String(), nullable=True),
        sa.Column("verification_status", sa.String()),
        sa.Column("overall_rating", sa.Float(), nullable=True),
        sa.Column("review_count", sa.Integer()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "revoked_tokens",
        sa.Column("token_digest", sa.String(64), primary_key=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_revoked_tokens_expires_at", "revoked_tokens", ["expires_at"])

    op.create_table(
        "services",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("counsellor_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("price_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String()),
        sa.Column("modalities", sa.JSON()),
        sa.Column("location_state", sa.String(), nullable=True),
        sa.Column("location_city", sa.String(), nullable=True),
        sa.Column("active", sa.Boolean()),
        sa.Column("average_rating", sa.Float(), nullable=True),
        sa.Column("review_count", sa.Integer()),
    )

    op.create_table(
        "availability_slots",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("service_id", sa.String(), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
    )
    op.create_index("ix_availability_slots_service_id", "availability_slots", ["service_id"])

    op.create_table(
        "orders",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("job_seeker_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("service_id", sa.String(), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("slot_id", sa.String(), sa.ForeignKey("availability_slots.id"), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("timezone", sa.String(), nullable=False),
        sa.Column("modality", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("payment_status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "bookings",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("order_id", sa.String(), sa.ForeignKey("orders.id"), nullable=False, unique=True),
        sa.Column("service_id", sa.String(), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("slot_id", sa.String(), sa.ForeignKey("availability_slots.id"), nullable=False),
        sa.Column("job_seeker_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("counsellor_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(), nullable=False),
        sa.Column("modality", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("payment_status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "processed_webhook_events",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    for table in (
        "processed_webhook_events", "bookings", "orders",
        "availability_slots", "services", "revoked_tokens", "users",
    ):
        op.drop_table(table)
