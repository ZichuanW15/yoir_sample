"""Where an online session happens, and who is allowed to know.

Two properties matter and neither is obvious from reading the code: the room is
fixed at confirmation rather than derived on read, and it never travels with the
public marketplace listing.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.meetings import meeting_url_for, room_name
from app.models import AvailabilityWindow, Booking, Service


def add_window(db_session: Session, service: Service) -> AvailabilityWindow:
    start = datetime.now(UTC) + timedelta(days=1)
    window = AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start, ends_at=start + timedelta(hours=3),
    )
    db_session.add(window)
    db_session.commit()
    db_session.refresh(window)
    return window


def book(client: TestClient, service: Service, window: AvailabilityWindow, headers: dict) -> dict:
    order = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "serviceId": service.id,
            "startsAt": window.starts_at.isoformat(),
            "modality": service.modalities[0],
            "timezone": "Australia/Melbourne",
        },
    )
    assert order.status_code == 201, order.text
    paid = client.post(
        f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=headers
    )
    assert paid.status_code == 200, paid.text
    return paid.json()["booking"]


# --- naming -----------------------------------------------------------------


def test_the_room_is_named_after_the_booking_id() -> None:
    """The booking id is doing the security work, not just the naming.

    Jitsi treats the room name as the whole access control: anyone who knows it can
    walk in. A sequence number or the counsellor's name would be guessable.
    """
    assert room_name("1c3b6bd5-c183-4ba5-a996-b3452d03119b") == (
        "yoir-1c3b6bd5c1834ba5a996b3452d03119b"
    )


@pytest.mark.parametrize("hostile", ["../../admin", "a b/c?d#e", "UPPER-case"])
def test_room_names_are_stripped_of_anything_but_letters_and_digits(hostile: str) -> None:
    name = room_name(hostile)

    assert name.startswith("yoir-")
    assert name[5:].isalnum() or name[5:] == ""


def test_an_in_person_booking_gets_no_room(db_session: Session, service: Service) -> None:
    booking = Booking(id="booking-1", modality="in_person")

    assert meeting_url_for(booking, service) is None


def test_a_counsellors_own_room_wins_over_the_generated_one(
    db_session: Session, service: Service
) -> None:
    service.meeting_url = "https://zoom.us/j/1234567890"
    booking = Booking(id="booking-1", modality="online")

    assert meeting_url_for(booking, service) == "https://zoom.us/j/1234567890"


# --- confirmation -----------------------------------------------------------


def test_confirming_a_booking_fixes_its_room(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict
) -> None:
    window = add_window(db_session, service)

    booking = book(client, service, window, job_seeker_headers)

    assert booking["meetingUrl"] == f"https://meet.jit.si/{room_name(booking['id'])}"
    stored = db_session.get(Booking, booking["id"])
    # Stored, not derived on read: the email and the app must agree months later.
    assert stored.meeting_url == booking["meetingUrl"]


def test_the_room_survives_the_counsellor_changing_their_preferred_one(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict,
    counsellor_headers: dict,
) -> None:
    """A room agreed with the job seeker cannot be moved out from under them by an
    edit to the listing — they already have the old link in their inbox."""
    window = add_window(db_session, service)
    booking = book(client, service, window, job_seeker_headers)
    original = booking["meetingUrl"]

    edit = client.patch(
        f"/api/v1/me/services/{service.id}",
        headers=counsellor_headers,
        json={
            "title": service.title,
            "description": service.description,
            "priceMinor": service.price_minor,
            "currency": service.currency,
            "modalities": list(service.modalities),
            "meetingUrl": "https://zoom.us/j/9999999999",
        },
    )
    assert edit.status_code == 200, edit.text

    db_session.expire_all()
    assert db_session.get(Booking, booking["id"]).meeting_url == original


def test_a_new_booking_uses_the_counsellors_room_once_they_set_one(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict,
) -> None:
    service.meeting_url = "https://zoom.us/j/9999999999"
    db_session.commit()
    window = add_window(db_session, service)

    booking = book(client, service, window, job_seeker_headers)

    assert booking["meetingUrl"] == "https://zoom.us/j/9999999999"


# --- who may see it ---------------------------------------------------------


def test_the_public_listing_never_carries_the_counsellors_room(
    client: TestClient, db_session: Session, service: Service
) -> None:
    """A room URL is an access credential. Publishing it on the marketplace would
    let anyone browsing walk into a session they have not paid for."""
    service.meeting_url = "https://zoom.us/j/9999999999"
    db_session.commit()

    listing = client.get("/api/v1/services")
    detail = client.get(f"/api/v1/services/{service.id}")

    assert listing.status_code == detail.status_code == 200
    assert "9999999999" not in listing.text
    assert "9999999999" not in detail.text
    assert "meetingUrl" not in detail.json()


def test_the_counsellor_sees_their_own_room_on_their_own_listing(
    client: TestClient, db_session: Session, service: Service, counsellor_headers: dict
) -> None:
    service.meeting_url = "https://zoom.us/j/9999999999"
    db_session.commit()

    response = client.get("/api/v1/me/services", headers=counsellor_headers)

    assert response.status_code == 200
    assert response.json()[0]["meetingUrl"] == "https://zoom.us/j/9999999999"


def test_clearing_the_override_returns_the_service_to_generated_rooms(
    client: TestClient, db_session: Session, service: Service, counsellor_headers: dict
) -> None:
    """Without this there is no way back once a counsellor has set a room."""
    service.meeting_url = "https://zoom.us/j/9999999999"
    db_session.commit()
    form = {
        "title": service.title,
        "description": service.description,
        "priceMinor": service.price_minor,
        "currency": service.currency,
        "modalities": list(service.modalities),
    }

    response = client.patch(
        f"/api/v1/me/services/{service.id}",
        headers=counsellor_headers,
        json={**form, "meetingUrl": ""},
    )

    assert response.status_code == 200
    assert response.json()["meetingUrl"] is None
    db_session.expire_all()
    assert db_session.get(Service, service.id).meeting_url is None


def test_a_stranger_cannot_read_a_bookings_room(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict,
    counsellor_headers: dict,
) -> None:
    window = add_window(db_session, service)
    booking = book(client, service, window, job_seeker_headers)

    # Both parties may see it; that is the point of it existing.
    for headers in (job_seeker_headers, counsellor_headers):
        response = client.get(f"/api/v1/bookings/{booking['id']}", headers=headers)
        assert response.status_code == 200
        assert response.json()["meetingUrl"] == booking["meetingUrl"]

    outsider = client.get(f"/api/v1/bookings/{booking['id']}")
    assert outsider.status_code == 401


def test_confirming_a_booking_tells_both_parties(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The regression that sent nothing to the counsellor.

    Only the job seeker was emailed, so whoever had to deliver the session was never
    told it existed — and on a sandbox mail domain, where only one address receives
    anything, that looked like mail being broken.
    """
    from app.mail import messages

    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(
        messages, "booking_confirmed",
        lambda *a, **k: sent.append(("job_seeker", a[3].email)) or True,
    )
    monkeypatch.setattr(
        messages, "booking_received",
        lambda *a, **k: sent.append(("counsellor", a[4].email)) or True,
    )
    window = add_window(db_session, service)

    book(client, service, window, job_seeker_headers)

    assert sorted(sent) == [
        ("counsellor", "maya@example.com"),
        ("job_seeker", "alex.jobseeker@example.com"),
    ]


def test_a_failure_telling_one_party_still_tells_the_other(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.mail import messages

    told: list[str] = []
    monkeypatch.setattr(
        messages, "booking_confirmed",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("render failed")),
    )
    monkeypatch.setattr(
        messages, "booking_received", lambda *a, **k: told.append("counsellor") or True,
    )
    window = add_window(db_session, service)

    booking = book(client, service, window, job_seeker_headers)

    assert booking["id"]
    assert told == ["counsellor"]
