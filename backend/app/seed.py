"""Seed the database from app/seed_data.json — editable mock data, no code changes.

Runs on startup only when the `services` table is empty. To re-seed after editing
the JSON: stop the backend, drop and recreate the database, restart.

Every counsellor logs in with the `password` value in the file (default: password123).
"""
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AvailabilitySlot, Service, User
from app.security import hash_password

_DATA_FILE = Path(__file__).parent / "seed_data.json"


def _seed_slots(db: Session, services: list[Service]) -> None:
    if db.scalar(select(AvailabilitySlot).limit(1)) is not None:
        return
    first_day = (datetime.now(UTC) + timedelta(days=1)).replace(
        hour=9, minute=0, second=0, microsecond=0
    )
    for service in services:
        for day_offset, hour in ((0, 9), (1, 14), (3, 11)):
            starts_at = (first_day + timedelta(days=day_offset)).replace(hour=hour)
            db.add(
                AvailabilitySlot(
                    service_id=service.id,
                    starts_at=starts_at,
                    ends_at=starts_at + timedelta(hours=1),
                    status="open",
                )
            )


def seed(db: Session) -> None:
    existing_services = list(db.scalars(select(Service)))
    if existing_services:
        _seed_slots(db, existing_services)
        db.commit()
        return

    data = json.loads(_DATA_FILE.read_text())

    counsellors: dict[str, User] = {}
    for row in data.get("counsellors", []):
        user = User(
            name=row["name"],
            email=row["email"].lower(),
            password_hash=hash_password(row.get("password", "password123")),
            role="counsellor",
            introduction=row.get("introduction"),
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

    _seed_slots(db, services)
    db.commit()
