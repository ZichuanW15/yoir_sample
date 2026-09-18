"""Where the payment flow hands a message off to whoever will deliver it.

Every place the payment flow has to tell somebody something calls through here
rather than reaching for a mailer of its own, so what is sent and when is decided in
one file. The structured log line is kept alongside the send: it is what makes a
delivery failure traceable afterwards, and it is all that happens on a machine with
no mail credentials.

Nothing here raises. Most of these run inside a Stripe webhook, and a non-2xx there
makes Stripe redeliver the event — turning a mail outage into a duplicate booking.
"""

import logging

from app.mail import messages
from app.models import Booking, Order, Service, User
from app.payments.receipts import build_receipt

log = logging.getLogger("app.payments.notifications")


def booking_confirmed(
    booking: Booking, order: Order, service: Service, job_seeker: User, counsellor: User,
) -> None:
    """The job seeker's confirmation: when, how to join, and their receipt.

    The receipt travels inside this email rather than a separate one, because a
    second message about the same booking reads as a duplicate and gets ignored —
    and because the two must agree about the amount, which they cannot fail to do
    when they are built together.
    """
    log.info(
        "notify booking_confirmed booking=%s job_seeker=%s counsellor=%s starts_at=%s",
        booking.id, job_seeker.email, counsellor.email, booking.starts_at.isoformat(),
    )
    try:
        receipt = build_receipt(booking, order, service, counsellor, job_seeker)
        messages.booking_confirmed(
            booking, order, service, job_seeker, counsellor, receipt,
        )
    except Exception:
        # The booking is paid for and confirmed; failing here would undo that.
        log.exception("Could not send the confirmation email for booking=%s", booking.id)

    # Told separately, and in its own try: a counsellor who is not told has no idea
    # anyone is coming. Neither email may stop the other being attempted.
    try:
        messages.booking_received(booking, order, service, job_seeker, counsellor)
    except Exception:
        log.exception("Could not tell counsellor=%s about booking=%s", counsellor.email, booking.id)


def receipt_issued(booking: Booking, job_seeker: User, receipt_number: str) -> None:
    log.info(
        "notify receipt_issued booking=%s to=%s receipt=%s",
        booking.id, job_seeker.email, receipt_number,
    )


def slot_taken_refund(order: Order, job_seeker: User, refunded_minor: int) -> None:
    log.warning(
        "notify slot_taken_refund order=%s to=%s refunded_minor=%s",
        order.id, job_seeker.email, refunded_minor,
    )


def booking_cancelled(booking: Booking, recipient: User, refunded_minor: int) -> None:
    log.info(
        "notify booking_cancelled booking=%s to=%s refunded_minor=%s",
        booking.id, recipient.email, refunded_minor,
    )


def payout_sent(booking: Booking, counsellor: User, amount_minor: int) -> None:
    log.info(
        "notify payout_sent booking=%s to=%s amount_minor=%s",
        booking.id, counsellor.email, amount_minor,
    )


def dispute_opened(booking: Booking, reason: str) -> None:
    log.error("notify dispute_opened booking=%s reason=%s — needs admin review", booking.id, reason)
