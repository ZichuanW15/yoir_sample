from datetime import timedelta

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.availability import bookable_starts
from app.config import get_settings
from app.db import get_db
from app.errors import NOT_FOUND, ApiError
from app.models import Service, User
from app.schemas import (
    BookableStartOut,
    CounsellorProfileOut,
    CounsellorSummary,
    Location,
    OwnServiceOut,
    ServiceOut,
)

router = APIRouter(tags=["Marketplace"])


def service_to_out(service: Service) -> ServiceOut:
    """Shared ORM -> wire mapping; also used by the counsellor-owned service routes."""
    location = None
    if service.location_state and service.location_city:
        location = Location(state=service.location_state, city_or_region=service.location_city)
    return ServiceOut(
        id=service.id,
        counsellor=CounsellorSummary(
            id=service.counsellor.id,
            display_name=service.counsellor.name,
            introduction=service.counsellor.introduction,
            verification_status=service.counsellor.verification_status,
            overall_rating=service.counsellor.overall_rating,
            review_count=service.counsellor.review_count,
        ),
        title=service.title,
        description=service.description,
        price_minor=service.price_minor,
        duration_minutes=service.duration_minutes,
        currency=service.currency,
        modalities=service.modalities or [],
        location=location,
        active=service.active,
        average_rating=service.average_rating,
        review_count=service.review_count,
    )


def own_service_to_out(service: Service) -> OwnServiceOut:
    """The same service, plus the one field only its owner may see."""
    return OwnServiceOut(
        **service_to_out(service).model_dump(),
        meeting_url=service.meeting_url,
    )


def _bookable(service: Service) -> bool:
    """Payments spec §8 — only a counsellor Stripe will pay may be found and booked.

    Skipped entirely where Stripe is not configured: on such a deployment nobody has
    a connected account, and hiding every service would empty the marketplace.
    """
    if not get_settings().payments_enabled:
        return True
    counsellor = service.counsellor
    # Taking a booking we could never pay out on would leave the job seeker owed a
    # refund, so the connected account has to exist as well as the flag being set.
    return bool(counsellor and counsellor.payouts_enabled and counsellor.stripe_account_id)


@router.get("/services", response_model=list[ServiceOut])
def list_services(
    query: str | None = Query(default=None),
    modality: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ServiceOut]:
    """US-44, US-45. Active public services only; optional text and modality filters."""
    services = list(db.scalars(select(Service).where(Service.active.is_(True))))
    services = [s for s in services if _bookable(s)]
    if query:
        term = query.strip().lower()
        services = [s for s in services if term in f"{s.title} {s.counsellor.name}".lower()]
    if modality:
        services = [s for s in services if modality in (s.modalities or [])]
    return [service_to_out(s) for s in services]


@router.get("/services/{service_id}", response_model=ServiceOut)
def get_service(service_id: str, db: Session = Depends(get_db)) -> ServiceOut:
    """US-46. Public service detail."""
    service = db.get(Service, service_id)
    if service is None or not service.active or not _bookable(service):
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    return service_to_out(service)


@router.get("/services/{service_id}/slots", response_model=list[BookableStartOut])
def list_service_slots(
    service_id: str,
    modality: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[BookableStartOut]:
    """US-40. When this service can be booked, worked out on the spot.

    Not a list of stored rows: the answer depends on this service's duration and on
    how it is being delivered, so the same counsellor window yields different times
    for a thirty-minute review than for a ninety-minute session, and different times
    again for in person than for online. Booking either one re-answers the question for both,
    which is what lets a counsellor offer several services in the same hour.
    """
    service = db.get(Service, service_id)
    if service is None or not service.active or not _bookable(service):
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    duration = timedelta(minutes=service.duration_minutes)
    return [
        BookableStartOut(starts_at=start, ends_at=start + duration)
        for start in bookable_starts(db, service, modality=modality)
    ]


@router.get(
    "/counsellors", response_model=list[CounsellorProfileOut],
    response_model_exclude_none=True,
)
def list_counsellors(db: Session = Depends(get_db)) -> list[CounsellorProfileOut]:
    """US-44, US-13. The Career Professionals a Job Seeker can book, best rated first.

    Exactly the people behind the services Explore lists, by the same rule, so the
    home screen never recommends someone who cannot be booked.
    """
    from app.routers.counsellor import counsellor_profile_out

    services = db.scalars(select(Service).where(Service.active.is_(True)))
    owners = {s.counsellor.id: s.counsellor for s in services if _bookable(s)}
    ranked = sorted(owners.values(), key=lambda user: (-(user.overall_rating or 0), user.name))
    return [counsellor_profile_out(user, enforce_visibility=True) for user in ranked]


@router.get(
    "/counsellors/{counsellor_id}", response_model=CounsellorProfileOut,
    response_model_exclude_none=True,
)
def get_counsellor_profile(
    counsellor_id: str, db: Session = Depends(get_db),
) -> CounsellorProfileOut:
    """US-30. A counsellor's public professional profile."""
    # Imported here rather than at module scope: the counsellor router already
    # imports this module for service_to_out, so a top-level import would cycle.
    from app.routers.counsellor import counsellor_profile_out

    user = db.get(User, counsellor_id)
    if user is None or user.role != "counsellor":
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Career Professional not found.")
    return counsellor_profile_out(user, enforce_visibility=True)
