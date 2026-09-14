from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import NOT_FOUND, VALIDATION_ERROR, ApiError
from app.models import AvailabilitySlot, Service, User
from app.routers.services import service_to_out
from app.schemas import (
    AvailabilitySlotOut,
    CreateAvailabilitySlotRequest,
    CreateServiceRequest,
    ServiceOut,
    UpdateAvailabilitySlotRequest,
)
from app.security import require_counsellor, require_verified_counsellor

router = APIRouter(prefix="/me", tags=["Counsellor"])


# --- US-34 / US-35 / US-37 / US-38: services --------------------------------


@router.get("/services", response_model=list[ServiceOut])
def list_own_services(
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> list[ServiceOut]:
    """US-34, US-36. Every service the calling counsellor owns, active or not."""
    services = db.scalars(
        select(Service)
        .where(Service.counsellor_id == user.id)
        .order_by(Service.title)
    )
    return [service_to_out(s) for s in services]


@router.post("/services", status_code=status.HTTP_201_CREATED, response_model=ServiceOut)
def create_service(
    payload: CreateServiceRequest,
    user: User = Depends(require_verified_counsellor),
    db: Session = Depends(get_db),
) -> ServiceOut:
    """US-34, US-35, US-37, US-38. An eligible counsellor lists a new service."""
    state = payload.location.state.strip() if payload.location else None
    city = payload.location.city_or_region.strip() if payload.location else None
    if "in_person" in payload.modalities and not (state and city):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "An in-person service needs a meeting area.",
            {"location": "State and city or region are required for in-person delivery."},
        )

    service = Service(
        counsellor_id=user.id,
        title=payload.title,
        description=payload.description,
        price_minor=payload.price_minor,
        currency=payload.currency,
        modalities=list(payload.modalities),
        location_state=state,
        location_city=city,
        active=True,
        review_count=0,
    )
    db.add(service)
    try:
        db.flush()
        # Build the response — including the counsellor relationship read — before
        # committing. A failure here rolls back instead of leaving a saved service
        # behind a 500, which would otherwise invite a duplicate-creating retry.
        result = service_to_out(service)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result


# --- US-39: counsellor availability ----------------------------------------


def _as_utc(value: datetime) -> datetime:
    """Treat a naive datetime as UTC so slot comparisons never mix tz-aware and naive."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _lock_counsellor(db: Session, user: User) -> None:
    """A counsellor is one person and can only be in one place at a time, so their
    calendar spans every service they offer, not just the one being written. Lock
    their row so any concurrent create/update of any of their slots — on any
    service — serialises against this one, making the cross-service overlap check
    in _reject_overlap atomic with the write that follows it."""
    db.scalar(select(User).where(User.id == user.id).with_for_update())


def _owned_service(db: Session, service_id: str, user: User) -> Service:
    _lock_counsellor(db, user)
    service = db.get(Service, service_id)
    if service is None or service.counsellor_id != user.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    return service


def _owned_open_slot(db: Session, slot_id: str, user: User) -> tuple[AvailabilitySlot, Service]:
    """Lock the slot itself, which keeps this check-then-write atomic with the
    booking flow's own with_for_update() on the same row (US-41) so a slot cannot
    be edited/removed out from under a booking that is in flight, and the
    counsellor's row — see _lock_counsellor — for the cross-service overlap check."""
    slot = db.scalar(
        select(AvailabilitySlot).where(AvailabilitySlot.id == slot_id).with_for_update()
    )
    if slot is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Time slot not found.")
    service = db.get(Service, slot.service_id)
    if service is None or service.counsellor_id != user.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Time slot not found.")
    _lock_counsellor(db, user)
    if slot.status != "open":
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "SLOT_UNAVAILABLE",
            "This slot is already reserved and can no longer be changed.",
        )
    return slot, service


def _validate_window(starts_at: datetime, ends_at: datetime) -> None:
    starts_at, ends_at = _as_utc(starts_at), _as_utc(ends_at)
    if ends_at <= starts_at:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "A slot must end after it starts.",
            {"endsAt": "Must be later than startsAt."},
        )
    if starts_at <= datetime.now(UTC):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "A slot must start in the future.",
            {"startsAt": "Must be in the future."},
        )


def _reject_overlap(
    db: Session,
    counsellor_id: str,
    starts_at: datetime,
    ends_at: datetime,
    *,
    exclude_slot_id: str | None = None,
) -> None:
    """US-41. Checked across every service the counsellor offers, not just the one
    being written: two different services under the same counsellor still share
    one calendar, so a slot on either can't be booked at the same time as a slot
    on the other without double-booking the counsellor."""
    starts_at, ends_at = _as_utc(starts_at), _as_utc(ends_at)
    siblings = db.scalars(
        select(AvailabilitySlot)
        .join(Service, AvailabilitySlot.service_id == Service.id)
        .where(Service.counsellor_id == counsellor_id)
    )
    for other in siblings:
        if other.id == exclude_slot_id:
            continue
        if _as_utc(other.starts_at) < ends_at and _as_utc(other.ends_at) > starts_at:
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "SLOT_OVERLAP",
                "This time overlaps an existing slot on your calendar.",
            )


@router.get("/availability-slots", response_model=list[AvailabilitySlotOut])
def list_own_availability_slots(
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> list[AvailabilitySlot]:
    """US-39. Every slot across the caller's services, for the weekly calendar."""
    return list(
        db.scalars(
            select(AvailabilitySlot)
            .join(Service, AvailabilitySlot.service_id == Service.id)
            .where(Service.counsellor_id == user.id)
            .order_by(AvailabilitySlot.starts_at)
        )
    )


@router.post(
    "/availability-slots",
    status_code=status.HTTP_201_CREATED,
    response_model=AvailabilitySlotOut,
)
def create_availability_slot(
    payload: CreateAvailabilitySlotRequest,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> AvailabilitySlotOut:
    """US-39. Add one open slot to a service the caller owns."""
    _owned_service(db, payload.service_id, user)  # locks the counsellor for the overlap check below
    _validate_window(payload.starts_at, payload.ends_at)
    _reject_overlap(db, user.id, payload.starts_at, payload.ends_at)

    slot = AvailabilitySlot(
        service_id=payload.service_id,
        starts_at=_as_utc(payload.starts_at),
        ends_at=_as_utc(payload.ends_at),
        status="open",
    )
    db.add(slot)
    try:
        db.flush()
        # Build the response before committing — see create_service for why.
        result = AvailabilitySlotOut.model_validate(slot)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result


@router.patch("/availability-slots/{slot_id}", response_model=AvailabilitySlotOut)
def update_availability_slot(
    slot_id: str,
    payload: UpdateAvailabilitySlotRequest,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> AvailabilitySlotOut:
    """US-39. Move an open slot's start/end; a reserved slot cannot be changed."""
    if payload.starts_at is None and payload.ends_at is None:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "Provide a new startsAt or endsAt.",
            {"_": "At least one of startsAt or endsAt is required."},
        )
    # Locks the slot (so it cannot be booked out from under this edit) and the
    # counsellor (so this write and any concurrent create/update across every
    # service they offer serialise) for the remainder of the transaction.
    slot, _service = _owned_open_slot(db, slot_id, user)

    starts_at = payload.starts_at or slot.starts_at
    ends_at = payload.ends_at or slot.ends_at
    _validate_window(starts_at, ends_at)
    _reject_overlap(db, user.id, starts_at, ends_at, exclude_slot_id=slot.id)

    slot.starts_at = _as_utc(starts_at)
    slot.ends_at = _as_utc(ends_at)
    try:
        db.flush()
        result = AvailabilitySlotOut.model_validate(slot)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result


@router.delete("/availability-slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability_slot(
    slot_id: str,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> Response:
    """US-39. Remove an open slot; a held or booked slot cannot be removed."""
    slot, _service = _owned_open_slot(db, slot_id, user)
    db.delete(slot)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
