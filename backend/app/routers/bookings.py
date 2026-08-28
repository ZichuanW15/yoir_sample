import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import FORBIDDEN, NOT_FOUND, ApiError
from app.models import AvailabilitySlot, Booking, Order, Service, User
from app.schemas import BookingOut, CreateOrderRequest, OrderOut, StubPaymentConfirmation
from app.security import require_job_seeker

router = APIRouter(tags=["Bookings"])


@router.post("/orders", status_code=status.HTTP_201_CREATED, response_model=OrderOut)
def create_order(
    payload: CreateOrderRequest,
    user: User = Depends(require_job_seeker),
    db: Session = Depends(get_db),
) -> Order:
    service = db.get(Service, payload.service_id)
    if service is None or not service.active:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    slot = db.scalar(
        select(AvailabilitySlot)
        .where(AvailabilitySlot.id == payload.slot_id)
        .with_for_update()
    )
    if slot is None or slot.service_id != service.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Time slot not found.")
    if slot.status != "open":
        raise ApiError(status.HTTP_409_CONFLICT, "SLOT_UNAVAILABLE", "This time slot is no longer available.")
    if payload.modality not in (service.modalities or []):
        raise ApiError(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", "Choose a supported service modality.")

    slot.status = "held"
    order = Order(
        job_seeker_id=user.id,
        service_id=service.id,
        slot_id=slot.id,
        amount_minor=service.price_minor,
        currency=service.currency,
        timezone=payload.timezone,
        modality=payload.modality,
        status="awaiting_payment",
        payment_status="not_started",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def _booking_out(booking: Booking, service: Service) -> BookingOut:
    return BookingOut(
        id=booking.id,
        order_id=booking.order_id,
        service_id=booking.service_id,
        service_title=service.title,
        starts_at=booking.starts_at,
        ends_at=booking.ends_at,
        timezone=booking.timezone,
        modality=booking.modality,
        status="confirmed",
        payment_status="paid",
    )


@router.post("/orders/{order_id}/payments/stub", response_model=StubPaymentConfirmation)
def complete_stub_payment(
    order_id: str,
    user: User = Depends(require_job_seeker),
    db: Session = Depends(get_db),
) -> StubPaymentConfirmation:
    """Development payment boundary used while CLIENT-02 remains unresolved."""
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Order not found.")
    if order.job_seeker_id != user.id:
        raise ApiError(status.HTTP_403_FORBIDDEN, FORBIDDEN, "You cannot pay for this order.")
    service = db.get(Service, order.service_id)
    slot = db.get(AvailabilitySlot, order.slot_id)
    if service is None or slot is None:
        raise ApiError(status.HTTP_409_CONFLICT, "INVALID_STATE_TRANSITION", "The order cannot be completed.")

    existing = db.scalar(select(Booking).where(Booking.order_id == order.id))
    if existing is not None:
        return StubPaymentConfirmation(
            payment_id=f"stub_{order.id}",
            payment_status="paid",
            booking=_booking_out(existing, service),
        )
    if order.status != "awaiting_payment" or slot.status != "held":
        raise ApiError(status.HTTP_409_CONFLICT, "INVALID_STATE_TRANSITION", "The order cannot be paid in its current state.")

    order.status = "confirmed"
    order.payment_status = "paid"
    slot.status = "booked"
    booking = Booking(
        order_id=order.id,
        service_id=service.id,
        slot_id=slot.id,
        job_seeker_id=user.id,
        counsellor_id=service.counsellor_id,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        timezone=order.timezone,
        modality=order.modality,
        status="confirmed",
        payment_status="paid",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return StubPaymentConfirmation(
        payment_id=f"stub_{uuid.uuid4()}",
        payment_status="paid",
        booking=_booking_out(booking, service),
    )
