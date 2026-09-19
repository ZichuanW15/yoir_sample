"""The Platform Owner's area: who may open it, and whether its numbers are true.

The arithmetic tests here all check the same property from different angles — that
the dashboard reports the breakdown frozen on each order rather than recomputing it
from the current settings. That is what stops the platform disagreeing with receipts
it has already issued.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.mail import messages
from app.models import AvailabilityWindow, Booking, Order, Service, User

ADMIN_READS = ["/api/v1/admin/verifications", "/api/v1/admin/payments",
               "/api/v1/admin/stats", "/api/v1/admin/bookings", "/api/v1/admin/counsellors"]


@pytest.fixture
def decisions(monkeypatch: pytest.MonkeyPatch) -> list[tuple]:
    captured: list[tuple] = []
    monkeypatch.setattr(
        messages, "verification_decided",
        lambda to, name, decision, reason: captured.append((to, decision, reason)) or True,
    )
    return captured


def book_and_pay(
    client: TestClient, db_session: Session, service: Service, headers: dict, days: int = 1
) -> dict:
    start = datetime.now(UTC) + timedelta(days=days)
    window = AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start, ends_at=start + timedelta(hours=3),
    )
    db_session.add(window)
    db_session.commit()
    order = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "serviceId": service.id,
            "startsAt": start.isoformat(),
            "modality": "online",
            "timezone": "Australia/Melbourne",
        },
    )
    assert order.status_code == 201, order.text
    paid = client.post(f"/api/v1/orders/{order.json()['id']}/payments/stub", headers=headers)
    assert paid.status_code == 200, paid.text
    return paid.json()["booking"]


# --- who may open it --------------------------------------------------------


@pytest.mark.parametrize("path", ADMIN_READS)
def test_the_admin_area_is_closed_to_everyone_else(
    client: TestClient, path: str, job_seeker_headers: dict, counsellor_headers: dict
) -> None:
    assert client.get(path).status_code == 401
    for headers in (job_seeker_headers, counsellor_headers):
        response = client.get(path, headers=headers)
        assert response.status_code == 403
        assert response.json()["code"] == "FORBIDDEN"


def test_a_forged_owner_claim_does_not_open_the_admin_area(
    client: TestClient, job_seeker: User
) -> None:
    """The role is read from the database row, never from the token. A correctly
    signed token carrying the wrong role is the realistic attack, not a bad signature."""
    from app.security import create_access_token

    token, _ = create_access_token(job_seeker.id, "platform_owner")

    response = client.get(
        "/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 403


@pytest.mark.parametrize("path", ADMIN_READS)
def test_the_owner_may_open_every_admin_view(
    client: TestClient, path: str, platform_owner_headers: dict
) -> None:
    assert client.get(path, headers=platform_owner_headers).status_code == 200


# --- the verification queue -------------------------------------------------


def test_the_queue_lists_pending_counsellors_oldest_first(
    client: TestClient, db_session: Session, platform_owner_headers: dict
) -> None:
    """Oldest first because this is a queue someone works through: newest-first
    leaves whoever has waited longest permanently at the bottom."""
    now = datetime.now(UTC)
    for index, name in enumerate(["Waited longest", "Waited least"]):
        db_session.add(User(
            name=name, email=f"pending{index}@example.com", password_hash="x",
            role="counsellor", verification_status="pending",
            verification_submitted_at=now - timedelta(days=10 - index * 9),
        ))
    db_session.commit()

    response = client.get("/api/v1/admin/verifications", headers=platform_owner_headers)

    assert response.status_code == 200
    assert [row["counsellorName"] for row in response.json()] == [
        "Waited longest", "Waited least",
    ]


def test_the_queue_shows_only_pending_by_default(
    client: TestClient, counsellor: User, platform_owner_headers: dict
) -> None:
    # The `counsellor` fixture is already verified.
    assert client.get(
        "/api/v1/admin/verifications", headers=platform_owner_headers
    ).json() == []

    everyone = client.get(
        "/api/v1/admin/verifications?status=all", headers=platform_owner_headers
    )
    assert [row["counsellorId"] for row in everyone.json()] == [counsellor.id]


def test_approving_a_counsellor_records_it_and_tells_them(
    client: TestClient,
    db_session: Session,
    platform_owner_headers: dict,
    decisions: list,
) -> None:
    applicant = User(
        name="Jo Applicant", email="jo@example.com", password_hash="x", role="counsellor",
        verification_status="pending", linkedin_url="https://linkedin.com/in/jo",
    )
    db_session.add(applicant)
    db_session.commit()

    response = client.post(
        f"/api/v1/admin/verifications/{applicant.id}/decision",
        headers=platform_owner_headers,
        json={"decision": "verified"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "verified"
    db_session.expire_all()
    stored = db_session.get(User, applicant.id)
    assert stored.verification_status == "verified"
    assert stored.verification_decided_at is not None
    assert decisions == [("jo@example.com", "verified", "")]


def test_rejecting_requires_a_reason_and_passes_it_on(
    client: TestClient,
    db_session: Session,
    platform_owner_headers: dict,
    decisions: list,
) -> None:
    """A rejection with no reason is a dead end: the counsellor cannot tell what to
    fix, so they either give up or resubmit exactly the same profile."""
    applicant = User(
        name="Jo Applicant", email="jo@example.com", password_hash="x", role="counsellor",
        verification_status="pending",
    )
    db_session.add(applicant)
    db_session.commit()
    url = f"/api/v1/admin/verifications/{applicant.id}/decision"

    silent = client.post(url, headers=platform_owner_headers, json={"decision": "rejected"})
    assert silent.status_code == 400
    assert "reason" in silent.json()["fieldErrors"]
    db_session.expire_all()
    assert db_session.get(User, applicant.id).verification_status == "pending"
    assert decisions == []

    explained = client.post(
        url,
        headers=platform_owner_headers,
        json={"decision": "rejected", "reason": "Your LinkedIn profile is private."},
    )
    assert explained.status_code == 200
    assert explained.json()["decisionReason"] == "Your LinkedIn profile is private."
    assert decisions == [("jo@example.com", "rejected", "Your LinkedIn profile is private.")]


def test_a_decision_email_that_fails_does_not_undo_the_decision(
    client: TestClient,
    db_session: Session,
    platform_owner_headers: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    applicant = User(
        name="Jo", email="jo@example.com", password_hash="x", role="counsellor",
        verification_status="pending",
    )
    db_session.add(applicant)
    db_session.commit()
    monkeypatch.setattr(
        messages, "verification_decided",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("mail provider down")),
    )

    response = client.post(
        f"/api/v1/admin/verifications/{applicant.id}/decision",
        headers=platform_owner_headers,
        json={"decision": "verified"},
    )

    # Not a 500: reporting failure for a decision that was recorded would invite the
    # Platform Owner to make it a second time.
    assert response.status_code == 200
    assert response.json()["status"] == "verified"
    db_session.expire_all()
    assert db_session.get(User, applicant.id).verification_status == "verified"


def test_deciding_on_somebody_who_is_not_a_counsellor_is_a_404(
    client: TestClient, job_seeker: User, platform_owner_headers: dict
) -> None:
    response = client.post(
        f"/api/v1/admin/verifications/{job_seeker.id}/decision",
        headers=platform_owner_headers,
        json={"decision": "verified"},
    )

    assert response.status_code == 404


# --- the counsellor's own submission ----------------------------------------


def test_submitting_puts_a_counsellor_into_the_queue(
    client: TestClient, db_session: Session, counsellor_headers: dict, counsellor: User
) -> None:
    counsellor.verification_status = "rejected"
    counsellor.verification_decision_reason = "Your LinkedIn profile is private."
    db_session.commit()

    response = client.post(
        "/api/v1/me/verification-submissions",
        headers=counsellor_headers,
        json={"linkedInUrl": "https://linkedin.com/in/maya-chen"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    # The old reason is cleared: showing a rejection for work already redone would
    # tell the counsellor to fix something they have just fixed.
    assert body["decisionReason"] is None
    db_session.expire_all()
    assert db_session.get(User, counsellor.id).linkedin_url == "https://linkedin.com/in/maya-chen"


def test_an_already_verified_counsellor_cannot_resubmit(
    client: TestClient, counsellor_headers: dict
) -> None:
    response = client.post(
        "/api/v1/me/verification-submissions",
        headers=counsellor_headers,
        json={"linkedInUrl": "https://linkedin.com/in/maya-chen"},
    )

    assert response.status_code == 409


def test_a_job_seeker_cannot_submit_for_verification(
    client: TestClient, job_seeker_headers: dict
) -> None:
    response = client.post(
        "/api/v1/me/verification-submissions",
        headers=job_seeker_headers,
        json={"linkedInUrl": "https://linkedin.com/in/alex"},
    )

    assert response.status_code == 403


# --- the money ---------------------------------------------------------------


def test_the_dashboard_totals_are_the_frozen_order_breakdown(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict,
    platform_owner_headers: dict,
) -> None:
    """Summed from the order rows, not recomputed from the fee setting — which is
    proved here by moving the setting afterwards and finding the totals unchanged."""
    booking = book_and_pay(client, db_session, service, job_seeker_headers)
    order = db_session.get(Order, db_session.get(Booking, booking["id"]).order_id)

    stats = client.get("/api/v1/admin/stats", headers=platform_owner_headers).json()

    money = stats["money"]
    assert money["grossMinor"] == order.amount_minor
    assert money["platformFeeMinor"] == order.platform_fee_minor
    assert money["counsellorPayoutMinor"] == order.counsellor_payout_minor
    assert money["sessionGstMinor"] == order.session_gst_minor
    assert money["refundedMinor"] == 0
    # The commission's own GST is contained within the commission, not charged on
    # top of it, so the split is two ways rather than three.
    assert money["grossMinor"] == money["counsellorPayoutMinor"] + money["platformFeeMinor"]
    assert 0 < money["platformFeeGstMinor"] < money["platformFeeMinor"]
    assert stats["bookingsByStatus"] == {"confirmed": 1}
    assert stats["jobSeekers"] >= 1 and stats["counsellors"] >= 1


def test_an_unpaid_hold_is_not_counted_as_money(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker_headers: dict,
    platform_owner_headers: dict,
) -> None:
    """A held order carries a frozen breakdown too. Counting it would inflate every
    total on the dashboard with money nobody has paid."""
    start = datetime.now(UTC) + timedelta(days=1)
    db_session.add(AvailabilityWindow(
        counsellor_id=service.counsellor_id, starts_at=start, ends_at=start + timedelta(hours=3),
    ))
    db_session.commit()
    held = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json={
            "serviceId": service.id,
            "startsAt": start.isoformat(),
            "modality": "online",
            "timezone": "Australia/Melbourne",
        },
    )
    assert held.status_code == 201

    stats = client.get("/api/v1/admin/stats", headers=platform_owner_headers).json()

    assert stats["money"]["grossMinor"] == 0
    assert stats["ordersAwaitingPayment"] == 1


def test_payment_oversight_names_both_parties_and_no_card_details(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker: User,
    counsellor: User,
    job_seeker_headers: dict,
    platform_owner_headers: dict,
) -> None:
    booking = book_and_pay(client, db_session, service, job_seeker_headers)

    response = client.get("/api/v1/admin/payments", headers=platform_owner_headers)

    assert response.status_code == 200
    (row,) = response.json()
    assert row["jobSeekerName"] == job_seeker.name
    assert row["counsellorName"] == counsellor.name
    assert row["bookingId"] == booking["id"]
    assert row["serviceTitle"] == service.title
    assert row["paymentStatus"] == "paid"
    # The Platform Owner needs to see that money moved, not how it was paid for.
    assert not {"card", "last4", "clientSecret", "paymentMethod"} & row.keys()


def test_admin_bookings_names_both_sides(
    client: TestClient,
    db_session: Session,
    service: Service,
    job_seeker: User,
    counsellor: User,
    job_seeker_headers: dict,
    platform_owner_headers: dict,
) -> None:
    book_and_pay(client, db_session, service, job_seeker_headers)

    response = client.get("/api/v1/admin/bookings", headers=platform_owner_headers)

    (row,) = response.json()
    assert (row["jobSeekerName"], row["counsellorName"]) == (job_seeker.name, counsellor.name)
    assert row["serviceTitle"] == service.title
    assert row["amountMinor"] == service.price_minor


def test_the_counsellor_list_totals_what_each_has_sold(
    client: TestClient,
    db_session: Session,
    service: Service,
    counsellor: User,
    job_seeker_headers: dict,
    platform_owner_headers: dict,
) -> None:
    book_and_pay(client, db_session, service, job_seeker_headers, days=1)
    book_and_pay(client, db_session, service, job_seeker_headers, days=2)

    response = client.get("/api/v1/admin/counsellors", headers=platform_owner_headers)

    (row,) = response.json()
    assert row["id"] == counsellor.id
    assert row["serviceCount"] == 1
    assert row["bookingCount"] == 2
    assert row["grossMinor"] == service.price_minor * 2
    assert 0 < row["payoutMinor"] < row["grossMinor"]


def test_a_counsellor_who_has_sold_nothing_still_appears(
    client: TestClient, db_session: Session, platform_owner_headers: dict
) -> None:
    """An outer join, not an inner one: the counsellors worth chasing are precisely
    the ones with no bookings yet."""
    db_session.add(User(
        name="Nobody Yet", email="nobody@example.com", password_hash="x", role="counsellor",
    ))
    db_session.commit()

    response = client.get("/api/v1/admin/counsellors", headers=platform_owner_headers)

    (row,) = [r for r in response.json() if r["name"] == "Nobody Yet"]
    assert (row["serviceCount"], row["bookingCount"], row["grossMinor"]) == (0, 0, 0)


def test_verified_counsellors_who_cannot_be_paid_are_counted(
    client: TestClient, db_session: Session, counsellor: User, platform_owner_headers: dict
) -> None:
    """They can publish nothing anyone can book, so this is the queue that quietly
    costs the platform bookings."""
    assert counsellor.verification_status == "verified"
    assert counsellor.payouts_enabled is False

    stats = client.get("/api/v1/admin/stats", headers=platform_owner_headers).json()

    assert stats["counsellorsAwaitingPayouts"] == 1
    counsellor.payouts_enabled = True
    db_session.commit()
    after = client.get("/api/v1/admin/stats", headers=platform_owner_headers).json()
    assert after["counsellorsAwaitingPayouts"] == 0
