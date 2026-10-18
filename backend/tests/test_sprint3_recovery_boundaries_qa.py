"""Implemented payment recovery boundaries missing from normal-path coverage.

Stripe SDK calls use the existing recording fake; signatures use real local HMAC
verification. These are application/database tests, not provider acceptance. No
live credentials, transfers, notifications or mailbox delivery are involved.
"""

from datetime import UTC, datetime, timedelta

import pytest
import test_payments as payment_fixtures
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from test_payments import (
    CONNECT_SECRET,
    PLATFORM_SECRET,
    add_window,
    complete_long_ago,
    create_order,
    post_webhook,
    succeeded_event,
)

from app.db import SessionLocal, get_db
from app.main import app
from app.models import Booking, Order, ProcessedWebhookEvent, User
from app.payments import gateway, jobs

WEBHOOK = "/api/v1/payments/stripe/webhook"
CONNECT = f"{WEBHOOK}/connect"

# Reuse the existing test-only provider fixture graph without loading duplicate
# tests or registering that test module globally as a pytest plugin.
confirmed_booking = payment_fixtures.confirmed_booking
paid_order = payment_fixtures.paid_order
payable_counsellor = payment_fixtures.payable_counsellor
stripe_api = payment_fixtures.stripe_api
stripe_enabled = payment_fixtures.stripe_enabled


def _ack(response):
    assert response.status_code == 200, response.text
    assert response.json() == {"received": True}


def _event(identifier, kind, payload):
    return {"id": identifier, "type": kind, "data": {"object": payload}}


def _second_order(client, db, service, headers):
    window = add_window(db, service, starts_at=datetime.now(UTC) + timedelta(days=5))
    response = create_order(client, service, window, headers)
    assert response.status_code == 201, response.text
    order_id = response.json()["id"]
    intent = client.post(f"/api/v1/orders/{order_id}/payment-intents", headers=headers)
    assert intent.status_code == 200, intent.text
    return order_id, intent.json()["paymentIntentId"]


def test_signed_success_recovers_intent_metadata_when_its_id_was_not_persisted(
    client, db_session, paid_order, stripe_api,
):
    """The provider can finish between creating an intent and saving its identifier."""
    order_id, intent_id = paid_order
    db_session.get(Order, order_id).payment_intent_id = None
    db_session.commit()
    event = succeeded_event("evt_metadata_recovery", intent_id, order_id)
    _ack(post_webhook(client, WEBHOOK, event, PLATFORM_SECRET))
    _ack(post_webhook(client, WEBHOOK, event, PLATFORM_SECRET))
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        assert (order.status, order.payment_status, order.payment_intent_id) == (
            "confirmed", "paid", intent_id,
        )
        bookings = list(db.scalars(select(Booking).where(Booking.order_id == order_id)))
        assert len(bookings) == 1 and bookings[0].payment_status == "paid"
        assert db.get(ProcessedWebhookEvent, event["id"]) is not None
    assert stripe_api.refunds == [] and stripe_api.transfers == []


@pytest.mark.parametrize("kind,payload", [
    ("payment_intent.succeeded", {"id": "pi_no_order", "metadata": {}}),
    ("payment_intent.succeeded", {"id": "pi_no_order", "metadata": {"order_id": "missing"}}),
    ("charge.dispute.created", {"id": "dp_no_intent", "reason": "fraudulent"}),
])
def test_unrelated_signed_delivery_is_acknowledged_without_changing_a_real_order(
    client, db_session, paid_order, stripe_api, kind, payload,
):
    """No retry storm or accidental claim of a similarly timed, unrelated purchase."""
    order_id, intent_id = paid_order
    event = _event("evt_unrelated", kind, payload)
    _ack(post_webhook(client, WEBHOOK, event, PLATFORM_SECRET))
    _ack(post_webhook(client, WEBHOOK, event, PLATFORM_SECRET))
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        assert (order.status, order.payment_status, order.payment_intent_id) == (
            "awaiting_payment", "not_started", intent_id,
        )
        assert list(db.scalars(select(Booking))) == []
        assert len(list(db.scalars(select(ProcessedWebhookEvent)))) == 1
    assert stripe_api.refunds == [] and stripe_api.transfers == []


def test_late_payment_failed_delivery_cannot_regress_an_already_confirmed_purchase(
    client, confirmed_booking, stripe_api,
):
    identifier, order_id = confirmed_booking.id, confirmed_booking.order_id
    with SessionLocal() as db:
        intent_id = db.get(Order, order_id).payment_intent_id
    event = _event("evt_late_failure", "payment_intent.payment_failed", {"id": intent_id})
    _ack(post_webhook(client, WEBHOOK, event, PLATFORM_SECRET))
    with SessionLocal() as db:
        booking = db.get(Booking, identifier)
        order = db.get(Order, order_id)
        assert (booking.status, booking.payment_status) == ("confirmed", "paid")
        assert (order.status, order.payment_status) == ("confirmed", "paid")
        assert len(list(db.scalars(select(Booking)))) == 1
    assert stripe_api.refunds == [] and stripe_api.cancellations == []


def test_webhook_database_failure_releases_event_claim_and_booking_for_same_delivery_retry(
    client, paid_order, stripe_api, monkeypatch,
):
    """A claim and its application effect are atomic, so a failed delivery is retryable."""
    order_id, intent_id = paid_order
    event = succeeded_event("evt_transaction_retry", intent_id, order_id)
    attempts = []

    def broken_transaction():
        with SessionLocal() as db:
            def refuse_commit():
                db.flush()
                attempts.append((
                    db.get(ProcessedWebhookEvent, event["id"]) is not None,
                    db.scalar(select(Booking).where(Booking.order_id == order_id)) is not None,
                ))
                raise OperationalError("QA webhook transaction", {}, RuntimeError("fault"))

            with monkeypatch.context() as patch:
                patch.setattr(db, "commit", refuse_commit)
                yield db

    with monkeypatch.context() as patch:
        patch.setitem(app.dependency_overrides, get_db, broken_transaction)
        failed = post_webhook(client, WEBHOOK, event, PLATFORM_SECRET)
    assert failed.status_code == 500 and failed.json()["code"] == "INTERNAL_ERROR"
    assert "QA webhook transaction" not in failed.text
    assert attempts == [(True, True)]
    with SessionLocal() as db:
        assert db.get(ProcessedWebhookEvent, event["id"]) is None
        assert db.scalar(select(Booking).where(Booking.order_id == order_id)) is None
        order = db.get(Order, order_id)
        assert (order.status, order.payment_status) == ("awaiting_payment", "not_started")
    _ack(post_webhook(client, WEBHOOK, event, PLATFORM_SECRET))
    _ack(post_webhook(client, WEBHOOK, event, PLATFORM_SECRET))
    with SessionLocal() as db:
        assert len(list(db.scalars(select(Booking).where(Booking.order_id == order_id)))) == 1
        assert len(list(db.scalars(select(ProcessedWebhookEvent)))) == 1
        assert db.get(Order, order_id).payment_status == "paid"


def test_failed_hold_cancellation_does_not_block_other_rows_and_next_tick_recovers(
    client, db_session, service, job_seeker_headers, paid_order, stripe_api, monkeypatch,
):
    """An unavailable provider must leave the failed row retryable and process its peers."""
    first_id, first_intent = paid_order
    second_id, second_intent = _second_order(client, db_session, service, job_seeker_headers)
    for identifier in (first_id, second_id):
        db_session.get(Order, identifier).hold_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()
    cancel = gateway.cancel_payment_intent
    attempts = []

    def fail_first(identifier):
        attempts.append(identifier)
        if identifier == first_intent:
            raise gateway.PaymentProviderError("temporary provider cancellation outage")
        return cancel(identifier)

    with monkeypatch.context() as patch:
        patch.setattr(gateway, "cancel_payment_intent", fail_first)
        assert jobs.release_expired_holds(db_session) == 1
    assert set(attempts) == {first_intent, second_intent}
    with SessionLocal() as db:
        assert db.get(Order, first_id).status == "awaiting_payment"
        assert db.get(Order, second_id).status == "cancelled"
    assert stripe_api.cancellations == [second_intent]
    assert jobs.release_expired_holds(db_session) == 1
    assert jobs.release_expired_holds(db_session) == 0
    assert stripe_api.cancellations == [second_intent, first_intent]
    with SessionLocal() as db:
        assert all(db.get(Order, identifier).status == "cancelled"
                   for identifier in (first_id, second_id))


@pytest.mark.parametrize("error_type", [gateway.PaymentProviderError, RuntimeError])
def test_failed_payout_row_does_not_block_peer_and_retry_transfers_each_booking_once(
    client, db_session, service, job_seeker_headers, confirmed_booking,
    stripe_api, monkeypatch, error_type,
):
    """SDK failures and unexpected row failures preserve independent job progress."""
    first = confirmed_booking
    second_id, second_intent = _second_order(client, db_session, service, job_seeker_headers)
    _ack(post_webhook(client, WEBHOOK, succeeded_event(
        "evt_second_payout", second_intent, second_id,
    ), PLATFORM_SECRET))
    second = db_session.scalar(select(Booking).where(Booking.order_id == second_id))
    complete_long_ago(db_session, first)
    complete_long_ago(db_session, second)
    first_id, second_booking_id = first.id, second.id
    transfer = gateway.create_transfer
    attempts = []

    def fail_first(**kwargs):
        attempts.append(kwargs["booking_id"])
        if kwargs["booking_id"] == first_id:
            raise error_type("temporary transfer failure")
        return transfer(**kwargs)

    with monkeypatch.context() as patch:
        patch.setattr(gateway, "create_transfer", fail_first)
        assert jobs.pay_counsellors(db_session) == 1
    assert set(attempts) == {first_id, second_booking_id}
    with SessionLocal() as db:
        waiting = db.get(Booking, first_id)
        assert waiting.status == "completed" and waiting.transfer_id is None
        assert db.get(Booking, second_booking_id).status == "paid_out"
    assert jobs.pay_counsellors(db_session) == 1
    assert jobs.pay_counsellors(db_session) == 0
    assert {row["idempotency_key"] for row in stripe_api.transfers} == {
        f"transfer-{first_id}", f"transfer-{second_booking_id}",
    }
    assert len(stripe_api.transfers) == 2


def test_connect_redelivery_cannot_overwrite_a_newer_readiness_event(
    client, payable_counsellor, stripe_api,
):
    """A repeated older event ID is ignored after a later legitimate readiness change."""
    identifier = payable_counsellor.id
    account_id = payable_counsellor.stripe_account_id
    initial = _event("evt_connect_before", "account.updated", {
        "id": account_id, "charges_enabled": False, "payouts_enabled": False,
    })
    later = _event("evt_connect_after", "account.updated", {
        "id": account_id, "charges_enabled": True, "payouts_enabled": True,
    })
    for event in (initial, later, initial):
        _ack(post_webhook(client, CONNECT, event, CONNECT_SECRET))
    with SessionLocal() as db:
        stored = db.get(User, identifier)
        assert stored.charges_enabled and stored.payouts_enabled
        assert len(list(db.scalars(select(ProcessedWebhookEvent)))) == 2
    assert stripe_api.account_links == [] and stripe_api.transfers == []
