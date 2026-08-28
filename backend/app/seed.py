"""Seed data mirroring the frontend's src/api/demo.ts so a connected app looks identical.

Demo counsellor logins (password for both): password123
    maya@example.com  ·  jordan@example.com
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Service, User
from app.security import hash_password

_DEMO_PASSWORD = "password123"


def seed(db: Session) -> None:
    if db.scalar(select(Service).limit(1)) is not None:
        return

    maya = User(
        name="Maya Chen",
        email="maya@example.com",
        password_hash=hash_password(_DEMO_PASSWORD),
        role="counsellor",
        introduction=(
            "Career counsellor specialising in early-career transitions and "
            "interview preparation."
        ),
        verification_status="verified",
        overall_rating=4.9,
        review_count=46,
    )
    jordan = User(
        name="Jordan Lee",
        email="jordan@example.com",
        password_hash=hash_password(_DEMO_PASSWORD),
        role="counsellor",
        introduction=(
            "Recruitment and career-development specialist with experience "
            "across technology and consulting."
        ),
        verification_status="verified",
        overall_rating=4.8,
        review_count=32,
    )
    db.add_all([maya, jordan])
    db.flush()

    db.add_all(
        [
            Service(
                counsellor_id=maya.id,
                title="Interview confidence coaching",
                description=(
                    "A focused one-to-one session covering behavioural questions, confident "
                    "delivery and practical feedback for your next interview."
                ),
                price_minor=9500,
                currency="AUD",
                modalities=["online"],
                active=True,
                average_rating=4.9,
                review_count=28,
            ),
            Service(
                counsellor_id=jordan.id,
                title="Resume and cover letter review",
                description=(
                    "Detailed, actionable feedback to make your application clearer, more "
                    "relevant and easier for recruiters to scan."
                ),
                price_minor=7000,
                currency="AUD",
                modalities=["online", "in_person"],
                location_state="VIC",
                location_city="Melbourne",
                active=True,
                average_rating=4.7,
                review_count=19,
            ),
        ]
    )
    db.commit()
