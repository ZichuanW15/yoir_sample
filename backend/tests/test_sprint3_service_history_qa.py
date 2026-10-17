"""US-36 AC3 / QA #201: service edits must preserve agreed booking information.

This uses the implemented order and stub-payment APIs to create an existing
booking, then edits the live listing. It does not exercise service removal or
assume a cancellation policy for upcoming bookings.
"""

from datetime import UTC, datetime, timedelta

import pytest
from qa_acceptance import KnownAcceptanceDefect

from app.db import SessionLocal
from app.models import AvailabilityWindow, Service


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


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason=(
        "S3-BE-SERVICE-HISTORY: US-36 AC3 / #201; meeting area is still "
        "read from the edited listing instead of retaining the booked value"
    ),
)
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
    # Setup, commercial snapshot and unrelated booking corruption fail normally.
    assert after_order == before_order
    stable_fields = (
        "id", "orderId", "serviceId", "startsAt", "endsAt", "timezone", "modality",
        "status", "paymentStatus", "amountMinor", "meetingAddress", "preSessionBrief",
        "serviceTitle",
    )
    for source, after in after_views.items():
        before = before_views[source]
        assert {key: after[key] for key in stable_fields} == {
            key: before[key] for key in stable_fields
        }

    # Only the reproduced metadata expectation is eligible for the strict xfail.
    changed = {
        source: {
            key: {"recorded": before_views[source][key], "returned": after[key]}
            for key in ("meetingArea",)
            if after[key] != before_views[source][key]
        }
        for source, after in after_views.items()
    }
    changed = {source: fields for source, fields in changed.items() if fields}
    if changed:
        raise KnownAcceptanceDefect(
            f"Existing booking metadata changed after listing edit: {changed}"
        )
