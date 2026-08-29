"""Rebuild the schema and load app/seed_data.json — run any time, no web server needed.

    cd backend && source .venv/bin/activate
    python reset_db.py

Drops and recreates every table in the database named by DATABASE_URL, then seeds
counsellors, job seekers, services and availability slots from app/seed_data.json.
Other databases on the server are untouched.
"""
from sqlalchemy import func, select

from app import models  # noqa: F401  — registers tables on Base
from app.db import Base, SessionLocal, engine
from app.seed import seed


def main() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
        rows = {
            "users": db.scalar(select(func.count()).select_from(models.User)),
            "  job_seekers": db.scalar(
                select(func.count()).where(models.User.role == "job_seeker")
            ),
            "  counsellors": db.scalar(
                select(func.count()).where(models.User.role == "counsellor")
            ),
            "services": db.scalar(select(func.count()).select_from(models.Service)),
            "availability_slots": db.scalar(
                select(func.count()).select_from(models.AvailabilitySlot)
            ),
            "orders": db.scalar(select(func.count()).select_from(models.Order)),
            "bookings": db.scalar(select(func.count()).select_from(models.Booking)),
        }

    print(f"Reset + seeded  {engine.url}")
    for name, count in rows.items():
        print(f"  {name:<20} {count}")
    print("\nLogins (password: password123)")
    print("  job seekers : alex@example.com, sam@example.com")
    print(
        "  counsellors : maya@example.com, jordan@example.com, "
        "priya@example.com, tom@example.com"
    )


if __name__ == "__main__":
    main()
