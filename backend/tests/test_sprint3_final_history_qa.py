"""US-36/42/43/48: each purchase retains its own title across listing changes.

Payment uses the implemented stub. Completed/paid-out states below are explicit
database fixtures, not claims of a real provider settlement. Email composition is
real; only delivery is captured, so no external inbox is contacted.
"""

from datetime import UTC, datetime, timedelta
from html import escape

import pytest
from test_sprint3_completion_qa import _body, _trade_views

from app.db import SessionLocal
from app.mail import messages
from app.models import AvailabilityWindow, Booking, Order


def _edit(client, service_id, headers, title, price):
    return _body(client.patch(
        f"/api/v1/me/services/{service_id}", headers=headers,
        json={
            "title": title, "description": "Revised public offering", "priceMinor": price,
            "currency": "AUD", "durationMinutes": 60, "modalities": ["online"],
        },
    ))


@pytest.mark.parametrize("lifecycle", ["confirmed", "completed", "paid_out"])
def test_two_purchases_of_one_renamed_listing_keep_distinct_titles_in_every_history_reader(
    client, db_session, service, counsellor, job_seeker_headers, counsellor_headers,
    platform_owner_headers, monkeypatch, lifecycle,
):
    original_title = "Career <review> & résumé"
    updated_title = "Interview coaching after rename"
    final_title = "Current listing title that nobody purchased"
    service.title = original_title
    start = (datetime.now(UTC) + timedelta(days=3)).replace(second=0, microsecond=0)
    db_session.add(AvailabilityWindow(
        counsellor_id=counsellor.id, starts_at=start,
        ends_at=start + timedelta(hours=4), modalities=["online"],
    ))
    db_session.commit()
    sent = []

    def capture(message, settings=None):
        sent.append(message)
        return True

    monkeypatch.setattr(messages, "send", capture)

    def hold(at):
        return _body(client.post("/api/v1/orders", headers=job_seeker_headers, json={
            "serviceId": service.id, "startsAt": at.isoformat(),
            "timezone": "Australia/Melbourne", "modality": "online",
        }), 201)

    first = hold(start)
    _edit(client, service.id, counsellor_headers, updated_title, 12345)
    second = hold(start + timedelta(hours=2))
    _edit(client, service.id, counsellor_headers, final_title, 14500)
    pairs = []
    for order, expected_title, expected_amount in (
        (first, original_title, 9500), (second, updated_title, 12345),
    ):
        booking = _body(client.post(
            f"/api/v1/orders/{order['id']}/payments/stub", headers=job_seeker_headers,
        ))["booking"]
        assert booking["serviceTitle"] == expected_title
        # Actual text/HTML rendering and both recipients agree with the receipt.
        assert len(sent) == (2 if order is first else 4)
        for message in sent[-2:]:
            assert expected_title in message.text
            assert escape(expected_title) in message.html
            assert final_title not in message.text + message.html
        assert {message.to for message in sent[-2:]} == {
            counsellor.email, "alex.jobseeker@example.com",
        }
        if lifecycle != "confirmed":
            stored = db_session.get(Booking, booking["id"])
            stored.status = lifecycle
            stored.completed_at = stored.ends_at
            if lifecycle == "paid_out":
                stored.paid_out_at = stored.ends_at + timedelta(days=1)
            db_session.commit()
        pairs.append((booking, expected_title, expected_amount))

    def histories():
        result = []
        for booking, expected_title, expected_amount in pairs:
            views = _trade_views(
                client, booking, job_seeker_headers, counsellor_headers, platform_owner_headers,
            )
            assert views["order"]["booking"]["serviceTitle"] == expected_title
            assert views["admin_payment"]["serviceTitle"] == expected_title
            for actor in ("seeker", "counsellor"):
                assert views[f"{actor}_detail"]["serviceTitle"] == expected_title
                listed = next(row for row in views[f"{actor}_list"] if row["id"] == booking["id"])
                assert listed["serviceTitle"] == expected_title
                receipt = views[f"{actor}_receipt"]
                assert receipt["description"] == expected_title
                assert receipt["totalMinor"] == expected_amount
                assert expected_title in receipt["text"]
            listed = next(row for row in views["admin_bookings"] if row["id"] == booking["id"])
            assert listed["serviceTitle"] == expected_title
            result.append(views)
        return result

    before_withdrawal = histories()
    assert client.delete(
        f"/api/v1/me/services/{service.id}", headers=counsellor_headers,
    ).status_code == 204
    assert histories() == before_withdrawal
    assert client.get(f"/api/v1/services/{service.id}").status_code == 404
    with SessionLocal() as db:
        assert db.get(Order, first["id"]).service_title == original_title
        assert db.get(Order, second["id"]).service_title == updated_title
    statement = _body(client.get(
        f"/api/v1/me/commission-statements/{start.year}/{start.month}",
        headers=counsellor_headers,
    ))
    expected_titles = [] if lifecycle == "confirmed" else [original_title, updated_title]
    assert [line["description"] for line in statement["lines"]] == expected_titles
    for expected_title in expected_titles:
        assert expected_title in statement["text"]
    assert final_title not in statement["text"]


def test_legacy_order_without_a_title_snapshot_still_has_readable_receipt_and_booking(
    client, db_session, service, job_seeker_headers, counsellor_headers, platform_owner_headers,
):
    from test_sprint3_completion_qa import _book

    booking, _ = _book(client, db_session, service, job_seeker_headers, "online")
    # Explicit pre-migration/unbackfilled record; no original title can be recovered.
    order = db_session.get(Order, booking["orderId"])
    order.service_title = None
    db_session.commit()
    views = _trade_views(
        client, booking, job_seeker_headers, counsellor_headers, platform_owner_headers,
    )
    assert views["seeker_detail"]["serviceTitle"] == service.title
    assert views["counsellor_receipt"]["description"] == service.title
    assert views["admin_payment"]["serviceTitle"] == service.title
    assert views["order"]["booking"]["serviceTitle"] == service.title
