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
from app.models import AvailabilityWindow, Booking, Order, Service, User
from app.payments.jobs import release_expired_holds
from app.security import create_access_token
from app.seed import seed


def new_window(db: Session, service: Service, start: datetime) -> AvailabilityWindow:
    window = AvailabilityWindow(
        counsellor_id=service.counsellor_id,
        starts_at=start,
        ends_at=start + timedelta(hours=1),
        modalities=["online", "in_person"],
    )
    db.add(window)
    db.commit()
    return window


def order_input(service_id: str, start: datetime | str) -> dict[str, str]:
    return {
        "serviceId": service_id,
        "startsAt": start.isoformat() if isinstance(start, datetime) else start,
        "modality": "online",
        "timezone": "Australia/Melbourne",
    }


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def test_seeded_calendar_has_no_cross_service_counsellor_overlap(db_session: Session) -> None:
    """The seed now declares each person's working windows once, across all services."""
    seed(db_session)
    with SessionLocal() as db:
        services = list(db.scalars(select(Service)))
        windows = list(db.scalars(select(AvailabilityWindow)))
        owners = {service.counsellor_id for service in services}
        assert services and windows
        assert all(window.counsellor_id in owners for window in windows)
        overlapping = [
            (a.id, b.id)
            for a, b in combinations(windows, 2)
            if a.counsellor_id == b.counsellor_id
            and utc(a.starts_at) < utc(b.ends_at)
            and utc(b.starts_at) < utc(a.ends_at)
        ]
    assert overlapping == []


def test_seeded_starts_cannot_confirm_overlapping_bookings_for_one_counsellor(
    client: TestClient,
    db_session: Session,
) -> None:
    """Exercise derived public starts and HTTP reservations in the payment stub mode."""
    seed(db_session)
    buyer = db_session.scalar(select(User).where(User.role == "job_seeker"))
    assert buyer is not None and buyer.email_verified_at is not None
    token, _ = create_access_token(buyer.id, buyer.role)
    headers = {"Authorization": f"Bearer {token}"}
    listing = client.get("/api/v1/services", params={"modality": "online"})
    assert listing.status_code == 200 and listing.json()
    confirmed_ids = []
    rejected_overlaps = 0
    # Read every offer before making a reservation. These are intentionally stale
    # snapshots, so both same-service and cross-service overlapping starts get tried.
    candidates = []
    for service in listing.json():
        starts = client.get(
            f"/api/v1/services/{service['id']}/slots", params={"modality": "online"}
        )
        assert starts.status_code == 200 and starts.json()
        candidates.extend((service, start) for start in starts.json()[:3])
    for service, start in candidates:
        order = client.post(
            "/api/v1/orders",
            headers=headers,
            json=order_input(service["id"], start["startsAt"]),
        )
        assert order.status_code in {201, 409}, order.text
        if order.status_code == 409:
            assert order.json()["code"] == "SLOT_UNAVAILABLE"
            rejected_overlaps += 1
            continue
        assert utc(datetime.fromisoformat(order.json()["startsAt"])) == utc(
            datetime.fromisoformat(start["startsAt"])
        )
        assert "windowId" in order.json() and "slotId" not in order.json()
        payment = client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=headers)
        assert payment.status_code == 200, payment.text
        confirmed_ids.append(payment.json()["booking"]["id"])
    assert confirmed_ids and rejected_overlaps
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
    assert collisions == []


def test_public_availability_omits_past_window_starts(
    client: TestClient,
    db_session: Session,
    service: Service,
) -> None:
    past = new_window(db_session, service, datetime.now(UTC) - timedelta(days=2))
    future = new_window(db_session, service, datetime.now(UTC) + timedelta(days=2))
    response = client.get(f"/api/v1/services/{service.id}/slots")
    assert response.status_code == 200
    starts = {utc(datetime.fromisoformat(row["startsAt"])) for row in response.json()}
    assert utc(past.starts_at) not in starts
    assert starts == {utc(future.starts_at)}
    assert all(set(row) == {"startsAt", "endsAt"} for row in response.json())


def test_order_rejects_a_past_window_start_without_creating_a_hold(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    past = new_window(db_session, service, datetime.now(UTC) - timedelta(days=2))
    response = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_input(service.id, past.starts_at)
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "VALIDATION_ERROR"
    with SessionLocal() as db:
        stored = db.get(AvailabilityWindow, past.id)
        assert stored is not None and utc(stored.starts_at) == utc(past.starts_at)
        assert list(db.scalars(select(Order))) == []
        assert list(db.scalars(select(Booking))) == []


def test_window_edit_rederives_availability_for_every_owned_service(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
) -> None:
    """There is no per-service calendar assignment to silently ignore any more."""
    second = Service(
        counsellor_id=service.counsellor_id,
        title="Shorter service",
        description="Preparation",
        price_minor=8000,
        duration_minutes=30,
        currency="AUD",
        modalities=["online"],
        active=True,
    )
    db_session.add(second)
    db_session.commit()
    window = new_window(db_session, service, datetime.now(UTC) + timedelta(days=3))
    moved = window.starts_at + timedelta(days=1)
    response = client.patch(
        f"/api/v1/me/availability-windows/{window.id}",
        headers=counsellor_headers,
        json={"startsAt": moved.isoformat(), "endsAt": (moved + timedelta(hours=1)).isoformat()},
    )
    assert response.status_code == 200, response.text
    assert response.json()["id"] == window.id and "serviceId" not in response.json()
    with SessionLocal() as db:
        stored = db.get(AvailabilityWindow, window.id)
        assert stored is not None and stored.counsellor_id == service.counsellor_id
        assert utc(stored.starts_at) == utc(moved)
    for item, minutes in ((service, (0,)), (second, (0, 15, 30))):
        offers = client.get(f"/api/v1/services/{item.id}/slots")
        assert offers.status_code == 200
        assert [utc(datetime.fromisoformat(row["startsAt"])) for row in offers.json()] == [
            utc(moved) + timedelta(minutes=offset) for offset in minutes
        ]


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
            "durationMinutes": 60,
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
def test_failed_booking_commit_rolls_back_order_payment_and_hold_together(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
) -> None:
    window = new_window(db_session, service, datetime.now(UTC) + timedelta(days=2))
    path = "/api/v1/orders"
    payload = order_input(service.id, window.starts_at)
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
        persisted_window = db.get(AvailabilityWindow, window.id)
        assert persisted_window is not None
        assert utc(persisted_window.starts_at) == utc(window.starts_at)
        if operation == "create_order":
            assert list(db.scalars(select(Order))) == []
            offers = client.get(f"/api/v1/services/{service.id}/slots")
            assert offers.status_code == 200 and len(offers.json()) == 1
        else:
            orders = list(db.scalars(select(Order)))
            assert len(orders) == 1 and orders[0].id == order_id
            assert orders[0].status == "awaiting_payment"
            assert orders[0].payment_status == "not_started"
            assert orders[0].hold_expires_at > datetime.now(UTC)
            offers = client.get(f"/api/v1/services/{service.id}/slots")
            assert offers.status_code == 200 and offers.json() == []


def test_expired_unpaid_hold_restores_public_time_before_cleanup(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    """Availability obeys hold_expires_at; the cleanup job subsequently cancels the order."""
    window = new_window(db_session, service, datetime.now(UTC) + timedelta(days=2))
    payload = order_input(service.id, window.starts_at)
    first = client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)
    assert first.status_code == 201, first.text
    persisted = db_session.get(Order, first.json()["id"])
    assert persisted is not None and persisted.hold_expires_at > datetime.now(UTC)
    offered = client.get(f"/api/v1/services/{service.id}/slots")
    assert offered.status_code == 200 and offered.json() == []
    persisted.hold_expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()
    restored = client.get(f"/api/v1/services/{service.id}/slots")
    assert restored.status_code == 200 and len(restored.json()) == 1
    assert utc(datetime.fromisoformat(restored.json()[0]["startsAt"])) == utc(window.starts_at)
    retry = client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)
    assert retry.status_code == 201, retry.text
    assert retry.json()["id"] != first.json()["id"]
    assert release_expired_holds(db_session) == 1
    with SessionLocal() as db:
        expired = db.get(Order, first.json()["id"])
        active = db.get(Order, retry.json()["id"])
        assert expired is not None and expired.status == "cancelled"
        assert active is not None and active.status == "awaiting_payment"
        assert active.hold_expires_at > datetime.now(UTC)
        assert list(db.scalars(select(Booking))) == []
        assert db.get(AvailabilityWindow, window.id) is not None


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
    window = new_window(db_session, service, datetime.now(UTC) + timedelta(days=2))
    payload = order_input(service.id, window.starts_at)
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
        assert stored_order.window_id == window.id
        stored_window = db.get(AvailabilityWindow, window.id)
        assert stored_window is not None
        assert utc(stored_window.starts_at) == utc(window.starts_at)
        if operation == "create_order":
            assert stored_order.status == "awaiting_payment"
            assert stored_order.payment_status == "not_started"
            assert stored_order.hold_expires_at > datetime.now(UTC) and bookings == []
        else:
            assert stored_order.id == original_order_id
            assert stored_order.status == "confirmed" and stored_order.payment_status == "paid"
            assert stored_order.window_id == window.id
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
    window = new_window(db_session, service, datetime.now(UTC) + timedelta(days=2))
    order = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_input(service.id, window.starts_at)
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
        persisted_window = db.get(AvailabilityWindow, window.id)
        assert persisted_order is not None and persisted_order.status == "confirmed"
        assert persisted_window is not None
        assert bookings[0].window_id == persisted_window.id
