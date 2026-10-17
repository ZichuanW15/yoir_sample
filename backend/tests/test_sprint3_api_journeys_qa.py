"""Sprint 3 QA journeys across the APIs added to dev through 16 October.

These supplement request-level tests with revision changes, transactional recovery
and agreement between consumer/owner/admin views. Payment is the implemented stub.
Completed-session prerequisites are established through the completion job or an
explicit database fixture; these are not evidence of a device or provider run.
"""

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, get_db
from app.main import app
from app.models import AvailabilityWindow, Booking, Order, Review, Service, User
from app.routers import diagnosis as diagnosis_router

VERSION = "yoir-six-step-v1"


def _body(response, status=200):
    assert response.status_code == status, response.text
    return response.json()


def _complete_diagnosis(client, headers):
    record = _body(client.post(
        "/api/v1/me/diagnosis", headers=headers, json={"questionnaireVersion": VERSION},
    ))
    for step, answer in (
        ("now", "job"), ("goal", "find_job"), ("tried", []),
        ("stuck", "interview"), ("barriers", []),
    ):
        record = _body(_save_step(client, headers, record, step, answer))
    return record


def _save_step(client, headers, record, step, answer):
    return client.put(
        f"/api/v1/diagnoses/{record['id']}/steps/{step}", headers=headers,
        json={"questionnaireVersion": VERSION,
              "expectedRevision": record["revision"], "value": answer},
    )


def _derived(client, headers, record):
    return tuple(_body(client.get(
        f"/api/v1/diagnoses/{record['id']}/{view}", headers=headers,
    )) for view in ("direction", "marketplace-criteria"))


def _window(db, service, *, day=2, minutes=180):
    start = (datetime.now(UTC) + timedelta(days=day)).replace(
        hour=9, minute=0, second=0, microsecond=0,
    )
    window = AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start,
        ends_at=start + timedelta(minutes=minutes), modalities=["online"],
    )
    db.add(window)
    db.commit()
    return window


def _order(client, headers, service, starts_at):
    return _body(client.post("/api/v1/orders", headers=headers, json={
        "serviceId": service.id, "startsAt": starts_at.isoformat(),
        "modality": "online", "timezone": "Australia/Melbourne",
    }), 201)


def _pay(client, headers, order):
    return _body(client.post(
        f"/api/v1/orders/{order['id']}/payments/stub", headers=headers,
    ))["booking"]


def _completed_booking(client, db, service, headers, *, day=2):
    window = _window(db, service, day=day)
    booking = _pay(client, headers, _order(client, headers, service, window.starts_at))
    # Completion scheduling is independently tested in test_payment_jobs.py. This
    # fixture only establishes the documented prerequisite for submitting a review.
    db.get(Booking, booking["id"]).status = "completed"
    db.commit()
    return booking


def _review(client, headers, booking, rating, comment):
    return client.post(
        f"/api/v1/bookings/{booking['id']}/review", headers=headers,
        json={"rating": rating, "comment": comment},
    )


def _rating_views(client, service_id, counsellor_id):
    detail = _body(client.get(f"/api/v1/services/{service_id}"))
    listed = next(row for row in _body(client.get("/api/v1/services"))
                  if row["id"] == service_id)
    profile = _body(client.get(f"/api/v1/counsellors/{counsellor_id}"))
    return detail, listed, profile


@pytest.fixture
def fail_commit_after_flush(monkeypatch):
    """Inject an actual transaction fault after SQL writes, before any commit.

    No product endpoint or response is replaced. A fresh request/session reads the
    database afterwards, so an in-memory response cannot satisfy the recovery check.
    """
    @contextmanager
    def injection():
        observations = []

        def database():
            with SessionLocal() as db:
                def fail():
                    db.flush()
                    observations.append("writes flushed; commit refused")
                    raise OperationalError("QA pre-commit fault", {}, RuntimeError("injected"))

                with monkeypatch.context() as patch:
                    patch.setattr(db, "commit", fail)
                    yield db

        with monkeypatch.context() as patch:
            patch.setitem(app.dependency_overrides, get_db, database)
            yield observations

    return injection


def test_editing_confirmed_answers_refreshes_direction_criteria_and_catalog_together(
    client, job_seeker_headers, counsellor_headers,
):
    """US-10/12/13: consumers must use the newest saved revision, not old advice."""
    offerings = {}
    for title in ("Interview practice", "Resume coaching"):
        created = _body(client.post("/api/v1/me/services", headers=counsellor_headers, json={
            "title": title, "description": "Practical feedback", "priceMinor": 9000,
            "currency": "AUD", "modalities": ["online"],
        }), 201)
        offerings[title] = created["id"]

    original = _complete_diagnosis(client, job_seeker_headers)
    old_direction, old_criteria = _derived(client, job_seeker_headers, original)
    assert old_direction["area"] == "Interview skills"
    assert old_criteria["query"] == "interview"

    revised = _body(_save_step(client, job_seeker_headers, original, "stuck", "ksc"))
    assert revised["status"] == "answers_complete"
    assert revised["revision"] == original["revision"] + 1
    direction, criteria = _derived(client, job_seeker_headers, revised)
    assert direction["area"] == "Resume and applications"
    assert criteria["query"] == "resume"
    assert direction["sourceRevision"] == revised["revision"]
    assert criteria["area"] == direction["area"]
    assert criteria["diagnosisId"] == direction["diagnosisId"] == original["id"]
    found = _body(client.get("/api/v1/services", params={"query": criteria["query"]}))
    assert {row["id"] for row in found} == {offerings["Resume coaching"]}

    # A second device holding the old revision may not overwrite the new result.
    rejected = _save_step(client, job_seeker_headers, original, "stuck", "networking")
    assert rejected.status_code == 409
    assert _derived(client, job_seeker_headers, revised) == (direction, criteria)
    assert _body(client.get("/api/v1/me/diagnosis", headers=job_seeker_headers)) == revised


def test_marketplace_derivation_failure_preserves_answers_and_recovers_without_resaving(
    client, job_seeker_headers, monkeypatch,
):
    """US-12/13: a transient result failure must not erase confirmed progress."""
    record = _complete_diagnosis(client, job_seeker_headers)
    direction, criteria = _derived(client, job_seeker_headers, record)

    def unavailable(*_args, **_kwargs):
        raise RuntimeError("private QA criteria fault")

    with monkeypatch.context() as patch:
        patch.setattr(diagnosis_router, "marketplace_criteria_for", unavailable)
        response = client.get(
            f"/api/v1/diagnoses/{record['id']}/marketplace-criteria",
            headers=job_seeker_headers,
        )
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert response.json()["requestId"]
    assert "private QA" not in response.text
    assert "query" not in response.json()
    assert _body(client.get("/api/v1/me/diagnosis", headers=job_seeker_headers)) == record
    assert _derived(client, job_seeker_headers, record) == (direction, criteria)


def test_review_aggregates_are_weighted_per_session_and_agree_across_public_views(
    client, db_session, service, counsellor, job_seeker_headers, counsellor_headers,
):
    """US-53/54/55: three sessions over two services are not two equally weighted means."""
    second = Service(
        counsellor_id=counsellor.id, title="Resume coaching", description="Feedback",
        price_minor=7000, currency="AUD", modalities=["online"], active=True,
    )
    other_owner = User(
        name="Unrelated professional", email="unrelated.rating@example.com",
        password_hash="fixture", role="counsellor", verification_status="verified",
        overall_rating=4.5, review_count=8,
    )
    db_session.add_all([second, other_owner])
    db_session.commit()
    unrelated = Service(
        counsellor_id=other_owner.id, title="Unrelated offer", description="Feedback",
        price_minor=7000, currency="AUD", modalities=["online"], active=True,
        average_rating=4.5, review_count=8,
    )
    db_session.add(unrelated)
    db_session.commit()
    written = []
    for day, offering, rating in ((2, service, 1), (3, service, 2), (4, second, 5)):
        booking = _completed_booking(client, db_session, offering, job_seeker_headers, day=day)
        review = _body(_review(client, job_seeker_headers, booking, rating, f"Session {day}"), 201)
        written.append((booking, review))

    first_detail, first_listed, profile = _rating_views(client, service.id, counsellor.id)
    second_detail, second_listed, _ = _rating_views(client, second.id, counsellor.id)
    for row in (first_detail, first_listed):
        assert (row["averageRating"], row["reviewCount"]) == (1.5, 2)
    for row in (second_detail, second_listed):
        assert (row["averageRating"], row["reviewCount"]) == (5, 1)
    for row in (first_detail["counsellor"], second_detail["counsellor"], profile):
        assert row["overallRating"] == pytest.approx(8 / 3)
        assert row["reviewCount"] == 3
    assert {r["id"] for r in first_detail["reviews"]} == {
        written[0][1]["id"], written[1][1]["id"],
    }
    assert [r["id"] for r in second_detail["reviews"]] == [written[2][1]["id"]]

    for headers in (job_seeker_headers, counsellor_headers):
        listed = {r["id"]: r for r in _body(client.get("/api/v1/me/bookings", headers=headers))}
        for booking, review in written:
            detail = _body(client.get(f"/api/v1/bookings/{booking['id']}", headers=headers))
            assert listed[booking["id"]]["review"] == detail["review"] == review

    before = _rating_views(client, service.id, counsellor.id)
    rejected = _review(client, job_seeker_headers, written[0][0], 5, "Replace the first score")
    assert rejected.status_code == 409
    assert _rating_views(client, service.id, counsellor.id) == before
    with SessionLocal() as db:
        assert len(list(db.scalars(select(Review)))) == 3
        untouched = db.get(User, other_owner.id)
        assert (untouched.overall_rating, untouched.review_count) == (4.5, 8)
        untouched_service = db.get(Service, unrelated.id)
        assert (untouched_service.average_rating, untouched_service.review_count) == (4.5, 8)


def test_failed_review_commit_rolls_back_review_and_both_aggregates_then_retry_succeeds(
    client, db_session, service, job_seeker_headers, fail_commit_after_flush,
):
    """US-53 AC4, US-54/55: no half-published review or partially updated rating."""
    first = _completed_booking(client, db_session, service, job_seeker_headers, day=2)
    _body(_review(client, job_seeker_headers, first, 2, "First review"), 201)
    second = _completed_booking(client, db_session, service, job_seeker_headers, day=3)
    before = _rating_views(client, service.id, service.counsellor_id)
    with fail_commit_after_flush() as attempts:
        failed = _review(client, job_seeker_headers, second, 5, "Retry this review")
    assert attempts == ["writes flushed; commit refused"]
    assert failed.status_code == 500
    assert failed.json()["code"] == "INTERNAL_ERROR"
    assert failed.json()["requestId"]
    assert "QA pre-commit" not in failed.text
    assert _rating_views(client, service.id, service.counsellor_id) == before
    assert _body(client.get(
        f"/api/v1/bookings/{second['id']}", headers=job_seeker_headers,
    ))["review"] is None
    with SessionLocal() as db:
        assert len(list(db.scalars(select(Review)))) == 1
        assert db.get(Service, service.id).review_count == 1
        assert db.get(User, service.counsellor_id).review_count == 1

    retried = _body(_review(client, job_seeker_headers, second, 5, "Retry this review"), 201)
    assert _body(client.get(
        f"/api/v1/bookings/{second['id']}", headers=job_seeker_headers,
    ))["review"] == retried
    detail, _, profile = _rating_views(client, service.id, service.counsellor_id)
    assert (detail["averageRating"], detail["reviewCount"]) == (3.5, 2)
    assert (profile["overallRating"], profile["reviewCount"]) == (3.5, 2)


@pytest.mark.parametrize("payload", [
    {"rating": 4, "comment": "Useful", "bookingId": "different-booking"},
    {"rating": 4, "comment": "Useful", "jobSeekerId": "another-person"},
    {"rating": 4, "comment": "x" * 4001},
    {"rating": 2.5, "comment": "Fractional score"},
])
def test_invalid_review_metadata_cannot_publish_or_change_existing_ratings(
    client, db_session, service, job_seeker_headers, payload,
):
    """US-53: reject identity injection and contract boundaries atomically."""
    first = _completed_booking(client, db_session, service, job_seeker_headers, day=2)
    _body(_review(client, job_seeker_headers, first, 3, "Existing legitimate review"), 201)
    second = _completed_booking(client, db_session, service, job_seeker_headers, day=3)
    before = _rating_views(client, service.id, service.counsellor_id)
    rejected = client.post(
        f"/api/v1/bookings/{second['id']}/review", headers=job_seeker_headers, json=payload,
    )
    assert rejected.status_code == 400
    assert rejected.json()["code"] == "VALIDATION_ERROR"
    assert _rating_views(client, service.id, service.counsellor_id) == before
    with SessionLocal() as db:
        assert list(db.scalars(select(Review.booking_id))) == [first["id"]]


def test_full_length_unicode_review_round_trips_without_losing_text(
    client, db_session, service, job_seeker_headers,
):
    """US-53/54: the accepted 4,000-character limit includes Unicode comments."""
    booking = _completed_booking(client, db_session, service, job_seeker_headers)
    comment = "谢谢🙂 " * 1000
    assert len(comment) == 4000
    saved = _body(_review(client, job_seeker_headers, booking, 5, comment), 201)
    assert saved["comment"] == comment.strip()
    assert _body(client.get(f"/api/v1/services/{service.id}"))["reviews"] == [saved]


def test_verification_rejection_resubmission_and_approval_change_real_publish_permission(
    client, db_session, counsellor, counsellor_headers, platform_owner_headers, monkeypatch,
):
    """US-31/32/33/58: corrected submission replaces stale rejection for the same session."""
    from app.mail import messages

    notifications = []
    monkeypatch.setattr(messages, "verification_decided", lambda *args: notifications.append(args))
    counsellor.verification_status = "pending"
    db_session.commit()
    path = f"/api/v1/admin/verifications/{counsellor.id}"
    offering = {
        "title": "Interview practice", "description": "Practical feedback",
        "priceMinor": 9000, "currency": "AUD", "modalities": ["online"],
    }
    submitted = _body(client.post(
        "/api/v1/me/verification-submissions", headers=counsellor_headers,
        json={"linkedInUrl": "https://www.linkedin.com/in/qa-first-profile"},
    ), 201)
    assert _body(client.get(path, headers=platform_owner_headers)) == submitted
    unpublished = client.post("/api/v1/me/services", headers=counsellor_headers, json=offering)
    assert unpublished.status_code == 403
    rejected = _body(client.post(f"{path}/decision", headers=platform_owner_headers, json={
        "decision": "rejected", "reason": "Make your work experience visible",
    }))
    assert rejected["status"] == "rejected"
    assert _body(client.get(path, headers=platform_owner_headers)) == rejected
    assert _body(client.get("/api/v1/admin/verifications", headers=platform_owner_headers)) == []

    resubmitted = _body(client.post(
        "/api/v1/me/verification-submissions", headers=counsellor_headers,
        json={"linkedInUrl": "https://www.linkedin.com/in/qa-corrected-profile"},
    ), 201)
    assert resubmitted["id"] == submitted["id"]
    assert resubmitted["status"] == "pending"
    assert resubmitted["decisionReason"] is None and resubmitted["decidedAt"] is None
    assert _body(client.get(path, headers=platform_owner_headers)) == resubmitted
    queue = _body(client.get("/api/v1/admin/verifications", headers=platform_owner_headers))
    assert queue == [resubmitted]
    approved = _body(client.post(f"{path}/decision", headers=platform_owner_headers, json={
        "decision": "verified", "reason": "Experience verified",
    }))
    assert _body(client.get(path, headers=platform_owner_headers)) == approved
    published = _body(client.post(
        "/api/v1/me/services", headers=counsellor_headers, json=offering,
    ), 201)
    assert _body(client.get(f"/api/v1/services/{published['id']}"))["counsellor"][
        "verificationStatus"
    ] == "verified"
    assert [call[2] for call in notifications] == ["rejected", "verified"]


def _calendar_state(client, counsellor_headers, service_id, window_id):
    calendar = _body(client.get("/api/v1/me/availability-windows", headers=counsellor_headers))
    window = next(row for row in calendar if row["id"] == window_id)
    own = next(row for row in _body(client.get("/api/v1/me/services", headers=counsellor_headers))
               if row["id"] == service_id)
    slots = _body(client.get(f"/api/v1/services/{service_id}/slots"))
    assert own["nextAvailableAt"] == (slots[0]["startsAt"] if slots else None)
    return window, own, slots


def test_expired_hold_restores_calendar_minutes_and_public_next_time_without_cleanup_job(
    client, db_session, service, counsellor_headers, job_seeker_headers,
):
    """US-40/41 follow-up: every read releases an expired unpaid hold consistently."""
    window = _window(db_session, service, minutes=service.duration_minutes)
    before = _calendar_state(client, counsellor_headers, service.id, window.id)
    assert before[0]["freeMinutes"] == service.duration_minutes
    assert len(before[2]) == 1
    order = _order(client, job_seeker_headers, service, window.starts_at)
    held = _calendar_state(client, counsellor_headers, service.id, window.id)
    assert held[0]["freeMinutes"] == 0 and held[0]["hasBookings"] is False
    assert held[2] == []

    # Deterministic expiry fixture; no wall-clock sleep or cleanup operation.
    db_session.get(Order, order["id"]).hold_expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()
    released = _calendar_state(client, counsellor_headers, service.id, window.id)
    assert released == before
    with SessionLocal() as db:
        assert db.get(Order, order["id"]).status == "awaiting_payment"
    replacement = _order(client, job_seeker_headers, service, window.starts_at)
    assert replacement["id"] != order["id"]


def test_paid_rescheduled_and_cancelled_session_updates_calendar_and_admin_order_together(
    client, db_session, service, counsellor_headers, job_seeker_headers, platform_owner_headers,
):
    """US-48/69 plus availability: moving a booking keeps its order, frees the old span."""
    first = _window(db_session, service, day=2, minutes=service.duration_minutes)
    second = _window(db_session, service, day=3, minutes=service.duration_minutes)
    order = _order(client, job_seeker_headers, service, first.starts_at)
    booking = _pay(client, job_seeker_headers, order)
    before_admin = _body(client.get(
        f"/api/v1/admin/payments/{order['id']}", headers=platform_owner_headers,
    ))
    booked = _calendar_state(client, counsellor_headers, service.id, first.id)
    assert booked[0]["freeMinutes"] == 0 and booked[0]["hasBookings"] is True

    moved = _body(client.post(f"/api/v1/bookings/{booking['id']}/reschedule",
                             headers=job_seeker_headers, json={
                                 "startsAt": second.starts_at.isoformat(),
                                 "modality": "online", "timezone": "Australia/Melbourne",
                             }))
    assert moved["id"] == booking["id"] and moved["orderId"] == order["id"]
    old = _calendar_state(client, counsellor_headers, service.id, first.id)
    new = _calendar_state(client, counsellor_headers, service.id, second.id)
    assert old[0]["freeMinutes"] == service.duration_minutes
    assert old[0]["hasBookings"] is False
    assert new[0]["freeMinutes"] == 0 and new[0]["hasBookings"] is True
    after_admin = _body(client.get(
        f"/api/v1/admin/payments/{order['id']}", headers=platform_owner_headers,
    ))
    assert after_admin["startsAt"] == moved["startsAt"]
    assert after_admin["endsAt"] == moved["endsAt"]
    for key in ("bookingId", "amountMinor", "platformFeeMinor", "counsellorPayoutMinor"):
        assert after_admin[key] == before_admin[key]

    cancelled = _body(client.post(
        f"/api/v1/bookings/{booking['id']}/cancel", headers=counsellor_headers,
    ))
    assert cancelled["booking"]["status"] == "cancelled"
    released = _calendar_state(client, counsellor_headers, service.id, second.id)
    assert released[0]["freeMinutes"] == service.duration_minutes
    assert released[0]["hasBookings"] is False
    assert len(released[2]) == 2
    detail = _body(client.get(
        f"/api/v1/admin/payments/{order['id']}", headers=platform_owner_headers,
    ))
    assert detail["bookingStatus"] == "cancelled"


def test_reschedule_commit_failure_preserves_booking_order_calendar_and_can_retry(
    client, db_session, service, counsellor_headers, job_seeker_headers,
    platform_owner_headers, fail_commit_after_flush,
):
    """US-69 AC4: failure after both SQL updates cannot partially move a session."""
    first = _window(db_session, service, day=2, minutes=service.duration_minutes)
    second = _window(db_session, service, day=3, minutes=service.duration_minutes)
    order = _order(client, job_seeker_headers, service, first.starts_at)
    booking = _pay(client, job_seeker_headers, order)
    booking_path = f"/api/v1/bookings/{booking['id']}"
    order_path = f"/api/v1/orders/{order['id']}"
    admin_path = f"/api/v1/admin/payments/{order['id']}"
    before = (
        _body(client.get(booking_path, headers=job_seeker_headers)),
        _body(client.get(order_path, headers=job_seeker_headers)),
        _body(client.get(admin_path, headers=platform_owner_headers)),
        _calendar_state(client, counsellor_headers, service.id, first.id),
        _calendar_state(client, counsellor_headers, service.id, second.id),
    )
    payload = {"startsAt": second.starts_at.isoformat(),
               "modality": "online", "timezone": "Australia/Melbourne"}
    with fail_commit_after_flush() as attempts:
        failed = client.post(f"{booking_path}/reschedule", headers=job_seeker_headers, json=payload)
    assert attempts == ["writes flushed; commit refused"]
    assert failed.status_code == 500 and failed.json()["code"] == "INTERNAL_ERROR"
    assert "QA pre-commit" not in failed.text
    after = (
        _body(client.get(booking_path, headers=job_seeker_headers)),
        _body(client.get(order_path, headers=job_seeker_headers)),
        _body(client.get(admin_path, headers=platform_owner_headers)),
        _calendar_state(client, counsellor_headers, service.id, first.id),
        _calendar_state(client, counsellor_headers, service.id, second.id),
    )
    assert after == before
    with SessionLocal() as db:
        stored_booking = db.get(Booking, booking["id"])
        stored_order = db.get(Order, order["id"])
        assert stored_booking.starts_at == stored_order.starts_at == first.starts_at
        assert stored_booking.window_id == stored_order.window_id == first.id

    retried = _body(client.post(
        f"{booking_path}/reschedule", headers=job_seeker_headers, json=payload,
    ))
    assert retried["startsAt"] == second.starts_at.isoformat().replace("+00:00", "Z")
    assert _body(client.get(admin_path, headers=platform_owner_headers))["startsAt"] == retried[
        "startsAt"
    ]
    with SessionLocal() as db:
        assert len(list(db.scalars(select(Booking)))) == len(list(db.scalars(select(Order)))) == 1
