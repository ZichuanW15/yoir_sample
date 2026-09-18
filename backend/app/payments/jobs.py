"""Payments spec §9 — the three things that have to happen without a user present.

Each job takes its own session and commits per row, so one booking Stripe refuses
does not roll back the ones already handled on the same tick; the next tick simply
picks that row up again. All three are safe to run twice: expiry checks the status
it is about to change, and a payout will not start while `transfer_id` is set.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import Booking, Order, User
from app.payments import gateway, notifications
from app.payments.service import as_utc, release_hold

log = logging.getLogger(__name__)


def release_expired_holds(db: Session, now: datetime | None = None) -> int:
    """Free slots whose checkout window ran out, and cancel their PaymentIntents."""
    now = now or datetime.now(UTC)
    released = 0
    stale = db.scalars(
        select(Order).where(
            Order.status == "awaiting_payment",
            Order.hold_expires_at.is_not(None),
        )
    )
    for order in list(stale):
        if as_utc(order.hold_expires_at) > now:
            continue
        try:
            release_hold(db, order)
            db.commit()
        except Exception:
            db.rollback()
            log.exception("Could not release the hold on order %s", order.id)
            continue
        if order.status == "cancelled":
            released += 1
    return released


def mark_sessions_completed(db: Session, now: datetime | None = None) -> int:
    """Move confirmed bookings past their end time to `completed`.

    Completion is what starts the payout clock, so a booking flagged for review —
    a dispute, a reported no-show — deliberately stays put until an admin clears it.
    """
    now = now or datetime.now(UTC)
    completed = 0
    for booking in list(db.scalars(select(Booking).where(Booking.status == "confirmed"))):
        if booking.flagged_for_review or as_utc(booking.ends_at) > now:
            continue
        booking.status = "completed"
        booking.completed_at = now
        completed += 1
    if completed:
        db.commit()
    return completed


def pay_counsellors(
    db: Session, now: datetime | None = None, settings: Settings | None = None,
) -> int:
    """Transfer each completed booking's counsellor share, once the delay has passed."""
    settings = settings or get_settings()
    now = now or datetime.now(UTC)
    paid = 0
    due = db.scalars(
        select(Booking).where(
            Booking.status == "completed",
            Booking.transfer_id.is_(None),
            Booking.flagged_for_review.is_(False),
        )
    )
    for booking in list(due):
        if booking.completed_at is None:
            continue
        if as_utc(booking.completed_at) + timedelta(hours=settings.payout_delay_hours) > now:
            continue
        try:
            if _pay_one(db, booking):
                db.commit()
                paid += 1
            else:
                db.rollback()
        except gateway.PaymentProviderError as error:
            db.rollback()
            log.warning("Payout for booking %s deferred to the next run: %s", booking.id, error)
        except Exception:
            db.rollback()
            log.exception("Payout for booking %s failed", booking.id)
    return paid


def _pay_one(db: Session, booking: Booking) -> bool:
    order = db.get(Order, booking.order_id)
    counsellor = db.get(User, booking.counsellor_id)
    if order is None or counsellor is None:
        return False
    if not counsellor.stripe_account_id or not counsellor.payouts_enabled:
        log.info("Booking %s is waiting on counsellor payout onboarding", booking.id)
        return False

    # A refunded booking's money has gone back to the job seeker; there is nothing
    # left to pass on, and a partial refund is settled when the payout is released.
    payable = order.counsellor_payout_minor
    if booking.refunded_minor:
        payable -= booking.refunded_minor
    if payable <= 0:
        booking.status = "paid_out"
        booking.paid_out_at = datetime.now(UTC)
        return True

    intent = (
        gateway.retrieve_payment_intent(order.payment_intent_id)
        if order.payment_intent_id
        else None
    )
    transfer = gateway.create_transfer(
        booking_id=booking.id,
        order_id=order.id,
        destination_account_id=counsellor.stripe_account_id,
        amount_minor=payable,
        source_transaction=getattr(intent, "latest_charge", None) if intent else None,
    )
    booking.transfer_id = transfer.id
    booking.status = "paid_out"
    booking.paid_out_at = datetime.now(UTC)
    notifications.payout_sent(booking, counsellor, payable)
    return True


def run_payment_jobs(db: Session, now: datetime | None = None) -> dict[str, int]:
    """One tick of all three jobs. Returned counts are what the scheduler logs."""
    now = now or datetime.now(UTC)
    return {
        "holds_released": release_expired_holds(db, now),
        "sessions_completed": mark_sessions_completed(db, now),
        "counsellors_paid": pay_counsellors(db, now),
    }
