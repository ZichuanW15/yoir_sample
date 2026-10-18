"""US-69 — move a confirmed booking to another open slot on the same order.

Mirrors `test_booking_detail.py`'s shape: a local `book()` helper creates an
`AvailabilityWindow`, posts `/orders`, then pays it with the stub to get a
confirmed booking to reschedule.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import engine
from app.models import AvailabilityWindow, Booking, Order, Service


def book(
    client: TestClient,
    db_session: Session,
    service: Service,
    headers: dict,
    *,
    start: datetime | None = None,
    modality: str = "online",
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
            "serviceId": service.id,
            "startsAt": start.isoformat(),
            "modality": modality,
            "timezone": "Australia/Melbourne",
        },
    )
    assert order.status_code == 201, order.text
    paid = client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=headers)
    assert paid.status_code == 200, paid.text
    return paid.json()["booking"]


def reschedule(
    client: TestClient, booking_id: str, starts_at: datetime, headers: dict, *, modality="online",
):
    return client.post(
        f"/api/v1/bookings/{booking_id}/reschedule",
        headers=headers,
        json={
            "startsAt": starts_at.isoformat(),
            "modality": modality,
            "timezone": "Australia/Melbourne",
        },
    )


def assert_error_shape(response, expected_status: int, expected_code: str) -> dict:
    assert response.status_code == expected_status
    body = response.json()
    assert body["code"] == expected_code
    return body


# --- AT-US-69-1: successful move ------------------------------------------


def test_the_job_seeker_can_reschedule_to_another_open_time(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)
    new_start = original_start + timedelta(hours=1)

    response = reschedule(client, booking["id"], new_start, job_seeker_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    # Same order and booking reference — nothing new was created.
    assert body["id"] == booking["id"]
    assert body["orderId"] == booking["orderId"]
    assert body["status"] == "confirmed"
    assert body["startsAt"] == new_start.isoformat().replace("+00:00", "Z")
    assert len(list(db_session.scalars(select(Booking)))) == 1
    assert len(list(db_session.scalars(select(Order)))) == 1

    # The old slot is open again: a second job seeker can book it.
    second_order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json={
            "serviceId": service.id,
            "startsAt": original_start.isoformat(),
            "modality": "online",
            "timezone": "Australia/Melbourne",
        },
    )
    assert second_order.status_code == 201, second_order.text


def test_the_counsellor_can_also_reschedule_a_booking_they_deliver(
    client: TestClient, db_session: Session, service: Service,
    job_seeker_headers: dict, counsellor_headers: dict,
) -> None:
    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)
    new_start = original_start + timedelta(hours=1)

    response = reschedule(client, booking["id"], new_start, counsellor_headers)

    assert response.status_code == 200, response.text


def test_reschedule_reflects_in_my_bookings_and_booking_detail(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)
    new_start = original_start + timedelta(hours=1)
    reschedule(client, booking["id"], new_start, job_seeker_headers)

    detail = client.get(f"/api/v1/bookings/{booking['id']}", headers=job_seeker_headers)
    assert detail.json()["startsAt"] == new_start.isoformat().replace("+00:00", "Z")

    listed = client.get("/api/v1/me/bookings", headers=job_seeker_headers)
    [row] = [b for b in listed.json() if b["id"] == booking["id"]]
    assert row["startsAt"] == new_start.isoformat().replace("+00:00", "Z")


def test_a_reschedule_that_partially_overlaps_its_own_current_time_succeeds(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    """A booking's own current span must not be read as a clash with its new one —
    it is moving, not doubling — so a reschedule a few minutes either side of where
    it already is must not be rejected as unavailable."""
    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)
    nudged = original_start + timedelta(minutes=15)

    response = reschedule(client, booking["id"], nudged, job_seeker_headers)

    assert response.status_code == 200, response.text


# --- AT-US-69-2: conflict keeps the original -------------------------------


def test_rescheduling_onto_a_slot_someone_else_holds_is_rejected_and_keeps_the_original(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)
    taken_start = original_start + timedelta(hours=2)
    # Someone else's confirmed booking occupies the time this request will try for.
    book(client, db_session, service, job_seeker_headers, start=taken_start)

    response = reschedule(client, booking["id"], taken_start, job_seeker_headers)

    assert_error_shape(response, 409, "SLOT_UNAVAILABLE")
    db_session.expire_all()
    unchanged = db_session.get(Booking, booking["id"])
    assert unchanged.starts_at.replace(tzinfo=UTC) == original_start
    assert len(list(db_session.scalars(select(Booking)))) == 2
    assert len(list(db_session.scalars(select(Order)))) == 2


def test_rescheduling_outside_every_availability_window_is_rejected(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)
    # The window `book()` creates only covers three hours from original_start.
    outside = original_start + timedelta(days=10)

    response = reschedule(client, booking["id"], outside, job_seeker_headers)

    assert_error_shape(response, 409, "SLOT_UNAVAILABLE")


def test_postgresql_concurrent_reschedules_onto_the_same_slot_move_exactly_one(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    """Two different bookings racing to reschedule onto the same new time: exactly
    one must win, the other must be rejected with its original booking untouched —
    the row-lock concurrency evidence for reschedule, mirroring
    `test_postgresql_concurrent_order_requests_reserve_slot_once` for orders."""
    if engine.dialect.name != "postgresql":
        import pytest
        pytest.skip("PostgreSQL row-lock concurrency evidence requires PostgreSQL")

    base = datetime.now(UTC) + timedelta(days=1)
    first = book(client, db_session, service, job_seeker_headers, start=base)
    second = book(client, db_session, service, job_seeker_headers, start=base + timedelta(hours=1))
    contested = base + timedelta(hours=2)
    start_together = Barrier(3)

    def go(booking_id: str) -> Any:
        start_together.wait(timeout=5)
        return reschedule(client, booking_id, contested, job_seeker_headers)

    with ThreadPoolExecutor(max_workers=2) as executor:
        requests = [executor.submit(go, first["id"]), executor.submit(go, second["id"])]
        start_together.wait(timeout=5)
        responses = [request.result(timeout=10) for request in requests]

    assert sorted(response.status_code for response in responses) == [200, 409]
    conflict = next(response for response in responses if response.status_code == 409)
    assert_error_shape(conflict, 409, "SLOT_UNAVAILABLE")
    db_session.expire_all()
    starts = sorted(b.starts_at.replace(tzinfo=UTC) for b in db_session.scalars(select(Booking)))
    # The loser still holds its own original time; only the winner moved.
    assert base in starts or (base + timedelta(hours=1)) in starts
    assert contested in starts
    assert len(list(db_session.scalars(select(Booking)))) == 2
    assert len(list(db_session.scalars(select(Order)))) == 2


# --- AT-US-69-3: non-participant or ineligible rejected --------------------


def test_a_stranger_cannot_reschedule_someone_elses_booking(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    from app.models import User
    from app.security import create_access_token, hash_password

    stranger = User(
        name="Stranger",
        email="stranger@example.com",
        password_hash=hash_password("password123"),
        role="job_seeker",
        email_verified_at=datetime.now(UTC),
    )
    db_session.add(stranger)
    db_session.commit()
    db_session.refresh(stranger)
    token, _ = create_access_token(stranger.id, stranger.role)
    stranger_headers = {"Authorization": f"Bearer {token}"}

    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)

    response = reschedule(
        client, booking["id"], original_start + timedelta(hours=1), stranger_headers,
    )

    assert_error_shape(response, 404, "NOT_FOUND")
    db_session.expire_all()
    unchanged = db_session.get(Booking, booking["id"])
    assert unchanged.starts_at.replace(tzinfo=UTC) == original_start


def test_a_cancelled_booking_cannot_be_rescheduled(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)
    cancelled = client.post(f"/api/v1/bookings/{booking['id']}/cancel", headers=job_seeker_headers)
    assert cancelled.status_code == 200, cancelled.text

    response = reschedule(
        client, booking["id"], original_start + timedelta(hours=1), job_seeker_headers,
    )

    assert_error_shape(response, 409, "INVALID_STATE_TRANSITION")


def test_a_past_booking_cannot_be_rescheduled(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    # Created and paid for in the future (orders reject a past time outright), then
    # pushed into the past directly on the row, the way other tests reach a state
    # the API itself refuses to create.
    booking = book(client, db_session, service, job_seeker_headers)
    row = db_session.get(Booking, booking["id"])
    row.starts_at = datetime.now(UTC) - timedelta(hours=2)
    row.ends_at = datetime.now(UTC) - timedelta(hours=1)
    db_session.commit()

    response = reschedule(
        client, booking["id"], datetime.now(UTC) + timedelta(days=2), job_seeker_headers,
    )

    assert_error_shape(response, 409, "INVALID_STATE_TRANSITION")


def test_rescheduling_to_a_time_that_has_already_passed_is_rejected(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)

    response = reschedule(
        client, booking["id"], datetime.now(UTC) - timedelta(hours=1), job_seeker_headers,
    )

    assert_error_shape(response, 400, "VALIDATION_ERROR")


def test_an_unauthenticated_request_cannot_reschedule(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    original_start = datetime.now(UTC) + timedelta(days=1)
    booking = book(client, db_session, service, job_seeker_headers, start=original_start)

    response = client.post(
        f"/api/v1/bookings/{booking['id']}/reschedule",
        json={
            "startsAt": (original_start + timedelta(hours=1)).isoformat(),
            "modality": "online",
            "timezone": "Australia/Melbourne",
        },
    )

    assert response.status_code == 401
