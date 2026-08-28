from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import NOT_FOUND, ApiError
from app.models import Service
from app.schemas import CounsellorSummary, Location, ServiceOut

router = APIRouter(tags=["Marketplace"])


def _to_out(service: Service) -> ServiceOut:
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
        currency=service.currency,
        modalities=service.modalities or [],
        location=location,
        active=service.active,
        average_rating=service.average_rating,
        review_count=service.review_count,
    )


@router.get("/services", response_model=list[ServiceOut])
def list_services(
    query: str | None = Query(default=None),
    modality: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ServiceOut]:
    """US-44, US-45. Active public services only; optional text and modality filters."""
    services = list(db.scalars(select(Service).where(Service.active.is_(True))))
    if query:
        term = query.strip().lower()
        services = [s for s in services if term in f"{s.title} {s.counsellor.name}".lower()]
    if modality:
        services = [s for s in services if modality in (s.modalities or [])]
    return [_to_out(s) for s in services]


@router.get("/services/{service_id}", response_model=ServiceOut)
def get_service(service_id: str, db: Session = Depends(get_db)) -> ServiceOut:
    """US-46. Public service detail."""
    service = db.get(Service, service_id)
    if service is None or not service.active:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    return _to_out(service)
