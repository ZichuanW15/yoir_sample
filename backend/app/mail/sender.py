"""The only module that talks to Mailgun.

Everything above it goes through `send`, so the whole application has one seam to
mock in tests and one place where the API key is read — the same arrangement as
`app/payments/gateway.py`.

Two decisions worth stating, because both look like bugs otherwise:

**`send` never raises.** Transactional mail is best-effort. A Stripe webhook that
returned non-2xx because Mailgun was unreachable would be redelivered, and the retry
would run the confirmation path a second time. A booking that exists without its
confirmation email is a far smaller problem than one confirmed twice, so failures are
logged and swallowed.

**No API key means no sending.** The message is logged instead and the call succeeds,
so the app runs end to end on a machine with no mail credentials, exactly as payments
fall back to the development stub.
"""

import logging
from dataclasses import dataclass

import requests

from app.config import Settings, get_settings

log = logging.getLogger(__name__)

#: Mailgun is normally well under a second; this is a ceiling, not a target. A request
#: thread must not be held open by someone else's outage.
TIMEOUT_SECONDS = 10


@dataclass(frozen=True)
class Message:
    to: str
    subject: str
    html: str
    text: str


def report_configuration(settings: Settings | None = None) -> None:
    """Say at startup what will happen to mail, rather than at the first send.

    A misconfiguration here is silent by design — sending never raises — so without
    this the first sign of trouble is somebody reporting a missing email, with a
    single INFO line buried in the log to explain it.
    """
    settings = settings or get_settings()
    if not settings.mail_enabled:
        missing = [
            name
            for name, value in (
                ("MAILGUN_API_KEY", settings.mailgun_api_key),
                ("MAILGUN_DOMAIN", settings.mailgun_domain),
            )
            if not value
        ]
        log.warning(
            "Mail is NOT configured (%s missing): every message will be logged and "
            "discarded, including email confirmation and booking confirmations.",
            " and ".join(missing),
        )
        return
    if settings.mail_domain_is_sandbox:
        log.warning(
            "Mail is on the Mailgun SANDBOX domain %s. Only addresses added as "
            "Authorised Recipients in the Mailgun dashboard receive anything; mail to "
            "anyone else is accepted by the API and then silently dropped.",
            settings.mailgun_domain,
        )
        return
    log.info("Mail is configured: sending as %s via %s",
             settings.mail_sender, settings.mailgun_domain)


def send(message: Message, settings: Settings | None = None) -> bool:
    """Deliver one message. Returns whether it was actually handed to Mailgun.

    The return value is for tests and logging; no caller is expected to branch on it,
    because there is nothing useful an application can do about a failed email.
    """
    settings = settings or get_settings()

    if not settings.mail_enabled:
        log.info(
            "Mail not configured; would have sent to=%s subject=%r", message.to, message.subject,
        )
        return False

    if settings.mail_domain_is_sandbox:
        # Mailgun accepts these and drops them unless the recipient is on the sandbox's
        # authorised list, which is indistinguishable from a bug in this code.
        log.warning(
            "Mailgun sandbox domain in use: mail to %s is only delivered if that "
            "address is an authorised recipient. Verify a real domain before relying "
            "on delivery.", message.to,
        )

    try:
        response = requests.post(
            f"{settings.mailgun_base_url}/{settings.mailgun_domain}/messages",
            auth=("api", settings.mailgun_api_key),
            data={
                "from": settings.mail_sender,
                "to": message.to,
                "subject": message.subject,
                "text": message.text,
                "html": message.html,
            },
            timeout=TIMEOUT_SECONDS,
        )
    except requests.RequestException as error:
        log.error(
            "Could not reach Mailgun for to=%s subject=%r: %s",
            message.to, message.subject, error,
        )
        return False

    if not response.ok:
        # Mailgun's body explains refusals — an unauthorised sandbox recipient, a
        # suppressed address — and is the only way to tell them apart.
        log.error(
            "Mailgun refused to=%s subject=%r: %s %s",
            message.to, message.subject, response.status_code, response.text[:400],
        )
        return False

    log.info("Sent mail to=%s subject=%r", message.to, message.subject)
    return True
