"""Payments spec §8 — Stripe's two webhook endpoints, plus the Connect redirects.

They take no bearer token, because Stripe is the caller. What stands in for
authentication is the signature over the raw request body, so every handler reads
`await request.body()` and hands those exact bytes to the gateway: parsing the JSON
first and re-encoding it would change the bytes, and the signature would no longer
verify.

Stripe retries on any non-2xx and can deliver the same event twice, so each event id
is claimed in the same transaction that applies its effect. A handler that fails
leaves neither the claim nor the change behind, and the retry does the work.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import NOT_FOUND, VALIDATION_ERROR, ApiError
from app.models import Booking, Order, ProcessedWebhookEvent, User
from app.payments import gateway, notifications
from app.payments.service import confirm_paid_order, refund_slot_taken, time_is_available_for
from app.schemas import WebhookAck

log = logging.getLogger(__name__)

router = APIRouter(prefix="/payments/stripe", tags=["Orders"])


def _verified_event(
    payload: bytes, signature: str | None, secret: str,
) -> gateway.WebhookEvent:
    try:
        return gateway.construct_event(payload, signature, secret)
    except gateway.PaymentProviderError as error:
        # 400, never 500: a bad signature is a rejected request, and a 5xx would
        # put Stripe into a retry loop over something no retry can fix.
        raise ApiError(status.HTTP_400_BAD_REQUEST, VALIDATION_ERROR, str(error)) from error


def _claim_event(db: Session, event: gateway.WebhookEvent) -> bool:
    """Record this event id, or report that another delivery already has it."""
    db.add(ProcessedWebhookEvent(event_id=event.id, event_type=event.type))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        log.info("Ignoring Stripe event %s: already processed.", event.id)
        return False
    return True


def _order_for_intent(db: Session, intent: dict[str, Any]) -> Order | None:
    """Find the order this PaymentIntent belongs to.

    The stored id is the primary route; the metadata written at creation is the
    fallback for the window where Stripe answered but the id had not been saved yet.
    """
    order = db.scalar(
        select(Order).where(Order.payment_intent_id == intent["id"]).with_for_update()
    )
    if order is not None:
        return order
    order_id = (intent.get("metadata") or {}).get("order_id")
    if not order_id:
        return None
    return db.scalar(select(Order).where(Order.id == order_id).with_for_update())


# --- platform events -------------------------------------------------------


@router.post("/webhook", response_model=WebhookAck)
async def platform_webhook(request: Request, db: Session = Depends(get_db)) -> WebhookAck:
    """Events on the platform account: the job seeker's payment and any dispute."""
    settings = get_settings()
    event = _verified_event(
        await request.body(),
        request.headers.get("stripe-signature"),
        settings.stripe_webhook_secret,
    )
    if not _claim_event(db, event):
        return WebhookAck(received=True)

    handler = {
        "payment_intent.succeeded": _payment_succeeded,
        "payment_intent.payment_failed": _payment_failed,
        "charge.dispute.created": _dispute_created,
    }.get(event.type)
    if handler is not None:
        handler(db, event.data_object)
    else:
        log.debug("No handler for Stripe event type %s", event.type)
    db.commit()
    return WebhookAck(received=True)


def _payment_succeeded(db: Session, intent: dict[str, Any]) -> None:
    """The job seeker has paid. Confirm the booking, or refund if the slot is gone."""
    order = _order_for_intent(db, intent)
    if order is None:
        log.warning("payment_intent.succeeded for unknown order: %s", intent["id"])
        return
    if not order.payment_intent_id:
        order.payment_intent_id = intent["id"]
    if order.status == "refunded_slot_taken":
        return
    if db.scalar(select(Booking).where(Booking.order_id == order.id)) is not None:
        return  # Already confirmed by an earlier delivery of this same payment.

    if time_is_available_for(db, order):
        # Covers both "still held for us" and "the hold lapsed but nobody took it",
        # which the spec treats the same way: the job seeker paid, so they get the time.
        confirm_paid_order(db, order)
    else:
        refund_slot_taken(db, order)


def _payment_failed(db: Session, intent: dict[str, Any]) -> None:
    """Record the failure only. The order keeps its hold so the job seeker can retry
    with another card; the release job frees the slot when the hold runs out."""
    order = _order_for_intent(db, intent)
    if order is None or order.status != "awaiting_payment":
        return
    order.payment_status = "failed"
    log.info("Payment failed for order %s", order.id)


def _dispute_created(db: Session, charge_dispute: dict[str, Any]) -> None:
    """Flag the booking for admin review, which also holds back its payout (spec §9)."""
    intent_id = charge_dispute.get("payment_intent")
    if not intent_id:
        return
    order = db.scalar(select(Order).where(Order.payment_intent_id == intent_id))
    if order is None:
        return
    booking = db.scalar(select(Booking).where(Booking.order_id == order.id))
    if booking is None:
        return
    booking.flagged_for_review = True
    booking.review_reason = f"Stripe dispute: {charge_dispute.get('reason', 'unknown')}"
    notifications.dispute_opened(booking, booking.review_reason)


# --- connected account events ----------------------------------------------


@router.post("/webhook/connect", response_model=WebhookAck)
async def connect_webhook(request: Request, db: Session = Depends(get_db)) -> WebhookAck:
    """Events on counsellors' connected accounts, signed with their own secret."""
    settings = get_settings()
    event = _verified_event(
        await request.body(),
        request.headers.get("stripe-signature"),
        settings.stripe_connect_webhook_secret,
    )
    if not _claim_event(db, event):
        return WebhookAck(received=True)

    if event.type == "account.updated":
        _account_updated(db, event.data_object)
    else:
        log.debug("No handler for Connect event type %s", event.type)
    db.commit()
    return WebhookAck(received=True)


def _account_updated(db: Session, account: dict[str, Any]) -> None:
    """Stripe is the only authority on whether a counsellor can be paid.

    These two flags are never set from the app or inferred from the counsellor
    reaching the end of onboarding — Stripe can still be waiting on verification.
    """
    counsellor = db.scalar(select(User).where(User.stripe_account_id == account["id"]))
    if counsellor is None:
        log.warning("account.updated for an account no counsellor claims: %s", account["id"])
        return
    counsellor.charges_enabled = bool(account.get("charges_enabled"))
    counsellor.payouts_enabled = bool(account.get("payouts_enabled"))
    log.info(
        "Counsellor %s payouts_enabled=%s charges_enabled=%s",
        counsellor.id, counsellor.payouts_enabled, counsellor.charges_enabled,
    )


# --- Connect onboarding redirects ------------------------------------------


@router.get("/onboarding/return")
def onboarding_return(token: str = "") -> Response:
    """Where Stripe sends the counsellor when they finish the hosted flow.

    Reaching this page is not evidence that onboarding succeeded — Stripe sends
    people here whether or not it did. The app bounces back in and re-reads
    /me/payout-status, which is answered from account.updated webhooks.

    Where "back" is depends on which app they started in, so it travels in the
    signed token rather than being assumed: a browser cannot follow a `yoir://`
    deep link, and a device cannot usefully land on the web build.
    """
    settings = get_settings()
    claims = gateway.read_onboarding_token(token) if token else None
    target = claims.return_to if claims else (
        f"{settings.app_deep_link_scheme}://onboarding-complete"
    )
    return RedirectResponse(url=target, status_code=status.HTTP_303_SEE_OTHER)


@router.get("/onboarding/refresh")
def onboarding_refresh(token: str = "") -> Response:
    """Stripe sends the counsellor here when their Account Link has expired.

    The request carries no session, so the account id travels in the signed token
    this server put in the link. An unsigned or tampered token gets nothing: minting
    Account Links for arbitrary account ids would be a way to probe them.
    """
    claims = gateway.read_onboarding_token(token) if token else None
    if claims is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "This onboarding link has expired.")
    try:
        # Carry the original destination into the new link, so a counsellor whose
        # link went stale still comes back to the app they started in.
        url = gateway.create_account_link(claims.account_id, claims.return_to)
    except gateway.PaymentProviderError as error:
        raise ApiError(
            status.HTTP_502_BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", str(error),
        ) from error
    return RedirectResponse(url=url, status_code=status.HTTP_303_SEE_OTHER)
