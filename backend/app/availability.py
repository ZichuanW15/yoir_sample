"""US-40/US-41 — what can actually be booked, derived rather than stored.

A counsellor declares windows of time they are available. Nothing is pre-cut into
sellable pieces, because the size of a piece depends on which service someone
chooses. A bookable start is any point on the calendar's step where the service's
whole duration fits inside one window and collides with nothing already taken.

"Already taken" is two things: a confirmed booking, and an unpaid order whose hold
has not lapsed. Neither is a flag on a shared row, so two services can be offered in
the same hour without ever writing two overlapping rows — which is what made the old
per-service slots contradictory.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AvailabilityWindow, Booking, Order, Service

#: Offered start times land on this grid. Quarter hours are what the picker shows
#: and what people expect a calendar to offer.
STEP_MINUTES = 15

#: A booking that is over cannot be cancelled into, and an order that has lapsed
#: holds nothing, so both stop consuming time.
LIVE_BOOKING_STATUSES = ("confirmed", "completed", "paid_out")


@dataclass(frozen=True)
class Busy:
    starts_at: datetime
    ends_at: datetime


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """Half-open intervals, so a session ending at 10:00 and one starting at 10:00
    do not count as clashing."""
    return a_start < b_end and b_start < a_end


def busy_periods(
    db: Session,
    counsellor_id: str,
    now: datetime | None = None,
    exclude_order_id: str | None = None,
) -> list[Busy]:
    """Every span of this counsellor's time that is already spoken for."""
    now = now or datetime.now(UTC)
    taken: list[Busy] = []

    bookings = db.scalars(
        select(Booking).where(
            Booking.counsellor_id == counsellor_id,
            Booking.status.in_(LIVE_BOOKING_STATUSES),
        )
    )
    taken.extend(Busy(b.starts_at, b.ends_at) for b in bookings)

    # An unpaid order holds its span only while its hold is alive; once it lapses the
    # time is offerable again without anything having to sweep it up first.
    holds = db.execute(
        select(Order)
        .join(Service, Order.service_id == Service.id)
        .where(
            Service.counsellor_id == counsellor_id,
            Order.status == "awaiting_payment",
            Order.hold_expires_at.is_not(None),
        )
    ).scalars()
    for order in holds:
        if order.id == exclude_order_id or order.hold_expires_at <= now:
            continue
        taken.append(Busy(order.starts_at, order.ends_at))
    return taken


def is_free(
    db: Session,
    counsellor_id: str,
    starts_at: datetime,
    ends_at: datetime,
    now: datetime | None = None,
    exclude_order_id: str | None = None,
    modality: str | None = None,
) -> bool:
    """Whether this exact span sits inside a suitable window and clashes with nothing.

    Both halves matter: a time nobody has taken is still not bookable if the
    counsellor never said they were available for it, or said they were available
    only in a way this booking is not asking for.
    """
    windows = db.scalars(
        select(AvailabilityWindow).where(AvailabilityWindow.counsellor_id == counsellor_id)
    )
    if not any(
        w.starts_at <= starts_at and ends_at <= w.ends_at
        and (modality is None or modality in (w.modalities or []))
        for w in windows
    ):
        return False
    return not any(
        _overlaps(starts_at, ends_at, busy.starts_at, busy.ends_at)
        for busy in busy_periods(db, counsellor_id, now, exclude_order_id)
    )


def bookable_starts(
    db: Session,
    service: Service,
    now: datetime | None = None,
    limit: int = 200,
    modality: str | None = None,
) -> list[datetime]:
    """Every start time at which this service could be booked, soonest first.

    Derived on each request rather than stored. That is the point of the design: the
    same window yields different answers for a thirty-minute review and a ninety-
    minute deep-dive, and booking either one re-answers the question for both.

    A window only permits the ways the counsellor can actually deliver in it, so
    in-person availability may differ from online. What does not differ is the time
    itself: a booking of either kind takes the counsellor out of both, because the
    busy check below looks at every booking regardless of how it is delivered.
    """
    now = now or datetime.now(UTC)
    duration = timedelta(minutes=service.duration_minutes)
    step = timedelta(minutes=STEP_MINUTES)
    taken = busy_periods(db, service.counsellor_id, now)

    windows = db.scalars(
        select(AvailabilityWindow)
        .where(AvailabilityWindow.counsellor_id == service.counsellor_id)
        .order_by(AvailabilityWindow.starts_at)
    )
    wanted = {modality} if modality else set(service.modalities or [])

    starts: list[datetime] = []
    for window in windows:
        # A window the service cannot be delivered in offers nothing, however free.
        if not (wanted & set(service.modalities or []) & set(window.modalities or [])):
            continue
        # Begin on the first step at or after the window opens, and never offer a
        # time that has already passed.
        cursor = max(window.starts_at, _ceil_to_step(now, step))
        cursor = _ceil_to_step(cursor, step, origin=window.starts_at)
        while cursor + duration <= window.ends_at:
            if not any(
                _overlaps(cursor, cursor + duration, busy.starts_at, busy.ends_at)
                for busy in taken
            ):
                starts.append(cursor)
                if len(starts) >= limit:
                    return sorted(starts)
            cursor += step
    return sorted(starts)


def _ceil_to_step(moment: datetime, step: timedelta, origin: datetime | None = None) -> datetime:
    """Round up onto the step grid, measured from `origin` so offers line up with the
    window's own start rather than with the wall clock."""
    base = origin or moment.replace(hour=0, minute=0, second=0, microsecond=0)
    if moment <= base:
        return base
    elapsed = (moment - base).total_seconds()
    steps = int(-(-elapsed // step.total_seconds()))
    return base + steps * step
