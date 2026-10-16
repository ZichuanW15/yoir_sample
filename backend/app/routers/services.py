from datetime import timedelta

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.availability import bookable_starts, next_bookable_start
from app.config import get_settings
from app.db import get_db
from app.errors import NOT_FOUND, ApiError
from app.models import Review, Service, User
from app.reviews import review_out
from app.schemas import (
    BookableStartOut,
    CounsellorProfileOut,
    CounsellorSummary,
    Location,
    OwnServiceOut,
    ServiceDetailOut,
    ServiceOut,
)

router = APIRouter(tags=["Marketplace"])


def _public_counsellor_text(user: User) -> str:
    """Only index profile fields the public serializer is allowed to reveal."""
    visibility = user.profile_visibility or "public"
    if visibility == "restricted":
        return user.name
    visible = [user.name, user.introduction or ""]
    if visibility == "public":
        visible.extend([
            user.background or "", user.experience or "",
            *(user.qualifications or []), *(user.expertise or []),
            *(user.languages or []),
        ])
    return " ".join(visible)


def _query_score(query: str, *parts: str) -> int:
    """A positive, deterministic relevance score for the Marketplace query."""
    term = query.strip().lower()
    if not term:
        return 1
    text = " ".join(parts).lower()
    return text.count(term)


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


def own_service_to_out(service: Service, db: Session) -> OwnServiceOut:
    """The same service, plus what only its owner sees: the meeting room, and when a
    job seeker could next book it."""
    return OwnServiceOut(
        **service_to_out(service).model_dump(),
        meeting_url=service.meeting_url,
        # A withdrawn service is offered to nobody, so it has no next time.
        next_available_at=next_bookable_start(db, service) if service.active else None,
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
    if query and query.strip():
        scored = [
            (
                _query_score(
                    query, service.title, service.description,
                    service.counsellor.name,
                ),
                service,
            )
            for service in services
        ]
        services = [
            service for score, service in sorted(
                scored,
                key=lambda item: (
                    -item[0], -(item[1].average_rating or 0), item[1].title,
                ),
            )
            if score > 0
        ]
    if modality:
        services = [s for s in services if modality in (s.modalities or [])]
    return [service_to_out(s) for s in services]


@router.get("/services/{service_id}", response_model=ServiceDetailOut)
def get_service(service_id: str, db: Session = Depends(get_db)) -> ServiceDetailOut:
    """US-46, US-54. Public service detail, with its reviews — newest first.

    No login required: a visitor deciding whether to buy needs to see this
    before an account exists to log into.
    """
    service = db.get(Service, service_id)
    if service is None or not service.active or not _bookable(service):
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    reviews = db.scalars(
        select(Review).where(Review.service_id == service_id).order_by(Review.created_at.desc())
    )
    return ServiceDetailOut(
        **service_to_out(service).model_dump(),
        reviews=[review_out(r) for r in reviews],
    )


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
def list_counsellors(
    query: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[CounsellorProfileOut]:
    """US-44, US-13. The Career Professionals a Job Seeker can book, best rated first.

    Exactly the people behind the services Explore lists, by the same rule, so the
    home screen never recommends someone who cannot be booked.
    """
    from app.routers.counsellor import counsellor_profile_out

    services = list(db.scalars(select(Service).where(Service.active.is_(True))))
    services = [service for service in services if _bookable(service)]
    owners = {service.counsellor.id: service.counsellor for service in services}
    if query and query.strip():
        services_by_owner: dict[str, list[Service]] = {}
        for service in services:
            services_by_owner.setdefault(service.counsellor_id, []).append(service)
        scored = [
            (
                _query_score(
                    query,
                    _public_counsellor_text(user),
                    *(
                        f"{service.title} {service.description}"
                        for service in services_by_owner.get(user.id, [])
                    ),
                ),
                user,
            )
            for user in owners.values()
        ]
        ranked = [
            user for score, user in sorted(
                scored,
                key=lambda item: (-item[0], -(item[1].overall_rating or 0), item[1].name),
            )
            if score > 0
        ]
    else:
        ranked = sorted(
            owners.values(), key=lambda user: (-(user.overall_rating or 0), user.name),
        )
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
