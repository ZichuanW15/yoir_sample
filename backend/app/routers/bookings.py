import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.availability import is_free
from app.config import get_settings
from app.db import get_db
from app.errors import FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, ApiError
from app.models import AvailabilityWindow, Booking, Order, Service, User
from app.payments import gateway, receipts
from app.payments.service import (
    apply_amounts,
    as_utc,
    cancel_booking,
    confirm_paid_order,
    stored_amounts,
)
from app.schemas import (
    BookingAmountsOut,
    BookingOut,
    CancelBookingOut,
    CancelBookingRequest,
    CreateOrderRequest,
    OrderOut,
    OrderStatusOut,
    PaymentIntentOut,
    ReceiptOut,
    StubPaymentConfirmation,
)
from app.security import get_current_user, require_job_seeker, require_verified_email_job_seeker

router = APIRouter(tags=["Bookings"])


# --- shared mapping --------------------------------------------------------


def _order_out(order: Order, client_secret: str | None = None) -> OrderOut:
    settings = get_settings()
    return OrderOut(
        id=order.id,
        service_id=order.service_id,
        window_id=order.window_id,
        starts_at=order.starts_at,
        ends_at=order.ends_at,
        amount_minor=order.amount_minor,
        currency=order.currency,
        status=order.status,
        payment_status=order.payment_status,
        hold_expires_at=order.hold_expires_at,
        amounts=BookingAmountsOut(**stored_amounts(order).as_dict()),
        payment_provider="stripe" if settings.payments_enabled else "stub",
        payment_intent_client_secret=client_secret,
    )


def _booking_out(
    booking: Booking,
    service: Service,
    order: Order | None = None,
    *,
    viewer: User | None = None,
    job_seeker: User | None = None,
    counsellor: User | None = None,
) -> BookingOut:
    """The booking as one of its two parties sees it.

    `viewer` decides which of the two people is "the other one". Without it the
    booking is returned unattributed, which is what the payment endpoints want —
    they are answering about an order, not rendering somebody's diary.
    """
    other = None
    if viewer is not None:
        other = counsellor if viewer.id == booking.job_seeker_id else job_seeker
    area = ""
    if service.location_city and service.location_state:
        area = f"{service.location_city}, {service.location_state}"
    return BookingOut(
        id=booking.id,
        order_id=booking.order_id,
        service_id=booking.service_id,
        service_title=service.title,
        starts_at=booking.starts_at,
        ends_at=booking.ends_at,
        timezone=booking.timezone,
        modality=booking.modality,
        status=booking.status,
        payment_status=booking.payment_status,
        amount_minor=order.amount_minor if order else 0,
        refunded_minor=booking.refunded_minor,
        cancelled_by_role=booking.cancelled_by_role,
        meeting_url=booking.meeting_url,
        counterparty_name=other.name if other is not None else "",
        counterparty_role=other.role if other is not None else None,
        meeting_area=area if booking.modality == "in_person" else "",
    )


def _visible_booking(db: Session, booking_id: str, user: User) -> tuple[Booking, Order, Service]:
    """Load a booking the caller is a party to.

    A booking a stranger asks for is reported as missing, not forbidden: whether a
    given booking id exists is itself information they are not entitled to.
    """
    booking = db.get(Booking, booking_id)
    if booking is None or user.id not in (booking.job_seeker_id, booking.counsellor_id):
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Booking not found.")
    order = db.get(Order, booking.order_id)
    service = db.get(Service, booking.service_id)
    if order is None or service is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Booking not found.")
    return booking, order, service


# --- US-41 / payments spec §7: create the order and start the payment ------


@router.post("/orders", status_code=status.HTTP_201_CREATED, response_model=OrderOut)
def create_order(
    payload: CreateOrderRequest,
    # Verified address required: we are about to take money and then email a
    # receipt, joining details and any refund notice to it.
    user: User = Depends(require_verified_email_job_seeker),
    db: Session = Depends(get_db),
) -> OrderOut:
    """Hold the slot and freeze the amount breakdown; the payment starts next.

    The price is read from the service row here and never taken from the request —
    an app that sends its own amount is sending one the server ignores (spec §13).
    The split between what the job seeker pays, what the platform keeps and what the
    counsellor is owed is written down now and never recalculated, so a counsellor
    who changes their price or GST status later cannot change a booking already made.
    """
    settings = get_settings()
    service = db.get(Service, payload.service_id)
    if service is None or not service.active:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    counsellor = db.get(User, service.counsellor_id)
    if counsellor is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    # Spec §7.2 — taking money we have no way to pass on would leave the job seeker
    # owed a refund for a session the counsellor cannot be paid for.
    if settings.payments_enabled and not counsellor.payouts_enabled:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "COUNSELLOR_PAYOUTS_UNAVAILABLE",
            "This counsellor cannot accept bookings yet. Please try another counsellor.",
        )

    starts_at = payload.starts_at if payload.starts_at.tzinfo else payload.starts_at.replace(
        tzinfo=UTC
    )
    ends_at = starts_at + timedelta(minutes=service.duration_minutes)
    if starts_at <= datetime.now(UTC):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST, VALIDATION_ERROR, "That time has already passed.",
        )
    if payload.modality not in (service.modalities or []):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "Choose a supported service modality.",
        )

    # Serialise against every other booking attempt on this counsellor's calendar.
    # Availability is derived rather than stored, so there is no slot row to lock —
    # the counsellor's own row stands in for their calendar.
    db.scalar(select(User).where(User.id == counsellor.id).with_for_update())
    window = db.scalar(
        select(AvailabilityWindow).where(
            AvailabilityWindow.counsellor_id == counsellor.id,
            AvailabilityWindow.starts_at <= starts_at,
            AvailabilityWindow.ends_at >= ends_at,
        )
    )
    # The window must permit this way of meeting, not merely cover the time.
    if window is not None and payload.modality not in (window.modalities or []):
        window = None
    if window is None or not is_free(
        db, counsellor.id, starts_at, ends_at, modality=payload.modality,
    ):
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "SLOT_UNAVAILABLE",
            "This time is no longer available.",
        )

    order = Order(
        job_seeker_id=user.id,
        service_id=service.id,
        window_id=window.id,
        starts_at=starts_at,
        ends_at=ends_at,
        amount_minor=service.price_minor,
        currency=service.currency,
        timezone=payload.timezone,
        modality=payload.modality,
        status="awaiting_payment",
        payment_status="not_started",
    )
    apply_amounts(order, counsellor, settings)
    db.add(order)
    db.commit()
    db.refresh(order)
    return _order_out(order)


@router.post("/orders/{order_id}/payment-intents", response_model=PaymentIntentOut)
def create_payment_intent(
    order_id: str,
    user: User = Depends(require_job_seeker),
    db: Session = Depends(get_db),
) -> PaymentIntentOut:
    """Open the Stripe payment for an order that is already holding its slot.

    Separate from creating the order so that a job seeker whose first attempt fell
    over — the app was killed, the network dropped — can pick the same held slot back
    up instead of racing to reserve it again. Calling it twice returns the same
    PaymentIntent: the idempotency key is derived from the order id, so Stripe
    replays its first answer rather than opening a second charge for one booking.
    """
    settings = get_settings()
    if not settings.payments_enabled:
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "PAYMENTS_UNAVAILABLE",
            "Card payments are not configured on this server.",
        )
    order = db.get(Order, order_id)
    if order is None or order.job_seeker_id != user.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Order not found.")
    if order.status != "awaiting_payment":
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "This order is no longer awaiting payment.",
        )
    if order.hold_expires_at is not None and as_utc(order.hold_expires_at) <= datetime.now(UTC):
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "SLOT_UNAVAILABLE",
            "Your reservation has expired. Please choose a time again.",
        )

    service = db.get(Service, order.service_id)
    if service is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    try:
        intent = gateway.create_payment_intent(order, service.counsellor_id)
    except gateway.PaymentProviderError as error:
        raise ApiError(
            status.HTTP_502_BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", str(error),
        ) from error

    order.payment_intent_id = intent.id
    db.commit()
    return PaymentIntentOut(
        payment_intent_id=intent.id,
        client_secret=intent.client_secret,
        status=intent.status,
    )


@router.get("/orders/{order_id}", response_model=OrderStatusOut)
def get_order(
    order_id: str,
    user: User = Depends(require_job_seeker),
    db: Session = Depends(get_db),
) -> OrderStatusOut:
    """The app's source of truth after PaymentSheet closes (spec §12).

    PaymentSheet returning success only means Stripe accepted the card; the booking
    exists once the webhook has been processed, which is what this reports. The
    client secret is not repeated here — it was handed over once, at creation.
    """
    order = db.get(Order, order_id)
    if order is None or order.job_seeker_id != user.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Order not found.")
    booking = db.scalar(select(Booking).where(Booking.order_id == order.id))
    service = db.get(Service, order.service_id)
    return OrderStatusOut(
        order=_order_out(order),
        booking=_booking_out(booking, service, order) if booking and service else None,
    )


# --- bookings --------------------------------------------------------------


@router.get("/me/bookings", response_model=list[BookingOut])
def list_bookings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BookingOut]:
    """Every booking the caller is a party to — theirs as a job seeker, or theirs
    to deliver as a counsellor."""
    job_seeker = aliased(User)
    counsellor = aliased(User)
    rows = db.execute(
        select(Booking, Order, Service, job_seeker, counsellor)
        .join(Order, Booking.order_id == Order.id)
        .join(Service, Booking.service_id == Service.id)
        .join(job_seeker, job_seeker.id == Booking.job_seeker_id)
        .join(counsellor, counsellor.id == Booking.counsellor_id)
        .where(
            (Booking.job_seeker_id == user.id) | (Booking.counsellor_id == user.id)
        )
        .order_by(Booking.starts_at.desc())
    ).all()
    return [
        _booking_out(
            booking, service, order,
            viewer=user, job_seeker=seeker_row, counsellor=counsellor_row,
        )
        for booking, order, service, seeker_row, counsellor_row in rows
    ]


@router.get("/bookings/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BookingOut:
    booking, order, service = _visible_booking(db, booking_id, user)
    return _booking_out(
        booking, service, order,
        viewer=user,
        job_seeker=db.get(User, booking.job_seeker_id),
        counsellor=db.get(User, booking.counsellor_id),
    )


@router.post("/bookings/{booking_id}/cancel", response_model=CancelBookingOut)
def cancel_booking_endpoint(
    booking_id: str,
    payload: CancelBookingRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CancelBookingOut:
    """Payments spec §10. Either party may cancel; the refund follows from who did.

    The booking row is locked for the whole call so a cancel racing the payout job
    cannot refund money the same booking is simultaneously transferring away.
    """
    _visible_booking(db, booking_id, user)
    booking = db.scalar(select(Booking).where(Booking.id == booking_id).with_for_update())
    if booking is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Booking not found.")
    order = db.get(Order, booking.order_id)
    service = db.get(Service, booking.service_id)
    if order is None or service is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Booking not found.")
    if booking.status in ("cancelled", "refunded"):
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "This booking has already been cancelled.",
        )

    role = "job_seeker" if user.id == booking.job_seeker_id else "counsellor"
    try:
        refunded = cancel_booking(db, booking, order, role)
    except gateway.PaymentProviderError as error:
        db.rollback()
        raise ApiError(
            status.HTTP_502_BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", str(error),
        ) from error
    db.commit()
    db.refresh(booking)
    return CancelBookingOut(
        booking=_booking_out(booking, service, order),
        refunded_minor=refunded,
        currency=order.currency,
    )


@router.get("/bookings/{booking_id}/receipt", response_model=ReceiptOut)
def get_booking_receipt(
    booking_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReceiptOut:
    """Payments spec §11 — built from the order's snapshot, in the counsellor's name."""
    booking, order, service = _visible_booking(db, booking_id, user)
    counsellor = db.get(User, booking.counsellor_id)
    job_seeker = db.get(User, booking.job_seeker_id)
    if counsellor is None or job_seeker is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Booking not found.")
    receipt = receipts.build_receipt(booking, order, service, counsellor, job_seeker)
    return ReceiptOut(**receipt.__dict__, text=receipt.render_text())


# --- development stub ------------------------------------------------------


@router.post("/orders/{order_id}/payments/stub", response_model=StubPaymentConfirmation)
def complete_stub_payment(
    order_id: str,
    user: User = Depends(require_job_seeker),
    db: Session = Depends(get_db),
) -> StubPaymentConfirmation:
    """Development payment boundary, kept for deployments with no Stripe keys.

    It is refused outright once Stripe is configured, so a real deployment cannot be
    talked into confirming a booking nobody paid for.
    """
    if get_settings().payments_enabled:
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            FORBIDDEN,
            "This server takes card payments; the payment stub is disabled.",
        )
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Order not found.")
    if order.job_seeker_id != user.id:
        raise ApiError(status.HTTP_403_FORBIDDEN, FORBIDDEN, "You cannot pay for this order.")
    service = db.get(Service, order.service_id)
    if service is None:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "The order cannot be completed.",
        )

    existing = db.scalar(select(Booking).where(Booking.order_id == order.id))
    if existing is not None:
        return StubPaymentConfirmation(
            payment_id=f"stub_{order.id}",
            payment_status="paid",
            booking=_booking_out(existing, service, order),
        )
    if order.status != "awaiting_payment":
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "The order cannot be paid in its current state.",
        )
    # The hold may have lapsed and the time been taken while this order sat unpaid,
    # so availability is re-checked rather than assumed — excluding this order, whose
    # own hold must not be read as a clash with itself.
    if not is_free(
        db, service.counsellor_id, order.starts_at, order.ends_at, exclude_order_id=order.id,
    ):
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "SLOT_UNAVAILABLE",
            "This time is no longer available.",
        )

    # The same confirmation the Stripe webhook runs, rather than a second copy of it.
    # Building the booking here separately is how the stub path came to hand back
    # bookings with no meeting room and send no confirmation email.
    booking = confirm_paid_order(db, order)
    db.commit()
    db.refresh(booking)
    return StubPaymentConfirmation(
        payment_id=f"stub_{uuid.uuid4()}",
        payment_status="paid",
        booking=_booking_out(booking, service, order),
    )
