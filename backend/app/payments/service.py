"""The payment state machine: what each Stripe outcome does to an order or booking.

Routers, webhook handlers and background jobs all funnel through here so the rules
live in one place. Functions in this module flush but do not commit — the caller
owns the transaction boundary, because a webhook has to record the event id and the
state change together or not at all.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.availability import is_free
from app.config import Settings, get_settings
from app.meetings import meeting_url_for
from app.models import Booking, Order, Service, User
from app.payments import gateway, notifications
from app.payments.amounts import BookingAmounts, calculate_booking_amounts, refund_split
from app.payments.receipts import receipt_number

log = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """SQLite hands back naive datetimes; treat those as the UTC they were stored as."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def stored_amounts(order: Order) -> BookingAmounts:
    """Read the frozen breakdown back off the order — never recalculate it."""
    return BookingAmounts(
        total_minor=order.amount_minor,
        session_gst_minor=order.session_gst_minor,
        platform_fee_minor=order.platform_fee_minor,
        platform_fee_gst_minor=order.platform_fee_gst_minor,
        counsellor_payout_minor=order.counsellor_payout_minor,
    )


def apply_amounts(
    order: Order, counsellor: User, settings: Settings | None = None,
) -> BookingAmounts:
    """Freeze the commission split and the counsellor's tax status onto a new order."""
    settings = settings or get_settings()
    amounts = calculate_booking_amounts(order.amount_minor, counsellor.gst_registered, settings)
    order.session_gst_minor = amounts.session_gst_minor
    order.platform_fee_minor = amounts.platform_fee_minor
    order.platform_fee_gst_minor = amounts.platform_fee_gst_minor
    order.counsellor_payout_minor = amounts.counsellor_payout_minor
    order.counsellor_gst_registered_at_booking = counsellor.gst_registered
    order.counsellor_abn_at_booking = counsellor.abn
    order.hold_expires_at = _now() + timedelta(minutes=settings.slot_hold_minutes)
    return amounts


# --- confirmation ----------------------------------------------------------


def time_is_available_for(db: Session, order: Order) -> bool:
    """Can this order still have the time it asked for?

    With availability derived rather than stored there is no row to inspect: the
    question is whether the counsellor still declares that window and whether anybody
    else has taken the span since. The order's own hold is excluded, or it would be
    read as a clash with itself.
    """
    service = db.get(Service, order.service_id)
    if service is None:
        return False
    return is_free(
        db,
        service.counsellor_id,
        order.starts_at,
        order.ends_at,
        exclude_order_id=order.id,
    )


def confirm_paid_order(db: Session, order: Order) -> Booking:
    """Payment succeeded and the time is ours: turn the held order into a booking."""
    existing = db.scalar(select(Booking).where(Booking.order_id == order.id))
    if existing is not None:
        return existing

    service = db.get(Service, order.service_id)
    if service is None:
        raise ValueError(f"Order {order.id} points at a service that no longer exists.")

    order.status = "confirmed"
    order.payment_status = "paid"
    booking = Booking(
        order_id=order.id,
        service_id=service.id,
        window_id=order.window_id,
        job_seeker_id=order.job_seeker_id,
        counsellor_id=service.counsellor_id,
        starts_at=order.starts_at,
        ends_at=order.ends_at,
        timezone=order.timezone,
        modality=order.modality,
        status="confirmed",
        payment_status="paid",
    )
    db.add(booking)
    # Flushed first so the booking has the id its meeting room is named after.
    db.flush()
    # Decided once and stored, not derived on read: the email, the receipt and the
    # app must all name the same room months later, even if the counsellor changes
    # their preferred one in between.
    booking.meeting_url = meeting_url_for(booking, service)
    db.flush()

    job_seeker = db.get(User, order.job_seeker_id)
    counsellor = db.get(User, service.counsellor_id)
    if job_seeker is not None and counsellor is not None:
        notifications.booking_confirmed(booking, order, service, job_seeker, counsellor)
        notifications.receipt_issued(booking, job_seeker, receipt_number(booking))
    return booking


def refund_slot_taken(db: Session, order: Order) -> None:
    """Payment landed after the hold lapsed and someone else took the time (spec §8).

    The job seeker is made whole in full: they did nothing wrong, and no session
    will happen.
    """
    if order.status == "refunded_slot_taken":
        return
    if order.payment_intent_id:
        gateway.refund_payment_intent(
            order.payment_intent_id,
            idempotency_key=f"refund-slot-taken-{order.id}",
            reason="requested_by_customer",
        )
    order.status = "refunded_slot_taken"
    order.payment_status = "refunded"
    db.flush()
    job_seeker = db.get(User, order.job_seeker_id)
    if job_seeker is not None:
        notifications.slot_taken_refund(order, job_seeker, order.amount_minor)


def release_hold(db: Session, order: Order) -> None:
    """Let a lapsed, unpaid hold go and cancel its PaymentIntent.

    There is no slot to hand back: the hold was the order, so cancelling it is what
    makes the time offerable again.
    """
    if order.status != "awaiting_payment":
        return
    if order.payment_intent_id:
        try:
            gateway.cancel_payment_intent(order.payment_intent_id)
        except gateway.PaymentProviderError as error:
            # Leave the order alone and let the next tick try again; freeing the
            # time while a live intent could still be paid is the worse outcome.
            log.warning("Could not cancel PaymentIntent for order %s: %s", order.id, error)
            return
    order.status = "cancelled"
    db.flush()


# --- cancellation and refunds ---------------------------------------------


def refundable_minor(
    booking: Booking,
    order: Order,
    cancelled_by_role: str,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> int:
    """Payments spec §10 — how much of a cancelled booking goes back to the job seeker.

    A counsellor who cancels always refunds in full; the job seeker never loses money
    over a session they were still willing to attend. A job seeker gets everything
    back outside the notice window, and the client's late-cancellation percentage
    inside it.
    """
    settings = settings or get_settings()
    already = booking.refunded_minor
    if cancelled_by_role != "job_seeker":
        return max(order.amount_minor - already, 0)

    now = now or _now()
    notice = as_utc(booking.starts_at) - now
    if notice >= timedelta(hours=settings.cancellation_full_refund_hours):
        return max(order.amount_minor - already, 0)
    percent = max(0, min(100, settings.cancellation_late_refund_percent))
    entitled = order.amount_minor * percent // 100
    return max(entitled - already, 0)


def cancel_booking(
    db: Session,
    booking: Booking,
    order: Order,
    cancelled_by_role: str,
    settings: Settings | None = None,
) -> int:
    """Cancel a confirmed booking, refund per policy, and free the slot.

    Order matters when the counsellor has already been paid: the transfer is
    reversed first so the refund is funded, rather than leaving the platform short
    if the reversal then fails (spec §10).

    Returns what was actually refunded, which is zero on a deployment running the
    payment stub because no money was ever taken.
    """
    settings = settings or get_settings()
    refund_minor = refundable_minor(booking, order, cancelled_by_role, settings)

    if refund_minor > 0 and booking.transfer_id:
        amounts = stored_amounts(order)
        clawback = refund_split(amounts, booking.refunded_minor + refund_minor)
        outstanding = clawback - booking.transfer_reversed_minor
        if outstanding > 0:
            gateway.reverse_transfer(
                booking.transfer_id,
                outstanding,
                idempotency_key=f"reversal-{booking.id}-{booking.refunded_minor + refund_minor}",
            )
            booking.transfer_reversed_minor += outstanding

    # What policy says is owed and what actually moved are two different numbers.
    # An order with no PaymentIntent — a stub deployment — never took money, so
    # there is nothing to give back, and the caller must not be told otherwise.
    refunded_now = 0
    if refund_minor > 0 and order.payment_intent_id:
        gateway.refund_payment_intent(
            order.payment_intent_id,
            refund_minor,
            idempotency_key=f"refund-{booking.id}-{booking.refunded_minor + refund_minor}",
            reason="requested_by_customer",
        )
        booking.refunded_minor += refund_minor
        refunded_now = refund_minor

    booking.status = "refunded" if booking.refunded_minor > 0 else "cancelled"
    booking.payment_status = (
        "refunded" if booking.refunded_minor >= order.amount_minor
        else "partially_refunded" if booking.refunded_minor > 0
        else "paid"
    )
    booking.cancelled_at = _now()
    booking.cancelled_by_role = cancelled_by_role
    order.status = "cancelled"
    order.payment_status = booking.payment_status

    # Nothing to reopen: a cancelled booking stops counting as busy, so the time
    # returns to the counsellor's window of its own accord.
    db.flush()

    for user_id in (booking.job_seeker_id, booking.counsellor_id):
        recipient = db.get(User, user_id)
        if recipient is not None:
            notifications.booking_cancelled(booking, recipient, refunded_now)
    return refunded_now
