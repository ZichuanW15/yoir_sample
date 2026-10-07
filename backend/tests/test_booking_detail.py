"""US-43 — a booking's own detail: the specific in-person meeting address.

The meeting link (meeting_url, already on Booking) and the general meeting area
(the service's state/city, meeting_area) existed before this story. What was
missing is a specific address for one confirmed booking, added by the counsellor
delivering it and read back to both participants — covered here.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AvailabilityWindow, Service, User


def book(
    client: TestClient,
    db_session: Session,
    service: Service,
    headers: dict,
    *,
    modality: str = "in_person",
) -> dict:
    start = datetime.now(UTC) + timedelta(days=1)
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


def set_address(client: TestClient, booking_id: str, headers: dict, address: str | None):
    return client.patch(
        f"/api/v1/bookings/{booking_id}/meeting-address",
        headers=headers,
        json={"meetingAddress": address},
    )


def test_a_confirmed_booking_has_no_address_until_the_counsellor_adds_one(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict,
) -> None:
    service.modalities = ["in_person"]
    db_session.commit()
    booking = book(client, db_session, service, job_seeker_headers)
    assert booking["meetingAddress"] == ""


def test_the_counsellor_adds_an_address_and_both_parties_read_it_back(
    client: TestClient, db_session: Session, service: Service,
    job_seeker_headers: dict, counsellor_headers: dict,
) -> None:
    service.modalities = ["in_person"]
    db_session.commit()
    booking = book(client, db_session, service, job_seeker_headers)

    response = set_address(client, booking["id"], counsellor_headers, "  Level 4, 123 Collins St, Melbourne  ")
    assert response.status_code == 200
    assert response.json()["meetingAddress"] == "Level 4, 123 Collins St, Melbourne"

    for headers in (job_seeker_headers, counsellor_headers):
        detail = client.get(f"/api/v1/bookings/{booking['id']}", headers=headers).json()
        assert detail["meetingAddress"] == "Level 4, 123 Collins St, Melbourne"


def test_the_address_can_be_updated_and_cleared(
    client: TestClient, db_session: Session, service: Service,
    job_seeker_headers: dict, counsellor_headers: dict,
) -> None:
    service.modalities = ["in_person"]
    db_session.commit()
    booking = book(client, db_session, service, job_seeker_headers)
    set_address(client, booking["id"], counsellor_headers, "Wrong building")

    corrected = set_address(client, booking["id"], counsellor_headers, "123 Collins St")
    assert corrected.json()["meetingAddress"] == "123 Collins St"

    cleared = set_address(client, booking["id"], counsellor_headers, None)
    assert cleared.json()["meetingAddress"] == ""


def test_only_the_delivering_counsellor_can_set_the_address(
    client: TestClient, db_session: Session, service: Service,
    job_seeker_headers: dict,
) -> None:
    """The Job Seeker is a participant and can read the booking, but this is the
    counsellor's call to make — it is their session to run."""
    service.modalities = ["in_person"]
    db_session.commit()
    booking = book(client, db_session, service, job_seeker_headers)

    response = set_address(client, booking["id"], job_seeker_headers, "123 Collins St")
    assert response.status_code == 403


def test_a_stranger_cannot_set_or_see_the_address(
    client: TestClient, db_session: Session, service: Service,
    job_seeker_headers: dict, platform_owner_headers: dict,
) -> None:
    """Not even the Platform Owner: administration has its own view (US-32/US-71)."""
    service.modalities = ["in_person"]
    db_session.commit()
    booking = book(client, db_session, service, job_seeker_headers)

    assert set_address(client, booking["id"], platform_owner_headers, "123 Collins St").status_code == 404
    assert client.get(f"/api/v1/bookings/{booking['id']}", headers=platform_owner_headers).status_code == 404


def test_an_address_over_the_limit_is_rejected(
    client: TestClient, db_session: Session, service: Service,
    job_seeker_headers: dict, counsellor_headers: dict,
) -> None:
    service.modalities = ["in_person"]
    db_session.commit()
    booking = book(client, db_session, service, job_seeker_headers)

    response = set_address(client, booking["id"], counsellor_headers, "x" * 301)
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_an_online_booking_carries_its_meeting_link_in_the_detail_view(
    client: TestClient, db_session: Session, service: Service,
    job_seeker_headers: dict, counsellor_headers: dict,
) -> None:
    """AT-US-43-1 — the piece already in place before this story: confirmed in the
    detail endpoint too, not only on the My Bookings card."""
    booking = book(client, db_session, service, job_seeker_headers, modality="online")

    for headers in (job_seeker_headers, counsellor_headers):
        detail = client.get(f"/api/v1/bookings/{booking['id']}", headers=headers).json()
        assert detail["meetingUrl"] == booking["meetingUrl"]
        assert detail["meetingUrl"] is not None
