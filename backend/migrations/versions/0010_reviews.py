"""US-53/54/55 — one review per completed booking, feeding the service and
counsellor aggregates.

Revision ID: 0010
Revises: 0009
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reviews",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("booking_id", sa.String(), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("order_id", sa.String(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("service_id", sa.String(), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("counsellor_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("job_seeker_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("booking_id", name="uq_reviews_booking_id"),
    )
    op.create_index("ix_reviews_service_id", "reviews", ["service_id"])
    op.create_index("ix_reviews_counsellor_id", "reviews", ["counsellor_id"])


def downgrade() -> None:
    op.drop_index("ix_reviews_counsellor_id", table_name="reviews")
    op.drop_index("ix_reviews_service_id", table_name="reviews")
    op.drop_table("reviews")
