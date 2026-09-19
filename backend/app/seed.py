"""Seed the database from app/seed_data.json — editable mock data, no code changes.

Runs on startup only when the `services` table is empty. To re-seed after editing
the JSON: stop the backend, drop and recreate the database, restart.

Every counsellor logs in with the `password` value in the file (default: password123).
"""
import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AvailabilityWindow, Service, User
from app.security import hash_password

log = logging.getLogger(__name__)


def ensure_platform_owner(db: Session) -> None:
    """Create the administrator account if it is not already there.

    Deliberately separate from `seed`, and not gated on it: the demo data is
    something a deployment switches off, while the administration area has to be
    reachable regardless — the platform_owner role is never handed out by
    registration, so nothing else can create one.

    Idempotent in the strict sense: an existing account is left exactly as it is,
    including a password changed since, so redeploying never resets it and never
    reverts someone's own change. That is what makes it safe to leave switched on.
    """
    settings = get_settings()
    if not settings.admin_bootstrap_enabled:
        return

    email = settings.admin_email.strip().lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        if existing.role != "platform_owner":
            # Refuse rather than promote: silently granting administration rights
            # to an account somebody registered normally is not a thing config
            # should be able to do.
            log.error(
                "ADMIN_EMAIL %s already belongs to a %s account; leaving it alone. "
                "The administration area has no owner.", email, existing.role,
            )
        return

    db.add(
        User(
            name="Yoir Admin",
            email=email,
            password_hash=hash_password(settings.admin_password),
            role="platform_owner",
            # Nobody can send this account a confirmation link, and it does not book
            # or publish anything, so it starts confirmed.
            email_verified_at=datetime.now(UTC),
        )
    )
    db.commit()
    log.warning(
        "Created the administrator account %s from ADMIN_EMAIL/ADMIN_PASSWORD. Its "
        "password is whatever is in this deployment's configuration: change it, or "
        "clear those variables, before this environment holds anything real.", email,
    )

_DATA_FILE = Path(__file__).parent / "seed_data.json"


def _seed_windows(db: Session, counsellors: list[User]) -> None:
    """Give each counsellor a few mornings and afternoons of availability.

    Windows, not slots: what can be booked inside them depends on which service a job
    seeker picks, and is worked out at request time.
    """
    if db.scalar(select(AvailabilityWindow).limit(1)) is not None:
        return
    first_day = (datetime.now(UTC) + timedelta(days=1)).replace(
        hour=9, minute=0, second=0, microsecond=0
    )
    for counsellor in counsellors:
        for day_offset, hour, hours_long in ((0, 9, 3), (1, 13, 4), (3, 9, 3)):
            starts_at = (first_day + timedelta(days=day_offset)).replace(hour=hour)
            db.add(
                AvailabilityWindow(
                    counsellor_id=counsellor.id,
                    starts_at=starts_at,
                    ends_at=starts_at + timedelta(hours=hours_long),
                )
            )


def seed(db: Session) -> None:
    existing_services = list(db.scalars(select(Service)))
    if existing_services:
        owners = list(db.scalars(select(User).where(User.role == "counsellor")))
        _seed_windows(db, owners)
        db.commit()
        return

    data = json.loads(_DATA_FILE.read_text())

    for row in data.get("job_seekers", []):
        db.add(
            User(
                name=row["name"],
                email=row["email"].lower(),
                password_hash=hash_password(row.get("password", "password123")),
                role="job_seeker",
                email_verified_at=datetime.now(UTC),
            )
        )

    counsellors: dict[str, User] = {}
    for row in data.get("counsellors", []):
        user = User(
            name=row["name"],
            email=row["email"].lower(),
            password_hash=hash_password(row.get("password", "password123")),
            role="counsellor",
            # Demo accounts are usable the moment the database is seeded.
            email_verified_at=datetime.now(UTC),
            introduction=row.get("introduction"),
            background=row.get("background"),
            experience=row.get("experience"),
            qualifications=row.get("qualifications", []),
            expertise=row.get("expertise", []),
            languages=row.get("languages", []),
            linkedin_url=row.get("linkedin_url"),
            base_location_state=row.get("base_location_state"),
            base_location_city=row.get("base_location_city"),
            default_modality=row.get("default_modality", "online"),
            verification_status=row.get("verification_status", "pending"),
            overall_rating=row.get("overall_rating"),
            review_count=row.get("review_count", 0),
        )
        counsellors[user.email] = user
        db.add(user)
    db.flush()

    services: list[Service] = []
    for row in data.get("services", []):
        counsellor = counsellors[row["counsellor_email"].lower()]
        service = Service(
                counsellor_id=counsellor.id,
                title=row["title"],
                description=row["description"],
                price_minor=row["price_minor"],
                duration_minutes=row.get("duration_minutes", 60),
                currency=row.get("currency", "AUD"),
                modalities=row.get("modalities", []),
                location_state=row.get("location_state"),
                location_city=row.get("location_city"),
                active=row.get("active", True),
                average_rating=row.get("average_rating"),
                review_count=row.get("review_count", 0),
            )
        services.append(service)
        db.add(service)
    db.flush()

    _seed_windows(db, list(counsellors.values()))
    db.commit()
