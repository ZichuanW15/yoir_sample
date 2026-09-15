"""Executable Sprint 2 defects and payment/marketplace acceptance boundaries.

Known defects are strict xfails limited to KnownAcceptanceDefect. Setup, database,
unexpected status and response-shape failures must still fail the suite.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from itertools import combinations
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from qa_acceptance import KnownAcceptanceDefect
from sqlalchemy import event, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine, get_db
from app.main import app
from app.models import AvailabilitySlot, Booking, Order, Service, User
from app.security import create_access_token
from app.seed import seed


def new_slot(db: Session, service: Service, start: datetime) -> AvailabilitySlot:
    slot = AvailabilitySlot(
        service_id=service.id, starts_at=start, ends_at=start + timedelta(hours=1), status="open"
    )
    db.add(slot)
    db.commit()
    return slot


def order_input(service_id: str, slot_id: str) -> dict[str, str]:
    return {
        "serviceId": service_id,
        "slotId": slot_id,
        "modality": "online",
        "timezone": "Australia/Melbourne",
    }


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="S2-BE-SEED-OVERLAP: seed assigns identical times to a counsellor's services",
)
def test_seeded_calendar_has_no_cross_service_counsellor_overlap(db_session: Session) -> None:
    seed(db_session)
    with SessionLocal() as db:
        services = {s.id: s for s in db.scalars(select(Service))}
        slots = list(db.scalars(select(AvailabilitySlot)))
        assert services and slots
        assert all(slot.service_id in services for slot in slots)
        overlapping = [
            (a.id, b.id)
            for a, b in combinations(slots, 2)
            if services[a.service_id].counsellor_id == services[b.service_id].counsellor_id
            and utc(a.starts_at) < utc(b.ends_at)
            and utc(b.starts_at) < utc(a.ends_at)
        ]
    if overlapping:
        raise KnownAcceptanceDefect(f"Seed produced {len(overlapping)} same-counsellor overlaps")


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="S2-BE-DOUBLE-BOOKING: overlapping seeded services can both be purchased",
)
def test_seeded_slots_cannot_confirm_overlapping_bookings_for_one_counsellor(
    client: TestClient,
    db_session: Session,
) -> None:
    """Exercise public slots and both HTTP writes; no mocked booking or payment."""
    seed(db_session)
    buyer = db_session.scalar(select(User).where(User.role == "job_seeker"))
    assert buyer is not None
    token, _ = create_access_token(buyer.id, buyer.role)
    headers = {"Authorization": f"Bearer {token}"}
    listing = client.get("/api/v1/services")
    assert listing.status_code == 200 and listing.json()
    confirmed_ids = []
    for service in listing.json():
        slots = client.get(f"/api/v1/services/{service['id']}/slots")
        assert slots.status_code == 200
        for slot in slots.json():
            order = client.post(
                "/api/v1/orders", headers=headers, json=order_input(service["id"], slot["id"])
            )
            # Only an intentional reservation conflict may prevent purchase.
            assert order.status_code in {201, 409}, order.text
            if order.status_code == 409:
                assert order.json()["code"] == "SLOT_UNAVAILABLE"
                continue
            assert order.json()["slotId"] == slot["id"]
            payment = client.post(
                f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=headers
            )
            assert payment.status_code == 200, payment.text
            confirmed_ids.append(payment.json()["booking"]["id"])
    assert confirmed_ids
    with SessionLocal() as db:
        bookings = list(db.scalars(select(Booking)))
        assert {b.id for b in bookings} == set(confirmed_ids)
        assert all(b.status == "confirmed" and b.payment_status == "paid" for b in bookings)
        collisions = [
            (a.id, b.id)
            for a, b in combinations(bookings, 2)
            if a.counsellor_id == b.counsellor_id
            and utc(a.starts_at) < utc(b.ends_at)
            and utc(b.starts_at) < utc(a.ends_at)
        ]
    if collisions:
        raise KnownAcceptanceDefect(f"Confirmed {len(collisions)} overlapping booking pairs")


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="S2-BE-PAST-SLOT-LIST: public availability includes past open slots",
)
def test_public_availability_omits_past_open_slots(
    client: TestClient,
    db_session: Session,
    service: Service,
) -> None:
    past = new_slot(db_session, service, datetime.now(UTC) - timedelta(days=2))
    future = new_slot(db_session, service, datetime.now(UTC) + timedelta(days=2))
    response = client.get(f"/api/v1/services/{service.id}/slots")
    assert response.status_code == 200
    ids = {row["id"] for row in response.json()}
    assert future.id in ids
    if past.id in ids:
        raise KnownAcceptanceDefect("A past open slot is still advertised to buyers")
    assert ids == {future.id}


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="S2-BE-PAST-SLOT-ORDER: orders accept elapsed open slots",
)
def test_order_rejects_a_past_open_slot_without_holding_it(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    past = new_slot(db_session, service, datetime.now(UTC) - timedelta(days=2))
    response = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_input(service.id, past.id)
    )
    assert response.status_code in {201, 400, 409}, response.text
    with SessionLocal() as db:
        stored = db.get(AvailabilitySlot, past.id)
        assert stored is not None
        orders = list(db.scalars(select(Order)))
        if response.status_code == 201:
            assert len(orders) == 1 and orders[0].id == response.json()["id"]
            assert stored.status == "held"
            raise KnownAcceptanceDefect("A past slot was reserved and persisted as an order")
        assert response.json()["code"] in {"VALIDATION_ERROR", "SLOT_UNAVAILABLE"}
        assert orders == [] and stored.status == "open"


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="S2-BE-SLOT-SERVICE: PATCH silently ignores a requested service change",
)
def test_slot_patch_does_not_silently_ignore_service_reassignment(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
) -> None:
    destination = Service(
        counsellor_id=service.counsellor_id,
        title="Destination service",
        description="Another owned service",
        price_minor=8000,
        currency="AUD",
        modalities=["online"],
        active=True,
    )
    db_session.add(destination)
    db_session.commit()
    start = datetime.now(UTC) + timedelta(days=3)
    slot = new_slot(db_session, service, start)
    moved = start + timedelta(days=1)
    response = client.patch(
        f"/api/v1/me/availability-slots/{slot.id}",
        headers=counsellor_headers,
        json={
            "serviceId": destination.id,
            "startsAt": moved.isoformat(),
            "endsAt": (moved + timedelta(hours=1)).isoformat(),
        },
    )
    assert response.status_code in {200, 400}, response.text
    with SessionLocal() as db:
        stored = db.get(AvailabilitySlot, slot.id)
        assert stored is not None
        if response.status_code == 400:
            # Until reassignment is supported, rejecting the unhandled field is honest.
            assert response.json()["code"] == "VALIDATION_ERROR"
            assert "serviceId" in response.json()["fieldErrors"]
            assert stored.service_id == service.id and utc(stored.starts_at) == utc(start)
        else:
            assert response.json()["id"] == slot.id
            assert utc(stored.starts_at) == utc(moved)
            assert response.json()["serviceId"] == stored.service_id
            if stored.service_id != destination.id:
                raise KnownAcceptanceDefect("PATCH returned 200 but retained the original service")


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="S2-BE-SERVICE-EXTRAS: published additionalProperties=false is not enforced",
)
def test_service_creation_rejects_unpublished_fields_instead_of_silently_dropping_them(
    client: TestClient,
    counsellor_headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/me/services",
        headers=counsellor_headers,
        json={
            "title": "New service",
            "description": "Preparation",
            "priceMinor": 5000,
            "currency": "AUD",
            "modalities": ["online"],
            "unexpectedClientField": "not-supported",
        },
    )
    assert response.status_code in {201, 400}, response.text
    with SessionLocal() as db:
        services = list(db.scalars(select(Service)))
        if response.status_code == 201:
            assert len(services) == 1 and services[0].id == response.json()["id"]
            raise KnownAcceptanceDefect("Unknown request field was dropped while service persisted")
        assert response.json()["code"] == "VALIDATION_ERROR"
        assert "unexpectedClientField" in response.json()["fieldErrors"]
        assert services == []


def test_marketplace_keyword_and_modality_combine_and_empty_results_are_success(
    client: TestClient,
    db_session: Session,
    counsellor: User,
) -> None:
    for identifier, title, modalities, active in [
        ("match", "Interview preparation", ["online"], True),
        ("wrong-modality", "Interview preparation", ["in_person"], True),
        ("wrong-query", "Resume review", ["online"], True),
        ("inactive", "Interview preparation", ["online"], False),
    ]:
        db_session.add(
            Service(
                id=identifier,
                counsellor_id=counsellor.id,
                title=title,
                description="Professional preparation",
                price_minor=5000,
                currency="AUD",
                modalities=modalities,
                active=active,
            )
        )
    db_session.commit()
    response = client.get("/api/v1/services", params={"query": " INTERVIEW ", "modality": "online"})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == ["match"]
    by_counsellor = client.get("/api/v1/services", params={"query": "MAYA CHEN"})
    assert by_counsellor.status_code == 200 and len(by_counsellor.json()) == 3
    empty = client.get("/api/v1/services", params={"query": "no matching service"})
    assert empty.status_code == 200 and empty.json() == []


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="S2-BE-ERROR-REQUEST-ID: unexpected failures omit the correlation response header",
)
def test_unexpected_failure_preserves_request_id_in_body_and_response_header(
    client: TestClient,
    service: Service,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = []

    def fail_response(_service: Service):
        attempts.append(True)
        raise RuntimeError("qa private failure detail")

    monkeypatch.setattr("app.routers.services.service_to_out", fail_response)
    request_id = "qa-sprint2-500-correlation"
    response = client.get(f"/api/v1/services/{service.id}", headers={"X-Request-Id": request_id})
    assert attempts == [True]
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert response.json()["requestId"] == request_id
    assert "qa private failure detail" not in response.text
    if response.headers.get("x-request-id") != request_id:
        raise KnownAcceptanceDefect("500 response loses the request correlation header")


@pytest.mark.parametrize("operation", ["create_order", "pay_order"])
def test_failed_booking_commit_rolls_back_order_payment_and_slot_together(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
) -> None:
    slot = new_slot(db_session, service, datetime.now(UTC) + timedelta(days=2))
    path = "/api/v1/orders"
    payload = order_input(service.id, slot.id)
    order_id = None
    if operation == "pay_order":
        created = client.post(path, headers=job_seeker_headers, json=payload)
        assert created.status_code == 201
        order_id = created.json()["id"]
        path = f"/api/v1/orders/{order_id}/payments/stub"
    attempts = []

    def failed_request_db():
        with SessionLocal() as request_db:

            def fail_commit():
                request_db.flush()
                attempts.append(True)
                raise OperationalError("qa failed booking commit", {}, RuntimeError("qa fault"))

            monkeypatch.setattr(request_db, "commit", fail_commit)
            yield request_db

    app.dependency_overrides[get_db] = failed_request_db
    try:
        response = client.post(path, headers=job_seeker_headers, json=payload)
    finally:
        app.dependency_overrides.pop(get_db, None)
    assert attempts == [True]
    assert response.status_code == 500 and response.json()["code"] == "INTERNAL_ERROR"
    assert "qa failed booking commit" not in response.text
    with SessionLocal() as db:
        assert list(db.scalars(select(Booking))) == []
        persisted_slot = db.get(AvailabilitySlot, slot.id)
        assert persisted_slot is not None
        if operation == "create_order":
            assert list(db.scalars(select(Order))) == []
            assert persisted_slot.status == "open"
        else:
            orders = list(db.scalars(select(Order)))
            assert len(orders) == 1 and orders[0].id == order_id
            assert orders[0].status == "awaiting_payment"
            assert orders[0].payment_status == "not_started"
            assert persisted_slot.status == "held"


def test_aged_unpaid_hold_characterization_does_not_claim_expiry_or_release(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    """Current behavior only: the latest Story Map leaves hold duration undecided.

    This is not acceptance of indefinite holds or of the old 15-minute proposal.
    A browser leaving checkout does not execute a server release operation.
    """
    slot = new_slot(db_session, service, datetime.now(UTC) + timedelta(days=2))
    payload = order_input(service.id, slot.id)
    first = client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)
    assert first.status_code == 201, first.text
    order_id = first.json()["id"]
    persisted = db_session.get(Order, order_id)
    assert persisted is not None
    persisted.created_at = datetime.now(UTC) - timedelta(minutes=16)
    db_session.commit()

    retry = client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)
    assert retry.status_code == 409, retry.text
    assert retry.json()["code"] == "SLOT_UNAVAILABLE"
    with SessionLocal() as db:
        orders = list(db.scalars(select(Order)))
        assert len(orders) == 1 and orders[0].id == order_id
        assert orders[0].status == "awaiting_payment"
        assert orders[0].payment_status == "not_started"
        held = db.get(AvailabilitySlot, slot.id)
        assert held is not None and held.status == "held"
        assert list(db.scalars(select(Booking))) == []


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason=(
        "S2-BE-POST-COMMIT-READ: a successful booking write is reported as 500 "
        "when its subsequent response read fails"
    ),
)
@pytest.mark.parametrize("operation", ["create_order", "pay_order"])
def test_committed_booking_write_does_not_depend_on_a_second_database_read(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
    operation: str,
) -> None:
    """Inject only an ORM read failure *after* the request's real DB commit.

    Flush/commit failures have a separate rollback test above. Payment retry is
    checked here against fresh rows; no payment provider or browser is simulated.
    """
    slot = new_slot(db_session, service, datetime.now(UTC) + timedelta(days=2))
    payload = order_input(service.id, slot.id)
    path = "/api/v1/orders"
    original_order_id = None
    if operation == "pay_order":
        created = client.post(path, headers=job_seeker_headers, json=payload)
        assert created.status_code == 201, created.text
        original_order_id = created.json()["id"]
        path = f"/api/v1/orders/{original_order_id}/payments/stub"

    commits = []
    failed_reads = []

    def request_db():
        with SessionLocal() as db:
            committed = False

            def after_commit(_session):
                nonlocal committed
                committed = True
                commits.append(True)

            def reject_post_commit_read(_state):
                if committed:
                    failed_reads.append(True)
                    raise OperationalError(
                        "qa post-commit response read", {}, RuntimeError("qa read unavailable")
                    )

            event.listen(db, "after_commit", after_commit)
            event.listen(db, "do_orm_execute", reject_post_commit_read)
            try:
                yield db
            finally:
                event.remove(db, "after_commit", after_commit)
                event.remove(db, "do_orm_execute", reject_post_commit_read)

    # Context restoration preserves any outer test harness's dependency override.
    missing = object()
    prior_override = app.dependency_overrides.get(get_db, missing)
    app.dependency_overrides[get_db] = request_db
    try:
        response = client.post(path, headers=job_seeker_headers, json=payload)
    finally:
        if prior_override is missing:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = prior_override

    assert commits == [True], "The request must have committed before the injected fault"
    expected_status = 201 if operation == "create_order" else 200
    assert response.status_code in {expected_status, 500}, response.text
    with SessionLocal() as db:
        orders = list(db.scalars(select(Order)))
        bookings = list(db.scalars(select(Booking)))
        assert len(orders) == 1
        stored_order = orders[0]
        assert stored_order.slot_id == slot.id
        stored_slot = db.get(AvailabilitySlot, slot.id)
        assert stored_slot is not None
        if operation == "create_order":
            assert stored_order.status == "awaiting_payment"
            assert stored_order.payment_status == "not_started"
            assert stored_slot.status == "held" and bookings == []
        else:
            assert stored_order.id == original_order_id
            assert stored_order.status == "confirmed" and stored_order.payment_status == "paid"
            assert stored_slot.status == "booked"
            assert len(bookings) == 1 and bookings[0].order_id == original_order_id
            booking_id = bookings[0].id

    if response.status_code == 500:
        # Only this fully reproduced post-commit failure is expected. Auth/setup,
        # an earlier error, missing rows or a failed recovery remain ordinary Fail.
        assert failed_reads == [True]
        assert response.json()["code"] == "INTERNAL_ERROR"
        assert "qa post-commit" not in response.text and "qa read unavailable" not in response.text
        retry = client.post(path, headers=job_seeker_headers, json=payload)
        if operation == "create_order":
            assert retry.status_code == 409, retry.text
            assert retry.json()["code"] == "SLOT_UNAVAILABLE"
        else:
            assert retry.status_code == 200, retry.text
            assert retry.json()["booking"]["id"] == booking_id
            repeated = client.post(path, headers=job_seeker_headers, json=payload)
            assert repeated.status_code == 200 and repeated.json() == retry.json()
        with SessionLocal() as db:
            assert len(list(db.scalars(select(Order)))) == 1
            expected_bookings = 0 if operation == "create_order" else 1
            assert len(list(db.scalars(select(Booking)))) == expected_bookings
        raise KnownAcceptanceDefect(
            f"{operation} committed but returned 500; retry returned {retry.status_code}"
        )

    assert failed_reads == []
    if operation == "create_order":
        assert response.json()["id"] == stored_order.id
    else:
        assert response.json()["booking"]["id"] == booking_id


def test_postgresql_simultaneous_payment_retries_confirm_one_booking(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("Payment row-lock concurrency evidence requires PostgreSQL")
    slot = new_slot(db_session, service, datetime.now(UTC) + timedelta(days=2))
    order = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_input(service.id, slot.id)
    )
    assert order.status_code == 201
    order_id = order.json()["id"]
    together = Barrier(2)

    def pay():
        together.wait(timeout=5)
        return client.post(f"/api/v1/orders/{order_id}/payments/stub", headers=job_seeker_headers)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(pay) for _ in range(2)]
        responses = [future.result(timeout=15) for future in futures]
    assert [response.status_code for response in responses] == [200, 200]
    booking_ids = {response.json()["booking"]["id"] for response in responses}
    assert len(booking_ids) == 1
    with SessionLocal() as db:
        bookings = list(db.scalars(select(Booking)))
        assert len(bookings) == 1 and bookings[0].id in booking_ids
        assert bookings[0].order_id == order_id and bookings[0].payment_status == "paid"
        persisted_order = db.get(Order, order_id)
        persisted_slot = db.get(AvailabilitySlot, slot.id)
        assert persisted_order is not None and persisted_order.status == "confirmed"
        assert persisted_slot is not None and persisted_slot.status == "booked"
