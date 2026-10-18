"""Sprint 3 browser preconditions, exclusively in serve.py's owned SQLite DB.

Completed/cancelled sessions are setup data: browser review tests do not claim to
exercise the scheduler or a real payment provider. All subsequent requests use
the real application routes. No fixture endpoint is installed in the product.
"""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import AvailabilityWindow, Booking, Order, Service, User
from app.security import hash_password

PASSWORD = "qa-browser-fixture-password"


def seed_sprint3(db: Session, owned_database: Path) -> None:
    bind = db.get_bind()
    if bind.dialect.name != "sqlite" or Path(bind.url.database).resolve() != owned_database.resolve():
        raise RuntimeError("Browser fixtures require the exclusively owned temporary SQLite database")

    now = datetime.now(UTC)
    password_hash = hash_password(PASSWORD)

    def user(key: str, name: str, role: str, **fields) -> User:
        row = User(
            id=f"qa-s3-{key}", name=name, email=f"qa-s3-{key}@example.com",
            role=role, password_hash=password_hash, email_verified_at=now, **fields,
        )
        db.add(row)
        return row

    buyer = user("buyer", "QA Review Buyer", "job_seeker")
    user("stranger", "QA Other Buyer", "job_seeker")
    user("admin", "QA Browser Admin", "platform_owner")
    reviewer = user(
        "reviewer", "QA Review Professional", "counsellor",
        introduction="Career sessions used only by the browser acceptance fixtures.",
        background="QA fixture background", experience="QA fixture experience",
        linkedin_url="https://www.linkedin.com/in/qa-browser-fixture/",
        base_location_state="VIC", base_location_city="Melbourne",
        verification_status="verified", overall_rating=None, review_count=0,
    )
    user(
        "candidate", "QA Verification Candidate", "counsellor",
        introduction="Candidate introduction for the isolated browser review queue.",
        background="Candidate background", experience="Candidate experience",
        linkedin_url="https://www.linkedin.com/in/qa-verification-fixture/",
        verification_status="pending", verification_submitted_at=now,
    )
    available = user(
        "available", "QA Availability Professional", "counsellor",
        introduction="A dedicated professional with a single three-hour online window.",
        background="QA fixture background", experience="QA fixture experience",
        linkedin_url="https://www.linkedin.com/in/qa-availability-fixture/",
        base_location_state="VIC", base_location_city="Melbourne",
        verification_status="verified",
    )
    db.flush()

    review_service = Service(
        id="qa-s3-review-service", counsellor_id=reviewer.id,
        title="QA completed review session", description="A seeded completed session for real review submission.",
        price_minor=8450, duration_minutes=60, currency="AUD", modalities=["online"],
        active=True, average_rating=None, review_count=0,
    )
    availability_service = Service(
        id="qa-s3-availability-service", counsellor_id=available.id,
        title="QA modality and remaining time", description="Only the online modality has a seeded window.",
        price_minor=9900, duration_minutes=60, currency="AUD", modalities=["in_person", "online"],
        location_state="VIC", location_city="Melbourne", active=True,
    )
    db.add_all([review_service, availability_service])
    past = now - timedelta(days=3)
    future = (now + timedelta(days=8)).replace(hour=0, minute=0, second=0, microsecond=0)
    history_window = AvailabilityWindow(
        id="qa-s3-history-window", counsellor_id=reviewer.id,
        starts_at=past, ends_at=past + timedelta(hours=3), modalities=["online"],
    )
    available_window = AvailabilityWindow(
        id="qa-s3-available-window", counsellor_id=available.id,
        starts_at=future, ends_at=future + timedelta(hours=3), modalities=["online"],
    )
    db.add_all([history_window, available_window])
    db.flush()

    for index, state in enumerate(("completed", "confirmed", "cancelled")):
        starts = past + timedelta(hours=index)
        order = Order(
            id=f"qa-s3-{state}-order", job_seeker_id=buyer.id, service_id=review_service.id,
            window_id=history_window.id, starts_at=starts, ends_at=starts + timedelta(hours=1),
            amount_minor=8450, currency="AUD", timezone="Australia/Melbourne", modality="online",
            status="cancelled" if state == "cancelled" else "confirmed", payment_status="paid",
            platform_fee_minor=845, platform_fee_gst_minor=77, counsellor_payout_minor=7605,
            created_at=now,
        )
        db.add(order)
        db.flush()
        db.add(Booking(
            id=f"qa-s3-{state}-booking", order_id=order.id, service_id=review_service.id,
            window_id=history_window.id, job_seeker_id=buyer.id, counsellor_id=reviewer.id,
            starts_at=starts, ends_at=starts + timedelta(hours=1), timezone="Australia/Melbourne",
            modality="online", status=state, payment_status="paid",
            completed_at=starts + timedelta(hours=1) if state == "completed" else None,
        ))

    # More than one list page reproduces the read-by-id integration boundary.
    # Zero-value cancelled fixture orders neither hold availability nor represent
    # payments; the old order must remain accessible through the detail API.
    for index in range(201):
        db.add(Order(
            id=f"qa-s3-archive-{index:03d}", job_seeker_id=buyer.id,
            service_id=review_service.id, window_id=history_window.id,
            starts_at=past, ends_at=past + timedelta(hours=1), amount_minor=0,
            currency="AUD", timezone="Australia/Melbourne", modality="online",
            status="cancelled", payment_status="not_started",
            created_at=now - timedelta(days=30, minutes=index),
        ))
    db.commit()
