"""Payments, availability windows, refresh tokens and counsellor profiles.

Revision ID: 0002
Revises: 0001
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- counsellor payouts, tax and profile (payments spec §5, US-30/31) ----
    with op.batch_alter_table("users") as batch:
        for column in (
            sa.Column("stripe_account_id", sa.String(), nullable=True),
            sa.Column("charges_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("payouts_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("abn", sa.String(11), nullable=True),
            sa.Column("gst_registered", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("legal_name", sa.String(), nullable=True),
            sa.Column("date_of_birth", sa.Date(), nullable=True),
            sa.Column("address", sa.String(), nullable=True),
            sa.Column("phone", sa.String(), nullable=True),
            sa.Column("photo_url", sa.String(), nullable=True),
            sa.Column("linkedin_url", sa.String(), nullable=True),
            sa.Column("background", sa.String(), nullable=True),
            sa.Column("experience", sa.String(), nullable=True),
            sa.Column("base_location_state", sa.String(), nullable=True),
            sa.Column("base_location_city", sa.String(), nullable=True),
            sa.Column(
                "default_modality", sa.String(), nullable=False, server_default="online",
            ),
        ):
            batch.add_column(column)
    op.create_index("ix_users_stripe_account_id", "users", ["stripe_account_id"])

    # --- duration belongs to the service, not the calendar -------------------
    with op.batch_alter_table("services") as batch:
        batch.add_column(
            sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="60"),
        )

    # --- availability becomes the counsellor's own calendar ------------------
    op.create_table(
        "availability_windows",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("counsellor_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("modalities", sa.JSON(), nullable=False),
    )
    op.create_index(
        "ix_availability_windows_counsellor_id", "availability_windows", ["counsellor_id"],
    )
    op.create_index("ix_availability_windows_starts_at", "availability_windows", ["starts_at"])

    # Carry the existing slots across rather than dropping them: one window per
    # slot, owned by the counsellor behind its service. Overlapping windows are
    # legal now, so no merging is needed here.
    op.execute(
        """
        INSERT INTO availability_windows (id, counsellor_id, starts_at, ends_at, modalities)
        SELECT s.id, sv.counsellor_id, s.starts_at, s.ends_at, sv.modalities
        FROM availability_slots AS s
        JOIN services AS sv ON sv.id = s.service_id
        """
    )

    # --- orders and bookings name a window and their own span ----------------
    with op.batch_alter_table("orders") as batch:
        batch.add_column(sa.Column("window_id", sa.String(), nullable=True))
        batch.add_column(sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("hold_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("payment_intent_id", sa.String(), nullable=True))
        for name in (
            "session_gst_minor", "platform_fee_minor",
            "platform_fee_gst_minor", "counsellor_payout_minor",
        ):
            batch.add_column(sa.Column(name, sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column(
            "counsellor_gst_registered_at_booking", sa.Boolean(),
            nullable=False, server_default=sa.false(),
        ))
        batch.add_column(sa.Column("counsellor_abn_at_booking", sa.String(11), nullable=True))

    # The slot id was the window id, so the join is direct.
    op.execute(
        """
        UPDATE orders SET
            window_id = slot_id,
            starts_at = (SELECT starts_at FROM availability_windows w WHERE w.id = orders.slot_id),
            ends_at   = (SELECT ends_at   FROM availability_windows w WHERE w.id = orders.slot_id)
        """
    )

    with op.batch_alter_table("bookings") as batch:
        batch.add_column(sa.Column("window_id", sa.String(), nullable=True))
        batch.add_column(sa.Column("transfer_id", sa.String(), nullable=True))
        batch.add_column(sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("paid_out_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("cancelled_by_role", sa.String(), nullable=True))
        batch.add_column(sa.Column("review_reason", sa.String(), nullable=True))
        for name in ("refunded_minor", "transfer_reversed_minor"):
            batch.add_column(sa.Column(name, sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column(
            "flagged_for_review", sa.Boolean(), nullable=False, server_default=sa.false(),
        ))
    op.execute("UPDATE bookings SET window_id = slot_id")

    # Only now that every row has a window can the columns be tightened and the
    # old ones dropped.
    with op.batch_alter_table("orders") as batch:
        batch.alter_column("window_id", nullable=False)
        batch.alter_column("starts_at", nullable=False)
        batch.alter_column("ends_at", nullable=False)
        batch.drop_column("slot_id")
    with op.batch_alter_table("bookings") as batch:
        batch.alter_column("window_id", nullable=False)
        batch.drop_column("slot_id")

    op.drop_table("availability_slots")

    # --- US-06: sessions that slide instead of expiring hourly ---------------
    op.create_table(
        "refresh_tokens",
        sa.Column("token_digest", sa.String(64), primary_key=True),
        sa.Column("family_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("client", sa.String(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"])


def downgrade() -> None:
    # Deliberately not reversible. Going back would mean cutting each availability
    # window into per-service slots, and there is no answer for a window that now
    # serves several services or that no slot ever described. A restore from backup
    # is the honest way back.
    raise NotImplementedError(
        "0002 cannot be reversed: availability windows carry information that "
        "per-service slots cannot express. Restore from a backup instead."
    )
