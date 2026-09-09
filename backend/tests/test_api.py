"""QA behaviour tests for the eight backend operations in the executable slice."""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import engine, get_db
from app.main import app
from app.models import AvailabilitySlot, Booking, Order, Service, User
from app.security import create_access_token, verify_password

REGISTER = {
    "name": "  Alex Tester  ",
    "email": "Alex.Tester@Example.com",
    "password": "correct-horse",
    "passwordConfirmation": "correct-horse",
    "role": "job_seeker",
}


def add_slot(
    db_session: Session,
    service: Service,
    *,
    starts_at: datetime | None = None,
    status: str = "open",
) -> AvailabilitySlot:
    start = starts_at or datetime.now(UTC) + timedelta(days=1)
    slot = AvailabilitySlot(
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(hours=1),
        status=status,
    )
    db_session.add(slot)
    db_session.commit()
    db_session.refresh(slot)
    return slot


def order_payload(
    service: Service,
    slot: AvailabilitySlot,
    **overrides: Any,
) -> dict[str, Any]:
    return {
        "serviceId": service.id,
        "slotId": slot.id,
        "modality": "online",
        "timezone": "Australia/Melbourne",
        **overrides,
    }


def assert_error_shape(response, expected_status: int, expected_code: str) -> dict:
    assert response.status_code == expected_status
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert body["code"] == expected_code
    assert isinstance(body["message"], str) and body["message"]
    assert isinstance(body["requestId"], str) and body["requestId"]
    assert response.headers["x-request-id"] == body["requestId"]
    return body


def test_health_checks_database_and_returns_no_secrets(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize("role", ["job_seeker", "counsellor"])
def test_register_persists_normalised_account(
    client: TestClient, db_session: Session, role: str
) -> None:
    payload = {**REGISTER, "role": role}
    response = client.post("/api/v1/auth/users", json=payload)

    assert response.status_code == 201
    assert response.json() == {
        "id": response.json()["id"],
        "name": "Alex Tester",
        "email": "alex.tester@example.com",
        "role": role,
    }
    user = db_session.get(User, response.json()["id"])
    assert user is not None
    assert user.email == "alex.tester@example.com"
    assert user.password_hash != REGISTER["password"]
    assert REGISTER["password"] not in response.text
    assert user.password_hash not in response.text
    assert "set-cookie" not in response.headers


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"name": ""}, "name"),
        ({"name": " \t\n\u2003 "}, "name"),
        ({"name": "A" * 121}, "name"),
        ({"email": ""}, "email"),
        ({"email": "   "}, "email"),
        ({"email": "not-an-email"}, "email"),
        ({"password": ""}, "password"),
        ({"password": "short", "passwordConfirmation": "short"}, "password"),
        ({"passwordConfirmation": ""}, "passwordConfirmation"),
        ({"passwordConfirmation": "short"}, "passwordConfirmation"),
        ({"role": ""}, "role"),
        ({"role": "platform_owner"}, "role"),
        ({"role": "admin"}, "role"),
        ({"passwordConfirmation": "different-password"}, "passwordConfirmation"),
        *[({field: value}, field) for field in REGISTER for value in (None, 123)],
    ],
)
def test_register_rejects_invalid_input(
    client: TestClient, db_session: Session, changes: dict[str, Any], field: str
) -> None:
    response = client.post("/api/v1/auth/users", json={**REGISTER, **changes})
    body = assert_error_shape(response, 400, "VALIDATION_ERROR")
    assert field in body["fieldErrors"]
    assert REGISTER["password"] not in response.text
    assert db_session.scalars(select(User)).all() == []


def test_register_rejects_missing_input(client: TestClient, db_session: Session) -> None:
    response = client.post("/api/v1/auth/users", json={})
    body = assert_error_shape(response, 400, "VALIDATION_ERROR")
    assert {"name", "email", "password", "passwordConfirmation", "role"}.issubset(
        body["fieldErrors"]
    )
    assert db_session.scalars(select(User)).all() == []


@pytest.mark.parametrize("field", REGISTER)
def test_register_requires_each_field(
    client: TestClient, db_session: Session, field: str
) -> None:
    payload = {key: value for key, value in REGISTER.items() if key != field}
    response = client.post("/api/v1/auth/users", json=payload)

    body = assert_error_shape(response, 400, "VALIDATION_ERROR")
    assert set(body["fieldErrors"]) == {field}
    assert db_session.scalars(select(User)).all() == []


@pytest.mark.parametrize("name", ["A", " \t" + "A" * 120 + "\n "])
def test_register_accepts_name_length_boundaries_after_trimming(
    client: TestClient, name: str
) -> None:
    response = client.post("/api/v1/auth/users", json={**REGISTER, "name": name})

    assert response.status_code == 201
    assert response.json()["name"] == name.strip()


def test_register_preserves_password_whitespace(
    client: TestClient, db_session: Session
) -> None:
    password = "  abcd  "
    response = client.post(
        "/api/v1/auth/users",
        json={**REGISTER, "password": password, "passwordConfirmation": password},
    )

    assert response.status_code == 201
    user = db_session.get(User, response.json()["id"])
    assert user is not None
    assert verify_password(password, user.password_hash)
    assert not verify_password(password.strip(), user.password_hash)
    assert password not in response.text
    assert user.password_hash not in response.text


def test_register_password_confirmation_requires_exact_match(
    client: TestClient, db_session: Session
) -> None:
    response = client.post(
        "/api/v1/auth/users",
        json={**REGISTER, "passwordConfirmation": " " + REGISTER["password"] + " "},
    )

    body = assert_error_shape(response, 400, "VALIDATION_ERROR")
    assert set(body["fieldErrors"]) == {"passwordConfirmation"}
    assert db_session.scalars(select(User)).all() == []


def test_register_duplicate_email_is_409(client: TestClient) -> None:
    first = client.post("/api/v1/auth/users", json=REGISTER)
    second = client.post(
        "/api/v1/auth/users", json={**REGISTER, "email": "ALEX.TESTER@example.com"}
    )

    assert first.status_code == 201
    body = assert_error_shape(second, 409, "VALIDATION_ERROR")
    assert body["fieldErrors"] == {"email": "Already registered."}


def test_register_rejects_unknown_fields(client: TestClient, db_session: Session) -> None:
    response = client.post("/api/v1/auth/users", json={**REGISTER, "actingUserId": "other"})
    body = assert_error_shape(response, 400, "VALIDATION_ERROR")
    assert set(body["fieldErrors"]) == {"actingUserId"}
    assert db_session.scalars(select(User)).all() == []


@pytest.mark.xfail(
    strict=True,
    reason="The pre-check race is not converted from IntegrityError to a contract-shaped 409",
)
def test_register_database_uniqueness_race_is_409(client: TestClient) -> None:
    class ConflictingSession:
        commit_attempted = False

        def scalar(self, _statement):
            return None

        def add(self, value) -> None:
            self.user = value

        def flush(self) -> None:
            # Emulate the generated ID so response validation reaches the commit race.
            self.user.id = "race-test-user-id"

        def commit(self) -> None:
            self.commit_attempted = True
            raise IntegrityError("duplicate email", {}, Exception("unique violation"))

        def rollback(self) -> None:
            return None

    db = ConflictingSession()

    def conflicting_db():
        yield db

    app.dependency_overrides[get_db] = conflicting_db
    try:
        response = client.post("/api/v1/auth/users", json=REGISTER)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert db.commit_attempted
    assert_error_shape(response, 409, "VALIDATION_ERROR")


def test_login_returns_verifiable_expiring_jwt(client: TestClient) -> None:
    created = client.post("/api/v1/auth/users", json=REGISTER)
    assert created.status_code == 201

    response = client.post(
        "/api/v1/auth/sessions",
        json={"email": "ALEX.TESTER@example.com", "password": REGISTER["password"]},
    )
    assert response.status_code == 200
    body = response.json()
    payload = jwt.decode(
        body["accessToken"],
        os.environ["JWT_SECRET"],
        algorithms=["HS256"],
    )
    assert payload["sub"] == created.json()["id"]
    assert payload["role"] == "job_seeker"
    assert datetime.fromisoformat(body["expiresAt"]).timestamp() == pytest.approx(
        payload["exp"], abs=1
    )
    assert body["user"] == created.json()


def test_login_failure_is_generic_for_wrong_and_unknown_account(client: TestClient) -> None:
    created = client.post("/api/v1/auth/users", json=REGISTER)
    assert created.status_code == 201

    wrong_password = client.post(
        "/api/v1/auth/sessions",
        json={"email": REGISTER["email"], "password": "wrong-password"},
    )
    unknown_account = client.post(
        "/api/v1/auth/sessions",
        json={"email": "nobody@example.com", "password": "wrong-password"},
    )

    wrong_body = assert_error_shape(wrong_password, 401, "INVALID_CREDENTIALS")
    unknown_body = assert_error_shape(unknown_account, 401, "INVALID_CREDENTIALS")
    assert (wrong_body["code"], wrong_body["message"]) == (
        unknown_body["code"],
        unknown_body["message"],
    )


@pytest.mark.xfail(
    strict=True,
    reason="Malformed Argon2 hashes raise InvalidHashError instead of a generic 401",
)
def test_login_malformed_hash_is_generic_401(client: TestClient, db_session: Session) -> None:
    db_session.add(
        User(
            name="Broken Hash",
            email="broken@example.com",
            password_hash="not-an-argon2-hash",
            role="job_seeker",
        )
    )
    db_session.commit()

    response = client.post(
        "/api/v1/auth/sessions",
        json={"email": "broken@example.com", "password": "password123"},
    )
    assert_error_shape(response, 401, "INVALID_CREDENTIALS")


def test_request_id_is_preserved_on_validation_error(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/sessions",
        json={},
        headers={"X-Request-Id": "qa-request-123"},
    )
    body = assert_error_shape(response, 400, "VALIDATION_ERROR")
    assert body["requestId"] == "qa-request-123"


def test_marketplace_list_query_and_modality(
    client: TestClient, db_session: Session, counsellor: User, service: Service
) -> None:
    inactive = Service(
        counsellor_id=counsellor.id,
        title="Hidden service",
        description="Must not be public.",
        price_minor=1,
        currency="AUD",
        modalities=["in_person"],
        active=False,
        review_count=0,
    )
    db_session.add(inactive)
    db_session.commit()

    response = client.get("/api/v1/services")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [service.id]
    item = response.json()[0]
    assert item["priceMinor"] == 9500
    assert item["currency"] == "AUD"
    assert item["modalities"] == ["online"]
    assert item["counsellor"]["displayName"] == "Maya Chen"

    assert len(client.get("/api/v1/services?query=Maya").json()) == 1
    assert client.get("/api/v1/services?query=missing").json() == []
    assert len(client.get("/api/v1/services?modality=online").json()) == 1
    assert client.get("/api/v1/services?modality=in_person").json() == []


@pytest.mark.xfail(
    strict=True,
    reason="The OpenAPI modality enum is not enforced by the backend query parameter",
)
def test_marketplace_rejects_invalid_modality(client: TestClient) -> None:
    response = client.get("/api/v1/services?modality=telepathy")
    assert_error_shape(response, 400, "VALIDATION_ERROR")


def test_service_detail_and_not_found(client: TestClient, service: Service) -> None:
    found = client.get(f"/api/v1/services/{service.id}")
    assert found.status_code == 200
    assert found.json()["id"] == service.id

    missing = client.get("/api/v1/services/does-not-exist")
    assert_error_shape(missing, 404, "NOT_FOUND")


def test_inactive_service_detail_is_not_public(
    client: TestClient, db_session: Session, counsellor: User
) -> None:
    hidden = Service(
        counsellor_id=counsellor.id,
        title="Inactive",
        description="Inactive service.",
        price_minor=100,
        currency="AUD",
        modalities=["online"],
        active=False,
        review_count=0,
    )
    db_session.add(hidden)
    db_session.commit()
    db_session.refresh(hidden)

    response = client.get(f"/api/v1/services/{hidden.id}")
    assert_error_shape(response, 404, "NOT_FOUND")


def test_service_slots_returns_only_open_slots_in_start_order(
    client: TestClient,
    db_session: Session,
    service: Service,
) -> None:
    start = datetime.now(UTC) + timedelta(days=1)
    later = add_slot(db_session, service, starts_at=start + timedelta(hours=2))
    earlier = add_slot(db_session, service, starts_at=start)
    add_slot(db_session, service, starts_at=start + timedelta(hours=1), status="held")
    add_slot(db_session, service, starts_at=start + timedelta(hours=3), status="booked")

    response = client.get(f"/api/v1/services/{service.id}/slots")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [earlier.id, later.id]
    assert all(item["serviceId"] == service.id for item in response.json())
    assert all(item["status"] == "open" for item in response.json())
    assert all(item["endsAt"] > item["startsAt"] for item in response.json())


@pytest.mark.parametrize("missing_id", ["does-not-exist", ""])
def test_service_slots_rejects_missing_or_inactive_service(
    client: TestClient,
    db_session: Session,
    service: Service,
    missing_id: str,
) -> None:
    if not missing_id:
        service.active = False
        db_session.commit()
        missing_id = service.id

    response = client.get(f"/api/v1/services/{missing_id}/slots")

    assert_error_shape(response, 404, "NOT_FOUND")


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Basic credentials"},
        {"Authorization": "Bearer not-a-jwt"},
        {"Authorization": "Bearer "},
    ],
)
def test_create_order_requires_valid_bearer_authentication(
    client: TestClient,
    db_session: Session,
    service: Service,
    headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)

    response = client.post(
        "/api/v1/orders",
        headers=headers,
        json=order_payload(service, slot),
    )

    assert_error_shape(response, 401, "AUTHENTICATION_REQUIRED")


@pytest.mark.parametrize("token_kind", ["expired", "wrong-signature", "missing-user"])
def test_create_order_rejects_unusable_jwt(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker: User,
    token_kind: str,
) -> None:
    slot = add_slot(db_session, service)
    if token_kind == "expired":
        token = jwt.encode(
            {
                "sub": job_seeker.id,
                "role": job_seeker.role,
                "exp": datetime.now(UTC) - timedelta(minutes=1),
            },
            "qa-test-secret-that-is-at-least-32-characters",
            algorithm="HS256",
        )
    elif token_kind == "wrong-signature":
        token = jwt.encode(
            {
                "sub": job_seeker.id,
                "role": job_seeker.role,
                "exp": datetime.now(UTC) + timedelta(minutes=10),
            },
            "different-secret-that-is-at-least-32-characters",
            algorithm="HS256",
        )
    else:
        token, _ = create_access_token("deleted-user", "job_seeker")

    response = client.post(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {token}"},
        json=order_payload(service, slot),
    )

    assert_error_shape(response, 401, "AUTHENTICATION_REQUIRED")


def test_create_order_authorises_from_persisted_role_not_token_claim(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
) -> None:
    slot = add_slot(db_session, service)
    forged_role_token, _ = create_access_token(counsellor.id, "job_seeker")

    response = client.post(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {forged_role_token}"},
        json=order_payload(service, slot),
    )

    assert_error_shape(response, 403, "FORBIDDEN")


def test_counsellor_cannot_create_order(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)

    response = client.post(
        "/api/v1/orders",
        headers=counsellor_headers,
        json=order_payload(service, slot),
    )

    assert_error_shape(response, 403, "FORBIDDEN")


def test_create_order_holds_slot_and_snapshots_commercial_values(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker: User,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)

    response = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot),
    )

    assert response.status_code == 201
    body = response.json()
    assert body == {
        "id": body["id"],
        "serviceId": service.id,
        "slotId": slot.id,
        "amountMinor": 9500,
        "currency": "AUD",
        "status": "awaiting_payment",
        "paymentStatus": "not_started",
    }
    db_session.expire_all()
    stored_order = db_session.get(Order, body["id"])
    stored_slot = db_session.get(AvailabilitySlot, slot.id)
    assert stored_order is not None
    assert stored_order.job_seeker_id == job_seeker.id
    assert stored_order.amount_minor == 9500
    assert stored_order.timezone == "Australia/Melbourne"
    assert stored_order.modality == "online"
    assert stored_slot is not None and stored_slot.status == "held"


@pytest.mark.parametrize(
    ("payload_change", "field"),
    [
        ({"timezone": ""}, "timezone"),
        ({"modality": "telepathy"}, "modality"),
        ({"slotId": None}, "slotId"),
    ],
)
def test_create_order_rejects_invalid_payload(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
    payload_change: dict[str, Any],
    field: str,
) -> None:
    slot = add_slot(db_session, service)

    response = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot, **payload_change),
    )

    body = assert_error_shape(response, 400, "VALIDATION_ERROR")
    assert field in body["fieldErrors"]


@pytest.mark.xfail(
    strict=True,
    reason="OpenAPI sets additionalProperties:false but CreateOrderRequest ignores extras",
)
def test_create_order_rejects_unknown_fields(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)
    response = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot, actingUserId="other-user"),
    )
    assert_error_shape(response, 400, "VALIDATION_ERROR")


def test_create_order_rejects_modality_not_offered_by_service(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)

    response = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot, modality="in_person"),
    )

    assert_error_shape(response, 400, "VALIDATION_ERROR")


def test_create_order_rejects_inactive_or_missing_service(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)
    service.active = False
    db_session.commit()

    inactive = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot),
    )
    missing = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot, serviceId="does-not-exist"),
    )

    assert_error_shape(inactive, 404, "NOT_FOUND")
    assert_error_shape(missing, 404, "NOT_FOUND")


def test_create_order_rejects_slot_from_another_service(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
    job_seeker_headers: dict[str, str],
) -> None:
    other_service = Service(
        counsellor_id=counsellor.id,
        title="Other service",
        description="A different service.",
        price_minor=5000,
        currency="AUD",
        modalities=["online"],
        active=True,
        review_count=0,
    )
    db_session.add(other_service)
    db_session.commit()
    db_session.refresh(other_service)
    other_slot = add_slot(db_session, other_service)

    response = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, other_slot),
    )

    assert_error_shape(response, 404, "NOT_FOUND")


@pytest.mark.parametrize("slot_status", ["held", "booked"])
def test_create_order_rejects_unavailable_slot(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
    slot_status: str,
) -> None:
    slot = add_slot(db_session, service, status=slot_status)

    response = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot),
    )

    assert_error_shape(response, 409, "SLOT_UNAVAILABLE")


def test_second_sequential_order_for_same_slot_is_rejected(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)
    payload = order_payload(service, slot)

    first = client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)
    second = client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)

    assert first.status_code == 201
    assert_error_shape(second, 409, "SLOT_UNAVAILABLE")
    assert len(list(db_session.scalars(select(Order)))) == 1


def test_postgresql_concurrent_order_requests_reserve_slot_once(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock concurrency evidence requires PostgreSQL")

    slot = add_slot(db_session, service)
    payload = order_payload(service, slot)
    start_together = Barrier(3)

    def reserve() -> Any:
        start_together.wait(timeout=5)
        return client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)

    with ThreadPoolExecutor(max_workers=2) as executor:
        requests = [executor.submit(reserve) for _ in range(2)]
        start_together.wait(timeout=5)
        responses = [request.result(timeout=10) for request in requests]

    assert sorted(response.status_code for response in responses) == [201, 409]
    conflict = next(response for response in responses if response.status_code == 409)
    assert_error_shape(conflict, 409, "SLOT_UNAVAILABLE")
    db_session.expire_all()
    assert len(list(db_session.scalars(select(Order)))) == 1
    stored_slot = db_session.get(AvailabilitySlot, slot.id)
    assert stored_slot is not None and stored_slot.status == "held"


@pytest.mark.xfail(
    strict=True,
    reason=(
        "Order.slot_id has no database UNIQUE invariant, so concurrent transactions can "
        "persist two active orders for one slot"
    ),
)
def test_order_slot_has_database_uniqueness_invariant() -> None:
    inspector = inspect(engine)
    unique_column_sets = {
        frozenset(constraint["column_names"])
        for constraint in inspector.get_unique_constraints("orders")
    }
    unique_column_sets.update(
        frozenset(index["column_names"])
        for index in inspector.get_indexes("orders")
        if index.get("unique")
    )
    assert frozenset({"slot_id"}) in unique_column_sets


@pytest.mark.xfail(
    strict=True,
    reason="The documented 15-minute order hold has no expiry or slot-release implementation",
)
def test_expired_order_hold_releases_slot_for_a_new_order(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)
    payload = order_payload(service, slot)
    first = client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)
    assert first.status_code == 201
    stored_order = db_session.get(Order, first.json()["id"])
    assert stored_order is not None
    stored_order.created_at = datetime.now(UTC) - timedelta(minutes=16)
    db_session.commit()

    second = client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)
    assert second.status_code == 201


def test_stub_payment_confirms_exactly_one_booking_and_books_slot(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker: User,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot),
    )
    assert order.status_code == 201

    response = client.post(
        f"/api/v1/orders/{order.json()['id']}/payments/stub",
        headers=job_seeker_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["paymentId"].startswith("stub_")
    assert body["paymentStatus"] == "paid"
    assert body["booking"] == {
        "id": body["booking"]["id"],
        "orderId": order.json()["id"],
        "serviceId": service.id,
        "serviceTitle": service.title,
        "startsAt": body["booking"]["startsAt"],
        "endsAt": body["booking"]["endsAt"],
        "timezone": "Australia/Melbourne",
        "modality": "online",
        "status": "confirmed",
        "paymentStatus": "paid",
    }
    db_session.expire_all()
    stored_order = db_session.get(Order, order.json()["id"])
    stored_slot = db_session.get(AvailabilitySlot, slot.id)
    stored_bookings = list(db_session.scalars(select(Booking)))
    assert stored_order is not None
    assert stored_order.job_seeker_id == job_seeker.id
    assert (stored_order.status, stored_order.payment_status) == ("confirmed", "paid")
    assert stored_slot is not None and stored_slot.status == "booked"
    assert len(stored_bookings) == 1
    assert stored_bookings[0].id == body["booking"]["id"]


def test_stub_payment_is_booking_idempotent(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot),
    )
    endpoint = f"/api/v1/orders/{order.json()['id']}/payments/stub"

    first = client.post(endpoint, headers=job_seeker_headers)
    second = client.post(endpoint, headers=job_seeker_headers)

    assert first.status_code == second.status_code == 200
    assert first.json()["booking"] == second.json()["booking"]
    assert len(list(db_session.scalars(select(Booking)))) == 1


@pytest.mark.xfail(
    strict=True,
    reason="First and repeated stub-payment responses derive different payment references",
)
def test_stub_payment_retry_returns_stable_payment_reference(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot),
    )
    endpoint = f"/api/v1/orders/{order.json()['id']}/payments/stub"

    first = client.post(endpoint, headers=job_seeker_headers)
    second = client.post(endpoint, headers=job_seeker_headers)

    assert first.json()["paymentId"] == second.json()["paymentId"]


def test_stub_payment_requires_authentication(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot),
    )

    response = client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub")

    assert_error_shape(response, 401, "AUTHENTICATION_REQUIRED")


def test_stub_payment_enforces_order_ownership(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
) -> None:
    slot = add_slot(db_session, service)
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot),
    )
    other_registration = client.post(
        "/api/v1/auth/users",
        json={
            **REGISTER,
            "email": "other.jobseeker@example.com",
            "name": "Other Job Seeker",
        },
    )
    assert other_registration.status_code == 201
    other_login = client.post(
        "/api/v1/auth/sessions",
        json={"email": "other.jobseeker@example.com", "password": REGISTER["password"]},
    )
    other_headers = {"Authorization": f"Bearer {other_login.json()['accessToken']}"}

    response = client.post(
        f"/api/v1/orders/{order.json()['id']}/payments/stub",
        headers=other_headers,
    )

    assert_error_shape(response, 403, "FORBIDDEN")


def test_stub_payment_rejects_counsellor_role(
    client: TestClient,
    counsellor_headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/orders/does-not-matter/payments/stub",
        headers=counsellor_headers,
    )
    assert_error_shape(response, 403, "FORBIDDEN")


def test_stub_payment_missing_order_is_404(
    client: TestClient,
    job_seeker_headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/orders/does-not-exist/payments/stub",
        headers=job_seeker_headers,
    )
    assert_error_shape(response, 404, "NOT_FOUND")


@pytest.mark.parametrize(
    ("order_status", "slot_status"),
    [("cancelled", "held"), ("awaiting_payment", "open"), ("confirmed", "booked")],
)
def test_stub_payment_rejects_invalid_state_transition(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict[str, str],
    order_status: str,
    slot_status: str,
) -> None:
    slot = add_slot(db_session, service)
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json=order_payload(service, slot),
    )
    db_session.expire_all()
    stored_order = db_session.get(Order, order.json()["id"])
    stored_slot = db_session.get(AvailabilitySlot, slot.id)
    assert stored_order is not None and stored_slot is not None
    stored_order.status = order_status
    stored_slot.status = slot_status
    db_session.commit()

    response = client.post(
        f"/api/v1/orders/{order.json()['id']}/payments/stub",
        headers=job_seeker_headers,
    )

    assert_error_shape(response, 409, "INVALID_STATE_TRANSITION")
