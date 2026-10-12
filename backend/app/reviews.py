"""US-54/US-55 — the service and counsellor rating aggregates, recomputed from
the stored reviews rather than incremented, so a correction never drifts from
what the `reviews` table actually holds.

Both values are cached on the row they describe (`Service.average_rating` /
`review_count`, `User.overall_rating` / `review_count`) rather than computed on
every read: the Marketplace lists many services and many counsellors at once,
and a cache kept true by recomputing on the one write that can change it is
cheaper than an aggregate join on every list.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Review, Service, User


def recompute_service_rating(db: Session, service_id: str) -> None:
    service = db.get(Service, service_id)
    if service is None:
        return
    count, average = db.execute(
        select(func.count(Review.id), func.avg(Review.rating)).where(
            Review.service_id == service_id,
        )
    ).one()
    service.review_count = count
    service.average_rating = float(average) if average is not None else None


def recompute_counsellor_rating(db: Session, counsellor_id: str) -> None:
    counsellor = db.get(User, counsellor_id)
    if counsellor is None:
        return
    count, average = db.execute(
        select(func.count(Review.id), func.avg(Review.rating)).where(
            Review.counsellor_id == counsellor_id,
        )
    ).one()
    counsellor.review_count = count
    counsellor.overall_rating = float(average) if average is not None else None
