"""The only module that talks to Stripe.

Everything above it — routers, webhooks, jobs — goes through these functions, so
the whole payment feature has exactly one seam to mock in tests (spec §14) and one
place where the secret key is read.

Stripe failures surface as PaymentProviderError rather than a stripe exception, so
a router can turn one into the project's error envelope and a background job can
log it and try the same booking again on the next tick. Retries are safe because
every creating call carries an idempotency key derived from the row it belongs to.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import stripe

from app.config import Settings, get_settings
from app.models import Order, User

log = logging.getLogger(__name__)

CURRENCY = "aud"
COUNTRY = "AU"


class PaymentProviderError(Exception):
    """A Stripe call failed. Carries a message safe to show a user."""

    def __init__(self, message: str, cause: Exception | None = None) -> None:
        super().__init__(message)
        self.cause = cause


class PaymentsDisabled(PaymentProviderError):
    """No STRIPE_SECRET_KEY is configured, so this deployment has no live payments."""

    def __init__(self) -> None:
        super().__init__("Card payments are not configured on this server.")


def _fail(operation: str, message: str, error: stripe.StripeError) -> PaymentProviderError:
    """Log why Stripe refused, then raise the message a user should see.

    The two are deliberately different. A counsellor cannot act on "you have not
    signed up for Connect" — that is the platform's own misconfiguration — but
    whoever is running the server has to be able to find it without attaching a
    debugger, so the real reason goes to the log with the operation that caused it.
    """
    log.error(
        "Stripe refused %s: %s (status=%s, code=%s, request_id=%s)",
        operation,
        getattr(error, "user_message", None) or str(error),
        getattr(error, "http_status", None),
        getattr(error, "code", None),
        getattr(error, "request_id", None),
    )
    return PaymentProviderError(message, error)


def _api(settings: Settings | None = None) -> Any:
    settings = settings or get_settings()
    if not settings.payments_enabled:
        raise PaymentsDisabled()
    stripe.api_key = settings.stripe_secret_key
    return stripe


def transfer_group(order_id: str) -> str:
    """Ties the charge and the later payout together in Stripe's own reporting."""
    return f"booking_{order_id}"


# --- job seeker payments ---------------------------------------------------


def create_payment_intent(order: Order, counsellor_id: str) -> Any:
    """Charge the job seeker into the platform balance (separate charges and transfers).

    No `transfer_data` and no `on_behalf_of`: the counsellor's share moves later, by
    Transfer, once the session has actually happened. `on_behalf_of` stays out until
    the client's accountant rules on it (spec §3).
    """
    api = _api()
    try:
        return api.PaymentIntent.create(
            amount=order.amount_minor,
            currency=CURRENCY,
            automatic_payment_methods={"enabled": True},
            transfer_group=transfer_group(order.id),
            metadata={
                "order_id": order.id,
                "counsellor_id": counsellor_id,
                "job_seeker_id": order.job_seeker_id,
            },
            idempotency_key=f"booking-{order.id}",
        )
    except stripe.StripeError as error:
        message = "We could not start the payment. Please try again."
        raise _fail("PaymentIntent.create", message, error) from error


def retrieve_payment_intent(payment_intent_id: str) -> Any:
    try:
        return _api().PaymentIntent.retrieve(payment_intent_id)
    except stripe.StripeError as error:
        raise _fail("PaymentIntent.retrieve", "We could not read the payment.", error) from error


def cancel_payment_intent(payment_intent_id: str) -> None:
    """Release an uncaptured PaymentIntent when its slot hold lapses (spec §9).

    An intent that already succeeded cannot be cancelled; that is the racing
    webhook's problem to refund, not an error here.
    """
    try:
        _api().PaymentIntent.cancel(payment_intent_id)
    except stripe.InvalidRequestError as error:
        log.info("PaymentIntent %s could not be cancelled: %s", payment_intent_id, error)
    except stripe.StripeError as error:
        raise _fail("PaymentIntent.cancel", "We could not cancel the payment.", error) from error


def refund_payment_intent(
    payment_intent_id: str,
    amount_minor: int | None = None,
    *,
    idempotency_key: str | None = None,
    reason: str | None = None,
) -> Any:
    """Refund a succeeded payment. `amount_minor` None means the full amount."""
    params: dict[str, Any] = {"payment_intent": payment_intent_id}
    if amount_minor is not None:
        params["amount"] = amount_minor
    if reason is not None:
        params["reason"] = reason
    if idempotency_key is not None:
        params["idempotency_key"] = idempotency_key
    try:
        return _api().Refund.create(**params)
    except stripe.StripeError as error:
        raise _fail("Refund.create", "We could not issue the refund.", error) from error


# --- counsellor onboarding and payouts -------------------------------------


def create_connected_account(counsellor: User) -> Any:
    """Accounts v1 with controller properties, per spec §7.

    The platform pays Stripe's fees and carries payment losses, and the counsellor
    gets an Express dashboard — the controller block, not a legacy `type`, is what
    says so on the current API.
    """
    api = _api()
    try:
        return api.Account.create(
            country=COUNTRY,
            email=counsellor.email,
            business_type="individual",
            controller={
                "stripe_dashboard": {"type": "express"},
                "fees": {"payer": "application"},
                "losses": {"payments": "application"},
            },
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
            metadata={"counsellor_id": counsellor.id},
        )
    except stripe.StripeError as error:
        raise _fail("Account.create", "We could not start payout setup.", error) from error


def create_account_link(
    account_id: str, return_to: str | None = None, settings: Settings | None = None,
) -> str:
    """A single-use onboarding URL. It expires within minutes, so never cache one."""
    settings = settings or get_settings()
    api = _api(settings)
    # Mirrors the published contract's /payments/stripe/* grouping.
    base = f"{settings.app_base_url.rstrip('/')}/api/v1/payments/stripe"
    token = onboarding_token(account_id, return_to)
    try:
        link = api.AccountLink.create(
            account=account_id,
            type="account_onboarding",
            # Stripe sends the counsellor back here when the link goes stale. The
            # signed token is how that unauthenticated request says who it is for.
            # Both carry the same signed token, so whichever way Stripe sends the
            # counsellor back, the server knows which app to return them to.
            refresh_url=f"{base}/onboarding/refresh?token={token}",
            return_url=f"{base}/onboarding/return?token={token}",
        )
    except stripe.StripeError as error:
        raise _fail("AccountLink.create", "We could not start payout setup.", error) from error
    return link.url


@dataclass(frozen=True)
class AccountStatus:
    """Whether Stripe will let a connected account be charged for and paid out."""

    charges_enabled: bool
    payouts_enabled: bool


def retrieve_account(account_id: str) -> AccountStatus:
    """Read a connected account's readiness.

    Returns plain booleans rather than the SDK's Account object: a StripeObject is
    not a mapping and raises on .get(), so handing one to a caller invites exactly
    that mistake. Flattening here matches how webhook payloads are handled.
    """
    try:
        account = _api().Account.retrieve(account_id)
    except stripe.StripeError as error:
        raise _fail("Account.retrieve", "We could not read the payout account.", error) from error
    return AccountStatus(
        charges_enabled=bool(getattr(account, "charges_enabled", False)),
        payouts_enabled=bool(getattr(account, "payouts_enabled", False)),
    )


def create_transfer(
    booking_id: str,
    order_id: str,
    destination_account_id: str,
    amount_minor: int,
    source_transaction: str | None,
) -> Any:
    """Pay the counsellor their share after the session (spec §9).

    `source_transaction` pins the transfer to the charge that funded it, so the
    money moves out of that specific payment rather than the platform's float.
    """
    params: dict[str, Any] = {
        "amount": amount_minor,
        "currency": CURRENCY,
        "destination": destination_account_id,
        "transfer_group": transfer_group(order_id),
        "idempotency_key": f"transfer-{booking_id}",
        "metadata": {"booking_id": booking_id, "order_id": order_id},
    }
    if source_transaction:
        params["source_transaction"] = source_transaction
    try:
        return _api().Transfer.create(**params)
    except stripe.StripeError as error:
        raise _fail(
            "Transfer.create", "We could not pay the Career Professional.", error,
        ) from error


def reverse_transfer(transfer_id: str, amount_minor: int, *, idempotency_key: str) -> Any:
    """Claw the counsellor's share back before refunding a paid-out booking (spec §10)."""
    try:
        return _api().Transfer.create_reversal(
            transfer_id,
            amount=amount_minor,
            idempotency_key=idempotency_key,
        )
    except stripe.StripeError as error:
        raise _fail(
            "Transfer.create_reversal",
            "We could not reverse the Career Professional payout.",
            error,
        ) from error


# --- webhooks --------------------------------------------------------------


@dataclass(frozen=True)
class WebhookEvent:
    """A verified Stripe event, flattened to plain data.

    The SDK hands back a StripeObject, which is neither a dict nor safely
    attribute-accessed, so handlers would have to know its quirks. They get plain
    dicts instead, which also makes them straightforward to call directly in a test.
    """

    id: str
    type: str
    data_object: dict[str, Any]


def construct_event(payload: bytes, signature: str | None, secret: str) -> WebhookEvent:
    """Verify a webhook signature against the raw request body.

    Parsing the body first and re-serialising it would change the bytes and fail
    verification, so callers must hand over exactly what arrived on the wire. Only
    once the signature checks out is the payload parsed.
    """
    if not secret:
        raise PaymentProviderError("This server has no webhook signing secret configured.")
    try:
        stripe.Webhook.construct_event(payload, signature, secret)
    except (stripe.SignatureVerificationError, ValueError) as error:
        log.warning("Rejected a webhook with an unverifiable signature: %s", error)
        raise PaymentProviderError("The webhook signature could not be verified.", error) from error

    try:
        body = json.loads(payload)
        return WebhookEvent(
            id=body["id"],
            type=body["type"],
            data_object=body["data"]["object"],
        )
    except (ValueError, KeyError, TypeError) as error:
        raise PaymentProviderError("The webhook payload was not a Stripe event.", error) from error


# --- onboarding refresh tokens ---------------------------------------------


def allowed_return_target(return_to: str | None, settings: Settings | None = None) -> str:
    """Resolve where onboarding should send the counsellor back to.

    Only two shapes are honoured: this app's own deep link scheme, and an origin we
    actually serve the web build from. Anything else falls back to the deep link and
    is never redirected to — a redirect endpoint that forwards to a caller-supplied
    URL is an open redirect, and this one is reachable without a session because
    Stripe is the caller.
    """
    settings = settings or get_settings()
    native = f"{settings.app_deep_link_scheme}://onboarding-complete"
    if not return_to:
        return native
    if return_to.startswith(f"{settings.app_deep_link_scheme}://"):
        return return_to

    parsed = urlsplit(return_to)
    if not parsed.netloc:
        return native
    bases = [urlsplit(base) for base in (settings.web_app_base_url, settings.app_base_url) if base]

    if parsed.scheme in ("http", "https"):
        origin = f"{parsed.scheme}://{parsed.netloc}"
        return return_to if origin in {f"{b.scheme}://{b.netloc}" for b in bases} else native

    # Expo Go does not register the app's own scheme — `Linking.createURL()` there
    # yields `exp://<dev server>/--/path` — so development on a phone needs this or
    # onboarding has nowhere to return to. Matched on hostname only, because the
    # Metro port differs from the API port; an exp:// URL tells Expo Go which bundle
    # server to load, so the host must still be a machine we are configured for and
    # never one an attacker names.
    if parsed.scheme in ("exp", "exps"):
        hosts = {b.hostname for b in bases if b.hostname}
        return return_to if parsed.hostname in hosts else native

    return native


def onboarding_token(account_id: str, return_to: str | None = None) -> str:
    """Sign a connected account id, and where to go afterwards, for the redirects.

    Stripe calls refresh_url and return_url with no credentials, so both the account
    id and the destination have to travel in the URL. Signing them with the app's own
    key means the endpoints act only on values this server put there, rather than on
    anything a stranger appends.
    """
    import jwt

    settings = get_settings()
    return jwt.encode(
        {
            "account_id": account_id,
            "purpose": "stripe_onboarding_refresh",
            "return_to": allowed_return_target(return_to, settings),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


@dataclass(frozen=True)
class OnboardingToken:
    account_id: str
    return_to: str


def read_onboarding_token(token: str) -> OnboardingToken | None:
    import jwt

    settings = get_settings()
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    if claims.get("purpose") != "stripe_onboarding_refresh":
        return None
    account_id = claims.get("account_id")
    if not isinstance(account_id, str) or not account_id:
        return None
    # Re-checked on the way out as well as in: a secret that leaked, or an allowlist
    # since narrowed, must not leave an old token able to redirect somewhere we no
    # longer serve.
    return OnboardingToken(
        account_id=account_id,
        return_to=allowed_return_target(claims.get("return_to"), settings),
    )
