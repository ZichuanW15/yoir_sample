"""Public payment configuration the Expo app reads before it can take a payment."""

from fastapi import APIRouter

from app.config import get_settings
from app.schemas import PaymentConfigOut

router = APIRouter(tags=["Payments"])


@router.get("/payments/config", response_model=PaymentConfigOut)
def payment_config() -> PaymentConfigOut:
    """The publishable key and the policy numbers the checkout screen has to show.

    Serving these rather than baking them into the app bundle means rotating a
    Stripe key, or moving from test to live, does not need a new build in the
    stores. The publishable key is designed to be public; nothing secret is here.
    """
    settings = get_settings()
    return PaymentConfigOut(
        provider="stripe" if settings.payments_enabled else "stub",
        publishable_key=settings.stripe_publishable_key or None,
        merchant_display_name=settings.merchant_display_name,
        slot_hold_minutes=settings.slot_hold_minutes,
        cancellation_full_refund_hours=settings.cancellation_full_refund_hours,
        cancellation_late_refund_percent=settings.cancellation_late_refund_percent,
    )
