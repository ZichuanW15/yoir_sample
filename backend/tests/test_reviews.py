"""US-53/54/55 — submitting a review, and the service/counsellor aggregates it
feeds.

Mirrors `test_reschedule.py`'s shape: a local `book()` helper creates an
`AvailabilityWindow`, posts `/orders`, then pays it with the stub to get a
confirmed booking, which the test then marks completed directly — the
transition that marks an order completed is not yet decided (US-53's
assumptions), so tests set it through the database until it is.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AvailabilityWindow, Booking, Review, Service, User


def book(
    client: TestClient, db_session: Session, service: Service, headers: dict,
    *, start: datetime | None = None,
) -> dict:
    start = start or datetime.now(UTC) + timedelta(days=1)
    db_session.add(AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start, ends_at=start + timedelta(hours=3),
    ))
    db_session.commit()
    order = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "serviceId": service.id, "startsAt": start.isoformat(),
            "modality": "online", "timezone": "Australia/Melbourne",
        },
    )
    assert order.status_code == 201, order.text
    paid = client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=headers)
    assert paid.status_code == 200, paid.text
    return paid.json()["booking"]


def complete(db_session: Session, booking_id: str) -> None:
    booking = db_session.get(Booking, booking_id)
    booking.status = "completed"
    db_session.commit()


# --- US-53: submitting a review ----------------------------------------------


def test_the_buyer_of_a_completed_booking_can_review_it(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    booking = book(client, db_session, service, job_seeker_headers)
    complete(db_session, booking["id"])

    response = client.post(
        f"/api/v1/bookings/{booking['id']}/review",
        headers=job_seeker_headers,
        json={"rating": 5, "comment": "Really helped me get ready for interviews."},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["rating"] == 5
    assert body["comment"] == "Really helped me get ready for interviews."
    assert body["bookingId"] == booking["id"]
    assert body["serviceId"] == service.id
    db_session.expire_all()
    stored = db_session.query(Review).filter(Review.booking_id == booking["id"]).one()
    assert stored.rating == 5


@pytest.mark.parametrize("payload", [
    {"rating": 0, "comment": "Too low."},
    {"rating": 6, "comment": "Too high."},
    {"comment": "No rating at all."},
    {"rating": 4, "comment": ""},
])
def test_an_invalid_rating_or_missing_comment_is_rejected_and_stores_nothing(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
    payload: dict,
) -> None:
    booking = book(client, db_session, service, job_seeker_headers)
    complete(db_session, booking["id"])

    response = client.post(
        f"/api/v1/bookings/{booking['id']}/review", headers=job_seeker_headers, json=payload,
    )

    assert response.status_code == 400
    db_session.expire_all()
    assert db_session.query(Review).filter(Review.booking_id == booking["id"]).count() == 0


def test_a_booking_that_is_not_yet_completed_cannot_be_reviewed(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    booking = book(client, db_session, service, job_seeker_headers)
    # Still "confirmed": the session has not happened yet.

    response = client.post(
        f"/api/v1/bookings/{booking['id']}/review",
        headers=job_seeker_headers, json={"rating": 5, "comment": "Great!"},
    )

    assert response.status_code == 409


def test_a_cancelled_booking_cannot_be_reviewed(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    booking = book(client, db_session, service, job_seeker_headers)
    stored = db_session.get(Booking, booking["id"])
    stored.status = "cancelled"
    db_session.commit()

    response = client.post(
        f"/api/v1/bookings/{booking['id']}/review",
        headers=job_seeker_headers, json={"rating": 3, "comment": "Didn't happen."},
    )

    assert response.status_code == 409


def test_only_the_buyer_may_review_their_own_booking(
    client: TestClient, db_session: Session, service: Service,
    job_seeker_headers: dict, counsellor_headers: dict, platform_owner_headers: dict,
) -> None:
    booking = book(client, db_session, service, job_seeker_headers)
    complete(db_session, booking["id"])
    payload = {"rating": 5, "comment": "Not mine to review."}

    # The counsellor delivering the session is a party to the booking, but is
    # refused before the ownership check is even reached — require_job_seeker
    # rejects the role outright.
    as_counsellor = client.post(
        f"/api/v1/bookings/{booking['id']}/review", headers=counsellor_headers, json=payload,
    )
    assert as_counsellor.status_code == 403

    as_owner = client.post(
        f"/api/v1/bookings/{booking['id']}/review", headers=platform_owner_headers, json=payload,
    )
    assert as_owner.status_code == 403

    db_session.expire_all()
    assert db_session.query(Review).filter(Review.booking_id == booking["id"]).count() == 0


def test_a_stranger_job_seeker_gets_the_same_not_found_as_a_nonexistent_booking(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    """Whether a given booking id exists is not a stranger's to learn — the same
    privacy-by-404 convention `_visible_booking` already applies elsewhere."""
    from app.security import create_access_token

    booking = book(client, db_session, service, job_seeker_headers)
    complete(db_session, booking["id"])

    stranger = User(
        name="Riley Stranger", email="riley.stranger@example.com",
        password_hash="x", role="job_seeker", email_verified_at=datetime.now(UTC),
    )
    db_session.add(stranger)
    db_session.commit()
    token, _ = create_access_token(stranger.id, "job_seeker")

    response = client.post(
        f"/api/v1/bookings/{booking['id']}/review",
        headers={"Authorization": f"Bearer {token}"},
        json={"rating": 5, "comment": "Not my booking."},
    )

    assert response.status_code == 404


def test_a_review_cannot_be_submitted_twice_for_the_same_booking(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    booking = book(client, db_session, service, job_seeker_headers)
    complete(db_session, booking["id"])
    payload = {"rating": 4, "comment": "First time."}
    first = client.post(
        f"/api/v1/bookings/{booking['id']}/review", headers=job_seeker_headers, json=payload,
    )
    assert first.status_code == 201

    again = client.post(
        f"/api/v1/bookings/{booking['id']}/review",
        headers=job_seeker_headers, json={"rating": 2, "comment": "Second time."},
    )

    assert again.status_code == 409
    db_session.expire_all()
    assert db_session.query(Review).filter(Review.booking_id == booking["id"]).count() == 1


# --- US-54: service aggregate and review list --------------------------------


def test_a_service_with_no_reviews_shows_a_clear_zero_state(
    client: TestClient, db_session: Session, service: Service,
) -> None:
    # The `service` fixture ships with placeholder averageRating/reviewCount;
    # a service that genuinely has no reviews must not keep showing them.
    service.average_rating = None
    service.review_count = 0
    db_session.commit()

    response = client.get(f"/api/v1/services/{service.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["averageRating"] is None
    assert body["reviewCount"] == 0
    assert body["reviews"] == []


def test_service_detail_is_public_and_reflects_a_stored_review(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    booking = book(client, db_session, service, job_seeker_headers)
    complete(db_session, booking["id"])
    client.post(
        f"/api/v1/bookings/{booking['id']}/review",
        headers=job_seeker_headers, json={"rating": 4, "comment": "Solid session."},
    )

    # No Authorization header: a visitor deciding whether to buy can see this.
    response = client.get(f"/api/v1/services/{service.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["averageRating"] == 4
    assert body["reviewCount"] == 1
    assert [r["comment"] for r in body["reviews"]] == ["Solid session."]
    assert body["reviews"][0]["rating"] == 4


def test_the_service_average_is_the_mean_of_its_own_reviews_only(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    other = Service(
        counsellor_id=service.counsellor_id, title="Resume review", description="...",
        price_minor=5000, currency="AUD", modalities=["online"], active=True,
    )
    db_session.add(other)
    db_session.commit()

    first_start = datetime.now(UTC) + timedelta(days=1)
    first = book(client, db_session, service, job_seeker_headers, start=first_start)
    complete(db_session, first["id"])
    client.post(
        f"/api/v1/bookings/{first['id']}/review",
        headers=job_seeker_headers, json={"rating": 2, "comment": "Not for me."},
    )
    second_start = datetime.now(UTC) + timedelta(days=2)
    second = book(client, db_session, other, job_seeker_headers, start=second_start)
    complete(db_session, second["id"])
    client.post(
        f"/api/v1/bookings/{second['id']}/review",
        headers=job_seeker_headers, json={"rating": 5, "comment": "Loved it."},
    )

    service_detail = client.get(f"/api/v1/services/{service.id}").json()
    other_detail = client.get(f"/api/v1/services/{other.id}").json()

    assert service_detail["averageRating"] == 2
    assert service_detail["reviewCount"] == 1
    assert other_detail["averageRating"] == 5
    assert other_detail["reviewCount"] == 1


def test_a_rejected_submission_leaves_the_service_aggregate_unchanged(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    service.average_rating = 4.9
    service.review_count = 28
    db_session.commit()
    booking = book(client, db_session, service, job_seeker_headers)
    complete(db_session, booking["id"])

    rejected = client.post(
        f"/api/v1/bookings/{booking['id']}/review",
        headers=job_seeker_headers, json={"rating": 9, "comment": "Out of range."},
    )
    assert rejected.status_code == 400

    detail = client.get(f"/api/v1/services/{service.id}").json()
    assert detail["averageRating"] == 4.9
    assert detail["reviewCount"] == 28


# --- US-55: the counsellor's overall rating -----------------------------------


def test_the_counsellors_overall_rating_spans_every_one_of_their_services(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    other = Service(
        counsellor_id=service.counsellor_id, title="Mock interview", description="...",
        price_minor=7000, currency="AUD", modalities=["online"], active=True,
    )
    db_session.add(other)
    db_session.commit()

    first_start = datetime.now(UTC) + timedelta(days=1)
    first = book(client, db_session, service, job_seeker_headers, start=first_start)
    complete(db_session, first["id"])
    client.post(
        f"/api/v1/bookings/{first['id']}/review",
        headers=job_seeker_headers, json={"rating": 3, "comment": "Okay."},
    )
    second_start = datetime.now(UTC) + timedelta(days=2)
    second = book(client, db_session, other, job_seeker_headers, start=second_start)
    complete(db_session, second["id"])
    client.post(
        f"/api/v1/bookings/{second['id']}/review",
        headers=job_seeker_headers, json={"rating": 5, "comment": "Excellent."},
    )

    db_session.expire_all()
    counsellor = db_session.get(User, service.counsellor_id)
    assert counsellor.review_count == 2
    assert counsellor.overall_rating == 4

    listing = client.get(f"/api/v1/services/{service.id}").json()
    assert listing["counsellor"]["overallRating"] == 4
    assert listing["counsellor"]["reviewCount"] == 2
