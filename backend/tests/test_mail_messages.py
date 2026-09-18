"""Every email the application composes, actually composed.

`test_mail.py` covers rendering and the Mailgun adapter separately, and that gap is
not theoretical: a keyword collision in the delivery helper made every registration
return 500 while both of those suites stayed green. So each of these calls the real
`messages` function with real domain objects and only stubs the network.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from app.config import get_settings
from app.mail import messages
from app.mail.sender import Message
from app.models import Booking, Order, Service, User
from app.payments.receipts import Receipt


@pytest.fixture
def outbox(monkeypatch: pytest.MonkeyPatch) -> list[Message]:
    """Capture what would be sent, after it has genuinely been rendered."""
    captured: list[Message] = []

    def capture(message: Message, settings: Any = None) -> bool:
        captured.append(message)
        return True

    monkeypatch.setattr(messages, "send", capture)
    return captured


def receipt(*, is_tax_invoice: bool = True) -> Receipt:
    return Receipt(
        receipt_number="YOIR-2026-000042",
        issued_at=datetime(2026, 9, 18, 3, 0, tzinfo=UTC),
        is_tax_invoice=is_tax_invoice,
        supplier_name="Maya Chen",
        supplier_abn="12 345 678 901" if is_tax_invoice else None,
        buyer_name="Alex Tester",
        description="Interview confidence coaching",
        session_starts_at=datetime(2026, 10, 2, 23, 0, tzinfo=UTC),
        total_minor=9500,
        gst_minor=864 if is_tax_invoice else 0,
        currency="AUD",
    )


def booking_fixtures(*, modality: str = "online", meeting_url: str = "") -> tuple:
    counsellor = User(
        id="counsellor-1", name="Maya Chen", email="maya@example.com",
        password_hash="x", role="counsellor",
    )
    job_seeker = User(
        id="seeker-1", name="Alex Tester", email="alex@example.com",
        password_hash="x", role="job_seeker",
    )
    service = Service(
        id="service-1", counsellor_id=counsellor.id, title="Interview confidence coaching",
        description="Practice and feedback.", price_minor=9500, currency="AUD",
        modalities=[modality], location_city="Melbourne", location_state="VIC",
    )
    order = Order(id="order-1", amount_minor=9500, currency="AUD")
    booking = Booking(
        id="booking-1", starts_at=datetime(2026, 10, 2, 23, 0, tzinfo=UTC),
        timezone="Australia/Melbourne", modality=modality, meeting_url=meeting_url,
    )
    return booking, order, service, job_seeker, counsellor


def both_parts(message: Message) -> str:
    return message.html + "\n" + message.text


# --- the account emails -----------------------------------------------------


def test_verify_email_composes_a_confirmation_link(outbox: list[Message]) -> None:
    assert messages.verify_email("alex@example.com", "Alex Tester", "tok-123", 24) is True

    (message,) = outbox
    assert message.to == "alex@example.com"
    assert message.subject == "Confirm your email"
    link = f"{get_settings().app_web_url.rstrip('/')}/auth/verify?token=tok-123"
    assert link in message.html
    assert link in message.text
    assert "Alex Tester" in both_parts(message)
    assert "24" in both_parts(message)


def test_password_reset_composes_a_reset_link(outbox: list[Message]) -> None:
    assert messages.password_reset("alex@example.com", "Alex Tester", "tok-456", 2) is True

    (message,) = outbox
    assert message.subject == "Reset your password"
    link = f"{get_settings().app_web_url.rstrip('/')}/auth/reset?token=tok-456"
    assert link in message.html
    assert link in message.text


@pytest.mark.parametrize(
    ("call", "expected_link"),
    [
        (lambda: messages.verify_email("a@example.com", "A", "t", 24), "/auth/verify?token=t"),
        (lambda: messages.password_reset("a@example.com", "A", "t", 2), "/auth/reset?token=t"),
    ],
)
def test_account_emails_never_carry_the_other_purpose_link(
    outbox: list[Message], call: Any, expected_link: str
) -> None:
    """A confirmation email carrying a reset URL would hand an account over on a typo."""
    call()

    (message,) = outbox
    other = "/auth/reset?" if "verify" in expected_link else "/auth/verify?"
    assert expected_link in message.text
    assert other not in both_parts(message)


# --- the booking confirmation -----------------------------------------------


def test_booking_confirmed_carries_joining_details_and_the_receipt(
    outbox: list[Message],
) -> None:
    booking, order, service, job_seeker, counsellor = booking_fixtures(
        meeting_url="https://meet.jit.si/yoir-booking-1"
    )

    assert messages.booking_confirmed(
        booking, order, service, job_seeker, counsellor, receipt()
    ) is True

    (message,) = outbox
    assert message.to == "alex@example.com"
    assert message.subject == "Your session with Maya Chen is booked"
    for part in (message.html, message.text):
        assert "https://meet.jit.si/yoir-booking-1" in part
        assert "Interview confidence coaching" in part
        assert "YOIR-2026-000042" in part
        assert "TAX INVOICE" in part
        assert "$95.00" in part
        assert "$8.64" in part
        # Named as the counsellor's supply, not the platform's: that is the whole
        # reason these are our receipts rather than Stripe Invoices.
        assert "Maya Chen" in part
        assert "12 345 678 901" in part


def test_a_non_gst_receipt_says_so_instead_of_showing_a_zero(outbox: list[Message]) -> None:
    booking, order, service, job_seeker, counsellor = booking_fixtures(
        meeting_url="https://meet.jit.si/yoir-booking-1"
    )

    messages.booking_confirmed(
        booking, order, service, job_seeker, counsellor, receipt(is_tax_invoice=False)
    )

    (message,) = outbox
    for part in (message.html, message.text):
        assert "TAX INVOICE" not in part
        assert "RECEIPT" in part.upper()
        assert "No GST has been charged" in part
        assert "$0.00" not in part


def test_an_in_person_booking_names_the_area_instead_of_a_link(outbox: list[Message]) -> None:
    booking, order, service, job_seeker, counsellor = booking_fixtures(modality="in_person")

    messages.booking_confirmed(booking, order, service, job_seeker, counsellor, receipt())

    (message,) = outbox
    for part in (message.html, message.text):
        assert "Melbourne, VIC" in part
        assert "meet.jit.si" not in part
    assert "In person" in message.text


def test_the_cancellation_terms_match_the_configured_policy(outbox: list[Message]) -> None:
    """The email must not invent a refund promise the cancellation endpoint will not keep."""
    settings = get_settings()
    booking, order, service, job_seeker, counsellor = booking_fixtures()

    messages.booking_confirmed(booking, order, service, job_seeker, counsellor, receipt())

    (message,) = outbox
    assert f"{settings.cancellation_full_refund_hours} hours" in message.text
    if settings.cancellation_late_refund_percent:
        assert f"{settings.cancellation_late_refund_percent}%" in message.text
    else:
        assert "is not refunded" in message.text


def test_the_counsellor_is_told_about_a_new_booking(outbox: list[Message]) -> None:
    """Without this the counsellor has no idea anyone is coming: the job seeker's
    confirmation goes only to the job seeker."""
    booking, order, service, job_seeker, counsellor = booking_fixtures(
        meeting_url="https://meet.jit.si/yoir-booking-1"
    )
    order.counsellor_payout_minor = 7600

    assert messages.booking_received(booking, order, service, job_seeker, counsellor) is True

    (message,) = outbox
    assert message.to == "maya@example.com"
    assert message.subject == "New booking: Interview confidence coaching"
    for part in (message.html, message.text):
        assert "Alex Tester" in part
        assert "https://meet.jit.si/yoir-booking-1" in part
        assert "$76.00" in part


def test_the_counsellors_email_carries_no_receipt(outbox: list[Message]) -> None:
    """They are the supplier, not the buyer. Their commission is invoiced separately
    on the monthly statement, so a receipt here would misdescribe the transaction."""
    booking, order, service, job_seeker, counsellor = booking_fixtures()
    order.counsellor_payout_minor = 7600

    messages.booking_received(booking, order, service, job_seeker, counsellor)

    (message,) = outbox
    for part in (message.html, message.text):
        assert "TAX INVOICE" not in part.upper()
        assert "YOIR-2026" not in part


def test_the_counsellor_sees_their_payout_not_the_gross(outbox: list[Message]) -> None:
    """Showing the price the job seeker paid would overstate what they are owed."""
    booking, order, service, job_seeker, counsellor = booking_fixtures()
    order.amount_minor = 9500
    order.counsellor_payout_minor = 7600

    messages.booking_received(booking, order, service, job_seeker, counsellor)

    (message,) = outbox
    assert "$76.00" in message.text
    assert "$95.00" not in message.text


def test_an_in_person_booking_tells_the_counsellor_to_make_contact(
    outbox: list[Message],
) -> None:
    booking, order, service, job_seeker, counsellor = booking_fixtures(modality="in_person")
    order.counsellor_payout_minor = 7600

    messages.booking_received(booking, order, service, job_seeker, counsellor)

    (message,) = outbox
    for part in (message.html, message.text):
        assert "Melbourne, VIC" in part
        assert "meet.jit.si" not in part


# --- failure is absorbed, never raised --------------------------------------


def test_a_broken_template_is_logged_and_does_not_raise(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Booking confirmation is composed inside the Stripe webhook. Raising there
    returns a non-2xx, and Stripe redelivers an event for a booking already made."""
    def explode(*_args: Any, **_kwargs: Any) -> Any:
        raise RuntimeError("template is broken")

    monkeypatch.setattr(messages, "render", explode)
    caplog.set_level("ERROR")

    assert messages.verify_email("alex@example.com", "Alex", "tok", 24) is False
    assert "alex@example.com" in caplog.text
