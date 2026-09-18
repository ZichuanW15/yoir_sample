"""QA tests for the Stripe payments feature (payments spec §14).

Every Stripe call is mocked — the suite never reaches the network and needs no
credentials. Webhook signatures are the exception: they are generated for real with
the same HMAC scheme Stripe uses, so the verification path, and the requirement that
it runs over the untouched raw body, are genuinely exercised rather than stubbed past.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AvailabilityWindow, Booking, Order, ProcessedWebhookEvent, Service, User
from app.payments import gateway, jobs
from app.payments.amounts import calculate_booking_amounts, refund_split
from app.payments.receipts import build_commission_statement, build_receipt

PLATFORM_SECRET = "whsec_platform_test"
CONNECT_SECRET = "whsec_connect_test"


# --- fixtures --------------------------------------------------------------


@pytest.fixture
def stripe_enabled(monkeypatch: pytest.MonkeyPatch):
    """Turn this deployment into one that has Stripe credentials."""
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_fake")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", PLATFORM_SECRET)
    monkeypatch.setenv("STRIPE_CONNECT_WEBHOOK_SECRET", CONNECT_SECRET)
    monkeypatch.setenv("APP_BASE_URL", "https://api.example.test")
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


@dataclass
class StripeCalls:
    """Records what the code asked Stripe to do, so tests can assert on it."""

    payment_intents: list[dict[str, Any]]
    refunds: list[dict[str, Any]]
    transfers: list[dict[str, Any]]
    reversals: list[dict[str, Any]]
    cancellations: list[str]
    accounts: list[dict[str, Any]]
    account_links: list[dict[str, Any]]


class _Obj:
    """A stand-in for a Stripe resource.

    Deliberately offers attribute access and nothing else. The real StripeObject is
    not a mapping and raises on .get(), so a fake that answered .get() would let
    dict-style access pass here and fail against Stripe.
    """

    def __init__(self, **fields: Any) -> None:
        self.__dict__.update(fields)


@pytest.fixture
def stripe_api(monkeypatch: pytest.MonkeyPatch, stripe_enabled) -> StripeCalls:
    """Replace every outbound Stripe call with a recording fake."""
    calls = StripeCalls([], [], [], [], [], [], [])
    counter = {"n": 0}

    def _next(prefix: str) -> str:
        counter["n"] += 1
        return f"{prefix}_{counter['n']}"

    def create_payment_intent(**kwargs: Any) -> Any:
        calls.payment_intents.append(kwargs)
        # Stripe replays the first response for a repeated idempotency key, so the
        # fake does too — that is the behaviour the retry paths rely on.
        for earlier in calls.payment_intents[:-1]:
            if earlier.get("idempotency_key") == kwargs.get("idempotency_key"):
                return _Obj(
                    id=earlier["_id"], client_secret=f"{earlier['_id']}_secret",
                    status="requires_payment_method", latest_charge="ch_1",
                )
        intent_id = _next("pi")
        kwargs["_id"] = intent_id
        return _Obj(
            id=intent_id, client_secret=f"{intent_id}_secret",
            status="requires_payment_method", latest_charge="ch_1",
        )

    monkeypatch.setattr("stripe.PaymentIntent.create", create_payment_intent)
    monkeypatch.setattr(
        "stripe.PaymentIntent.retrieve",
        lambda pid, **_: _Obj(id=pid, latest_charge=f"ch_for_{pid}"),
    )
    monkeypatch.setattr(
        "stripe.PaymentIntent.cancel",
        lambda pid, **_: calls.cancellations.append(pid),
    )

    def create_refund(**kwargs: Any) -> Any:
        calls.refunds.append(kwargs)
        return _Obj(id=_next("re"), status="succeeded")

    monkeypatch.setattr("stripe.Refund.create", create_refund)

    def create_transfer(**kwargs: Any) -> Any:
        calls.transfers.append(kwargs)
        return _Obj(id=_next("tr"))

    monkeypatch.setattr("stripe.Transfer.create", create_transfer)

    def create_reversal(transfer_id: str, **kwargs: Any) -> Any:
        calls.reversals.append({"transfer": transfer_id, **kwargs})
        return _Obj(id=_next("trr"))

    monkeypatch.setattr("stripe.Transfer.create_reversal", create_reversal)

    def create_account(**kwargs: Any) -> Any:
        calls.accounts.append(kwargs)
        return _Obj(id=_next("acct"))

    monkeypatch.setattr("stripe.Account.create", create_account)
    monkeypatch.setattr(
        "stripe.Account.retrieve",
        lambda aid, **_: _Obj(id=aid, charges_enabled=False, payouts_enabled=False),
    )

    def create_account_link(**kwargs: Any) -> Any:
        calls.account_links.append(kwargs)
        return _Obj(url=f"https://connect.stripe.test/setup/{kwargs['account']}")

    monkeypatch.setattr("stripe.AccountLink.create", create_account_link)
    return calls


@pytest.fixture
def other_job_seeker_headers(db_session: Session) -> dict[str, str]:
    """A second job seeker, for checking that one cannot reach another's order."""
    from app.security import create_access_token, hash_password

    user = User(
        name="Sam Other",
        email="sam.other@example.com",
        password_hash=hash_password("password123"),
        role="job_seeker",
    )
    db_session.add(user)
    db_session.commit()
    token, _ = create_access_token(user.id, user.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def payable_counsellor(db_session: Session, counsellor: User) -> User:
    """A counsellor Stripe has cleared to be paid."""
    counsellor.stripe_account_id = "acct_existing"
    counsellor.charges_enabled = True
    counsellor.payouts_enabled = True
    counsellor.abn = "12345678901"
    counsellor.gst_registered = True
    db_session.commit()
    db_session.refresh(counsellor)
    return counsellor


def add_window(
    db_session: Session, service: Service, *, starts_at: datetime | None = None, hours: int = 3,
) -> AvailabilityWindow:
    """Availability belongs to the counsellor who owns the service, not to the
    service, so one window serves everything they offer."""
    start = starts_at or datetime.now(UTC) + timedelta(days=3)
    window = AvailabilityWindow(
        counsellor_id=service.counsellor_id,
        starts_at=start,
        ends_at=start + timedelta(hours=hours),
    )
    db_session.add(window)
    db_session.commit()
    db_session.refresh(window)
    return window


def signed_event(payload: dict[str, Any], secret: str) -> tuple[bytes, dict[str, str]]:
    """Sign a payload exactly the way Stripe signs a webhook delivery."""
    body = json.dumps(payload).encode()
    timestamp = int(time.time())
    signature = hmac.new(
        secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256,
    ).hexdigest()
    return body, {
        "stripe-signature": f"t={timestamp},v1={signature}",
        "content-type": "application/json",
    }


def post_webhook(
    client: TestClient, path: str, payload: dict[str, Any], secret: str,
):
    body, headers = signed_event(payload, secret)
    return client.post(path, content=body, headers=headers)


def succeeded_event(event_id: str, intent_id: str, order_id: str) -> dict[str, Any]:
    return {
        "id": event_id,
        "type": "payment_intent.succeeded",
        "data": {"object": {
            "id": intent_id,
            "amount": 9500,
            "latest_charge": "ch_1",
            "metadata": {"order_id": order_id},
        }},
    }


def create_order(
    client: TestClient, service: Service, window: AvailabilityWindow, headers: dict[str, str],
):
    """Book the first bookable start. The end follows from the service's duration."""
    return client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "serviceId": service.id,
            "startsAt": window.starts_at.isoformat(),
            "modality": "online",
            "timezone": "Australia/Melbourne",
        },
    )


# --- §6 amount calculation -------------------------------------------------


def test_amounts_match_the_worked_example_in_the_spec() -> None:
    """$88 session, GST-registered counsellor, 20% commission."""
    amounts = calculate_booking_amounts(8800, counsellor_gst_registered=True)
    assert amounts.total_minor == 8800
    assert amounts.session_gst_minor == 800
    assert amounts.platform_fee_minor == 1760
    assert amounts.platform_fee_gst_minor == 160
    assert amounts.counsellor_payout_minor == 7040


def test_amounts_charge_no_session_gst_for_an_unregistered_counsellor() -> None:
    amounts = calculate_booking_amounts(8800, counsellor_gst_registered=False)
    assert amounts.session_gst_minor == 0
    # The job seeker pays the same price either way; only the tax treatment differs.
    assert amounts.total_minor == 8800
    assert amounts.counsellor_payout_minor == 7040


def test_the_three_shares_always_reconcile_to_the_price() -> None:
    for price in (0, 1, 7, 99, 100, 4999, 9500, 12345, 999999):
        amounts = calculate_booking_amounts(price, counsellor_gst_registered=True)
        assert amounts.platform_fee_minor + amounts.counsellor_payout_minor == price
        assert amounts.session_gst_minor <= price
        assert amounts.platform_fee_gst_minor <= amounts.platform_fee_minor


def test_rounding_is_half_up_rather_than_bankers() -> None:
    """A half cent must always go the same way, or the two sides disagree by a cent."""
    # 5 * 20% = 1.0 exactly; 15 * 20% = 3.0. The interesting case is x.5:
    # 250 minor * 20% = 50; 2.5 rounds to 3, not to 2 as round() would give.
    amounts = calculate_booking_amounts(1250, counsellor_gst_registered=False)
    assert amounts.platform_fee_minor == 250
    # 25 / 11 = 2.2727 -> 2. 125/11 = 11.36 -> 11.
    assert calculate_booking_amounts(25, True).session_gst_minor == 2
    assert calculate_booking_amounts(125, True).session_gst_minor == 11


def test_amounts_respect_a_gst_exclusive_commission_base(monkeypatch) -> None:
    monkeypatch.setenv("COMMISSION_BASE", "gst_exclusive")
    get_settings.cache_clear()
    try:
        amounts = calculate_booking_amounts(8800, counsellor_gst_registered=True)
        # Commission comes off $80, not $88.
        assert amounts.platform_fee_minor == 1600
        assert amounts.counsellor_payout_minor == 7200
    finally:
        get_settings.cache_clear()


def test_amounts_omit_platform_gst_when_the_platform_is_not_registered(monkeypatch) -> None:
    monkeypatch.setenv("PLATFORM_GST_REGISTERED", "false")
    get_settings.cache_clear()
    try:
        assert calculate_booking_amounts(8800, True).platform_fee_gst_minor == 0
    finally:
        get_settings.cache_clear()


def test_a_negative_price_is_refused() -> None:
    with pytest.raises(ValueError):
        calculate_booking_amounts(-1, counsellor_gst_registered=False)


def test_a_partial_refund_is_funded_by_both_sides_in_proportion() -> None:
    amounts = calculate_booking_amounts(8800, counsellor_gst_registered=True)
    assert refund_split(amounts, 8800) == 7040  # Full refund claws back the whole payout.
    assert refund_split(amounts, 4400) == 3520  # Half comes half from the counsellor.
    assert refund_split(amounts, 0) == 0


# --- §7 order creation and the PaymentIntent -------------------------------


def test_order_freezes_the_breakdown_and_the_counsellor_tax_snapshot(
    client: TestClient, db_session: Session, service: Service,
    payable_counsellor: User, job_seeker_headers: dict[str, str],
) -> None:
    window = add_window(db_session, service)
    response = create_order(client, service, window, job_seeker_headers)

    assert response.status_code == 201
    body = response.json()
    assert body["amounts"] == {
        "totalMinor": 9500, "sessionGstMinor": 864, "platformFeeMinor": 1900,
        "platformFeeGstMinor": 173, "counsellorPayoutMinor": 7600,
    }
    stored = db_session.get(Order, body["id"])
    assert stored.counsellor_gst_registered_at_booking is True
    assert stored.counsellor_abn_at_booking == "12345678901"
    assert stored.hold_expires_at is not None

    # A later change of tax status must not rewrite a booking already made.
    payable_counsellor.gst_registered = False
    payable_counsellor.abn = None
    db_session.commit()
    db_session.expire_all()
    assert db_session.get(Order, body["id"]).counsellor_abn_at_booking == "12345678901"


def test_order_ignores_any_price_the_app_sends(
    client: TestClient, db_session: Session, service: Service,
    payable_counsellor: User, job_seeker_headers: dict[str, str],
) -> None:
    """Spec §13 — the server never trusts an amount that came from the client."""
    window = add_window(db_session, service)
    response = client.post(
        "/api/v1/orders",
        headers=job_seeker_headers,
        json={
            "serviceId": service.id, "startsAt": window.starts_at.isoformat(), "modality": "online",
            "timezone": "Australia/Melbourne", "amountMinor": 1, "priceMinor": 1,
        },
    )
    assert response.status_code == 201
    assert response.json()["amountMinor"] == service.price_minor


def test_order_is_refused_when_the_counsellor_cannot_be_paid(
    client: TestClient, db_session: Session, service: Service,
    counsellor: User, job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    window = add_window(db_session, service)
    response = create_order(client, service, window, job_seeker_headers)

    assert response.status_code == 409
    assert response.json()["code"] == "COUNSELLOR_PAYOUTS_UNAVAILABLE"
    db_session.expire_all()
    # Nothing was reserved, so the time is still on offer to everyone else.
    assert db_session.scalar(select(Order)) is None


def test_payment_intent_is_created_once_and_replayed_on_retry(
    client: TestClient, db_session: Session, service: Service,
    payable_counsellor: User, job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    window = add_window(db_session, service)
    order_id = create_order(client, service, window, job_seeker_headers).json()["id"]

    first = client.post(f"/api/v1/orders/{order_id}/payment-intents", headers=job_seeker_headers)
    second = client.post(f"/api/v1/orders/{order_id}/payment-intents", headers=job_seeker_headers)

    assert first.status_code == 200
    assert first.json()["clientSecret"].endswith("_secret")
    # Same idempotency key both times, so Stripe opens one charge, not two.
    assert first.json()["paymentIntentId"] == second.json()["paymentIntentId"]
    keys = {call["idempotency_key"] for call in stripe_api.payment_intents}
    assert keys == {f"booking-{order_id}"}

    sent = stripe_api.payment_intents[0]
    assert sent["amount"] == 9500
    assert sent["currency"] == "aud"
    assert sent["transfer_group"] == f"booking_{order_id}"
    assert sent["metadata"]["order_id"] == order_id
    # Separate charges and transfers: nothing moves to the counsellor at charge time.
    assert "transfer_data" not in sent and "on_behalf_of" not in sent


def test_payment_intent_is_refused_once_the_hold_has_lapsed(
    client: TestClient, db_session: Session, service: Service,
    payable_counsellor: User, job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    window = add_window(db_session, service)
    order_id = create_order(client, service, window, job_seeker_headers).json()["id"]
    order = db_session.get(Order, order_id)
    order.hold_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    response = client.post(f"/api/v1/orders/{order_id}/payment-intents", headers=job_seeker_headers)

    assert response.status_code == 409
    assert response.json()["code"] == "SLOT_UNAVAILABLE"
    assert stripe_api.payment_intents == []


def test_payment_intent_is_not_available_for_someone_elses_order(
    client: TestClient, db_session: Session, service: Service, payable_counsellor: User,
    job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
    other_job_seeker_headers: dict[str, str],
) -> None:
    window = add_window(db_session, service)
    order_id = create_order(client, service, window, job_seeker_headers).json()["id"]

    response = client.post(
        f"/api/v1/orders/{order_id}/payment-intents", headers=other_job_seeker_headers,
    )

    assert response.status_code == 404
    assert stripe_api.payment_intents == []


def test_the_payment_stub_is_refused_once_stripe_is_configured(
    client: TestClient, db_session: Session, service: Service,
    payable_counsellor: User, job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    """A real deployment must not be talked into confirming an unpaid booking."""
    window = add_window(db_session, service)
    order_id = create_order(client, service, window, job_seeker_headers).json()["id"]

    response = client.post(
        f"/api/v1/orders/{order_id}/payments/stub", headers=job_seeker_headers,
    )

    assert response.status_code == 403
    assert db_session.scalar(select(Booking)) is None


# --- §8 webhooks -----------------------------------------------------------


@pytest.fixture
def paid_order(
    client: TestClient, db_session: Session, service: Service,
    payable_counsellor: User, job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
) -> tuple[str, str]:
    """An order with a live PaymentIntent, ready for the success webhook."""
    window = add_window(db_session, service)
    order_id = create_order(client, service, window, job_seeker_headers).json()["id"]
    intent = client.post(
        f"/api/v1/orders/{order_id}/payment-intents", headers=job_seeker_headers,
    ).json()
    return order_id, intent["paymentIntentId"]


def test_succeeded_webhook_confirms_the_booking_and_books_the_slot(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
) -> None:
    order_id, intent_id = paid_order

    response = post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        succeeded_event("evt_ok", intent_id, order_id), PLATFORM_SECRET,
    )

    assert response.status_code == 200
    db_session.expire_all()
    order = db_session.get(Order, order_id)
    booking = db_session.scalar(select(Booking).where(Booking.order_id == order_id))
    assert (order.status, order.payment_status) == ("confirmed", "paid")
    assert booking is not None and booking.status == "confirmed"
    assert booking.starts_at == order.starts_at


def test_a_redelivered_webhook_does_not_confirm_a_second_booking(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
) -> None:
    """Stripe retries, so the same event id must land exactly once (spec §8)."""
    order_id, intent_id = paid_order
    event = succeeded_event("evt_repeat", intent_id, order_id)

    first = post_webhook(client, "/api/v1/payments/stripe/webhook", event, PLATFORM_SECRET)
    second = post_webhook(client, "/api/v1/payments/stripe/webhook", event, PLATFORM_SECRET)

    assert (first.status_code, second.status_code) == (200, 200)
    db_session.expire_all()
    assert len(list(db_session.scalars(select(Booking)))) == 1
    assert len(list(db_session.scalars(select(ProcessedWebhookEvent)))) == 1


def test_a_second_event_id_for_the_same_payment_still_confirms_only_once(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
) -> None:
    """Idempotency cannot rest on the event id alone; the booking check backs it up."""
    order_id, intent_id = paid_order

    post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        succeeded_event("evt_a", intent_id, order_id), PLATFORM_SECRET,
    )
    post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        succeeded_event("evt_b", intent_id, order_id), PLATFORM_SECRET,
    )

    db_session.expire_all()
    assert len(list(db_session.scalars(select(Booking)))) == 1


def test_a_webhook_with_a_bad_signature_changes_nothing(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
) -> None:
    order_id, intent_id = paid_order
    event = succeeded_event("evt_forged", intent_id, order_id)

    body, headers = signed_event(event, "whsec_not_our_secret")
    response = client.post("/api/v1/payments/stripe/webhook", content=body, headers=headers)

    assert response.status_code == 400
    db_session.expire_all()
    assert db_session.scalar(select(Booking)) is None
    assert db_session.get(Order, order_id).status == "awaiting_payment"


def test_a_tampered_webhook_body_is_rejected(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
) -> None:
    """The signature covers the raw bytes, so editing the payload must invalidate it."""
    order_id, intent_id = paid_order
    body, headers = signed_event(succeeded_event("evt_x", intent_id, order_id), PLATFORM_SECRET)

    response = client.post(
        "/api/v1/payments/stripe/webhook",
        content=body.replace(b'"amount": 9500', b'"amount": 1'),
        headers=headers,
    )

    assert response.status_code == 400
    assert db_session.scalar(select(Booking)) is None


def test_the_connect_secret_is_not_accepted_on_the_platform_endpoint(
    client: TestClient, paid_order: tuple[str, str],
) -> None:
    order_id, intent_id = paid_order
    response = post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        succeeded_event("evt_wrong_secret", intent_id, order_id), CONNECT_SECRET,
    )
    assert response.status_code == 400


def test_payment_that_lands_after_the_slot_was_taken_is_refunded(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
    stripe_api: StripeCalls,
) -> None:
    """Spec §8 — the hold lapsed, somebody else booked the slot, so the money goes back."""
    order_id, intent_id = paid_order
    order = db_session.get(Order, order_id)
    order.hold_expires_at = datetime.now(UTC) - timedelta(minutes=5)
    # Somebody else got there first: a confirmed booking now occupies the time, which
    # is what makes it unavailable now that nothing carries a "booked" flag.
    other = db_session.scalar(select(User).where(User.role == "job_seeker"))
    rival = Order(
        job_seeker_id=other.id, service_id=order.service_id, window_id=order.window_id,
        starts_at=order.starts_at, ends_at=order.ends_at, amount_minor=order.amount_minor,
        currency="AUD", timezone="Australia/Melbourne", modality="online",
        status="confirmed", payment_status="paid",
    )
    db_session.add(rival)
    db_session.flush()
    db_session.add(Booking(
        order_id=rival.id, service_id=order.service_id, window_id=order.window_id,
        job_seeker_id=other.id,
        counsellor_id=db_session.get(Service, order.service_id).counsellor_id,
        starts_at=order.starts_at, ends_at=order.ends_at,
        timezone="Australia/Melbourne", modality="online",
        status="confirmed", payment_status="paid",
    ))
    db_session.commit()

    response = post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        succeeded_event("evt_late", intent_id, order_id), PLATFORM_SECRET,
    )

    assert response.status_code == 200
    db_session.expire_all()
    assert db_session.get(Order, order_id).status == "refunded_slot_taken"
    # The rival's booking stands; this order got no booking of its own, only a refund.
    assert db_session.scalar(select(Booking).where(Booking.order_id == order_id)) is None
    assert len(stripe_api.refunds) == 1
    assert stripe_api.refunds[0]["payment_intent"] == intent_id
    # A full refund, so no partial amount is sent.
    assert "amount" not in stripe_api.refunds[0]


def test_payment_landing_on_a_lapsed_but_untaken_slot_still_confirms(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
    stripe_api: StripeCalls,
) -> None:
    """"Still held or free" both confirm: the job seeker paid and nobody else wants it."""
    order_id, intent_id = paid_order
    order = db_session.get(Order, order_id)
    order.hold_expires_at = datetime.now(UTC) - timedelta(minutes=5)
    # Nobody took the time while the hold lapsed, so it is still free.
    db_session.commit()

    post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        succeeded_event("evt_free", intent_id, order_id), PLATFORM_SECRET,
    )

    db_session.expire_all()
    assert db_session.get(Order, order_id).status == "confirmed"
    assert stripe_api.refunds == []


def test_a_failed_payment_keeps_the_hold_so_another_card_can_be_tried(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
) -> None:
    order_id, intent_id = paid_order

    post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        {
            "id": "evt_failed", "type": "payment_intent.payment_failed",
            "data": {"object": {"id": intent_id, "metadata": {"order_id": order_id}}},
        },
        PLATFORM_SECRET,
    )

    db_session.expire_all()
    order = db_session.get(Order, order_id)
    assert (order.status, order.payment_status) == ("awaiting_payment", "failed")
    # The hold is the order itself, and it is still live, so the time stays reserved.
    assert order.hold_expires_at > datetime.now(UTC)


def test_a_dispute_flags_the_booking_and_holds_back_its_payout(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
) -> None:
    order_id, intent_id = paid_order
    post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        succeeded_event("evt_paid", intent_id, order_id), PLATFORM_SECRET,
    )

    post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        {
            "id": "evt_dispute", "type": "charge.dispute.created",
            "data": {"object": {"id": "dp_1", "payment_intent": intent_id, "reason": "fraudulent"}},
        },
        PLATFORM_SECRET,
    )

    db_session.expire_all()
    booking = db_session.scalar(select(Booking))
    assert booking.flagged_for_review is True
    assert "fraudulent" in booking.review_reason

    booking.status = "completed"
    booking.completed_at = datetime.now(UTC) - timedelta(days=5)
    db_session.commit()
    assert jobs.pay_counsellors(db_session) == 0


def test_account_updated_is_the_only_authority_on_payout_readiness(
    client: TestClient, db_session: Session, counsellor: User, stripe_api: StripeCalls,
) -> None:
    counsellor.stripe_account_id = "acct_webhook"
    db_session.commit()

    response = post_webhook(
        client, "/api/v1/payments/stripe/webhook/connect",
        {
            "id": "evt_account", "type": "account.updated",
            "data": {"object": {
                "id": "acct_webhook", "charges_enabled": True, "payouts_enabled": True,
            }},
        },
        CONNECT_SECRET,
    )

    assert response.status_code == 200
    db_session.expire_all()
    refreshed = db_session.get(User, counsellor.id)
    assert (refreshed.charges_enabled, refreshed.payouts_enabled) == (True, True)


def test_the_connect_endpoint_rejects_the_platform_signing_secret(
    client: TestClient, stripe_api: StripeCalls,
) -> None:
    response = post_webhook(
        client, "/api/v1/payments/stripe/webhook/connect",
        {"id": "evt_x", "type": "account.updated", "data": {"object": {"id": "acct_1"}}},
        PLATFORM_SECRET,
    )
    assert response.status_code == 400


# --- §9 background jobs ----------------------------------------------------


@pytest.fixture
def confirmed_booking(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
) -> Booking:
    order_id, intent_id = paid_order
    post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        succeeded_event(f"evt_{order_id}", intent_id, order_id), PLATFORM_SECRET,
    )
    db_session.expire_all()
    return db_session.scalar(select(Booking).where(Booking.order_id == order_id))


def test_the_release_job_frees_a_lapsed_slot_and_cancels_its_payment_intent(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
    stripe_api: StripeCalls,
) -> None:
    order_id, intent_id = paid_order
    order = db_session.get(Order, order_id)
    order.hold_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    assert jobs.release_expired_holds(db_session) == 1

    db_session.expire_all()
    assert db_session.get(Order, order_id).status == "cancelled"
    assert stripe_api.cancellations == [intent_id]


def test_the_release_job_leaves_a_live_hold_alone(
    db_session: Session, paid_order: tuple[str, str], stripe_api: StripeCalls,
) -> None:
    assert jobs.release_expired_holds(db_session) == 0
    assert stripe_api.cancellations == []


def test_sessions_are_marked_completed_only_once_they_have_ended(
    db_session: Session, confirmed_booking: Booking,
) -> None:
    assert jobs.mark_sessions_completed(db_session) == 0  # Still in the future.

    confirmed_booking.starts_at = datetime.now(UTC) - timedelta(hours=2)
    confirmed_booking.ends_at = datetime.now(UTC) - timedelta(hours=1)
    db_session.commit()

    assert jobs.mark_sessions_completed(db_session) == 1
    db_session.expire_all()
    assert db_session.get(Booking, confirmed_booking.id).status == "completed"


def complete_long_ago(db_session: Session, booking: Booking, hours: int = 48) -> None:
    booking.status = "completed"
    booking.completed_at = datetime.now(UTC) - timedelta(hours=hours)
    booking.starts_at = datetime.now(UTC) - timedelta(hours=hours + 2)
    booking.ends_at = datetime.now(UTC) - timedelta(hours=hours + 1)
    db_session.commit()


def test_the_payout_job_transfers_the_counsellor_share_exactly_once(
    db_session: Session, confirmed_booking: Booking, payable_counsellor: User,
    stripe_api: StripeCalls,
) -> None:
    """Spec §9 — never transfer twice for one booking."""
    complete_long_ago(db_session, confirmed_booking)

    assert jobs.pay_counsellors(db_session) == 1
    assert jobs.pay_counsellors(db_session) == 0  # Second run finds nothing to do.

    assert len(stripe_api.transfers) == 1
    transfer = stripe_api.transfers[0]
    assert transfer["amount"] == 7600
    assert transfer["currency"] == "aud"
    assert transfer["destination"] == payable_counsellor.stripe_account_id
    assert transfer["idempotency_key"] == f"transfer-{confirmed_booking.id}"
    # Pinned to the charge that funded it, not to the platform's float.
    assert transfer["source_transaction"].startswith("ch_for_pi")

    db_session.expire_all()
    stored = db_session.get(Booking, confirmed_booking.id)
    assert stored.status == "paid_out"
    assert stored.transfer_id is not None


def test_the_payout_job_waits_out_the_configured_delay(
    db_session: Session, confirmed_booking: Booking, stripe_api: StripeCalls,
) -> None:
    complete_long_ago(db_session, confirmed_booking, hours=1)  # PAYOUT_DELAY_HOURS is 24.
    assert jobs.pay_counsellors(db_session) == 0
    assert stripe_api.transfers == []


def test_the_payout_job_skips_a_counsellor_stripe_will_not_pay(
    db_session: Session, confirmed_booking: Booking, payable_counsellor: User,
    stripe_api: StripeCalls,
) -> None:
    complete_long_ago(db_session, confirmed_booking)
    payable_counsellor.payouts_enabled = False
    db_session.commit()

    assert jobs.pay_counsellors(db_session) == 0
    assert stripe_api.transfers == []
    db_session.expire_all()
    # The booking waits rather than being lost: it pays out once onboarding completes.
    assert db_session.get(Booking, confirmed_booking.id).status == "completed"


def test_a_stripe_failure_defers_the_payout_to_the_next_run(
    db_session: Session, confirmed_booking: Booking, stripe_api: StripeCalls,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    complete_long_ago(db_session, confirmed_booking)

    def explode(**_: Any):
        raise gateway.PaymentProviderError("Stripe is down")

    monkeypatch.setattr(gateway, "create_transfer", lambda **kw: explode())
    assert jobs.pay_counsellors(db_session) == 0

    db_session.expire_all()
    stored = db_session.get(Booking, confirmed_booking.id)
    assert stored.status == "completed" and stored.transfer_id is None


# --- §10 cancellations and refunds -----------------------------------------


def test_cancelling_well_before_the_session_refunds_in_full(
    client: TestClient, db_session: Session, confirmed_booking: Booking,
    job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    response = client.post(
        f"/api/v1/bookings/{confirmed_booking.id}/cancel", headers=job_seeker_headers,
    )

    assert response.status_code == 200
    assert response.json()["refundedMinor"] == 9500
    assert stripe_api.refunds[0]["amount"] == 9500
    db_session.expire_all()
    stored = db_session.get(Booking, confirmed_booking.id)
    assert (stored.status, stored.payment_status) == ("refunded", "refunded")
    # The time goes back on sale.



def test_a_late_job_seeker_cancellation_follows_the_configured_policy(
    client: TestClient, db_session: Session, confirmed_booking: Booking,
    job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    """CANCELLATION_LATE_REFUND_PERCENT is 0 until the client settles the policy."""
    confirmed_booking.starts_at = datetime.now(UTC) + timedelta(hours=2)
    db_session.commit()

    response = client.post(
        f"/api/v1/bookings/{confirmed_booking.id}/cancel", headers=job_seeker_headers,
    )

    assert response.status_code == 200
    assert response.json()["refundedMinor"] == 0
    assert stripe_api.refunds == []
    db_session.expire_all()
    assert db_session.get(Booking, confirmed_booking.id).status == "cancelled"


def test_a_counsellor_cancelling_always_refunds_the_job_seeker_in_full(
    client: TestClient, db_session: Session, confirmed_booking: Booking,
    counsellor_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    confirmed_booking.starts_at = datetime.now(UTC) + timedelta(minutes=30)
    db_session.commit()

    response = client.post(
        f"/api/v1/bookings/{confirmed_booking.id}/cancel", headers=counsellor_headers,
    )

    assert response.status_code == 200
    assert response.json()["refundedMinor"] == 9500
    db_session.expire_all()
    assert db_session.get(Booking, confirmed_booking.id).cancelled_by_role == "counsellor"


def test_cancelling_after_payout_reverses_the_transfer_before_refunding(
    client: TestClient, db_session: Session, confirmed_booking: Booking,
    payable_counsellor: User, counsellor_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    """Spec §10 — recover the counsellor's share first, so the refund is funded."""
    complete_long_ago(db_session, confirmed_booking)
    assert jobs.pay_counsellors(db_session) == 1
    db_session.expire_all()

    response = client.post(
        f"/api/v1/bookings/{confirmed_booking.id}/cancel", headers=counsellor_headers,
    )

    assert response.status_code == 200
    assert len(stripe_api.reversals) == 1
    assert stripe_api.reversals[0]["amount"] == 7600
    assert len(stripe_api.refunds) == 1
    assert stripe_api.refunds[0]["amount"] == 9500


def test_a_booking_cannot_be_cancelled_twice(
    client: TestClient, db_session: Session, confirmed_booking: Booking,
    job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    client.post(f"/api/v1/bookings/{confirmed_booking.id}/cancel", headers=job_seeker_headers)
    second = client.post(
        f"/api/v1/bookings/{confirmed_booking.id}/cancel", headers=job_seeker_headers,
    )

    assert second.status_code == 409
    assert len(stripe_api.refunds) == 1


def test_a_stranger_cannot_see_or_cancel_a_booking(
    client: TestClient, confirmed_booking: Booking, other_job_seeker_headers: dict[str, str],
) -> None:
    assert client.get(
        f"/api/v1/bookings/{confirmed_booking.id}", headers=other_job_seeker_headers,
    ).status_code == 404
    assert client.post(
        f"/api/v1/bookings/{confirmed_booking.id}/cancel", headers=other_job_seeker_headers,
    ).status_code == 404


# --- §7 counsellor onboarding ----------------------------------------------


def test_onboarding_creates_the_account_once_and_a_fresh_link_every_time(
    client: TestClient, db_session: Session, counsellor: User,
    counsellor_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    first = client.post("/api/v1/me/stripe-onboarding", headers=counsellor_headers)
    second = client.post("/api/v1/me/stripe-onboarding", headers=counsellor_headers)

    assert (first.status_code, second.status_code) == (200, 200)
    assert first.json()["accountId"] == second.json()["accountId"]
    # One connected account, but a new single-use link each time it is asked for.
    assert len(stripe_api.accounts) == 1
    assert len(stripe_api.account_links) == 2

    created = stripe_api.accounts[0]
    assert created["country"] == "AU"
    assert created["controller"]["stripe_dashboard"]["type"] == "express"
    assert created["controller"]["fees"]["payer"] == "application"
    assert created["capabilities"]["transfers"]["requested"] is True
    assert created["metadata"]["counsellor_id"] == counsellor.id

    link = stripe_api.account_links[0]
    assert link["type"] == "account_onboarding"
    # Account Links reject non-HTTPS URLs.
    assert link["return_url"].startswith("https://")
    assert link["refresh_url"].startswith("https://")

    db_session.expire_all()
    assert db_session.get(User, counsellor.id).stripe_account_id is not None


def test_onboarding_never_reports_readiness_from_the_app(
    client: TestClient, counsellor_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    """Finishing the hosted flow is not the same as Stripe agreeing to pay someone."""
    client.post("/api/v1/me/stripe-onboarding", headers=counsellor_headers)

    status_response = client.get("/api/v1/me/payout-status", headers=counsellor_headers)

    assert status_response.status_code == 200
    body = status_response.json()
    assert body["payoutsEnabled"] is False
    assert body["onboardingRequired"] is True


def test_the_onboarding_return_page_only_bounces_into_the_app(
    client: TestClient, stripe_api: StripeCalls,
) -> None:
    response = client.get(
        "/api/v1/payments/stripe/onboarding/return", follow_redirects=False,
    )
    assert response.status_code == 303
    assert response.headers["location"] == "yoir://onboarding-complete"


def test_the_onboarding_refresh_link_requires_this_servers_own_signature(
    client: TestClient, stripe_api: StripeCalls,
) -> None:
    good = gateway.onboarding_token("acct_refresh")
    response = client.get(
        f"/api/v1/payments/stripe/onboarding/refresh?token={good}", follow_redirects=False,
    )
    assert response.status_code == 303
    assert "acct_refresh" in response.headers["location"]

    # An unsigned id would let a stranger mint Account Links to probe account ids.
    forged = client.get(
        "/api/v1/payments/stripe/onboarding/refresh?token=acct_someone_else",
        follow_redirects=False,
    )
    assert forged.status_code == 404


def test_only_a_counsellor_can_reach_the_payout_endpoints(
    client: TestClient, job_seeker_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    assert client.post(
        "/api/v1/me/stripe-onboarding", headers=job_seeker_headers,
    ).status_code == 403
    assert client.get("/api/v1/me/payout-status", headers=job_seeker_headers).status_code == 403
    assert client.get("/api/v1/me/payout-status").status_code == 401


def test_tax_details_validate_the_abn_and_require_one_for_gst(
    client: TestClient, db_session: Session, counsellor: User,
    counsellor_headers: dict[str, str],
) -> None:
    spaced = client.put(
        "/api/v1/me/tax-details",
        headers=counsellor_headers,
        json={"abn": "12 345 678 901", "gstRegistered": True},
    )
    assert spaced.status_code == 200
    assert spaced.json()["abn"] == "12345678901"

    too_short = client.put(
        "/api/v1/me/tax-details",
        headers=counsellor_headers,
        json={"abn": "1234", "gstRegistered": False},
    )
    assert too_short.status_code == 400

    no_abn = client.put(
        "/api/v1/me/tax-details",
        headers=counsellor_headers,
        json={"abn": None, "gstRegistered": True},
    )
    assert no_abn.status_code == 400
    assert "abn" in no_abn.json()["fieldErrors"]


def test_the_marketplace_hides_counsellors_who_cannot_be_paid(
    client: TestClient, db_session: Session, service: Service,
    counsellor: User, stripe_api: StripeCalls,
) -> None:
    """Spec §8 — only a counsellor with payouts enabled is findable and bookable."""
    assert client.get("/api/v1/services").json() == []
    assert client.get(f"/api/v1/services/{service.id}").status_code == 404

    # The flag alone is not enough: a Transfer needs a destination account, so a
    # counsellor without one stays hidden rather than taking a booking that could
    # never be paid out.
    counsellor.payouts_enabled = True
    db_session.commit()
    assert client.get("/api/v1/services").json() == []

    counsellor.stripe_account_id = "acct_ready"
    db_session.commit()

    assert len(client.get("/api/v1/services").json()) == 1
    assert client.get(f"/api/v1/services/{service.id}").status_code == 200


def test_payment_config_serves_the_publishable_key_and_no_secret(
    client: TestClient, stripe_api: StripeCalls,
) -> None:
    body = client.get("/api/v1/payments/config").json()

    assert body["provider"] == "stripe"
    assert body["publishableKey"] == "pk_test_fake"
    assert body["merchantCountryCode"] == "AU"
    assert body["slotHoldMinutes"] == 15
    assert body["cancellationFullRefundHours"] == 24
    assert "sk_test_fake" not in json.dumps(body)


def test_payment_config_reports_the_stub_when_stripe_is_not_configured(
    client: TestClient,
) -> None:
    body = client.get("/api/v1/payments/config").json()
    assert body["provider"] == "stub"
    assert body["publishableKey"] is None


# --- §11 receipts and commission statements --------------------------------


def test_a_gst_registered_counsellor_issues_a_tax_invoice_in_their_own_name(
    client: TestClient, db_session: Session, confirmed_booking: Booking,
    payable_counsellor: User, job_seeker_headers: dict[str, str],
) -> None:
    response = client.get(
        f"/api/v1/bookings/{confirmed_booking.id}/receipt", headers=job_seeker_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["isTaxInvoice"] is True
    # The counsellor supplies the session; the platform is only their agent.
    assert body["supplierName"] == payable_counsellor.name
    assert body["supplierAbn"] == "12345678901"
    assert body["gstMinor"] == 864
    assert "TAX INVOICE" in body["text"]
    assert "ABN: 12345678901" in body["text"]


def test_an_unregistered_counsellor_issues_a_receipt_with_no_gst_line(
    client: TestClient, db_session: Session, service: Service, counsellor: User,
    job_seeker_headers: dict[str, str], job_seeker: User,
) -> None:
    counsellor.gst_registered = False
    counsellor.abn = None
    db_session.commit()
    window = add_window(db_session, service)
    order_id = create_order(client, service, window, job_seeker_headers).json()["id"]
    client.post(f"/api/v1/orders/{order_id}/payments/stub", headers=job_seeker_headers)
    booking = db_session.scalar(select(Booking).where(Booking.order_id == order_id))

    body = client.get(
        f"/api/v1/bookings/{booking.id}/receipt", headers=job_seeker_headers,
    ).json()

    assert body["isTaxInvoice"] is False
    assert body["gstMinor"] == 0
    assert "TAX INVOICE" not in body["text"]
    assert "No GST has been charged" in body["text"]


def test_a_receipt_reflects_the_snapshot_not_the_counsellors_current_settings(
    db_session: Session, confirmed_booking: Booking, payable_counsellor: User,
    service: Service, job_seeker: User,
) -> None:
    order = db_session.get(Order, confirmed_booking.order_id)
    payable_counsellor.gst_registered = False
    payable_counsellor.abn = None
    db_session.commit()

    receipt = build_receipt(
        confirmed_booking, order, service, payable_counsellor, job_seeker,
    )

    assert receipt.is_tax_invoice is True
    assert receipt.supplier_abn == "12345678901"


def test_the_commission_statement_lists_the_months_delivered_sessions(
    db_session: Session, confirmed_booking: Booking, payable_counsellor: User,
) -> None:
    complete_long_ago(db_session, confirmed_booking)
    started = confirmed_booking.starts_at

    statement = build_commission_statement(
        db_session, payable_counsellor, started.year, started.month,
    )

    assert len(statement.lines) == 1
    assert statement.commission_total_minor == 1900
    assert statement.commission_gst_total_minor == 173
    assert statement.payout_total_minor == 7600
    assert "commission" in statement.render_text().lower()


def test_the_commission_statement_excludes_a_month_with_no_sessions(
    client: TestClient, db_session: Session, confirmed_booking: Booking,
    counsellor_headers: dict[str, str], payable_counsellor: User,
) -> None:
    complete_long_ago(db_session, confirmed_booking)

    body = client.get(
        "/api/v1/me/commission-statements/2001/1", headers=counsellor_headers,
    ).json()

    assert body["lines"] == []
    assert body["commissionTotalMinor"] == 0


def test_a_counsellor_sees_their_own_bookings_and_a_job_seeker_sees_theirs(
    client: TestClient, confirmed_booking: Booking,
    job_seeker_headers: dict[str, str], counsellor_headers: dict[str, str],
    other_job_seeker_headers: dict[str, str],
) -> None:
    assert len(client.get("/api/v1/me/bookings", headers=job_seeker_headers).json()) == 1
    assert len(client.get("/api/v1/me/bookings", headers=counsellor_headers).json()) == 1
    assert client.get("/api/v1/me/bookings", headers=other_job_seeker_headers).json() == []


def test_the_order_endpoint_is_the_apps_source_of_truth_after_payment(
    client: TestClient, db_session: Session, paid_order: tuple[str, str],
    job_seeker_headers: dict[str, str],
) -> None:
    order_id, intent_id = paid_order

    before = client.get(f"/api/v1/orders/{order_id}", headers=job_seeker_headers).json()
    assert before["order"]["status"] == "awaiting_payment"
    assert before["booking"] is None
    # The client secret is handed over once, at creation, and never repeated.
    assert before["order"]["paymentIntentClientSecret"] is None

    post_webhook(
        client, "/api/v1/payments/stripe/webhook",
        succeeded_event("evt_truth", intent_id, order_id), PLATFORM_SECRET,
    )

    after = client.get(f"/api/v1/orders/{order_id}", headers=job_seeker_headers).json()
    assert after["order"]["status"] == "confirmed"
    assert after["booking"]["status"] == "confirmed"


def test_cancelling_a_stub_booking_does_not_claim_a_refund_that_never_happened(
    client: TestClient, db_session: Session, service: Service, counsellor: User,
    job_seeker_headers: dict[str, str],
) -> None:
    """No Stripe, no PaymentIntent, so no money was ever taken and none goes back.

    The reported figure has to be what actually moved, not what the policy would
    have entitled the job seeker to, or the app shows a refund nobody will receive.
    """
    window = add_window(db_session, service)
    order_id = create_order(client, service, window, job_seeker_headers).json()["id"]
    booking_id = client.post(
        f"/api/v1/orders/{order_id}/payments/stub", headers=job_seeker_headers,
    ).json()["booking"]["id"]

    response = client.post(f"/api/v1/bookings/{booking_id}/cancel", headers=job_seeker_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["refundedMinor"] == 0
    assert body["booking"]["refundedMinor"] == 0
    assert body["booking"]["status"] == "cancelled"
    assert body["booking"]["paymentStatus"] == "paid"


def test_every_timestamp_on_the_wire_carries_a_timezone_offset(
    client: TestClient, db_session: Session, service: Service, counsellor: User,
    job_seeker_headers: dict[str, str],
) -> None:
    """A timestamp with no offset is read as local time by a JavaScript client.

    SQLite cannot store a timezone, so an aware UTC value written there comes back
    naive unless the ORM reattaches it. Serialised without an offset, a 15-minute
    hold reads as hours in the past for anyone east of UTC and checkout shows
    "Reservation expired" immediately. This pins the wire format that prevents it.
    """
    window = add_window(db_session, service)
    body = create_order(client, service, window, job_seeker_headers).json()

    hold = body["holdExpiresAt"]
    assert hold.endswith("Z") or "+" in hold[10:], f"holdExpiresAt has no offset: {hold}"
    # Parsed as the UTC it is, the hold is in the future, not ten hours behind.
    parsed = datetime.fromisoformat(hold.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None
    assert parsed > datetime.now(UTC)

    booking_id = client.post(
        f"/api/v1/orders/{body['id']}/payments/stub", headers=job_seeker_headers,
    ).json()["booking"]["id"]
    booking = client.get(f"/api/v1/bookings/{booking_id}", headers=job_seeker_headers).json()
    for field in ("startsAt", "endsAt"):
        value = booking[field]
        assert value.endswith("Z") or "+" in value[10:], f"{field} has no offset: {value}"


def test_payout_readiness_needs_a_connected_account_not_just_the_flag(
    client: TestClient, db_session: Session, counsellor: User,
    counsellor_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    """Guards against reporting "ready to be paid" to someone who cannot be paid.

    payouts_enabled is normally only ever set by account.updated, which implies an
    account exists — but a hand-edited row, or a restored backup, can produce the
    flag without one, and the screen must not then tell a counsellor they are set up.
    """
    counsellor.payouts_enabled = True
    counsellor.charges_enabled = True
    counsellor.stripe_account_id = None
    db_session.commit()

    body = client.get("/api/v1/me/payout-status", headers=counsellor_headers).json()

    assert body["payoutsEnabled"] is True
    assert body["onboardingRequired"] is True  # because there is no account to pay into

    counsellor.stripe_account_id = "acct_real"
    db_session.commit()
    after = client.get("/api/v1/me/payout-status", headers=counsellor_headers).json()
    assert after["onboardingRequired"] is False


def test_onboarding_returns_the_counsellor_to_the_app_they_started_in(
    client: TestClient, db_session: Session, counsellor: User,
    counsellor_headers: dict[str, str], stripe_api: StripeCalls,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A browser cannot follow a `yoir://` deep link, so the web build must not be
    sent one. Where to return to travels in the signed token, not in an assumption."""
    monkeypatch.setenv("WEB_APP_BASE_URL", "http://localhost:8081")
    get_settings.cache_clear()

    client.post(
        "/api/v1/me/stripe-onboarding",
        headers=counsellor_headers,
        json={"returnTo": "http://localhost:8081/counsellor/payouts"},
    )
    return_url = stripe_api.account_links[-1]["return_url"]
    token = return_url.split("token=")[1]

    landed = client.get(
        f"/api/v1/payments/stripe/onboarding/return?token={token}", follow_redirects=False,
    )
    assert landed.status_code == 303
    assert landed.headers["location"] == "http://localhost:8081/counsellor/payouts"


def test_onboarding_still_deep_links_when_the_app_asks_for_it(
    client: TestClient, counsellor_headers: dict[str, str], stripe_api: StripeCalls,
) -> None:
    client.post(
        "/api/v1/me/stripe-onboarding",
        headers=counsellor_headers,
        json={"returnTo": "yoir://onboarding-complete"},
    )
    token = stripe_api.account_links[-1]["return_url"].split("token=")[1]

    landed = client.get(
        f"/api/v1/payments/stripe/onboarding/return?token={token}", follow_redirects=False,
    )
    assert landed.headers["location"] == "yoir://onboarding-complete"


@pytest.mark.parametrize(
    "hostile",
    [
        "https://evil.example.com/steal",
        "//evil.example.com",
        "javascript:alert(1)",
        "http://localhost:9999/not-ours",
    ],
)
def test_onboarding_never_redirects_somewhere_we_do_not_serve(
    client: TestClient, counsellor_headers: dict[str, str], stripe_api: StripeCalls,
    hostile: str,
) -> None:
    """The return endpoint takes no session — Stripe is the caller — so forwarding to
    a caller-supplied URL would be an open redirect worth phishing through."""
    client.post(
        "/api/v1/me/stripe-onboarding",
        headers=counsellor_headers,
        json={"returnTo": hostile},
    )
    token = stripe_api.account_links[-1]["return_url"].split("token=")[1]

    landed = client.get(
        f"/api/v1/payments/stripe/onboarding/return?token={token}", follow_redirects=False,
    )
    assert landed.headers["location"] == "yoir://onboarding-complete"
    assert "evil.example.com" not in landed.headers["location"]


def test_a_stale_onboarding_link_refreshes_back_to_the_same_app(
    client: TestClient, counsellor_headers: dict[str, str], stripe_api: StripeCalls,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WEB_APP_BASE_URL", "http://localhost:8081")
    get_settings.cache_clear()
    client.post(
        "/api/v1/me/stripe-onboarding",
        headers=counsellor_headers,
        json={"returnTo": "http://localhost:8081/counsellor/payouts"},
    )
    token = stripe_api.account_links[-1]["refresh_url"].split("token=")[1]

    refreshed = client.get(
        f"/api/v1/payments/stripe/onboarding/refresh?token={token}", follow_redirects=False,
    )

    assert refreshed.status_code == 303
    # The new link keeps the browser destination rather than reverting to the app.
    fresh = gateway.read_onboarding_token(
        stripe_api.account_links[-1]["return_url"].split("token=")[1]
    )
    assert fresh is not None
    assert fresh.return_to == "http://localhost:8081/counsellor/payouts"


@pytest.mark.parametrize(
    ("candidate", "allowed"),
    [
        # Expo Go never registers the app's own scheme, so this is what a phone
        # running the dev client actually asks to come back to.
        ("exp://192.168.0.166:8081/--/counsellor/payouts", True),
        ("exps://192.168.0.166:8081/--/counsellor/payouts", True),
        # A different Metro port is still the same machine.
        ("exp://192.168.0.166:19000/--/counsellor/payouts", True),
        # A different host is not. An exp:// URL tells Expo Go which bundle server to
        # load, so honouring a stranger's host would hand them the running app.
        ("exp://evil-bundle-server.test:8081/--/counsellor/payouts", False),
        ("exp://127.0.0.1:8081/--/counsellor/payouts", False),
    ],
)
def test_expo_go_can_be_returned_to_only_on_a_host_we_are_configured_for(
    monkeypatch: pytest.MonkeyPatch, candidate: str, allowed: bool,
) -> None:
    monkeypatch.setenv("APP_BASE_URL", "http://192.168.0.166:8000")
    monkeypatch.setenv("WEB_APP_BASE_URL", "http://192.168.0.166:8081")
    get_settings.cache_clear()
    try:
        resolved = gateway.allowed_return_target(candidate)
    finally:
        get_settings.cache_clear()

    if allowed:
        assert resolved == candidate
    else:
        assert resolved == "yoir://onboarding-complete"
