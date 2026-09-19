"""The list each party reads to find out what they have coming up.

The endpoint existed before any screen used it, and returned bookings that named
neither the other person nor where to meet them — enough to prove the query worked,
not enough to render a useful list. These cover what was missing.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AvailabilityWindow, Service, User


def book(
    client: TestClient,
    db_session: Session,
    service: Service,
    headers: dict,
    *,
    days: int = 1,
    modality: str = "online",
) -> dict:
    start = datetime.now(UTC) + timedelta(days=days)
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


def test_each_party_sees_the_other_one_named(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker: User,
    counsellor: User,
    job_seeker_headers: dict,
    counsellor_headers: dict,
) -> None:
    """The same booking, described from each side. A list of sessions that does not
    say who they are with is not a list anyone can act on."""
    book(client, db_session, service, job_seeker_headers)

    seeker_view = client.get("/api/v1/me/bookings", headers=job_seeker_headers).json()
    counsellor_view = client.get("/api/v1/me/bookings", headers=counsellor_headers).json()

    assert [(row["counterpartyName"], row["counterpartyRole"]) for row in seeker_view] == [
        (counsellor.name, "counsellor")
    ]
    assert [(row["counterpartyName"], row["counterpartyRole"]) for row in counsellor_view] == [
        (job_seeker.name, "job_seeker")
    ]


def test_an_online_booking_carries_its_room_to_both_parties(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict,
    counsellor_headers: dict,
) -> None:
    booking = book(client, db_session, service, job_seeker_headers)

    for headers in (job_seeker_headers, counsellor_headers):
        (row,) = client.get("/api/v1/me/bookings", headers=headers).json()
        assert row["meetingUrl"] == booking["meetingUrl"]
        assert row["meetingArea"] == ""


def test_an_in_person_booking_carries_the_meeting_area_instead(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict
) -> None:
    service.modalities = ["in_person"]
    service.location_city = "Melbourne"
    service.location_state = "VIC"
    db_session.commit()

    book(client, db_session, service, job_seeker_headers, modality="in_person")

    (row,) = client.get("/api/v1/me/bookings", headers=job_seeker_headers).json()
    assert row["meetingUrl"] is None
    assert row["meetingArea"] == "Melbourne, VIC"


def test_the_list_holds_only_the_callers_own_bookings(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict,
    platform_owner_headers: dict,
) -> None:
    """Not even the Platform Owner reads someone's diary from here; there is a
    separate administration view for that, which says so."""
    book(client, db_session, service, job_seeker_headers)

    assert client.get("/api/v1/me/bookings", headers=platform_owner_headers).json() == []


def test_the_list_needs_a_session(client: TestClient) -> None:
    assert client.get("/api/v1/me/bookings").status_code == 401


def test_bookings_come_back_newest_session_first(
    client: TestClient, db_session: Session, service: Service, job_seeker_headers: dict
) -> None:
    book(client, db_session, service, job_seeker_headers, days=1)
    book(client, db_session, service, job_seeker_headers, days=5)

    rows = client.get("/api/v1/me/bookings", headers=job_seeker_headers).json()

    assert [row["startsAt"] for row in rows] == sorted(
        (row["startsAt"] for row in rows), reverse=True
    )


@pytest.mark.parametrize(
    ("who", "expected_role"),
    [("job_seeker_headers", "counsellor"), ("counsellor_headers", "job_seeker")],
)
def test_a_single_booking_also_names_the_other_party(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker: User,
    counsellor: User,
    job_seeker_headers: dict,
    request: pytest.FixtureRequest,
    who: str,
    expected_role: str,
) -> None:
    """The confirmation screen reads this one, and needs the same details as the list."""
    booking = book(client, db_session, service, job_seeker_headers)
    headers = request.getfixturevalue(who)

    response = client.get(f"/api/v1/bookings/{booking['id']}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["counterpartyRole"] == expected_role
    assert body["counterpartyName"] == (
        counsellor.name if expected_role == "counsellor" else job_seeker.name
    )
