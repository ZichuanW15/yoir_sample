"""Sprint 2 API acceptance: QA #91, #109, #112, #115, #133..#145.

Availability is counsellor-owned; public starts and held time are derived from
service durations, unpaid orders and confirmed bookings on the shared calendar.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine, get_db
from app.main import app
from app.models import AvailabilityWindow, Booking, Order, Service, User
from app.security import create_access_token, hash_password, verify_password

SERVICE_INPUT = {
    "title": "  Interview practice  ",
    "description": "  Practical interview preparation.  ",
    "priceMinor": 9500,
    "durationMinutes": 60,
    "currency": "AUD",
    "modalities": ["online"],
}


def error_body(response: Any, status: int, code: str) -> dict[str, Any]:
    assert response.status_code == status, response.text
    body = response.json()
    assert body["code"] == code
    assert body["message"]
    assert isinstance(body["requestId"], str) and body["requestId"]
    if status != 500:
        assert body["requestId"] == response.headers["x-request-id"]
    # The 500-header defect has a dedicated narrow xfail in the regression suite;
    # it must not prevent transaction tests from checking their stored state.
    return body


def future_start() -> datetime:
    return (datetime.now(UTC) + timedelta(days=30)).replace(microsecond=0)


def as_utc(value: datetime) -> datetime:
    """Compare instants, preserving PostgreSQL session timezone offsets.

    SQLite strips the timezone from the UTC fixtures used by this module.
    """
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def window_input(**changes: Any) -> dict[str, Any]:
    start = future_start()
    return {
        "startsAt": start.isoformat(),
        "endsAt": (start + timedelta(hours=1)).isoformat(),
        "modalities": ["online", "in_person"],
        **changes,
    }


def store_window(db: Session, owner: User, *, offset: int = 0) -> AvailabilityWindow:
    start = future_start() + timedelta(hours=offset)
    window = AvailabilityWindow(
        counsellor_id=owner.id,
        starts_at=start,
        ends_at=start + timedelta(hours=1),
        modalities=["online", "in_person"],
    )
    db.add(window)
    db.commit()
    return window


def store_service(db: Session, owner: User, **changes: Any) -> Service:
    values = {
        "counsellor_id": owner.id,
        "title": "Second service",
        "description": "Preparation",
        "price_minor": 7000,
        "duration_minutes": 60,
        "currency": "AUD",
        "modalities": ["online"],
        "active": True,
    }
    item = Service(**(values | changes))
    db.add(item)
    db.commit()
    return item


@pytest.fixture
def other_counsellor(db_session: Session) -> User:
    user = User(
        name="Different Counsellor",
        email="other-counsellor@example.com",
        password_hash=hash_password("qa-only-password"),
        role="counsellor",
        verification_status="verified",
        email_verified_at=datetime.now(UTC),
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_registered_counsellor_starts_pending_and_cannot_publish_until_verified(
    client: TestClient,
) -> None:
    """US-04 uses the shared registration API, with no client-selected verification."""
    password = "  counsellor private password  "
    registration = client.post(
        "/api/v1/auth/users",
        json={
            "name": "  Erika Counsellor  ",
            "email": "Erika@Example.com",
            "password": password,
            "passwordConfirmation": password,
            "role": "counsellor",
        },
    )
    assert registration.status_code == 201
    assert set(registration.json()) == {"id", "name", "email", "role", "emailVerified"}
    assert "set-cookie" not in registration.headers
    with SessionLocal() as db:
        account = db.get(User, registration.json()["id"])
        assert account is not None
        assert account.name == "Erika Counsellor"
        assert account.email == "erika@example.com"
        assert account.role == "counsellor"
        assert account.verification_status == "pending"
        assert verify_password(password, account.password_hash)
        assert account.password_hash not in registration.text
    login = client.post(
        "/api/v1/auth/sessions",
        json={
            "email": "ERIKA@example.com",
            "password": password,
        },
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    own = client.get("/api/v1/me/services", headers=headers)
    assert own.status_code == 200 and own.json() == []
    error_body(
        client.post("/api/v1/me/services", headers=headers, json=SERVICE_INPUT), 403, "FORBIDDEN"
    )
    with SessionLocal() as db:
        assert list(db.scalars(select(Service))) == []


@pytest.mark.parametrize("modalities", [["online"], ["in_person"], ["online", "in_person"]])
def test_service_creation_persists_and_is_visible_to_owner_and_public(
    client: TestClient,
    counsellor: User,
    counsellor_headers: dict[str, str],
    modalities: list[str],
) -> None:
    payload = {**SERVICE_INPUT, "modalities": modalities, "priceMinor": 0}
    if "in_person" in modalities:
        payload["location"] = {"state": " VIC ", "cityOrRegion": " Melbourne "}
    created = client.post("/api/v1/me/services", headers=counsellor_headers, json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["title"] == "Interview practice"
    assert body["description"] == "Practical interview preparation."
    assert body["priceMinor"] == 0 and body["currency"] == "AUD"
    assert body["modalities"] == modalities and body["active"] is True
    assert body["durationMinutes"] == 60
    assert body["counsellor"]["id"] == counsellor.id
    assert body["reviewCount"] == 0 and body["averageRating"] is None
    assert body["location"] == (
        {"state": "VIC", "cityOrRegion": "Melbourne"} if "in_person" in modalities else None
    )
    with SessionLocal() as db:
        stored = db.get(Service, body["id"])
        assert stored is not None and stored.counsellor_id == counsellor.id
        assert stored.title == body["title"] and stored.modalities == modalities
    public_body = {
        key: value for key, value in body.items()
        if key not in {"meetingUrl", "nextAvailableAt"}
    }
    own = client.get("/api/v1/me/services", headers=counsellor_headers)
    assert own.status_code == 200 and own.json() == [body]
    public = client.get("/api/v1/services")
    assert public.status_code == 200 and public.json() == [public_body]
    detail = client.get(f"/api/v1/services/{body['id']}")
    assert detail.status_code == 200 and detail.json() == public_body
    assert not {"email", "passwordHash", "password"} & body["counsellor"].keys()


def test_published_service_modality_update_requires_real_backend_persistence(
    client: TestClient,
    counsellor_headers: dict[str, str],
) -> None:
    """The current edit endpoint accepts the entire service form."""
    created = client.post("/api/v1/me/services", headers=counsellor_headers, json=SERVICE_INPUT)
    assert created.status_code == 201, created.text
    service_id = created.json()["id"]
    response = client.patch(
        f"/api/v1/me/services/{service_id}",
        headers=counsellor_headers,
        json={
            **SERVICE_INPUT,
            "modalities": ["online", "in_person"],
            "location": {"state": "VIC", "cityOrRegion": "Melbourne"},
            "durationMinutes": 90,
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["modalities"] == ["online", "in_person"]
    assert response.json()["durationMinutes"] == 90
    with SessionLocal() as db:
        stored = db.get(Service, service_id)
        assert stored is not None and stored.modalities == ["online", "in_person"]
        assert stored.duration_minutes == 90 and stored.location_city == "Melbourne"
    listed = client.get("/api/v1/me/services", headers=counsellor_headers)
    assert listed.status_code == 200
    assert next(item for item in listed.json() if item["id"] == service_id) == response.json()


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"title": " \t "}, "title"),
        ({"title": "x" * 121}, "title"),
        ({"description": " \n "}, "description"),
        ({"description": "x" * 5001}, "description"),
        ({"priceMinor": -1}, "priceMinor"),
        ({"priceMinor": 1.5}, "priceMinor"),
        ({"durationMinutes": 0}, "durationMinutes"),
        ({"durationMinutes": 20}, "durationMinutes"),
        ({"durationMinutes": 495}, "durationMinutes"),
        ({"currency": "USD"}, "currency"),
        ({"modalities": []}, "modalities"),
        ({"modalities": ["telephone"]}, "modalities.0"),
        ({"modalities": ["online", "online"]}, "modalities"),
    ],
)
def test_invalid_service_fields_never_create_a_listing(
    client: TestClient,
    counsellor_headers: dict[str, str],
    changes: dict,
    field: str,
) -> None:
    response = client.post(
        "/api/v1/me/services", headers=counsellor_headers, json=SERVICE_INPUT | changes
    )
    assert field in error_body(response, 400, "VALIDATION_ERROR")["fieldErrors"]
    with SessionLocal() as db:
        assert list(db.scalars(select(Service))) == []


@pytest.mark.parametrize("field", [key for key in SERVICE_INPUT if key != "durationMinutes"])
def test_service_requires_each_published_field(
    client: TestClient,
    counsellor_headers: dict[str, str],
    field: str,
) -> None:
    response = client.post(
        "/api/v1/me/services",
        headers=counsellor_headers,
        json={k: v for k, v in SERVICE_INPUT.items() if k != field},
    )
    assert field in error_body(response, 400, "VALIDATION_ERROR")["fieldErrors"]
    with SessionLocal() as db:
        assert list(db.scalars(select(Service))) == []


@pytest.mark.parametrize("modalities", [["in_person"], ["online", "in_person"]])
@pytest.mark.parametrize(
    "location",
    [None, {"state": " ", "cityOrRegion": "Melbourne"}, {"state": "VIC", "cityOrRegion": " "}],
)
def test_in_person_service_requires_both_nonblank_location_fields(
    client: TestClient,
    counsellor_headers: dict[str, str],
    modalities: list[str],
    location: dict | None,
) -> None:
    response = client.post(
        "/api/v1/me/services",
        headers=counsellor_headers,
        json={**SERVICE_INPUT, "modalities": modalities, "location": location},
    )
    assert "location" in error_body(response, 400, "VALIDATION_ERROR")["fieldErrors"]
    with SessionLocal() as db:
        assert list(db.scalars(select(Service))) == []


@pytest.mark.parametrize("verification", ["pending", "rejected"])
def test_unverified_counsellor_cannot_publish_a_service(
    client: TestClient,
    db_session: Session,
    counsellor: User,
    counsellor_headers: dict[str, str],
    verification: str,
) -> None:
    counsellor.verification_status = verification
    db_session.commit()
    response = client.post("/api/v1/me/services", headers=counsellor_headers, json=SERVICE_INPUT)
    error_body(response, 403, "FORBIDDEN")
    with SessionLocal() as db:
        assert list(db.scalars(select(Service))) == []


COUNSELLOR_OPERATIONS = [
    ("GET", "/me/services"),
    ("POST", "/me/services"),
    ("PATCH", "/me/services/{service_id}"),
    ("DELETE", "/me/services/{service_id}"),
    ("GET", "/me/availability-windows"),
    ("POST", "/me/availability-windows"),
    ("PATCH", "/me/availability-windows/{window_id}"),
    ("DELETE", "/me/availability-windows/{window_id}"),
]


def test_logout_revokes_every_real_counsellor_route_but_preserves_other_session(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
    counsellor_headers: dict[str, str],
) -> None:
    window = store_window(db_session, counsellor)
    other_token, _ = create_access_token(counsellor.id, counsellor.role)
    before = client.get("/api/v1/me/services", headers=counsellor_headers)
    assert before.status_code == 200 and len(before.json()) == 1
    logged_out = client.delete("/api/v1/auth/sessions/current", headers=counsellor_headers)
    assert logged_out.status_code == 204 and logged_out.content == b""
    for method, path in COUNSELLOR_OPERATIONS:
        payload = SERVICE_INPUT if path.startswith("/me/services") else window_input()
        response = client.request(
            method,
            "/api/v1" + path.format(window_id=window.id, service_id=service.id),
            headers=counsellor_headers,
            json=payload,
        )
        error_body(response, 401, "AUTHENTICATION_REQUIRED")
    remaining_session = client.get(
        "/api/v1/me/services", headers={"Authorization": f"Bearer {other_token}"}
    )
    assert remaining_session.status_code == 200
    assert [item["id"] for item in remaining_session.json()] == [service.id]
    with SessionLocal() as db:
        assert [item.id for item in db.scalars(select(Service))] == [service.id]
        assert [item.id for item in db.scalars(select(AvailabilityWindow))] == [window.id]


@pytest.mark.parametrize(("method", "path"), COUNSELLOR_OPERATIONS)
@pytest.mark.parametrize("role", [None, "job_seeker", "platform_owner"])
def test_every_counsellor_operation_rejects_anonymous_and_wrong_roles(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
    job_seeker: User,
    method: str,
    path: str,
    role: str | None,
) -> None:
    window = store_window(db_session, counsellor)
    headers = {}
    if role is not None:
        job_seeker.role = role
        db_session.commit()
        token, _ = create_access_token(job_seeker.id, role)
        headers = {"Authorization": f"Bearer {token}"}
    payload = SERVICE_INPUT if path.startswith("/me/services") else window_input()
    response = client.request(
        method,
        "/api/v1" + path.format(window_id=window.id, service_id=service.id),
        headers=headers,
        json=payload,
    )
    error_body(
        response,
        401 if role is None else 403,
        "AUTHENTICATION_REQUIRED" if role is None else "FORBIDDEN",
    )
    with SessionLocal() as db:
        assert [item.id for item in db.scalars(select(Service))] == [service.id]
        stored = db.get(AvailabilityWindow, window.id)
        assert stored is not None and stored.counsellor_id == counsellor.id
        assert as_utc(stored.starts_at) == as_utc(window.starts_at)


def test_owner_lists_never_include_another_counsellors_services_or_calendar(
    client: TestClient,
    db_session: Session,
    counsellor: User,
    counsellor_headers: dict[str, str],
    other_counsellor: User,
) -> None:
    first = store_service(db_session, counsellor, title="A current service")
    archived = store_service(db_session, counsellor, title="Z inactive service", active=False)
    foreign = store_service(db_session, other_counsellor, title="Other person's service")
    own_windows = [store_window(db_session, counsellor, offset=offset) for offset in (4, 2, 0)]
    foreign_window = store_window(db_session, other_counsellor)
    own = client.get("/api/v1/me/services", headers=counsellor_headers)
    assert own.status_code == 200
    assert [s["id"] for s in own.json()] == [first.id, archived.id]
    calendar = client.get("/api/v1/me/availability-windows", headers=counsellor_headers)
    assert calendar.status_code == 200
    assert [w["id"] for w in calendar.json()] == [w.id for w in reversed(own_windows)]
    assert foreign_window.id not in {w["id"] for w in calendar.json()}
    public = client.get("/api/v1/services")
    assert public.status_code == 200
    assert {s["id"] for s in public.json()} == {first.id, foreign.id}


def test_window_create_edit_and_delete_persist_and_rederive_public_starts(
    client: TestClient,
    counsellor_headers: dict[str, str],
    service: Service,
) -> None:
    payload = window_input()
    created = client.post(
        "/api/v1/me/availability-windows", headers=counsellor_headers, json=payload
    )
    assert created.status_code == 201, created.text
    window_id = created.json()["id"]
    assert created.json()["modalities"] == ["online", "in_person"]
    assert created.json()["hasBookings"] is False
    assert "serviceId" not in created.json() and "status" not in created.json()
    start = datetime.fromisoformat(payload["startsAt"]) + timedelta(hours=2)
    updated = client.patch(
        f"/api/v1/me/availability-windows/{window_id}",
        headers=counsellor_headers,
        json={"startsAt": start.isoformat(), "endsAt": (start + timedelta(minutes=90)).isoformat()},
    )
    assert updated.status_code == 200, updated.text
    calendar = client.get("/api/v1/me/availability-windows", headers=counsellor_headers)
    assert calendar.status_code == 200 and calendar.json() == [updated.json()]
    listed = client.get(f"/api/v1/services/{service.id}/slots")
    assert listed.status_code == 200
    assert [as_utc(datetime.fromisoformat(row["startsAt"])) for row in listed.json()] == [
        start + timedelta(minutes=minutes) for minutes in (0, 15, 30)
    ]
    assert all(
        as_utc(datetime.fromisoformat(row["endsAt"]))
        - as_utc(datetime.fromisoformat(row["startsAt"]))
        == timedelta(minutes=60)
        for row in listed.json()
    )
    with SessionLocal() as db:
        stored = db.get(AvailabilityWindow, window_id)
        assert stored is not None and stored.counsellor_id == service.counsellor_id
        assert as_utc(stored.starts_at) == start
    deleted = client.delete(
        f"/api/v1/me/availability-windows/{window_id}", headers=counsellor_headers
    )
    assert deleted.status_code == 204 and deleted.content == b""
    with SessionLocal() as db:
        assert db.get(AvailabilityWindow, window_id) is None
    listed = client.get(f"/api/v1/services/{service.id}/slots")
    assert listed.status_code == 200 and listed.json() == []


@pytest.mark.parametrize("offset_minutes", [600, 660, 330])
def test_postgresql_window_round_trip_preserves_non_utc_instants(
    client: TestClient,
    counsellor_headers: dict[str, str],
    service: Service,
    offset_minutes: int,
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("Timezone-aware database round trips require the supported PostgreSQL engine")
    start = future_start().astimezone(timezone(timedelta(minutes=offset_minutes)))
    created = client.post(
        "/api/v1/me/availability-windows",
        headers=counsellor_headers,
        json=window_input(
            startsAt=start.isoformat(), endsAt=(start + timedelta(hours=1)).isoformat()
        ),
    )
    assert created.status_code == 201, created.text
    listed = client.get(f"/api/v1/services/{service.id}/slots")
    assert listed.status_code == 200 and len(listed.json()) == 1
    returned = listed.json()[0]
    assert datetime.fromisoformat(returned["startsAt"]) == start
    assert datetime.fromisoformat(returned["endsAt"]) == start + timedelta(hours=1)


@pytest.mark.parametrize("method", ["POST", "PATCH"])
@pytest.mark.parametrize("invalid_window", ["past", "equal", "reversed", "malformed"])
def test_invalid_window_boundaries_are_rejected_without_mutation(
    client: TestClient,
    db_session: Session,
    counsellor: User,
    counsellor_headers: dict[str, str],
    method: str,
    invalid_window: str,
) -> None:
    original = store_window(db_session, counsellor)
    start = future_start() + timedelta(hours=3)
    end = start + timedelta(hours=1)
    if invalid_window == "past":
        start, end = datetime.now(UTC) - timedelta(days=2), datetime.now(UTC) - timedelta(days=1)
    elif invalid_window == "equal":
        end = start
    elif invalid_window == "reversed":
        end = start - timedelta(hours=1)
    payload = window_input(
        startsAt="not-a-time" if invalid_window == "malformed" else start.isoformat(),
        endsAt=end.isoformat(),
    )
    path = "/api/v1/me/availability-windows" + (f"/{original.id}" if method == "PATCH" else "")
    error_body(
        client.request(method, path, headers=counsellor_headers, json=payload),
        400,
        "VALIDATION_ERROR",
    )
    with SessionLocal() as db:
        windows = list(db.scalars(select(AvailabilityWindow)))
        assert len(windows) == 1 and windows[0].id == original.id
        assert as_utc(windows[0].starts_at) == as_utc(original.starts_at)
        assert as_utc(windows[0].ends_at) == as_utc(original.ends_at)


@pytest.mark.parametrize("method", ["PATCH", "DELETE"])
def test_booked_window_cannot_be_moved_away_from_booking_or_removed(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
    counsellor_headers: dict[str, str],
    job_seeker_headers: dict[str, str],
    method: str,
) -> None:
    window = store_window(db_session, counsellor)
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json={
            "serviceId": service.id,
            "startsAt": window.starts_at.isoformat(),
            "modality": "online",
            "timezone": "Australia/Melbourne",
        },
    )
    assert order.status_code == 201, order.text
    payment = client.post(
        f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers
    )
    assert payment.status_code == 200, payment.text
    moved = as_utc(window.starts_at) + timedelta(hours=2)
    response = client.request(
        method,
        f"/api/v1/me/availability-windows/{window.id}",
        headers=counsellor_headers,
        json=window_input(
            startsAt=moved.isoformat(), endsAt=(moved + timedelta(hours=1)).isoformat()
        ),
    )
    error_body(response, 409, "SLOT_UNAVAILABLE")
    calendar = client.get("/api/v1/me/availability-windows", headers=counsellor_headers)
    assert calendar.status_code == 200 and calendar.json()[0]["hasBookings"] is True
    with SessionLocal() as db:
        stored = db.get(AvailabilityWindow, window.id)
        booking = db.get(Booking, payment.json()["booking"]["id"])
        stored_order = db.get(Order, order.json()["id"])
        assert stored is not None and as_utc(stored.starts_at) == as_utc(window.starts_at)
        assert (
            booking is not None and booking.window_id == window.id and booking.status == "confirmed"
        )
        assert stored_order is not None and stored_order.payment_status == "paid"


@pytest.mark.parametrize("method", ["PATCH", "DELETE"])
def test_foreign_and_missing_availability_resources_are_equally_hidden(
    client: TestClient,
    db_session: Session,
    counsellor: User,
    other_counsellor: User,
    method: str,
) -> None:
    window = store_window(db_session, counsellor)
    token, _ = create_access_token(other_counsellor.id, other_counsellor.role)
    headers = {"Authorization": f"Bearer {token}"}
    responses = [
        error_body(
            client.request(
                method,
                f"/api/v1/me/availability-windows/{resource}",
                headers=headers,
                json=window_input(),
            ),
            404,
            "NOT_FOUND",
        )
        for resource in (window.id, "missing-resource")
    ]
    assert responses[0]["message"] == responses[1]["message"]
    with SessionLocal() as db:
        assert [w.id for w in db.scalars(select(AvailabilityWindow))] == [window.id]


@pytest.mark.parametrize("offset_minutes", [30, 60])
def test_overlapping_or_adjacent_availability_merges_for_all_services(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
    counsellor_headers: dict[str, str],
    offset_minutes: int,
) -> None:
    original = store_window(db_session, counsellor)
    second = store_service(db_session, counsellor, duration_minutes=30)
    start = as_utc(original.starts_at) + timedelta(minutes=offset_minutes)
    response = client.post(
        "/api/v1/me/availability-windows",
        headers=counsellor_headers,
        json=window_input(
            startsAt=start.isoformat(), endsAt=(start + timedelta(hours=1)).isoformat()
        ),
    )
    assert response.status_code == 201, response.text
    with SessionLocal() as db:
        windows = list(db.scalars(select(AvailabilityWindow)))
        assert len(windows) == 1
        assert as_utc(windows[0].starts_at) == as_utc(original.starts_at)
        assert as_utc(windows[0].ends_at) == start + timedelta(hours=1)
    for item in (service, second):
        public = client.get(f"/api/v1/services/{item.id}/slots")
        assert public.status_code == 200 and public.json()
        assert as_utc(datetime.fromisoformat(public.json()[0]["startsAt"])) == as_utc(
            original.starts_at
        )
        assert len(public.json()) == (60 + offset_minutes - item.duration_minutes) // 15 + 1


def test_different_counsellors_can_offer_the_same_time_without_services(
    client: TestClient,
    db_session: Session,
    counsellor: User,
    other_counsellor: User,
) -> None:
    window = store_window(db_session, counsellor)
    token, _ = create_access_token(other_counsellor.id, other_counsellor.role)
    response = client.post(
        "/api/v1/me/availability-windows",
        headers={"Authorization": f"Bearer {token}"},
        json=window_input(startsAt=window.starts_at.isoformat(), endsAt=window.ends_at.isoformat()),
    )
    assert response.status_code == 201, response.text
    with SessionLocal() as db:
        assert list(db.scalars(select(Service))) == []
        windows = list(db.scalars(select(AvailabilityWindow)))
        assert len(windows) == 2
        assert {w.counsellor_id for w in windows} == {counsellor.id, other_counsellor.id}


@pytest.mark.parametrize(
    "operation", ["create_service", "create_window", "edit_window", "delete_window"]
)
def test_counsellor_failed_commit_leaves_no_partial_changes(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
    counsellor_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
) -> None:
    window = store_window(db_session, counsellor)
    original_start = as_utc(window.starts_at)
    start = future_start() + timedelta(hours=3)
    payload = window_input(
        startsAt=start.isoformat(), endsAt=(start + timedelta(hours=1)).isoformat()
    )
    requests = {
        "create_service": ("POST", "/api/v1/me/services", SERVICE_INPUT),
        "create_window": ("POST", "/api/v1/me/availability-windows", payload),
        "edit_window": ("PATCH", f"/api/v1/me/availability-windows/{window.id}", payload),
        "delete_window": ("DELETE", f"/api/v1/me/availability-windows/{window.id}", None),
    }
    commit_attempts = []

    def failing_request_db():
        with SessionLocal() as request_db:

            def fail_commit():
                request_db.flush()
                commit_attempts.append(True)
                raise OperationalError("qa forced commit", {}, RuntimeError("qa failure"))

            monkeypatch.setattr(request_db, "commit", fail_commit)
            yield request_db

    method, path, payload = requests[operation]
    app.dependency_overrides[get_db] = failing_request_db
    try:
        response = client.request(method, path, headers=counsellor_headers, json=payload)
    finally:
        app.dependency_overrides.pop(get_db, None)
    assert commit_attempts == [True]
    error_body(response, 500, "INTERNAL_ERROR")
    assert "qa forced commit" not in response.text and "qa failure" not in response.text
    with SessionLocal() as db:
        assert [s.id for s in db.scalars(select(Service))] == [service.id]
        windows = list(db.scalars(select(AvailabilityWindow)))
        assert len(windows) == 1 and windows[0].id == window.id
        assert as_utc(windows[0].starts_at) == original_start
        assert windows[0].counsellor_id == counsellor.id
