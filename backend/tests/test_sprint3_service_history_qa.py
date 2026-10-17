"""US-36 AC3 / QA #201: service edits must preserve agreed booking information.

This uses the implemented order and stub-payment APIs to create an existing
booking, then edits the live listing. It does not exercise service removal or
assume a cancellation policy for upcoming bookings.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.db import SessionLocal
from app.mail import messages
from app.models import AvailabilityWindow, Order, Service


def _booking_views(client, order_id, booking_id, seeker_headers, counsellor_headers):
    views = {}
    order = client.get(f"/api/v1/orders/{order_id}", headers=seeker_headers)
    assert order.status_code == 200, order.text
    assert order.json()["order"]["id"] == order_id
    assert order.json()["order"]["status"] == "confirmed"
    views["order.booking"] = order.json()["booking"]
    for role, headers in (("seeker", seeker_headers), ("counsellor", counsellor_headers)):
        detail = client.get(f"/api/v1/bookings/{booking_id}", headers=headers)
        assert detail.status_code == 200, detail.text
        views[f"{role}.detail"] = detail.json()
        listing = client.get("/api/v1/me/bookings", headers=headers)
        assert listing.status_code == 200, listing.text
        matches = [row for row in listing.json() if row["id"] == booking_id]
        assert len(matches) == 1
        views[f"{role}.list"] = matches[0]
    return order.json()["order"], views


def test_existing_booking_keeps_recorded_meeting_area_after_service_edit(
    client, db_session, service, job_seeker_headers, counsellor_headers,
):
    service.modalities = ["in_person"]
    service.location_state = "VIC"
    service.location_city = "Melbourne"
    original_title = service.title
    start = datetime.now(UTC) + timedelta(days=2)
    db_session.add(AvailabilityWindow(
        counsellor_id=service.counsellor_id,
        starts_at=start, ends_at=start + timedelta(hours=3), modalities=["in_person"],
    ))
    db_session.commit()
    service_id = service.id

    created = client.post("/api/v1/orders", headers=job_seeker_headers, json={
        "serviceId": service_id, "startsAt": start.isoformat(),
        "modality": "in_person", "timezone": "Australia/Melbourne",
    })
    assert created.status_code == 201, created.text
    order_id = created.json()["id"]
    paid = client.post(f"/api/v1/orders/{order_id}/payments/stub", headers=job_seeker_headers)
    assert paid.status_code == 200, paid.text
    booking_id = paid.json()["booking"]["id"]
    before_order, before_views = _booking_views(
        client, order_id, booking_id, job_seeker_headers, counsellor_headers,
    )
    for booking in before_views.values():
        assert booking["serviceTitle"] == original_title
        assert booking["meetingArea"] == "Melbourne, VIC"

    edited = {
        "title": "A different service offering", "description": "New listing details",
        "priceMinor": 13000, "durationMinutes": 90, "currency": "AUD",
        "modalities": ["in_person"], "location": {"state": "VIC", "cityOrRegion": "Geelong"},
    }
    updated = client.patch(
        f"/api/v1/me/services/{service_id}", headers=counsellor_headers, json=edited,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == edited["title"]
    assert updated.json()["location"] == edited["location"]
    with SessionLocal() as db:
        stored = db.get(Service, service_id)
        assert stored is not None
        assert stored.title == edited["title"]
        assert stored.location_city == "Geelong"
        assert stored.price_minor == 13000 and stored.duration_minutes == 90

    after_order, after_views = _booking_views(
        client, order_id, booking_id, job_seeker_headers, counsellor_headers,
    )
    assert after_order == before_order
    stable_fields = (
        "id", "orderId", "serviceId", "startsAt", "endsAt", "timezone", "modality",
        "status", "paymentStatus", "amountMinor", "meetingAddress", "preSessionBrief",
        "serviceTitle", "meetingArea",
    )
    for source, after in after_views.items():
        before = before_views[source]
        assert {key: after[key] for key in stable_fields} == {
            key: before[key] for key in stable_fields
        }


def _prepare_area_service(db_session, service, *, modality="in_person", city="Melbourne"):
    service.modalities = [modality]
    service.location_city = city
    service.location_state = "VIC" if city else None
    start = (datetime.now(UTC) + timedelta(days=3)).replace(second=0, microsecond=0)
    db_session.add(AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start,
        ends_at=start + timedelta(hours=6), modalities=["online", "in_person"],
    ))
    db_session.commit()
    return start


def _hold(client, service_id, headers, start, *, modality="in_person"):
    response = client.post("/api/v1/orders", headers=headers, json={
        "serviceId": service_id, "startsAt": start.isoformat(), "modality": modality,
        "timezone": "Australia/Melbourne",
    })
    assert response.status_code == 201, response.text
    return response.json()


def _pay(client, order_id, headers):
    response = client.post(f"/api/v1/orders/{order_id}/payments/stub", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["booking"]


def _move_listing(client, service_id, headers, city):
    response = client.patch(f"/api/v1/me/services/{service_id}", headers=headers, json={
        "title": "Location history regression", "description": "Updated service location",
        "priceMinor": 9500, "durationMinutes": 60, "currency": "AUD",
        "modalities": ["online", "in_person"],
        "location": {"state": "VIC", "cityOrRegion": city},
    })
    assert response.status_code == 200, response.text
    assert response.json()["location"]["cityOrRegion"] == city


def test_purchases_before_and_after_a_move_keep_distinct_areas_in_views_and_rendered_emails(
    client, db_session, service, counsellor, job_seeker_headers, counsellor_headers, monkeypatch,
):
    """Both payments happen after another move; each confirms its own purchased area."""
    start = _prepare_area_service(db_session, service)
    service_id = service.id
    first = _hold(client, service_id, job_seeker_headers, start)
    _move_listing(client, service_id, counsellor_headers, "Geelong")
    second = _hold(client, service_id, job_seeker_headers, start + timedelta(hours=2))
    _move_listing(client, service_id, counsellor_headers, "Ballarat")
    delivered = []

    def capture(message, settings=None):
        delivered.append(message)
        return True

    # Render the real templates, replacing only external email delivery.
    monkeypatch.setattr(messages, "send", capture)
    for order, expected_area in ((first, "Melbourne, VIC"), (second, "Geelong, VIC")):
        before_mail_count = len(delivered)
        booking = _pay(client, order["id"], job_seeker_headers)
        _, views = _booking_views(
            client, order["id"], booking["id"], job_seeker_headers, counsellor_headers,
        )
        assert all(view["meetingArea"] == expected_area for view in views.values())
        assert len(delivered) == before_mail_count + 2
        for message in delivered[-2:]:
            assert expected_area in message.text
            assert expected_area in message.html
            assert "Ballarat" not in message.text + message.html
        assert {message.to for message in delivered[-2:]} == {
            counsellor.email, "alex.jobseeker@example.com",
        }
        with SessionLocal() as db:
            assert db.get(Order, order["id"]).meeting_area == expected_area


@pytest.mark.parametrize("actor", ["seeker", "counsellor"])
def test_rescheduling_and_editing_exact_address_preserve_purchased_area(
    client, db_session, service, job_seeker_headers, counsellor_headers, actor,
):
    start = _prepare_area_service(db_session, service)
    order = _hold(client, service.id, job_seeker_headers, start)
    booking = _pay(client, order["id"], job_seeker_headers)
    _move_listing(client, service.id, counsellor_headers, "Geelong")
    address = "Level 2, 100 Collins Street, Melbourne"
    addressed = client.patch(
        f"/api/v1/bookings/{booking['id']}/meeting-address", headers=counsellor_headers,
        json={"meetingAddress": address},
    )
    assert addressed.status_code == 200, addressed.text
    assert addressed.json()["meetingArea"] == "Melbourne, VIC"
    moved_to = start + timedelta(hours=2)
    moved = client.post(
        f"/api/v1/bookings/{booking['id']}/reschedule",
        headers=job_seeker_headers if actor == "seeker" else counsellor_headers,
        json={"startsAt": moved_to.isoformat(), "modality": "in_person",
              "timezone": "Australia/Melbourne"},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["id"] == booking["id"]
    assert moved.json()["orderId"] == order["id"]
    _, views = _booking_views(
        client, order["id"], booking["id"], job_seeker_headers, counsellor_headers,
    )
    for view in views.values():
        assert view["meetingArea"] == "Melbourne, VIC"
        assert view["meetingAddress"] == address
        assert datetime.fromisoformat(view["startsAt"]) == moved_to
    with SessionLocal() as db:
        assert db.get(Order, order["id"]).meeting_area == "Melbourne, VIC"


def test_online_purchase_freezes_empty_area_before_listing_gains_an_in_person_location(
    client, db_session, service, job_seeker_headers, counsellor_headers, monkeypatch,
):
    start = _prepare_area_service(db_session, service, modality="online", city=None)
    order = _hold(client, service.id, job_seeker_headers, start, modality="online")
    _move_listing(client, service.id, counsellor_headers, "Geelong")
    delivered = []
    monkeypatch.setattr(messages, "send", lambda message, settings=None: (
        delivered.append(message) or True
    ))
    booking = _pay(client, order["id"], job_seeker_headers)
    _, views = _booking_views(
        client, order["id"], booking["id"], job_seeker_headers, counsellor_headers,
    )
    assert all(view["meetingArea"] == "" for view in views.values())
    assert len(delivered) == 2
    assert all("Geelong" not in message.text + message.html for message in delivered)
    with SessionLocal() as db:
        stored = db.get(Order, order["id"])
        assert stored.meeting_area == ""
        assert stored.area_for(db.get(Service, service.id)) == ""


def test_legacy_null_area_snapshot_remains_readable_via_live_listing_fallback(
    client, db_session, service, job_seeker_headers, counsellor_headers,
):
    start = _prepare_area_service(db_session, service)
    order = _hold(client, service.id, job_seeker_headers, start)
    booking = _pay(client, order["id"], job_seeker_headers)
    # Explicit unbackfilled legacy fixture: there is no original area to recover.
    with SessionLocal() as db:
        db.get(Order, order["id"]).meeting_area = None
        db.commit()
    _move_listing(client, service.id, counsellor_headers, "Geelong")
    _, views = _booking_views(
        client, order["id"], booking["id"], job_seeker_headers, counsellor_headers,
    )
    assert all(view["meetingArea"] == "Geelong, VIC" for view in views.values())
    with SessionLocal() as db:
        assert db.get(Order, order["id"]).meeting_area is None
