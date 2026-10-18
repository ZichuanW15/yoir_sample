"""Regression tests for the review findings on the counsellor service/availability
endpoints: response preparation must happen before commit, and slot writes must be
atomic with both the booking flow and each other."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AvailabilityWindow, Service, User

SERVICE_PAYLOAD = {
    "title": "Interview confidence coaching",
    "description": "Behavioural questions, delivery and practical feedback.",
    "priceMinor": 9500,
    "currency": "AUD",
    "modalities": ["online"],
}


def assert_error_shape(response, expected_status: int, expected_code: str) -> dict:
    assert response.status_code == expected_status
    body = response.json()
    assert body["code"] == expected_code
    return body


def service_payload(**overrides: Any) -> dict[str, Any]:
    return {**SERVICE_PAYLOAD, **overrides}


def add_window(
    db_session: Session,
    counsellor: User,
    *,
    starts_at: datetime | None = None,
    hours: int = 3,
) -> AvailabilityWindow:
    """A stretch of the counsellor's own time. Any service they offer fits inside it."""
    start = starts_at or datetime.now(UTC) + timedelta(days=1)
    window = AvailabilityWindow(
        counsellor_id=counsellor.id,
        starts_at=start,
        ends_at=start + timedelta(hours=hours),
    )
    db_session.add(window)
    db_session.commit()
    db_session.refresh(window)
    return window


def order_payload(
    service: Service, window: AvailabilityWindow, **overrides: Any,
) -> dict[str, Any]:
    return {
        "serviceId": service.id,
        "startsAt": window.starts_at.isoformat(),
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

    monkeypatch.setattr("app.routers.counsellor.own_service_to_out", boom)

    response = client.post(
        "/api/v1/me/services", headers=counsellor_headers, json=service_payload()
    )

    assert response.status_code == 500
    # The failure happened before commit, so nothing was left behind to retry into.
    assert list(db_session.scalars(select(Service))) == []



# --- US-39: availability windows --------------------------------------------


def test_create_availability_window_rolls_back_when_response_preparation_fails(
    client: TestClient,
    db_session: Session,
    counsellor: Any,
    counsellor_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failure while building the response must not leave a saved window behind a
    500, which would invite a duplicate-creating retry."""
    def boom(*_args: Any, **_kwargs: Any) -> Any:
        raise RuntimeError("response preparation failed")

    monkeypatch.setattr("app.routers.counsellor._window_out", boom)
    starts_at = datetime.now(UTC) + timedelta(days=2)

    response = client.post(
        "/api/v1/me/availability-windows",
        headers=counsellor_headers,
        json={
            "startsAt": starts_at.isoformat(),
            "endsAt": (starts_at + timedelta(hours=3)).isoformat(),
        },
    )

    assert response.status_code == 500
    db_session.expire_all()
    assert list(db_session.scalars(select(AvailabilityWindow))) == []


def test_two_services_can_be_offered_in_the_same_window(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: Any,
) -> None:
    """The point of the redesign.

    Availability is the counsellor's calendar, so every service they offer is
    bookable inside one window — the old per-service slots made this impossible,
    because a second service at the same time was rejected as an overlap.
    """
    other = Service(
        counsellor_id=counsellor.id,
        title="Resume review",
        description="A shorter session.",
        price_minor=4500,
        duration_minutes=30,
        currency="AUD",
        modalities=["online"],
        active=True,
    )
    db_session.add(other)
    db_session.commit()
    window = add_window(db_session, counsellor)

    first = client.get(f"/api/v1/services/{service.id}/slots").json()
    second = client.get(f"/api/v1/services/{other.id}/slots").json()

    assert first and second
    # Both start when the window opens, from the same three hours.
    assert first[0]["startsAt"] == second[0]["startsAt"] == window.starts_at.isoformat().replace(
        "+00:00", "Z"
    )
    # The shorter service fits more sessions into the same time.
    assert len(second) > len(first)


def test_booking_one_service_dissolves_the_time_for_every_other(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: Any,
    job_seeker_headers: dict[str, str],
) -> None:
    other = Service(
        counsellor_id=counsellor.id,
        title="Resume review",
        description="A shorter session.",
        price_minor=4500,
        duration_minutes=30,
        currency="AUD",
        modalities=["online"],
        active=True,
    )
    db_session.add(other)
    db_session.commit()
    window = add_window(db_session, counsellor)
    taken = window.starts_at.isoformat().replace("+00:00", "Z")

    order = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_payload(service, window),
    )
    assert order.status_code == 201
    client.post(
        f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers,
    )

    # The hour is gone for the service that was booked and for the other one alike.
    assert taken not in [s["startsAt"] for s in client.get(
        f"/api/v1/services/{service.id}/slots").json()]
    assert taken not in [s["startsAt"] for s in client.get(
        f"/api/v1/services/{other.id}/slots").json()]


def test_overlapping_windows_are_merged_rather_than_refused(
    client: TestClient,
    db_session: Session,
    counsellor: Any,
    counsellor_headers: dict[str, str],
) -> None:
    """Two stretches of availability that meet describe one longer stretch.

    The slots this replaces rejected any overlap, which made a calendar awkward to
    express for no benefit — there is nothing contradictory about saying "I am free
    9-11" and then "I am free 10-12".
    """
    first = datetime.now(UTC) + timedelta(days=2)
    for offset_hours, length in ((0, 2), (1, 2)):
        response = client.post(
            "/api/v1/me/availability-windows",
            headers=counsellor_headers,
            json={
                "startsAt": (first + timedelta(hours=offset_hours)).isoformat(),
                "endsAt": (first + timedelta(hours=offset_hours + length)).isoformat(),
            },
        )
        assert response.status_code == 201

    db_session.expire_all()
    windows = list(db_session.scalars(select(AvailabilityWindow)))
    assert len(windows) == 1
    assert windows[0].ends_at - windows[0].starts_at == timedelta(hours=3)


def test_adjacent_windows_are_joined(
    client: TestClient,
    db_session: Session,
    counsellor: Any,
    counsellor_headers: dict[str, str],
) -> None:
    """9-10 followed by 10-11 is three hours of availability, not two separate ones —
    and a session may then run across what used to be the boundary."""
    first = datetime.now(UTC) + timedelta(days=2)
    for offset in (0, 1):
        client.post(
            "/api/v1/me/availability-windows",
            headers=counsellor_headers,
            json={
                "startsAt": (first + timedelta(hours=offset)).isoformat(),
                "endsAt": (first + timedelta(hours=offset + 1)).isoformat(),
            },
        )

    db_session.expire_all()
    windows = list(db_session.scalars(select(AvailabilityWindow)))
    assert len(windows) == 1
    assert windows[0].ends_at - windows[0].starts_at == timedelta(hours=2)


def test_a_window_cannot_be_shortened_past_a_booked_session(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: Any,
    counsellor_headers: dict[str, str],
    job_seeker_headers: dict[str, str],
) -> None:
    """Someone has paid for that time; the way out is to cancel the booking."""
    window = add_window(db_session, counsellor)
    order = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_payload(service, window),
    )
    client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers)

    response = client.patch(
        f"/api/v1/me/availability-windows/{window.id}",
        headers=counsellor_headers,
        json={"startsAt": (window.starts_at + timedelta(hours=2)).isoformat()},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "SLOT_UNAVAILABLE"


def test_a_window_with_a_booking_cannot_be_deleted(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: Any,
    counsellor_headers: dict[str, str],
    job_seeker_headers: dict[str, str],
) -> None:
    window = add_window(db_session, counsellor)
    order = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_payload(service, window),
    )
    client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers)

    response = client.delete(
        f"/api/v1/me/availability-windows/{window.id}", headers=counsellor_headers,
    )

    assert response.status_code == 409
    db_session.expire_all()
    assert db_session.get(AvailabilityWindow, window.id) is not None


def test_an_empty_window_can_be_withdrawn(
    client: TestClient,
    db_session: Session,
    counsellor: Any,
    counsellor_headers: dict[str, str],
) -> None:
    window = add_window(db_session, counsellor)
    # Held separately: reading window.id after the row is gone raises rather than
    # returning the value.
    window_id = window.id

    assert client.delete(
        f"/api/v1/me/availability-windows/{window_id}", headers=counsellor_headers,
    ).status_code == 204
    db_session.expire_all()
    assert db_session.scalar(
        select(AvailabilityWindow).where(AvailabilityWindow.id == window_id)
    ) is None


def test_one_counsellor_cannot_touch_anothers_calendar(
    client: TestClient,
    db_session: Session,
    counsellor: Any,
) -> None:
    from app.security import create_access_token, hash_password

    window = add_window(db_session, counsellor)
    intruder = User(
        name="Other", email="other.calendar@example.com",
        password_hash=hash_password("password123"), role="counsellor",
        verification_status="verified",
    )
    db_session.add(intruder)
    db_session.commit()
    token, _ = create_access_token(intruder.id, intruder.role)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.patch(
        f"/api/v1/me/availability-windows/{window.id}", headers=headers,
        json={"endsAt": (window.ends_at + timedelta(hours=1)).isoformat()},
    ).status_code == 404
    assert client.delete(
        f"/api/v1/me/availability-windows/{window.id}", headers=headers,
    ).status_code == 404


def test_a_window_must_be_in_the_future_and_end_after_it_starts(
    client: TestClient, counsellor_headers: dict[str, str],
) -> None:
    past = datetime.now(UTC) - timedelta(hours=1)
    assert client.post(
        "/api/v1/me/availability-windows", headers=counsellor_headers,
        json={"startsAt": past.isoformat(), "endsAt": (past + timedelta(hours=1)).isoformat()},
    ).status_code == 400

    future = datetime.now(UTC) + timedelta(days=1)
    assert client.post(
        "/api/v1/me/availability-windows", headers=counsellor_headers,
        json={"startsAt": future.isoformat(), "endsAt": future.isoformat()},
    ).status_code == 400


# --- US-36: editing and withdrawing a service -------------------------------


def service_body(**overrides: Any) -> dict[str, Any]:
    return {
        "title": "Interview confidence coaching",
        "description": "Behavioural questions, delivery and practical feedback.",
        "priceMinor": 9500,
        "currency": "AUD",
        "modalities": ["online"],
        **overrides,
    }


def test_update_service_replaces_the_listing(
    client: TestClient, db_session: Session, service: Service,
    counsellor_headers: dict[str, str],
) -> None:
    response = client.patch(
        f"/api/v1/me/services/{service.id}",
        headers=counsellor_headers,
        json=service_body(title="Senior interview coaching", priceMinor=12500),
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Senior interview coaching"
    db_session.expire_all()
    stored = db_session.get(Service, service.id)
    assert stored.price_minor == 12500


def test_update_service_clears_a_location_the_form_left_empty(
    client: TestClient, db_session: Session, service: Service,
    counsellor_headers: dict[str, str],
) -> None:
    """The body is the whole service, so an omitted location means "remove it"."""
    service.location_state, service.location_city = "VIC", "Melbourne"
    service.modalities = ["online", "in_person"]
    db_session.commit()

    client.patch(
        f"/api/v1/me/services/{service.id}",
        headers=counsellor_headers,
        json=service_body(modalities=["online"]),
    )

    db_session.expire_all()
    stored = db_session.get(Service, service.id)
    assert (stored.location_state, stored.location_city) == (None, None)


def test_an_in_person_service_still_needs_a_meeting_area_when_edited(
    client: TestClient, service: Service, counsellor_headers: dict[str, str],
) -> None:
    response = client.patch(
        f"/api/v1/me/services/{service.id}",
        headers=counsellor_headers,
        json=service_body(modalities=["in_person"]),
    )

    assert response.status_code == 400
    assert "location" in response.json()["fieldErrors"]


def test_deleting_a_service_withdraws_it_without_erasing_it(
    client: TestClient, db_session: Session, service: Service,
    counsellor_headers: dict[str, str],
) -> None:
    """A soft delete: bookings and receipts still reference the row."""
    response = client.delete(f"/api/v1/me/services/{service.id}", headers=counsellor_headers)

    assert response.status_code == 204
    db_session.expire_all()
    stored = db_session.get(Service, service.id)
    assert stored is not None and stored.active is False
    # Gone from the Marketplace, but still listed in the counsellor's own workspace.
    assert client.get("/api/v1/services").json() == []
    assert client.get(f"/api/v1/services/{service.id}").status_code == 404
    own = client.get("/api/v1/me/services", headers=counsellor_headers).json()
    assert [s["id"] for s in own] == [service.id]


def test_deleting_a_service_twice_is_not_an_error(
    client: TestClient, service: Service, counsellor_headers: dict[str, str],
) -> None:
    assert client.delete(
        f"/api/v1/me/services/{service.id}", headers=counsellor_headers,
    ).status_code == 204
    assert client.delete(
        f"/api/v1/me/services/{service.id}", headers=counsellor_headers,
    ).status_code == 204


def test_a_counsellor_cannot_edit_or_delete_someone_elses_service(
    client: TestClient, db_session: Session, service: Service,
) -> None:
    from app.security import create_access_token, hash_password

    intruder = User(
        name="Other Counsellor", email="other.counsellor@example.com",
        password_hash=hash_password("password123"), role="counsellor",
        verification_status="verified",
    )
    db_session.add(intruder)
    db_session.commit()
    token, _ = create_access_token(intruder.id, intruder.role)
    headers = {"Authorization": f"Bearer {token}"}

    # Reported as missing, not forbidden: whether the id exists is not theirs to learn.
    assert client.patch(
        f"/api/v1/me/services/{service.id}", headers=headers, json=service_body(),
    ).status_code == 404
    assert client.delete(f"/api/v1/me/services/{service.id}", headers=headers).status_code == 404

    db_session.expire_all()
    assert db_session.get(Service, service.id).active is True


def test_editing_a_service_needs_a_counsellor_session(
    client: TestClient, service: Service, job_seeker_headers: dict[str, str],
) -> None:
    assert client.patch(
        f"/api/v1/me/services/{service.id}", json=service_body(),
    ).status_code == 401
    assert client.delete(
        f"/api/v1/me/services/{service.id}", headers=job_seeker_headers,
    ).status_code == 403


def test_renaming_a_service_does_not_rewrite_what_was_already_bought(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
    job_seeker_headers: dict[str, str],
    platform_owner_headers: dict[str, str],
) -> None:
    """US-36 AC3: an order and its booking keep the service information they were
    bought with. The receipt is a tax invoice for a GST-registered Career Professional,
    so its description must not change after it has been issued."""
    start = datetime.now(UTC) + timedelta(days=3)
    db_session.add(AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start, ends_at=start + timedelta(hours=3),
    ))
    db_session.commit()
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json={
            "serviceId": service.id, "startsAt": start.isoformat(),
            "modality": "online", "timezone": "Australia/Melbourne",
        },
    )
    assert order.status_code == 201, order.text
    paid = client.post(
        f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers,
    )
    booking_id = paid.json()["booking"]["id"]
    bought_as = service.title

    renamed = client.patch(
        f"/api/v1/me/services/{service.id}",
        headers=counsellor_headers,
        json=service_body(title="Renamed after it was bought", priceMinor=1),
    )
    assert renamed.status_code == 200, renamed.text

    detail = client.get(f"/api/v1/bookings/{booking_id}", headers=job_seeker_headers).json()
    mine = client.get("/api/v1/me/bookings", headers=job_seeker_headers).json()
    receipt = client.get(
        f"/api/v1/bookings/{booking_id}/receipt", headers=job_seeker_headers,
    ).json()
    admin_bookings = client.get("/api/v1/admin/bookings", headers=platform_owner_headers).json()
    admin_payments = client.get("/api/v1/admin/payments", headers=platform_owner_headers).json()

    assert detail["serviceTitle"] == bought_as
    assert [row["serviceTitle"] for row in mine] == [bought_as]
    assert receipt["description"] == bought_as
    assert receipt["totalMinor"] == 9500
    assert [row["serviceTitle"] for row in admin_bookings] == [bought_as]
    assert [row["serviceTitle"] for row in admin_payments] == [bought_as]
    # The listing itself shows the new name to anyone browsing.
    assert client.get(f"/api/v1/services/{service.id}").json()["title"] == (
        "Renamed after it was bought"
    )


def test_a_rename_before_payment_does_not_change_the_confirmation_emails(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
    job_seeker_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """US-36 AC3: the title is frozen when the order is placed, but the emails are
    sent when payment confirms. A rename in between must not give the emails a
    different name from the receipt they carry."""
    from app.mail import messages

    sent: dict[str, dict[str, Any]] = {}
    monkeypatch.setattr(
        messages, "_deliver",
        lambda template, /, *, to, subject, **context: sent.update(
            {template: {"subject": subject, **context}},
        ) or True,
    )
    start = datetime.now(UTC) + timedelta(days=3)
    db_session.add(AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start, ends_at=start + timedelta(hours=3),
    ))
    db_session.commit()
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json={
            "serviceId": service.id, "startsAt": start.isoformat(),
            "modality": "online", "timezone": "Australia/Melbourne",
        },
    )
    assert order.status_code == 201, order.text
    bought_as = service.title

    renamed = client.patch(
        f"/api/v1/me/services/{service.id}",
        headers=counsellor_headers,
        json=service_body(title="Renamed before payment"),
    )
    assert renamed.status_code == 200, renamed.text
    paid = client.post(
        f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers,
    )
    assert paid.status_code == 200, paid.text

    assert sent["booking_confirmed"]["service_title"] == bought_as
    assert sent["booking_received"]["service_title"] == bought_as
    assert sent["booking_received"]["subject"] == f"New booking: {bought_as}"


def test_moving_an_in_person_service_does_not_move_a_session_already_booked(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor_headers: dict[str, str],
    job_seeker_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """US-36 AC3: the meeting area is frozen when the order is placed, like the title.
    Moving the listing before payment must not move the emails, and moving it after
    must not move the booking either party reads."""
    from app.mail import messages

    sent: dict[str, dict[str, Any]] = {}
    monkeypatch.setattr(
        messages, "_deliver",
        lambda template, /, *, to, subject, **context: sent.update(
            {template: context},
        ) or True,
    )
    service.modalities = ["in_person"]
    service.location_state = "VIC"
    service.location_city = "Melbourne"
    start = datetime.now(UTC) + timedelta(days=3)
    db_session.add(AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start, ends_at=start + timedelta(hours=3),
        modalities=["in_person"],
    ))
    db_session.commit()
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json={
            "serviceId": service.id, "startsAt": start.isoformat(),
            "modality": "in_person", "timezone": "Australia/Melbourne",
        },
    )
    assert order.status_code == 201, order.text

    def move_to(city: str) -> None:
        moved = client.patch(
            f"/api/v1/me/services/{service.id}",
            headers=counsellor_headers,
            json=service_body(
                modalities=["in_person"], location={"state": "VIC", "cityOrRegion": city},
            ),
        )
        assert moved.status_code == 200, moved.text

    move_to("Geelong")
    paid = client.post(
        f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers,
    )
    assert paid.status_code == 200, paid.text
    booking_id = paid.json()["booking"]["id"]
    assert sent["booking_confirmed"]["meeting_area"] == "Melbourne, VIC"
    assert sent["booking_received"]["meeting_area"] == "Melbourne, VIC"

    move_to("Ballarat")
    for headers in (job_seeker_headers, counsellor_headers):
        detail = client.get(f"/api/v1/bookings/{booking_id}", headers=headers).json()
        mine = client.get("/api/v1/me/bookings", headers=headers).json()
        assert detail["meetingArea"] == "Melbourne, VIC"
        assert [row["meetingArea"] for row in mine] == ["Melbourne, VIC"]
    # The listing itself shows where new bookings will meet.
    assert client.get(f"/api/v1/services/{service.id}").json()["location"] == {
        "state": "VIC", "cityOrRegion": "Ballarat",
    }


# --- US-39: availability can differ by how the session is delivered ----------


def test_availability_can_differ_by_modality_but_time_is_shared(
    client: TestClient,
    db_session: Session,
    counsellor: Any,
    job_seeker_headers: dict[str, str],
) -> None:
    """A counsellor in the office on some days only, but online throughout.

    The two halves pull in different directions and both matter: what can be offered
    depends on how they can deliver at that hour, but the hour itself is one person's
    time — so booking either kind takes it away from both.
    """
    online_only = Service(
        counsellor_id=counsellor.id, title="Online coaching", description="d",
        price_minor=9500, duration_minutes=60, currency="AUD",
        modalities=["online"], active=True,
    )
    in_person = Service(
        counsellor_id=counsellor.id, title="In-person coaching", description="d",
        price_minor=9500, duration_minutes=60, currency="AUD",
        modalities=["in_person"], active=True,
        location_state="VIC", location_city="Melbourne",
    )
    db_session.add_all([online_only, in_person])
    db_session.commit()

    home_day = add_window(db_session, counsellor, starts_at=datetime.now(UTC) + timedelta(days=1))
    home_day.modalities = ["online"]
    office_day = add_window(
        db_session, counsellor, starts_at=datetime.now(UTC) + timedelta(days=2),
    )
    office_day.modalities = ["online", "in_person"]
    db_session.commit()

    online_offers = [s["startsAt"] for s in client.get(
        f"/api/v1/services/{online_only.id}/slots").json()]
    in_person_offers = [s["startsAt"] for s in client.get(
        f"/api/v1/services/{in_person.id}/slots").json()]

    home_morning = home_day.starts_at.isoformat().replace("+00:00", "Z")
    office_morning = office_day.starts_at.isoformat().replace("+00:00", "Z")

    # The home day is online-only, so only one of them is offered then.
    assert home_morning in online_offers
    assert home_morning not in in_person_offers
    # The office day permits both.
    assert office_morning in online_offers
    assert office_morning in in_person_offers

    # Book the in-person session on the office day...
    order = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json={
            "serviceId": in_person.id, "startsAt": office_morning,
            "modality": "in_person", "timezone": "Australia/Melbourne",
        },
    )
    assert order.status_code == 201
    client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers)

    # ...and the online service loses that hour too. One person, one calendar.
    after = [s["startsAt"] for s in client.get(f"/api/v1/services/{online_only.id}/slots").json()]
    assert office_morning not in after


def test_an_order_is_refused_in_a_window_that_does_not_allow_that_modality(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: Any,
    job_seeker_headers: dict[str, str],
) -> None:
    """Covering the time is not enough; the window has to permit the way of meeting."""
    service.modalities = ["online", "in_person"]
    window = add_window(db_session, counsellor)
    window.modalities = ["online"]
    db_session.commit()

    response = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json={
            "serviceId": service.id,
            "startsAt": window.starts_at.isoformat(),
            "modality": "in_person",
            "timezone": "Australia/Melbourne",
        },
    )

    assert_error_shape(response, 409, "SLOT_UNAVAILABLE")


def test_windows_offering_different_modalities_are_not_merged(
    client: TestClient,
    db_session: Session,
    counsellor: Any,
    counsellor_headers: dict[str, str],
) -> None:
    """An online-only morning and an any-modality afternoon are two statements.

    Merging them would silently widen one, quietly offering in-person time the
    counsellor never agreed to.
    """
    first = datetime.now(UTC) + timedelta(days=2)
    client.post(
        "/api/v1/me/availability-windows", headers=counsellor_headers,
        json={
            "startsAt": first.isoformat(),
            "endsAt": (first + timedelta(hours=2)).isoformat(),
            "modalities": ["online"],
        },
    )
    client.post(
        "/api/v1/me/availability-windows", headers=counsellor_headers,
        json={
            "startsAt": (first + timedelta(hours=1)).isoformat(),
            "endsAt": (first + timedelta(hours=3)).isoformat(),
            "modalities": ["online", "in_person"],
        },
    )

    db_session.expire_all()
    windows = list(db_session.scalars(select(AvailabilityWindow)))
    assert len(windows) == 2
    assert {frozenset(w.modalities) for w in windows} == {
        frozenset(["online"]), frozenset(["online", "in_person"]),
    }


# --- what the counsellor is shown as open -----------------------------------


def test_the_calendar_leaves_out_windows_that_have_ended(
    client: TestClient,
    db_session: Session,
    counsellor: Any,
    counsellor_headers: dict[str, str],
) -> None:
    """An ended window can take no booking, so listing it only reads as open time."""
    now = datetime.now(UTC)
    add_window(db_session, counsellor, starts_at=now - timedelta(days=3))
    under_way = add_window(db_session, counsellor, starts_at=now - timedelta(hours=1))
    ahead = add_window(db_session, counsellor, starts_at=now + timedelta(days=2))

    calendar = client.get(
        "/api/v1/me/availability-windows", headers=counsellor_headers,
    ).json()

    assert [window["id"] for window in calendar] == [under_way.id, ahead.id]


def test_each_window_reports_the_time_still_free_to_book(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: Any,
    counsellor_headers: dict[str, str],
    job_seeker_headers: dict[str, str],
) -> None:
    """Booked time is gone, and so is the part of a window already behind us."""
    now = datetime.now(UTC)
    booked = add_window(db_session, counsellor)
    untouched = add_window(db_session, counsellor, starts_at=now + timedelta(days=3))
    under_way = add_window(db_session, counsellor, starts_at=now - timedelta(hours=1))
    order = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_payload(service, booked),
    )
    client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers)

    calendar = {
        window["id"]: window
        for window in client.get(
            "/api/v1/me/availability-windows", headers=counsellor_headers,
        ).json()
    }

    assert calendar[booked.id]["hasBookings"] is True
    assert calendar[booked.id]["freeMinutes"] == 180 - service.duration_minutes
    assert calendar[untouched.id]["freeMinutes"] == 180
    # Two of its three hours are still to come; allow for the clock moving on.
    assert 119 <= calendar[under_way.id]["freeMinutes"] <= 120


def test_an_unpaid_hold_takes_the_time_it_holds(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: Any,
    counsellor_headers: dict[str, str],
    job_seeker_headers: dict[str, str],
) -> None:
    """The picker offers nothing while a hold is alive, so the calendar must not either."""
    window = add_window(db_session, counsellor, hours=1)
    held = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_payload(service, window),
    )
    assert held.status_code == 201

    calendar = client.get(
        "/api/v1/me/availability-windows", headers=counsellor_headers,
    ).json()

    assert calendar[0]["hasBookings"] is False
    assert calendar[0]["freeMinutes"] == 0


def test_each_service_reports_the_next_time_a_job_seeker_could_book_it(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: Any,
    counsellor_headers: dict[str, str],
    job_seeker_headers: dict[str, str],
) -> None:
    """The first of exactly what the time picker offers, so the two never disagree."""
    def next_open() -> str | None:
        own = client.get("/api/v1/me/services", headers=counsellor_headers).json()
        return own[0]["nextAvailableAt"]

    def first_offered() -> str:
        return client.get(f"/api/v1/services/{service.id}/slots").json()[0]["startsAt"]

    # Availability that has already ended offers nothing, however much of it there is.
    add_window(db_session, counsellor, starts_at=datetime.now(UTC) - timedelta(days=3))
    assert next_open() is None

    window = add_window(db_session, counsellor)
    assert next_open() == first_offered()

    order = client.post(
        "/api/v1/orders", headers=job_seeker_headers, json=order_payload(service, window),
    )
    client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=job_seeker_headers)

    # Booking the first time moves the next one on, for the counsellor and the picker alike.
    assert next_open() == first_offered()
    assert next_open() != window.starts_at.isoformat().replace("+00:00", "Z")
