"""Sprint 2 API acceptance: QA #91, #109, #112, #115, #133..#145.

Profile CRUD and service update/delete do not exist yet and are Blocked in the
QA matrix, rather than being counted as successful tests of a 404 response.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient
from qa_acceptance import KnownAcceptanceDefect
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine, get_db
from app.main import app
from app.models import AvailabilitySlot, Service, User
from app.security import create_access_token, hash_password, verify_password

SERVICE_INPUT = {
    "title": "  Interview practice  ",
    "description": "  Practical interview preparation.  ",
    "priceMinor": 9500,
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


def slot_input(service: Service, **changes: Any) -> dict[str, Any]:
    start = future_start()
    return {
        "serviceId": service.id,
        "startsAt": start.isoformat(),
        "endsAt": (start + timedelta(hours=1)).isoformat(),
        **changes,
    }


def store_slot(
    db: Session,
    service: Service,
    *,
    status: str = "open",
    offset: int = 0,
) -> AvailabilitySlot:
    start = future_start() + timedelta(hours=offset)
    slot = AvailabilitySlot(
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(hours=1),
        status=status,
    )
    db.add(slot)
    db.commit()
    return slot


def store_service(db: Session, owner: User, **changes: Any) -> Service:
    values = {
        "counsellor_id": owner.id,
        "title": "Second service",
        "description": "Preparation",
        "price_minor": 7000,
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
    assert set(registration.json()) == {"id", "name", "email", "role"}
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
    assert body["counsellor"]["id"] == counsellor.id
    assert body["reviewCount"] == 0 and body["averageRating"] is None
    assert body["location"] == (
        {"state": "VIC", "cityOrRegion": "Melbourne"} if "in_person" in modalities else None
    )
    with SessionLocal() as db:
        stored = db.get(Service, body["id"])
        assert stored is not None and stored.counsellor_id == counsellor.id
        assert stored.title == body["title"] and stored.modalities == modalities
    for path in ("/api/v1/services", "/api/v1/me/services"):
        response = client.get(path, headers=counsellor_headers if "/me/" in path else {})
        assert response.status_code == 200 and response.json() == [body]
    detail = client.get(f"/api/v1/services/{body['id']}")
    assert detail.status_code == 200 and detail.json() == body
    assert not {"email", "passwordHash", "password"} & body["counsellor"].keys()


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="QA-139 US37-AC4 BLOCKED: published service modality PATCH is not implemented",
)
@pytest.mark.future_contract
def test_published_service_modality_update_requires_real_backend_persistence(
    client: TestClient,
    counsellor_headers: dict[str, str],
) -> None:
    """US-37 explicitly retains edit modality; US-36's deferral cannot prove it.

    Use the path already called by frontend/src/api/client.ts, not a made-up API.
    A missing capability is an expected BLOCKED defect, never a passing 404 test.
    Any unexpected setup/authorization/storage failure remains an ordinary fail.
    """
    created = client.post("/api/v1/me/services", headers=counsellor_headers, json=SERVICE_INPUT)
    assert created.status_code == 201, created.text
    service_id = created.json()["id"]
    response = client.patch(
        f"/api/v1/me/services/{service_id}",
        headers=counsellor_headers,
        json={
            "modalities": ["online", "in_person"],
            "location": {"state": "VIC", "cityOrRegion": "Melbourne"},
        },
    )
    if response.status_code == 404:
        error_body(response, 404, "NOT_FOUND")
        with SessionLocal() as db:
            stored = db.get(Service, service_id)
            assert stored is not None and stored.modalities == ["online"]
        raise KnownAcceptanceDefect(
            "QA-139: published update route returned 404; modality unchanged"
        )
    assert response.status_code == 200, response.text
    assert response.json()["modalities"] == ["online", "in_person"]
    with SessionLocal() as db:
        stored = db.get(Service, service_id)
        assert stored is not None and stored.modalities == ["online", "in_person"]
    listed = client.get("/api/v1/me/services", headers=counsellor_headers)
    assert listed.status_code == 200
    assert next(item for item in listed.json() if item["id"] == service_id)["modalities"] == [
        "online", "in_person"
    ]


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"title": " \t "}, "title"),
        ({"title": "x" * 121}, "title"),
        ({"description": " \n "}, "description"),
        ({"description": "x" * 5001}, "description"),
        ({"priceMinor": -1}, "priceMinor"),
        ({"priceMinor": 1.5}, "priceMinor"),
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


@pytest.mark.parametrize("field", list(SERVICE_INPUT))
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
    ("GET", "/me/availability-slots"),
    ("POST", "/me/availability-slots"),
    ("PATCH", "/me/availability-slots/{slot_id}"),
    ("DELETE", "/me/availability-slots/{slot_id}"),
]


def test_logout_revokes_every_real_counsellor_route_but_preserves_other_session(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
    counsellor_headers: dict[str, str],
) -> None:
    slot = store_slot(db_session, service)
    other_token, _ = create_access_token(counsellor.id, counsellor.role)
    before = client.get("/api/v1/me/services", headers=counsellor_headers)
    assert before.status_code == 200 and len(before.json()) == 1
    logged_out = client.delete("/api/v1/auth/sessions/current", headers=counsellor_headers)
    assert logged_out.status_code == 204 and logged_out.content == b""
    for method, path in COUNSELLOR_OPERATIONS:
        payload = SERVICE_INPUT if path == "/me/services" else slot_input(service)
        response = client.request(
            method,
            "/api/v1" + path.format(slot_id=slot.id),
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
        assert [item.id for item in db.scalars(select(AvailabilitySlot))] == [slot.id]


@pytest.mark.parametrize(("method", "path"), COUNSELLOR_OPERATIONS)
@pytest.mark.parametrize("role", [None, "job_seeker", "platform_owner"])
def test_every_counsellor_operation_rejects_anonymous_and_wrong_roles(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker: User,
    method: str,
    path: str,
    role: str | None,
) -> None:
    slot = store_slot(db_session, service)
    headers = {}
    if role is not None:
        job_seeker.role = role
        db_session.commit()
        token, _ = create_access_token(job_seeker.id, role)
        headers = {"Authorization": f"Bearer {token}"}
    payload = SERVICE_INPUT if path == "/me/services" else slot_input(service)
    response = client.request(
        method, "/api/v1" + path.format(slot_id=slot.id), headers=headers, json=payload
    )
    error_body(
        response,
        401 if role is None else 403,
        "AUTHENTICATION_REQUIRED" if role is None else "FORBIDDEN",
    )
    with SessionLocal() as db:
        assert [item.id for item in db.scalars(select(Service))] == [service.id]
        stored = db.get(AvailabilitySlot, slot.id)
        assert stored is not None and stored.status == "open"


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
    own_slots = [
        store_slot(db_session, first, status="booked", offset=4),
        store_slot(db_session, archived, status="held", offset=2),
        store_slot(db_session, first, offset=0),
    ]
    foreign_slot = store_slot(db_session, foreign)
    own = client.get("/api/v1/me/services", headers=counsellor_headers)
    assert own.status_code == 200
    assert [s["id"] for s in own.json()] == [first.id, archived.id]
    calendar = client.get("/api/v1/me/availability-slots", headers=counsellor_headers)
    assert calendar.status_code == 200
    assert [s["id"] for s in calendar.json()] == [s.id for s in reversed(own_slots)]
    assert foreign_slot.id not in {s["id"] for s in calendar.json()}
    public = client.get("/api/v1/services")
    assert public.status_code == 200
    assert {s["id"] for s in public.json()} == {first.id, foreign.id}


def test_open_slot_create_edit_and_delete_persist_in_fresh_reads(
    client: TestClient,
    counsellor_headers: dict[str, str],
    service: Service,
) -> None:
    payload = slot_input(service)
    created = client.post("/api/v1/me/availability-slots", headers=counsellor_headers, json=payload)
    assert created.status_code == 201
    slot_id = created.json()["id"]
    assert created.json()["serviceId"] == service.id and created.json()["status"] == "open"
    start = datetime.fromisoformat(payload["startsAt"]) + timedelta(hours=2)
    updated = client.patch(
        f"/api/v1/me/availability-slots/{slot_id}",
        headers=counsellor_headers,
        json={
            "startsAt": start.isoformat(),
            "endsAt": (start + timedelta(minutes=45)).isoformat(),
        },
    )
    assert updated.status_code == 200
    for path in (f"/api/v1/services/{service.id}/slots", "/api/v1/me/availability-slots"):
        listed = client.get(path, headers=counsellor_headers if "/me/" in path else {})
        assert listed.status_code == 200 and len(listed.json()) == 1
        actual = datetime.fromisoformat(listed.json()[0]["startsAt"])
        assert as_utc(actual) == start
    deleted = client.delete(f"/api/v1/me/availability-slots/{slot_id}", headers=counsellor_headers)
    assert deleted.status_code == 204 and deleted.content == b""
    with SessionLocal() as db:
        assert db.get(AvailabilitySlot, slot_id) is None
    listed = client.get(f"/api/v1/services/{service.id}/slots")
    assert listed.status_code == 200 and listed.json() == []


@pytest.mark.parametrize("offset_minutes", [600, 660, 330])
def test_postgresql_slot_round_trip_preserves_non_utc_instants(
    client: TestClient,
    counsellor_headers: dict[str, str],
    service: Service,
    offset_minutes: int,
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("Timezone-aware database round trips require the supported PostgreSQL engine")
    start = future_start().astimezone(timezone(timedelta(minutes=offset_minutes)))
    created = client.post(
        "/api/v1/me/availability-slots",
        headers=counsellor_headers,
        json=slot_input(
            service, startsAt=start.isoformat(), endsAt=(start + timedelta(hours=1)).isoformat()
        ),
    )
    assert created.status_code == 201
    listed = client.get(f"/api/v1/services/{service.id}/slots")
    assert listed.status_code == 200 and len(listed.json()) == 1
    returned = listed.json()[0]
    assert datetime.fromisoformat(returned["startsAt"]) == start
    assert datetime.fromisoformat(returned["endsAt"]) == start + timedelta(hours=1)


@pytest.mark.parametrize("method", ["POST", "PATCH"])
@pytest.mark.parametrize("window", ["past", "equal", "reversed", "malformed"])
def test_invalid_slot_windows_are_rejected_without_mutation(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
    method: str,
    window: str,
) -> None:
    original = store_slot(db_session, service)
    start = future_start() + timedelta(hours=3)
    end = start + timedelta(hours=1)
    if window == "past":
        start, end = datetime.now(UTC) - timedelta(days=2), datetime.now(UTC) - timedelta(days=1)
    elif window == "equal":
        end = start
    elif window == "reversed":
        end = start - timedelta(hours=1)
    payload = slot_input(
        service,
        startsAt="not-a-time" if window == "malformed" else start.isoformat(),
        endsAt=end.isoformat(),
    )
    path = "/api/v1/me/availability-slots" + (f"/{original.id}" if method == "PATCH" else "")
    error_body(
        client.request(method, path, headers=counsellor_headers, json=payload),
        400,
        "VALIDATION_ERROR",
    )
    with SessionLocal() as db:
        slots = list(db.scalars(select(AvailabilitySlot)))
        assert len(slots) == 1 and slots[0].id == original.id
        assert as_utc(slots[0].starts_at) == as_utc(original.starts_at)


@pytest.mark.parametrize("method", ["PATCH", "DELETE"])
@pytest.mark.parametrize("slot_status", ["held", "booked"])
def test_reserved_slot_cannot_be_changed_or_removed(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
    method: str,
    slot_status: str,
) -> None:
    slot = store_slot(db_session, service, status=slot_status)
    response = client.request(
        method,
        f"/api/v1/me/availability-slots/{slot.id}",
        headers=counsellor_headers,
        json=slot_input(service),
    )
    error_body(response, 409, "SLOT_UNAVAILABLE")
    with SessionLocal() as db:
        stored = db.get(AvailabilitySlot, slot.id)
        assert stored is not None and stored.status == slot_status
        assert as_utc(stored.starts_at) == as_utc(slot.starts_at)


@pytest.mark.parametrize("method", ["POST", "PATCH", "DELETE"])
def test_foreign_and_missing_availability_resources_are_equally_hidden(
    client: TestClient,
    db_session: Session,
    service: Service,
    other_counsellor: User,
    method: str,
) -> None:
    slot = store_slot(db_session, service)
    token, _ = create_access_token(other_counsellor.id, other_counsellor.role)
    headers = {"Authorization": f"Bearer {token}"}
    responses = []
    for resource in (service.id if method == "POST" else slot.id, "missing-resource"):
        path = "/api/v1/me/availability-slots" + ("" if method == "POST" else f"/{resource}")
        payload = slot_input(service, serviceId=resource if method == "POST" else service.id)
        responses.append(
            error_body(
                client.request(method, path, headers=headers, json=payload), 404, "NOT_FOUND"
            )
        )
    assert responses[0]["message"] == responses[1]["message"]
    with SessionLocal() as db:
        assert [s.id for s in db.scalars(select(AvailabilitySlot))] == [slot.id]


@pytest.mark.parametrize("occupied_status", ["open", "held", "booked"])
def test_cross_service_overlap_rejected_but_adjacent_slot_allowed(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
    counsellor_headers: dict[str, str],
    occupied_status: str,
) -> None:
    original = store_slot(db_session, service, status=occupied_status)
    second = store_service(db_session, counsellor)
    error_body(
        client.post(
            "/api/v1/me/availability-slots", headers=counsellor_headers, json=slot_input(second)
        ),
        409,
        "SLOT_OVERLAP",
    )
    start = as_utc(original.ends_at)
    adjacent = client.post(
        "/api/v1/me/availability-slots",
        headers=counsellor_headers,
        json=slot_input(
            second, startsAt=start.isoformat(), endsAt=(start + timedelta(hours=1)).isoformat()
        ),
    )
    assert adjacent.status_code == 201
    with SessionLocal() as db:
        assert len(list(db.scalars(select(AvailabilitySlot)))) == 2


def test_different_counsellors_can_offer_the_same_time(
    client: TestClient,
    db_session: Session,
    service: Service,
    other_counsellor: User,
) -> None:
    store_slot(db_session, service)
    other = store_service(db_session, other_counsellor)
    token, _ = create_access_token(other_counsellor.id, other_counsellor.role)
    response = client.post(
        "/api/v1/me/availability-slots",
        headers={"Authorization": f"Bearer {token}"},
        json=slot_input(other),
    )
    assert response.status_code == 201
    with SessionLocal() as db:
        assert len(list(db.scalars(select(AvailabilitySlot)))) == 2


@pytest.mark.parametrize("operation", ["create_service", "create_slot", "edit_slot", "delete_slot"])
def test_counsellor_failed_commit_leaves_no_partial_changes(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
) -> None:
    slot = store_slot(db_session, service)
    original_start = as_utc(slot.starts_at)
    start = future_start() + timedelta(hours=3)
    requests = {
        "create_service": ("POST", "/api/v1/me/services", SERVICE_INPUT),
        "create_slot": (
            "POST",
            "/api/v1/me/availability-slots",
            slot_input(
                service, startsAt=start.isoformat(), endsAt=(start + timedelta(hours=1)).isoformat()
            ),
        ),
        "edit_slot": (
            "PATCH",
            f"/api/v1/me/availability-slots/{slot.id}",
            slot_input(
                service, startsAt=start.isoformat(), endsAt=(start + timedelta(hours=1)).isoformat()
            ),
        ),
        "delete_slot": ("DELETE", f"/api/v1/me/availability-slots/{slot.id}", None),
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
        slots = list(db.scalars(select(AvailabilitySlot)))
        assert len(slots) == 1 and slots[0].id == slot.id
        assert as_utc(slots[0].starts_at) == original_start
        assert slots[0].status == "open"
