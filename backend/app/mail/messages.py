"""One function per email the application sends.

Each builds its own context and hands a rendered message to the sender. Callers pass
domain objects, not template variables, so the wording and formatting of an email is
decided here rather than scattered across routers and webhook handlers.
"""

import logging
from datetime import datetime
from typing import Any

from app.config import get_settings
from app.mail.sender import Message, send
from app.mail.templates import money, render
from app.models import Booking, Order, Service, User
from app.payments.receipts import Receipt

log = logging.getLogger(__name__)


def _deliver(template: str, /, *, to: str, subject: str, **context: Any) -> bool:
    """Render and send, absorbing anything that goes wrong.

    A template that fails to render is a bug worth a stack trace in the log, but not
    worth failing the request that triggered it: the booking is already paid for and
    confirmed by the time its email is composed.

    The template name is positional-only and the rest keyword-only for the same reason
    `render` is: every email wants a `name` in its context, and a parameter called
    `name` here would swallow it.
    """
    try:
        html, text = render(template, **context)
    except Exception:
        log.exception("Could not render the %s email for %s", template, to)
        return False
    return send(Message(to=to, subject=subject, html=html, text=text))


def _when(moment: datetime, timezone_label: str) -> str:
    return f"{moment.strftime('%A %-d %B, %-I:%M %p')} ({timezone_label})"


# --- accounts ---------------------------------------------------------------


def verify_email(to: str, name: str, token: str, expires_in_hours: int) -> bool:
    """Takes an address and a name rather than a `User` on purpose.

    Registration composes this email *after* committing the account, and reading an
    attribute off an expired ORM row there would issue a SELECT that can fail once the
    row is already saved — telling the app to retry a registration that succeeded.
    Plain values make that mistake impossible rather than merely discouraged.
    """
    settings = get_settings()
    return _deliver(
        "verify_email",
        to=to,
        subject="Confirm your email",
        name=name,
        verify_url=f"{settings.app_web_url.rstrip('/')}/auth/verify?token={token}",
        expires_in_hours=expires_in_hours,
    )


def password_reset(to: str, name: str, token: str, expires_in_hours: int) -> bool:
    settings = get_settings()
    return _deliver(
        "password_reset",
        to=to,
        subject="Reset your password",
        name=name,
        reset_url=f"{settings.app_web_url.rstrip('/')}/auth/reset?token={token}",
        expires_in_hours=expires_in_hours,
    )


def verification_decided(to: str, name: str, decision: str, reason: str) -> bool:
    """The outcome of a counsellor's verification review (US-32).

    A rejection carries its reason, which is the whole point of sending it: without
    one the counsellor cannot tell what to change, and will either give up or submit
    the same profile again.
    """
    approved = decision == "verified"
    return _deliver(
        "verification_decided",
        to=to,
        subject=(
            "Your Career Professional account is verified"
            if approved
            else "About your Career Professional verification"
        ),
        name=name,
        approved=approved,
        reason=reason,
    )


# --- bookings ---------------------------------------------------------------


def booking_received(
    booking: Booking,
    order: Order,
    service: Service,
    job_seeker: User,
    counsellor: User,
) -> bool:
    """The counsellor's side of a new booking.

    Separate from the job seeker's confirmation because it answers different
    questions: who booked, what they will be paid, and when. It carries no receipt —
    the counsellor is the supplier, not the buyer, and their commission is invoiced
    separately on the monthly statement.
    """
    settings = get_settings()
    # US-36: the area frozen on the order, matching the booking it confirms.
    meeting_area = order.area_for(service)
    # US-36: what was bought, by the name it had when the order was placed. Payment
    # can confirm after a rename, and the receipt already uses the frozen title.
    service_title = order.title_for(service)
    return _deliver(
        "booking_received",
        to=counsellor.email,
        subject=f"New booking: {service_title}",
        name=counsellor.name,
        job_seeker_name=job_seeker.name,
        service_title=service_title,
        details=[
            ("When", _when(booking.starts_at, booking.timezone)),
            ("Delivery", "Online" if booking.modality == "online" else "In person"),
            ("Client", job_seeker.name),
            ("You earn", money(order.counsellor_payout_minor)),
            ("Booking", booking.id),
        ],
        meeting_url=booking.meeting_url or "",
        meeting_area=meeting_area,
        payout_minor=order.counsellor_payout_minor,
        payout_delay_hours=settings.payout_delay_hours,
    )


def booking_confirmed(
    booking: Booking,
    order: Order,
    service: Service,
    job_seeker: User,
    counsellor: User,
    receipt: Receipt,
) -> bool:
    """The job seeker's confirmation: when, where or how to join, and their receipt."""
    settings = get_settings()
    # US-36: the area frozen on the order, matching the booking it confirms.
    meeting_area = order.area_for(service)
    hours = settings.cancellation_full_refund_hours
    percent = settings.cancellation_late_refund_percent
    cancellation_note = (
        f"Cancel at least {hours} hours before the session for a full refund of "
        f"{money(order.amount_minor)}. "
        + (
            f"Cancelling later than that refunds {percent}%."
            if percent
            else "Cancelling later than that is not refunded."
        )
        + f" If {counsellor.name} cancels, you are always refunded in full."
    )

    return _deliver(
        "booking_confirmed",
        to=job_seeker.email,
        subject=f"Your session with {counsellor.name} is booked",
        name=job_seeker.name,
        # US-36: the frozen title, matching the receipt this email carries.
        service_title=order.title_for(service),
        counsellor_name=counsellor.name,
        when=_when(booking.starts_at, booking.timezone),
        details=[
            ("When", _when(booking.starts_at, booking.timezone)),
            ("Delivery", "Online" if booking.modality == "online" else "In person"),
            ("Paid", money(order.amount_minor)),
            ("Booking", booking.id),
        ],
        meeting_url=booking.meeting_url or "",
        meeting_area=meeting_area,
        receipt=receipt,
        cancellation_note=cancellation_note,
    )
