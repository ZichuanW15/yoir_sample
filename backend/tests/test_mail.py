"""Transactional email: rendering, and the guarantees the sender makes.

The most important of those is that sending never raises. Booking confirmation runs
inside the Stripe webhook, and a non-2xx there makes Stripe redeliver the event — so
an unreachable mail provider would turn a missing email into a booking confirmed
twice. These tests pin that.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import pytest
import requests

from app.config import get_settings
from app.mail import sender
from app.mail.sender import Message, send
from app.mail.templates import money, render
from app.payments.receipts import Receipt

RECEIPT = Receipt(
    receipt_number="YOIR-ABC123",
    issued_at=datetime(2026, 9, 20, tzinfo=UTC),
    is_tax_invoice=True,
    supplier_name="Maya Chen",
    supplier_abn="12345678901",
    buyer_name="Alex Rivera",
    description="Interview confidence coaching",
    session_starts_at=datetime(2026, 10, 1, 9, tzinfo=UTC),
    total_minor=8800,
    gst_minor=800,
    currency="AUD",
)


@pytest.fixture
def mail_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("MAILGUN_API_KEY", "key-test")
    monkeypatch.setenv("MAILGUN_DOMAIN", "mg.yoir.example")
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


def message() -> Message:
    return Message(to="alex@example.com", subject="Hello", html="<p>Hi</p>", text="Hi")


# --- rendering --------------------------------------------------------------


def test_every_email_has_both_an_html_and_a_text_part() -> None:
    """A message with no text alternative renders badly in some clients and scores
    worse with spam filters — which matters for mail someone is waiting on."""
    html, text = render(
        "verify_email", name="Alex", verify_url="https://x.test/v?token=t", expires_in_hours=24,
    )

    assert html.lstrip().startswith("<!doctype html>")
    assert "<" not in text.replace("<https://", "")  # the text part is not markup
    assert "Alex" in html and "Alex" in text


def test_the_recipients_name_can_be_passed_as_context() -> None:
    """`render` takes its template positionally on purpose: `name` is the most natural
    context variable for a recipient, and a keyword parameter would collide with it."""
    html, _ = render("verify_email", name="Alex", verify_url="https://x.test", expires_in_hours=1)

    assert "Alex" in html


def test_html_in_a_name_cannot_break_out_of_the_markup() -> None:
    html, text = render(
        "verify_email",
        name="<script>alert(1)</script>",
        verify_url="https://x.test",
        expires_in_hours=1,
    )

    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    # ...but the text part is not markup, so it is left alone rather than mangled.
    assert "<script>" in text


def test_a_missing_variable_fails_loudly_rather_than_leaving_a_gap() -> None:
    """StrictUndefined: a blank where a booking time should be is worse than an error."""
    with pytest.raises(Exception, match="expires_in_hours"):
        render("verify_email", name="Alex", verify_url="https://x.test")


def test_a_gst_registered_counsellor_gets_a_tax_invoice_in_the_email() -> None:
    html, text = render(
        "booking_confirmed",
        name="Alex", service_title="Coaching", counsellor_name="Maya Chen",
        when="Thu 1 Oct", details=[("Paid", "$88.00")],
        meeting_url="https://meet.jit.si/yoir-b1", meeting_area="",
        receipt=RECEIPT, cancellation_note="Cancel 24h before.",
    )

    for part in (html, text):
        assert "TAX INVOICE" in part
        assert "12345678901" in part      # the counsellor's ABN, not the platform's
        assert "Maya Chen" in part        # the supplier is the counsellor
        assert "$8.00" in part            # the GST inside the price


def test_an_unregistered_counsellor_gets_a_receipt_that_says_no_gst() -> None:
    plain = Receipt(**{**RECEIPT.__dict__, "is_tax_invoice": False, "gst_minor": 0})

    html, text = render(
        "booking_confirmed",
        name="Alex", service_title="Coaching", counsellor_name="Maya Chen",
        when="Thu 1 Oct", details=[], meeting_url="", meeting_area="Melbourne, VIC",
        receipt=plain, cancellation_note="Cancel 24h before.",
    )

    for part in (html, text):
        assert "TAX INVOICE" not in part
        assert "No GST has been charged" in part


def test_an_online_booking_carries_its_meeting_link_and_an_in_person_one_does_not() -> None:
    common: dict[str, Any] = dict(
        name="Alex", service_title="Coaching", counsellor_name="Maya",
        when="Thu", details=[], receipt=RECEIPT, cancellation_note="x",
    )

    online, _ = render(
        "booking_confirmed", meeting_url="https://meet.jit.si/yoir-b1", meeting_area="", **common,
    )
    in_person, in_person_text = render(
        "booking_confirmed", meeting_url="", meeting_area="Melbourne, VIC", **common,
    )

    assert "meet.jit.si" in online
    assert "meet.jit.si" not in in_person
    assert "Melbourne, VIC" in in_person_text


def test_money_is_formatted_once_so_templates_never_do_arithmetic() -> None:
    assert money(8800) == "$88.00"
    assert money(0) == "$0.00"
    assert money(123456789) == "$1,234,567.89"


# --- the sender -------------------------------------------------------------


def test_without_credentials_the_message_is_logged_and_nothing_is_sent(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The app has to run end to end on a machine with no mail keys, exactly as
    payments fall back to the development stub."""
    get_settings.cache_clear()
    with caplog.at_level(logging.INFO, logger="app.mail.sender"):
        assert send(message()) is False

    assert "would have sent" in caplog.text
    assert "alex@example.com" in caplog.text


def test_a_sandbox_domain_warns_that_delivery_is_restricted(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture,
) -> None:
    """Mailgun accepts sandbox mail to unauthorised addresses and silently drops it,
    which is indistinguishable from a bug in this application."""
    monkeypatch.setenv("MAILGUN_API_KEY", "key-test")
    monkeypatch.setenv("MAILGUN_DOMAIN", "sandbox123.mailgun.org")
    get_settings.cache_clear()
    monkeypatch.setattr(
        sender.requests, "post", lambda *a, **k: type("R", (), {"ok": True})(),
    )
    try:
        with caplog.at_level(logging.WARNING, logger="app.mail.sender"):
            assert send(message()) is True
        assert "sandbox" in caplog.text
        assert "authorised recipient" in caplog.text
    finally:
        get_settings.cache_clear()


def test_an_unreachable_provider_does_not_raise(
    mail_configured, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture,
) -> None:
    """The guarantee the booking flow depends on. A raise here would fail the Stripe
    webhook, and the redelivery would run the confirmation path a second time."""
    def unreachable(*_a: Any, **_k: Any):
        raise requests.ConnectionError("no route to host")

    monkeypatch.setattr(sender.requests, "post", unreachable)

    with caplog.at_level(logging.ERROR, logger="app.mail.sender"):
        assert send(message()) is False

    assert "Could not reach Mailgun" in caplog.text


def test_a_refusal_is_logged_with_the_providers_reason(
    mail_configured, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture,
) -> None:
    """Mailgun's body is the only way to tell an unauthorised sandbox recipient from a
    suppressed address, so it has to reach the log."""
    refused = type("R", (), {"ok": False, "status_code": 401, "text": "Forbidden: bad key"})()
    monkeypatch.setattr(sender.requests, "post", lambda *a, **k: refused)

    with caplog.at_level(logging.ERROR, logger="app.mail.sender"):
        assert send(message()) is False

    assert "Mailgun refused" in caplog.text
    assert "bad key" in caplog.text


def test_a_configured_sender_posts_the_message_to_mailgun(
    mail_configured, monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def capture(url: str, **kwargs: Any):
        captured["url"] = url
        captured.update(kwargs)
        return type("R", (), {"ok": True})()

    monkeypatch.setattr(sender.requests, "post", capture)

    assert send(message()) is True

    assert captured["url"] == "https://api.mailgun.net/v3/mg.yoir.example/messages"
    assert captured["auth"] == ("api", "key-test")
    assert captured["data"]["to"] == "alex@example.com"
    # Both parts always go, and the sender is the configured identity.
    assert captured["data"]["html"] and captured["data"]["text"]
    assert captured["data"]["from"] == "Yoir <postmaster@mg.yoir.example>"
    # A request thread must not be held open by someone else's outage.
    assert captured["timeout"] == sender.TIMEOUT_SECONDS
