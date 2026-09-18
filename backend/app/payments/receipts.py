"""Payments spec §11 — the two documents the agent model requires.

Under that model there are two separate supplies, so there are two documents:

  * the job seeker's receipt, issued in the **counsellor's** name, because the
    counsellor is who supplied the session. It is a tax invoice only when that
    counsellor was GST-registered on the day — otherwise it carries no GST line at
    all, because claiming GST that was never charged would be wrong.
  * the platform's monthly commission invoice **to the counsellor**, for the
    booking service the platform supplied to them.

Both are built from the snapshot fields frozen onto the order, never from the
counsellor's current settings: a receipt has to keep saying what was true when it
was issued.
"""

from calendar import monthrange
from dataclasses import dataclass, field
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.models import Booking, Order, Service, User


def receipt_number(booking: Booking) -> str:
    """Stable, human-quotable reference for the job seeker's receipt."""
    return f"YOIR-{booking.id.split('-')[0].upper()}"


def _money(minor: int) -> str:
    return f"${minor / 100:,.2f}"


@dataclass(frozen=True)
class Receipt:
    """What the job seeker gets. `is_tax_invoice` decides the heading and the GST line."""

    receipt_number: str
    issued_at: datetime
    is_tax_invoice: bool
    supplier_name: str
    supplier_abn: str | None
    buyer_name: str
    description: str
    session_starts_at: datetime
    total_minor: int
    gst_minor: int
    currency: str

    def render_text(self) -> str:
        heading = "TAX INVOICE" if self.is_tax_invoice else "RECEIPT"
        lines = [
            heading,
            f"Receipt {self.receipt_number}",
            f"Issued {self.issued_at.date().isoformat()}",
            "",
            f"Supplier: {self.supplier_name}",
        ]
        if self.is_tax_invoice and self.supplier_abn:
            lines.append(f"ABN: {self.supplier_abn}")
        lines += [
            f"To: {self.buyer_name}",
            "",
            f"{self.description}",
            f"Session: {self.session_starts_at.isoformat()}",
            "",
            f"Total ({self.currency}): {_money(self.total_minor)}",
        ]
        if self.is_tax_invoice:
            lines.append(f"Includes GST: {_money(self.gst_minor)}")
        else:
            # Spelling this out stops a buyer reading the absence of a GST line as
            # an omission and trying to claim a tenth of the price back.
            lines.append("No GST has been charged on this supply.")
        return "\n".join(lines)


def build_receipt(
    booking: Booking, order: Order, service: Service, counsellor: User, job_seeker: User,
) -> Receipt:
    return Receipt(
        receipt_number=receipt_number(booking),
        issued_at=booking.created_at or datetime.now(UTC),
        is_tax_invoice=order.counsellor_gst_registered_at_booking,
        supplier_name=counsellor.legal_name or counsellor.name,
        supplier_abn=order.counsellor_abn_at_booking,
        buyer_name=job_seeker.name,
        description=service.title,
        session_starts_at=booking.starts_at,
        total_minor=order.amount_minor,
        gst_minor=order.session_gst_minor,
        currency=order.currency,
    )


@dataclass(frozen=True)
class StatementLine:
    booking_id: str
    session_starts_at: datetime
    description: str
    session_total_minor: int
    commission_minor: int
    commission_gst_minor: int
    payout_minor: int


@dataclass(frozen=True)
class CommissionStatement:
    """The platform's monthly tax invoice to one counsellor."""

    counsellor_name: str
    counsellor_abn: str | None
    platform_name: str
    platform_abn: str | None
    platform_gst_registered: bool
    period_start: date
    period_end: date
    lines: list[StatementLine] = field(default_factory=list)

    @property
    def commission_total_minor(self) -> int:
        return sum(line.commission_minor for line in self.lines)

    @property
    def commission_gst_total_minor(self) -> int:
        return sum(line.commission_gst_minor for line in self.lines)

    @property
    def payout_total_minor(self) -> int:
        return sum(line.payout_minor for line in self.lines)

    def render_text(self) -> str:
        heading = "TAX INVOICE" if self.platform_gst_registered else "STATEMENT"
        lines = [
            f"{heading} — booking service commission",
            f"{self.platform_name}" + (f" · ABN {self.platform_abn}" if self.platform_abn else ""),
            f"To: {self.counsellor_name}"
            + (f" · ABN {self.counsellor_abn}" if self.counsellor_abn else ""),
            f"Period: {self.period_start.isoformat()} to {self.period_end.isoformat()}",
            "",
        ]
        for line in self.lines:
            lines.append(
                f"{line.session_starts_at.date().isoformat()}  {line.description}  "
                f"session {_money(line.session_total_minor)}  "
                f"commission {_money(line.commission_minor)}  "
                f"paid to you {_money(line.payout_minor)}"
            )
        lines += [
            "",
            f"Commission total: {_money(self.commission_total_minor)}",
        ]
        if self.platform_gst_registered:
            lines.append(f"Includes GST: {_money(self.commission_gst_total_minor)}")
        lines.append(f"Paid to you: {_money(self.payout_total_minor)}")
        return "\n".join(lines)


def build_commission_statement(
    db: Session, counsellor: User, year: int, month: int, settings: Settings | None = None,
) -> CommissionStatement:
    """Every session this counsellor delivered in the given month, and what we took.

    Cancelled and refunded bookings are left out: no session was supplied, so no
    commission was earned on one.
    """
    settings = settings or get_settings()
    period_start = date(year, month, 1)
    period_end = date(year, month, monthrange(year, month)[1])

    rows = db.execute(
        select(Booking, Order, Service)
        .join(Order, Booking.order_id == Order.id)
        .join(Service, Booking.service_id == Service.id)
        .where(
            Booking.counsellor_id == counsellor.id,
            Booking.status.in_(("completed", "paid_out")),
        )
        .order_by(Booking.starts_at)
    ).all()

    lines: list[StatementLine] = []
    for booking, order, service in rows:
        started = booking.starts_at.date()
        if not (period_start <= started <= period_end):
            continue
        lines.append(
            StatementLine(
                booking_id=booking.id,
                session_starts_at=booking.starts_at,
                description=service.title,
                session_total_minor=order.amount_minor,
                commission_minor=order.platform_fee_minor,
                commission_gst_minor=order.platform_fee_gst_minor,
                payout_minor=order.counsellor_payout_minor - booking.refunded_minor,
            )
        )

    return CommissionStatement(
        counsellor_name=counsellor.legal_name or counsellor.name,
        counsellor_abn=counsellor.abn,
        platform_name=settings.platform_legal_name,
        platform_abn=settings.platform_abn or None,
        platform_gst_registered=settings.platform_gst_registered,
        period_start=period_start,
        period_end=period_end,
        lines=lines,
    )
