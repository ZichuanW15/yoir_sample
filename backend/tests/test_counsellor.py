"""Regression tests for the review findings on the counsellor service/availability
endpoints: response preparation must happen before commit, and slot writes must be
atomic with both the booking flow and each other."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import engine
from app.models import AvailabilitySlot, Booking, Service
from app.schemas import AvailabilitySlotOut

SERVICE_PAYLOAD = {
    "title": "Interview confidence coaching",
    "description": "Behavioural questions, delivery and practical feedback.",
    "priceMinor": 9500,
    "currency": "AUD",
    "modalities": ["online"],
}


def service_payload(**overrides: Any) -> dict[str, Any]:
    return {**SERVICE_PAYLOAD, **overrides}


def add_slot(
    db_session: Session,
    service: Service,
    *,
    starts_at: datetime | None = None,
) -> AvailabilitySlot:
    start = starts_at or datetime.now(UTC) + timedelta(days=1)
    slot = AvailabilitySlot(
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(hours=1),
        status="open",
    )
    db_session.add(slot)
    db_session.commit()
    db_session.refresh(slot)
    return slot


def order_payload(service: Service, slot: AvailabilitySlot, **overrides: Any) -> dict[str, Any]:
    return {
        "serviceId": service.id,
        "slotId": slot.id,
        "modality": "online",
        "timezone": "Australia/Melbourne",
        **overrides,
    }


# --- [P2] response prepared before commit -----------------------------------


def test_create_service_rolls_back_when_response_preparation_fails(
    client: TestClient,
    db_session: Session,
    counsellor_headers: dict[str, str],
    monkeypatch: Any,
) -> None:
    def boom(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("simulated failure preparing the response")

    monkeypatch.setattr("app.routers.counsellor.service_to_out", boom)

    response = client.post(
        "/api/v1/me/services", headers=counsellor_headers, json=service_payload()
    )

    assert response.status_code == 500
    # The failure happened before commit, so nothing was left behind to retry into.
    assert list(db_session.scalars(select(Service))) == []


def test_create_availability_slot_rolls_back_when_response_preparation_fails(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
    monkeypatch: Any,
) -> None:
    def boom(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("simulated failure preparing the response")

    monkeypatch.setattr(AvailabilitySlotOut, "model_validate", boom)

    start = datetime.now(UTC) + timedelta(days=1)
    response = client.post(
        "/api/v1/me/availability-slots",
        headers=counsellor_headers,
        json={
            "serviceId": service.id,
            "startsAt": start.isoformat(),
            "endsAt": (start + timedelta(hours=1)).isoformat(),
        },
    )

    assert response.status_code == 500
    assert list(db_session.scalars(select(AvailabilitySlot))) == []


def test_update_availability_slot_rolls_back_when_response_preparation_fails(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
    monkeypatch: Any,
) -> None:
    slot = add_slot(db_session, service)
    original_start = slot.starts_at

    def boom(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("simulated failure preparing the response")

    monkeypatch.setattr(AvailabilitySlotOut, "model_validate", boom)

    new_start = original_start + timedelta(hours=1)
    response = client.patch(
        f"/api/v1/me/availability-slots/{slot.id}",
        headers=counsellor_headers,
        json={
            "startsAt": new_start.isoformat(),
            "endsAt": (new_start + timedelta(hours=1)).isoformat(),
        },
    )

    assert response.status_code == 500
    db_session.expire_all()
    stored = db_session.get(AvailabilitySlot, slot.id)
    assert stored is not None
    assert stored.starts_at == original_start


# --- [P1] overlap prevention is atomic with the write ------------------------


def test_postgresql_concurrent_slot_creation_on_empty_calendar_prevents_overlap(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock concurrency evidence requires PostgreSQL")

    start = datetime.now(UTC) + timedelta(days=1)
    payload = {
        "serviceId": service.id,
        "startsAt": start.isoformat(),
        "endsAt": (start + timedelta(hours=1)).isoformat(),
    }
    start_together = Barrier(2)

    def create() -> Any:
        start_together.wait(timeout=5)
        return client.post(
            "/api/v1/me/availability-slots", headers=counsellor_headers, json=payload
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        requests = [executor.submit(create) for _ in range(2)]
        responses = [request.result(timeout=10) for request in requests]

    assert sorted(response.status_code for response in responses) == [201, 409]
    db_session.expire_all()
    stored = list(
        db_session.scalars(
            select(AvailabilitySlot).where(AvailabilitySlot.service_id == service.id)
        )
    )
    assert len(stored) == 1


def test_postgresql_concurrent_slot_updates_prevent_overlap(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock concurrency evidence requires PostgreSQL")

    base = datetime.now(UTC) + timedelta(days=1)
    slot_a = add_slot(db_session, service, starts_at=base)
    slot_b = add_slot(db_session, service, starts_at=base + timedelta(hours=3))
    target = base + timedelta(hours=6)
    start_together = Barrier(2)

    def move(slot: AvailabilitySlot) -> Any:
        start_together.wait(timeout=5)
        return client.patch(
            f"/api/v1/me/availability-slots/{slot.id}",
            headers=counsellor_headers,
            json={
                "startsAt": target.isoformat(),
                "endsAt": (target + timedelta(hours=1)).isoformat(),
            },
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        requests = [executor.submit(move, slot_a), executor.submit(move, slot_b)]
        responses = [request.result(timeout=10) for request in requests]

    assert sorted(response.status_code for response in responses) == [200, 409]
    db_session.expire_all()
    refreshed = (
        db_session.get(AvailabilitySlot, slot_a.id),
        db_session.get(AvailabilitySlot, slot_b.id),
    )
    moved = [s for s in refreshed if s is not None and s.starts_at == target]
    assert len(moved) == 1


# --- [P1] slot edit/delete is atomic with the booking flow -------------------


def test_postgresql_concurrent_edit_and_booking_never_diverge(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
    counsellor_headers: dict[str, str],
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock concurrency evidence requires PostgreSQL")

    slot = add_slot(db_session, service)
    moved_start = slot.starts_at + timedelta(hours=2)
    start_together = Barrier(2)

    def edit() -> Any:
        start_together.wait(timeout=5)
        return client.patch(
            f"/api/v1/me/availability-slots/{slot.id}",
            headers=counsellor_headers,
            json={
                "startsAt": moved_start.isoformat(),
                "endsAt": (moved_start + timedelta(hours=1)).isoformat(),
            },
        )

    def book() -> tuple[Any, Any]:
        start_together.wait(timeout=5)
        order = client.post(
            "/api/v1/orders", headers=job_seeker_headers, json=order_payload(service, slot)
        )
        payment = None
        if order.status_code == 201:
            payment = client.post(
                f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers
            )
        return order, payment

    with ThreadPoolExecutor(max_workers=2) as executor:
        edit_future = executor.submit(edit)
        book_future = executor.submit(book)
        edit_response = edit_future.result(timeout=10)
        order_response, payment_response = book_future.result(timeout=10)

    assert edit_response.status_code in (200, 409)
    # Editing never removes the slot or moves its status away from "open", so the
    # booking side always has a slot to reserve regardless of which one the lock
    # lets through first: order creation and payment must both succeed here. A
    # non-201/200 response is a real failure, not a legitimate race outcome — it
    # must not be swallowed into "no booking happened".
    assert order_response.status_code == 201, order_response.text
    assert payment_response is not None, "order succeeded but payment was never attempted"
    assert payment_response.status_code == 200, payment_response.text

    db_session.expire_all()
    stored_slot = db_session.get(AvailabilitySlot, slot.id)
    stored_booking = db_session.scalar(select(Booking).where(Booking.slot_id == slot.id))
    assert stored_slot is not None
    # The bug this guards: a booking confirmed for one time while the slot backing
    # it silently moved to another. Whichever operation won, the two must agree.
    assert stored_booking is not None
    assert stored_booking.starts_at == stored_slot.starts_at
    assert stored_booking.ends_at == stored_slot.ends_at


def test_postgresql_concurrent_delete_and_booking_have_mutually_exclusive_outcomes(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
    counsellor_headers: dict[str, str],
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock concurrency evidence requires PostgreSQL")

    slot = add_slot(db_session, service)
    original_start, original_end = slot.starts_at, slot.ends_at
    start_together = Barrier(2)

    def remove() -> Any:
        start_together.wait(timeout=5)
        return client.delete(
            f"/api/v1/me/availability-slots/{slot.id}", headers=counsellor_headers
        )

    def book() -> tuple[Any, Any]:
        start_together.wait(timeout=5)
        order = client.post(
            "/api/v1/orders", headers=job_seeker_headers, json=order_payload(service, slot)
        )
        payment = None
        if order.status_code == 201:
            payment = client.post(
                f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers
            )
        return order, payment

    with ThreadPoolExecutor(max_workers=2) as executor:
        delete_future = executor.submit(remove)
        book_future = executor.submit(book)
        delete_response = delete_future.result(timeout=10)
        order_response, payment_response = book_future.result(timeout=10)

    # expunge, not expire: if delete won, the row is gone outright, and refreshing
    # an expired-but-still-identity-mapped `slot` against a missing row raises
    # ObjectDeletedError instead of the None a fresh query returns.
    db_session.expunge_all()
    stored_slot = db_session.get(AvailabilitySlot, slot.id)
    stored_booking = db_session.scalar(select(Booking).where(Booking.slot_id == slot.id))

    # Unlike edit, delete removes the row outright, so the two legitimate outcomes
    # diverge in shape rather than in a shared "both succeed" case. Enumerate both
    # explicitly and fail loudly on anything else instead of masking it as "no
    # booking happened".
    if delete_response.status_code == 204:
        # Delete won the lock: nothing was left for the booking side to reserve.
        assert stored_slot is None
        assert order_response.status_code == 404, order_response.text
        assert payment_response is None
        assert stored_booking is None
    elif delete_response.status_code == 409:
        # Booking won the lock: the slot survives, booked, at its original time.
        assert stored_slot is not None
        assert stored_slot.status == "booked"
        assert order_response.status_code == 201, order_response.text
        assert payment_response is not None, "order succeeded but payment was never attempted"
        assert payment_response.status_code == 200, payment_response.text
        assert stored_booking is not None
        assert stored_booking.starts_at == original_start
        assert stored_booking.ends_at == original_end
    else:
        pytest.fail(
            f"unexpected delete status {delete_response.status_code}: {delete_response.text}"
        )
