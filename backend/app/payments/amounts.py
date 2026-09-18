"""Payments spec §6 — the commission and GST split for one booking.

Every number here is written onto the order when it is created and is never
recalculated: a counsellor who registers for GST next month must not change what
a receipt issued today says. Callers therefore pass the counsellor's GST status
explicitly, rather than this module reading it back off a live row.
"""

from dataclasses import asdict, dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.config import Settings, get_settings

# Australian GST is 10%, so the GST inside a GST-inclusive price is one eleventh
# of it. Australia-only for now (payments spec §1), hence the constant.
GST_DIVISOR = Decimal(11)


def _round_minor(value: Decimal) -> int:
    """Round to whole minor units, half away from zero.

    Deliberately not Python's built-in round(), which is half-to-even: on a price
    like $0.05 that would send a half-cent to the counsellor on one booking and to
    the platform on the next, and the two sides would disagree about a cent.
    """
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


@dataclass(frozen=True)
class BookingAmounts:
    """The frozen breakdown of one booking, in minor units of the order currency."""

    total_minor: int
    """What the job seeker is charged."""
    session_gst_minor: int
    """GST inside the session price, owed by the counsellor. 0 if they are not registered."""
    platform_fee_minor: int
    """The platform's commission, GST inclusive."""
    platform_fee_gst_minor: int
    """GST inside that commission, owed by the platform. 0 if the platform is not registered."""
    counsellor_payout_minor: int
    """What is transferred to the counsellor once the session is completed."""

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


def calculate_booking_amounts(
    price_minor: int,
    counsellor_gst_registered: bool,
    settings: Settings | None = None,
) -> BookingAmounts:
    """Split a listed session price into the job seeker, counsellor and platform shares.

    The platform is an agent (spec §1): the counsellor supplies the session to the
    job seeker, and the platform supplies a booking service to the counsellor. So
    `total_minor` is the counsellor's price unchanged — commission is deducted from
    what the counsellor receives, never added to what the job seeker pays.
    """
    if price_minor < 0:
        raise ValueError("A session price cannot be negative.")
    settings = settings or get_settings()

    price = Decimal(price_minor)
    session_gst = _round_minor(price / GST_DIVISOR) if counsellor_gst_registered else 0

    # COMMISSION_BASE is one of the open decisions in spec §3. On gst_exclusive the
    # counsellor's own GST is not part of their supply to us, so it is taken out
    # before commission is worked out.
    commission_base = price
    if settings.commission_base == "gst_exclusive":
        commission_base = price - Decimal(session_gst)

    platform_fee = _round_minor(commission_base * Decimal(str(settings.platform_fee_percent)) / 100)
    platform_fee_gst = (
        _round_minor(Decimal(platform_fee) / GST_DIVISOR) if settings.platform_gst_registered else 0
    )

    return BookingAmounts(
        total_minor=price_minor,
        session_gst_minor=session_gst,
        platform_fee_minor=platform_fee,
        platform_fee_gst_minor=platform_fee_gst,
        counsellor_payout_minor=price_minor - platform_fee,
    )


def refund_split(amounts: BookingAmounts, refund_minor: int) -> int:
    """How much of `refund_minor` has to be clawed back from the counsellor.

    A refund after payout is funded by both sides in the proportion they were paid,
    so a partial refund does not silently come out of the platform's commission
    alone. Returns the amount to reverse from the counsellor's transfer.
    """
    if refund_minor <= 0 or amounts.total_minor <= 0:
        return 0
    if refund_minor >= amounts.total_minor:
        return amounts.counsellor_payout_minor
    share = Decimal(amounts.counsellor_payout_minor) * Decimal(refund_minor)
    return min(_round_minor(share / Decimal(amounts.total_minor)), amounts.counsellor_payout_minor)
