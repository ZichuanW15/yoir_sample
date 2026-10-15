"""Remaining implemented Sprint 3 API boundaries, reviewed 16 October 2026.

Real request handlers and isolated database transactions exercise failure/retry,
verification readers, withdrawn-service history and privacy refresh. Only a
pre-commit database fault and decision-email delivery are injected. Payment uses
the existing stub; historical completion/payout are explicit database fixtures,
not evidence of a real provider transfer, notification inbox or device run.
"""

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, get_db
from app.mail import messages
from app.main import app
from app.models import AvailabilityWindow, Booking, Order, Service, User

OWN_PROFILE = "/api/v1/me/counsellor-profile"
VISIBILITY = "/api/v1/me/profile-visibility"
OFFERING = {
    "title": "Interview confidence", "description": "Practice and feedback",
    "priceMinor": 9850, "durationMinutes": 60, "currency": "AUD",
    "modalities": ["online"],
}


def _body(response, status=200):
    assert response.status_code == status, response.text
    return response.json()


def _internal_error(response):
    assert response.status_code == 500, response.text
    body = response.json()
    assert body["code"] == "INTERNAL_ERROR" and body["requestId"]
    assert "completion QA" not in response.text


@pytest.fixture
def refused_commit(monkeypatch):
    """Actually write SQL, refuse commit, then read through unrelated sessions.

    Recording each dirty row after flush proves the endpoint reached its write
    boundary. Session close performs the ordinary transaction rollback; this
    fixture never rolls back product data on behalf of a successful response.
    """
    @contextmanager
    def inject():
        flushed = []

        def database():
            with SessionLocal() as db:
                def fail():
                    changed = list(db.dirty) + list(db.new)
                    db.flush()
                    flushed.append([
                        (type(row).__name__, row.id) for row in changed
                    ])
                    raise OperationalError(
                        "completion QA refused commit", {}, RuntimeError("injected fault"),
                    )

                with monkeypatch.context() as patch:
                    patch.setattr(db, "commit", fail)
                    yield db

        with monkeypatch.context() as patch:
            patch.setitem(app.dependency_overrides, get_db, database)
            yield flushed

    return inject


def _verification_views(client, identifier, counsellor_headers, owner_headers):
    root = f"/api/v1/admin/verifications/{identifier}"
    return {
        "submission": _body(client.get(root, headers=owner_headers)),
        "queue": _body(client.get(
            "/api/v1/admin/verifications?status=all", headers=owner_headers,
        )),
        "own": _body(client.get(OWN_PROFILE, headers=counsellor_headers)),
        "public": _body(client.get(f"/api/v1/counsellors/{identifier}")),
        "admin_user": next(row for row in _body(client.get(
            "/api/v1/admin/counsellors", headers=owner_headers,
        )) if row["id"] == identifier),
    }


def _status_agrees(views, expected):
    assert views["submission"]["status"] == expected
    assert views["queue"][0]["status"] == expected
    for source in ("own", "public", "admin_user"):
        assert views[source]["verificationStatus"] == expected


@pytest.mark.parametrize("original,decision", [
    ("pending", "verified"), ("pending", "rejected"),
    ("verified", "pending"), ("rejected", "verified"),
])
def test_failed_verification_decision_retains_all_readers_and_sends_no_email_then_retries(
    client, db_session, counsellor, counsellor_headers, platform_owner_headers,
    monkeypatch, refused_commit, original, decision,
):
    """US-32/33/58: a refused transaction cannot approve/reject only one reader."""
    counsellor.verification_status = original
    counsellor.linkedin_url = "https://www.linkedin.com/in/qa-original"
    counsellor.verification_submitted_at = datetime.now(UTC) - timedelta(days=2)
    counsellor.verification_decided_at = datetime.now(UTC) - timedelta(days=1)
    counsellor.verification_decision_reason = "Original investigation"
    db_session.commit()
    identifier = counsellor.id
    sent = []
    monkeypatch.setattr(messages, "verification_decided", lambda *args: sent.append(args))
    before = _verification_views(client, identifier, counsellor_headers, platform_owner_headers)
    _status_agrees(before, original)
    payload = {"decision": decision, "reason": "  Updated investigation  "}
    path = f"/api/v1/admin/verifications/{identifier}/decision"

    with refused_commit() as flushed:
        _internal_error(client.post(path, headers=platform_owner_headers, json=payload))
    assert flushed == [[("User", identifier)]]
    assert sent == []
    assert _verification_views(
        client, identifier, counsellor_headers, platform_owner_headers,
    ) == before
    with SessionLocal() as db:
        stored = db.get(User, identifier)
        assert stored.verification_status == original
        assert stored.verification_decision_reason == "Original investigation"

    retried = _body(client.post(path, headers=platform_owner_headers, json=payload))
    after = _verification_views(client, identifier, counsellor_headers, platform_owner_headers)
    _status_agrees(after, decision)
    assert after["submission"] == retried
    assert retried["decisionReason"] == "Updated investigation"
    assert retried["submittedAt"] == before["submission"]["submittedAt"]
    assert retried["decidedAt"] != before["submission"]["decidedAt"]
    assert sent == ([] if decision == "pending" else [(
        counsellor.email, counsellor.name, decision, "Updated investigation",
    )])
    published = client.post("/api/v1/me/services", headers=counsellor_headers, json=OFFERING)
    assert published.status_code == (201 if decision == "verified" else 403), published.text


@pytest.mark.parametrize("original", ["pending", "rejected"])
def test_failed_submission_preserves_link_decision_and_queue_until_successful_retry(
    client, db_session, counsellor, counsellor_headers, platform_owner_headers,
    refused_commit, original,
):
    """US-31/32: failed first submission/resubmission cannot claim a saved Pending state."""
    counsellor.verification_status = original
    counsellor.linkedin_url = None if original == "pending" else "https://linkedin.com/in/old-qa"
    counsellor.verification_submitted_at = None
    counsellor.verification_decided_at = (
        datetime.now(UTC) - timedelta(days=1) if original == "rejected" else None
    )
    counsellor.verification_decision_reason = "Prior rejection" if original == "rejected" else None
    db_session.commit()
    identifier = counsellor.id
    before = _verification_views(client, identifier, counsellor_headers, platform_owner_headers)
    payload = {"linkedInUrl": "https://www.linkedin.com/in/corrected-qa"}

    with refused_commit() as flushed:
        _internal_error(client.post(
            "/api/v1/me/verification-submissions", headers=counsellor_headers, json=payload,
        ))
    assert flushed == [[("User", identifier)]]
    assert _verification_views(
        client, identifier, counsellor_headers, platform_owner_headers,
    ) == before
    retried = _body(client.post(
        "/api/v1/me/verification-submissions", headers=counsellor_headers, json=payload,
    ), 201)
    after = _verification_views(client, identifier, counsellor_headers, platform_owner_headers)
    _status_agrees(after, "pending")
    assert after["submission"] == retried
    assert retried["linkedInUrl"] == payload["linkedInUrl"]
    assert retried["decisionReason"] is None and retried["decidedAt"] is None
    assert len(after["queue"]) == 1 and retried["id"] == identifier
    assert client.post(
        "/api/v1/me/services", headers=counsellor_headers, json=OFFERING,
    ).status_code == 403


def _book(client, db, service, seeker_headers, modality):
    service.modalities = [modality]
    service.location_state = "VIC" if modality == "in_person" else None
    service.location_city = "Melbourne" if modality == "in_person" else None
    start = (datetime.now(UTC) + timedelta(days=3)).replace(second=0, microsecond=0)
    window = AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start,
        ends_at=start + timedelta(hours=4), modalities=[modality],
    )
    db.add(window)
    db.commit()
    payload = {
        "serviceId": service.id, "startsAt": start.isoformat(), "modality": modality,
        "timezone": "Australia/Melbourne", "preSessionBrief": "Saved preparation note",
    }
    order = _body(client.post("/api/v1/orders", headers=seeker_headers, json=payload), 201)
    paid = _body(client.post(
        f"/api/v1/orders/{order['id']}/payments/stub", headers=seeker_headers,
    ))
    return paid["booking"], payload


def _trade_views(client, booking, seeker_headers, counsellor_headers, owner_headers):
    result = {
        "order": _body(client.get(
            f"/api/v1/orders/{booking['orderId']}", headers=seeker_headers,
        )),
        "admin_payment": _body(client.get(
            f"/api/v1/admin/payments/{booking['orderId']}", headers=owner_headers,
        )),
        "admin_bookings": _body(client.get("/api/v1/admin/bookings", headers=owner_headers)),
    }
    for actor, headers in (("seeker", seeker_headers), ("counsellor", counsellor_headers)):
        result[f"{actor}_detail"] = _body(client.get(
            f"/api/v1/bookings/{booking['id']}", headers=headers,
        ))
        result[f"{actor}_list"] = _body(client.get("/api/v1/me/bookings", headers=headers))
        result[f"{actor}_receipt"] = _body(client.get(
            f"/api/v1/bookings/{booking['id']}/receipt", headers=headers,
        ))
    return result


@pytest.mark.parametrize("modality", ["online", "in_person"])
@pytest.mark.parametrize("lifecycle", ["confirmed", "completed", "paid_out"])
def test_withdrawing_service_preserves_paid_booking_order_receipt_and_admin_history(
    client, db_session, service, job_seeker_headers, counsellor_headers,
    platform_owner_headers, modality, lifecycle,
):
    """US-36/42/43/48: delisting never erases an upcoming or historical paid purchase."""
    booking, payload = _book(client, db_session, service, job_seeker_headers, modality)
    if modality == "in_person":
        _body(client.patch(
            f"/api/v1/bookings/{booking['id']}/meeting-address",
            headers=counsellor_headers, json={"meetingAddress": "Level 2, 100 Collins Street"},
        ))
    if lifecycle != "confirmed":
        # Explicit historical fixture: no payout-provider execution is claimed.
        stored = db_session.get(Booking, booking["id"])
        order = db_session.get(Order, booking["orderId"])
        stored.starts_at = order.starts_at = datetime.now(UTC) - timedelta(days=3)
        stored.ends_at = order.ends_at = stored.starts_at + timedelta(hours=1)
        stored.status = lifecycle
        stored.completed_at = stored.ends_at
        if lifecycle == "paid_out":
            stored.paid_out_at = stored.ends_at + timedelta(days=1)
            stored.transfer_id = "qa-fixture-transfer-not-provider"
        db_session.commit()
    before = _trade_views(
        client, booking, job_seeker_headers, counsellor_headers, platform_owner_headers,
    )
    assert before["seeker_detail"]["status"] == lifecycle
    service_id = service.id
    for _ in range(2):
        assert client.delete(
            f"/api/v1/me/services/{service_id}", headers=counsellor_headers,
        ).status_code == 204
        assert _trade_views(
            client, booking, job_seeker_headers, counsellor_headers, platform_owner_headers,
        ) == before
    assert all(row["id"] != service_id for row in _body(client.get("/api/v1/services")))
    assert client.get(f"/api/v1/services/{service_id}").status_code == 404
    assert client.get(f"/api/v1/services/{service_id}/slots").status_code == 404
    own = _body(client.get("/api/v1/me/services", headers=counsellor_headers))
    assert own[0]["id"] == service_id and own[0]["active"] is False
    # Request a different, unoccupied time to isolate the inactive-service gate.
    payload["startsAt"] = (
        datetime.fromisoformat(payload["startsAt"]) + timedelta(hours=2)
    ).isoformat()
    blocked = client.post("/api/v1/orders", headers=job_seeker_headers, json=payload)
    assert blocked.status_code == 404 and blocked.json()["code"] == "NOT_FOUND"
    with SessionLocal() as db:
        assert db.get(Service, service_id).active is False
        assert len(list(db.scalars(select(Order)))) == 1
        assert len(list(db.scalars(select(Booking)))) == 1
        saved_booking = db.get(Booking, booking["id"])
        assert saved_booking.status == lifecycle and saved_booking.payment_status == "paid"


@pytest.mark.parametrize("operation", ["edit", "withdraw"])
def test_failed_service_change_preserves_listing_and_paid_history_then_same_request_retries(
    client, db_session, service, job_seeker_headers, counsellor_headers,
    platform_owner_headers, refused_commit, operation,
):
    """US-36: a transaction failure must not silently save/delist a paid service."""
    booking, _ = _book(client, db_session, service, job_seeker_headers, "online")
    service_id = service.id
    before_listing = _body(client.get(f"/api/v1/services/{service_id}"))
    before_trade = _trade_views(
        client, booking, job_seeker_headers, counsellor_headers, platform_owner_headers,
    )
    edit = {**OFFERING, "title": service.title, "description": "Changed description"}

    def request():
        path = f"/api/v1/me/services/{service_id}"
        if operation == "edit":
            return client.patch(path, headers=counsellor_headers, json=edit)
        return client.delete(path, headers=counsellor_headers)

    with refused_commit() as flushed:
        _internal_error(request())
    # update_service flushes before response mapping, so the fault's second flush
    # can have no dirty objects. The stored public snapshot below is authoritative.
    assert len(flushed) == 1
    assert _body(client.get(f"/api/v1/services/{service_id}")) == before_listing
    assert _trade_views(
        client, booking, job_seeker_headers, counsellor_headers, platform_owner_headers,
    ) == before_trade
    retried = request()
    assert retried.status_code == (200 if operation == "edit" else 204), retried.text
    assert _trade_views(
        client, booking, job_seeker_headers, counsellor_headers, platform_owner_headers,
    ) == before_trade
    with SessionLocal() as db:
        saved = db.get(Service, service_id)
        assert saved.active is (operation == "edit")
        if operation == "edit":
            assert saved.description == edit["description"]
        assert db.get(Order, booking["orderId"]).amount_minor == before_trade["order"][
            "order"
        ]["amountMinor"]


@pytest.mark.parametrize("requester", ["guest", "seeker", "owner"])
def test_loaded_public_profile_refresh_tracks_each_privacy_transition_without_data_loss(
    client, db_session, counsellor, service, counsellor_headers, job_seeker_headers, requester,
):
    """US-27/28: the same client must not retain a stale public response after a save."""
    counsellor.background = "Private background for refresh QA"
    counsellor.experience = "Private experience for refresh QA"
    counsellor.qualifications = ["Private qualification"]
    counsellor.linkedin_url = "https://www.linkedin.com/in/privacy-completion"
    db_session.commit()
    own_before = _body(client.get(OWN_PROFILE, headers=counsellor_headers))
    headers = {"guest": {}, "seeker": job_seeker_headers, "owner": counsellor_headers}[requester]
    path = f"/api/v1/counsellors/{counsellor.id}"
    initial = _body(client.get(path, headers=headers))
    assert initial["background"] == counsellor.background

    for level in ("partial", "restricted", "public", "restricted", "partial", "public"):
        assert _body(client.patch(
            VISIBILITY, headers=counsellor_headers, json={"visibility": level},
        )) == {"visibility": level}
        detail = _body(client.get(path, headers=headers))
        listed = next(row for row in _body(client.get(
            "/api/v1/counsellors", headers=headers,
        )) if row["id"] == counsellor.id)
        assert detail == listed and detail["visibility"] == level
        for field in ("background", "experience", "qualifications", "linkedinUrl"):
            if level == "public":
                assert detail[field] == own_before[field]
            else:
                # Redacted values must not leak. Omission versus empty values is
                # tracked by the separate existing privacy-contract defect test.
                assert not detail.get(field)
        assert detail["introduction"] == (
            "" if level == "restricted" else own_before["introduction"]
        )
        assert detail["displayName"] == own_before["displayName"]
        assert detail["verificationStatus"] == own_before["verificationStatus"]
        assert _body(client.get(OWN_PROFILE, headers=counsellor_headers)) == own_before
    assert _body(client.get(path, headers=headers)) == initial


@pytest.mark.parametrize("level", ["partial", "restricted"])
def test_counsellor_privacy_failed_commit_preserves_public_readers_and_retry_redacts(
    client, db_session, counsellor, service, counsellor_headers, refused_commit, level,
):
    """US-27/28: a failed privacy request has no hidden partial save in public readers."""
    counsellor.background = "Saved private background"
    db_session.commit()
    public_path = f"/api/v1/counsellors/{counsellor.id}"
    before = _body(client.get(public_path))
    payload = {"visibility": level}
    with refused_commit() as flushed:
        _internal_error(client.patch(VISIBILITY, headers=counsellor_headers, json=payload))
    assert flushed == [[("User", counsellor.id)]]
    assert _body(client.get(public_path)) == before
    assert _body(client.get(VISIBILITY, headers=counsellor_headers)) == {"visibility": "public"}
    _body(client.patch(VISIBILITY, headers=counsellor_headers, json=payload))
    assert not _body(client.get(public_path)).get("background")
    assert _body(client.get(OWN_PROFILE, headers=counsellor_headers))["background"] == (
        "Saved private background"
    )


def test_failed_counsellor_profile_save_keeps_public_onboarding_and_review_details_then_retries(
    client, counsellor, counsellor_headers, platform_owner_headers, refused_commit,
):
    """US-05/30/31: profile transaction rollback must also retain onboarding/review inputs."""
    before = _verification_views(
        client, counsellor.id, counsellor_headers, platform_owner_headers,
    )
    onboarding = _body(client.get("/api/v1/me/onboarding-state", headers=counsellor_headers))
    payload = {
        "linkedinUrl": "https://www.linkedin.com/in/completion-profile",
        "introduction": "Saved introduction", "background": "Saved background",
        "experience": "Saved experience", "qualifications": ["Qualification"],
        "expertise": ["Interview coaching"], "languages": ["English"],
        "baseLocation": {"state": "VIC", "cityOrRegion": "Melbourne"},
        "defaultModality": "in_person",
    }
    with refused_commit() as flushed:
        _internal_error(client.patch(OWN_PROFILE, headers=counsellor_headers, json=payload))
    assert flushed == [[("User", counsellor.id)]]
    assert _verification_views(
        client, counsellor.id, counsellor_headers, platform_owner_headers,
    ) == before
    assert _body(client.get(
        "/api/v1/me/onboarding-state", headers=counsellor_headers,
    )) == onboarding
    saved = _body(client.patch(OWN_PROFILE, headers=counsellor_headers, json=payload))
    for field, expected in payload.items():
        assert saved[field] == expected
    assert saved["verificationStatus"] == before["own"]["verificationStatus"]
    assert _body(client.get("/api/v1/me/onboarding-state", headers=counsellor_headers))["complete"]


@pytest.mark.parametrize("invalid_filter", ["approved", "", "PENDING", "pending,rejected"])
def test_invalid_review_queue_filter_is_explicit_error_and_does_not_change_submissions(
    client, counsellor, counsellor_headers, platform_owner_headers, invalid_filter,
):
    """US-58: a mistyped filter cannot silently hide a reviewer queue as an empty success."""
    before = _verification_views(
        client, counsellor.id, counsellor_headers, platform_owner_headers,
    )
    result = client.get(
        "/api/v1/admin/verifications", headers=platform_owner_headers,
        params={"status": invalid_filter},
    )
    assert result.status_code == 400 and result.json()["code"] == "VALIDATION_ERROR"
    assert "status" in result.json()["fieldErrors"]
    assert _verification_views(
        client, counsellor.id, counsellor_headers, platform_owner_headers,
    ) == before


@pytest.mark.parametrize("target", ["missing", "job_seeker", "platform_owner"])
def test_public_professional_detail_rejects_nonprofessional_ids_without_disclosing_profiles(
    client, job_seeker, platform_owner, target,
):
    """US-28/30: public profile paths cannot expose a seeker or platform owner's record."""
    identifier = {"missing": "qa-no-such-person", "job_seeker": job_seeker.id,
                  "platform_owner": platform_owner.id}[target]
    result = client.get(f"/api/v1/counsellors/{identifier}")
    assert result.status_code == 404 and result.json()["code"] == "NOT_FOUND"
    for secret in (job_seeker.email, platform_owner.email, job_seeker.name, platform_owner.name):
        assert secret not in result.text
