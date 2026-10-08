"""Email confirmation and password reset: the link lifecycle and what it unlocks.

The interesting properties are all about what a link *cannot* do — be spent twice,
be used for the other purpose, outlive its window, or reveal whether an address has
an account. Those are the ones that stop being true quietly.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.mail import messages
from app.models import RefreshToken, SingleUseToken, User
from app.security import VERIFY_EMAIL, digest_token, verify_password

PASSWORD = "password123"
REGISTER = {
    "name": "Nadia Verify",
    "email": "nadia.verify@example.com",
    "password": PASSWORD,
    "passwordConfirmation": PASSWORD,
    "role": "job_seeker",
}


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, str]]:
    """Capture the links the application mails instead of rendering and sending them.

    The raw token never appears in a response, which is the point of a mailed link,
    so a test can only get at it the way the recipient does.
    """
    captured: list[tuple[str, str, str]] = []

    def capture_verify(to: str, name: str, token: str, expires_in_hours: int) -> bool:
        captured.append(("verify_email", to, token))
        return True

    def capture_reset(to: str, name: str, token: str, expires_in_hours: int) -> bool:
        captured.append(("password_reset", to, token))
        return True

    monkeypatch.setattr(messages, "verify_email", capture_verify)
    monkeypatch.setattr(messages, "password_reset", capture_reset)
    return captured


def register(client: Any, **overrides: Any) -> dict:
    response = client.post("/api/v1/auth/users", json={**REGISTER, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def token_for(sent: list[tuple[str, str, str]], purpose: str) -> str:
    matching = [token for kind, _to, token in sent if kind == purpose]
    assert matching, f"no {purpose} email was sent"
    return matching[-1]


# --- confirming an address --------------------------------------------------


def test_registration_mails_a_link_and_leaves_the_account_unconfirmed(
    client: Any, db_session: Session, sent: list
) -> None:
    body = register(client)

    assert body["emailVerified"] is False
    assert [(kind, to) for kind, to, _ in sent] == [("verify_email", REGISTER["email"])]
    user = db_session.get(User, body["id"])
    assert user is not None and user.email_verified_at is None
    # Only a digest is stored: a leaked table must not hand over working links.
    stored = db_session.scalars(select(SingleUseToken)).all()
    assert [record.purpose for record in stored] == [VERIFY_EMAIL]
    assert stored[0].token_digest == digest_token(token_for(sent, "verify_email"))
    assert token_for(sent, "verify_email") not in {record.token_digest for record in stored}


def test_confirming_an_address_returns_a_session_for_the_confirmed_account(
    client: Any, db_session: Session, sent: list
) -> None:
    account = register(client)

    response = client.post(
        "/api/v1/auth/email-verifications", json={"token": token_for(sent, "verify_email")}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    # The link is itself proof of ownership, so it signs the person in rather than
    # sending them back to a password form.
    assert body["user"]["id"] == account["id"]
    assert body["user"]["emailVerified"] is True
    assert body["accessToken"] and body["refreshToken"]
    db_session.expire_all()
    assert db_session.get(User, account["id"]).email_verified_at is not None


def test_a_confirmation_link_works_exactly_once(client: Any, sent: list) -> None:
    register(client)
    token = token_for(sent, "verify_email")

    assert client.post("/api/v1/auth/email-verifications", json={"token": token}).status_code == 200

    replayed = client.post("/api/v1/auth/email-verifications", json={"token": token})
    assert replayed.status_code == 400
    assert replayed.json()["code"] == "VALIDATION_ERROR"


def test_a_confirmation_link_cannot_reset_a_password(client: Any, sent: list) -> None:
    """Purpose is checked on use. Without that, the link mailed to confirm an address
    would also change the password on it — privilege escalation dressed as convenience."""
    register(client)
    verification = token_for(sent, "verify_email")

    response = client.post(
        "/api/v1/auth/password-resets",
        json={
            "token": verification,
            "password": "new-password",
            "passwordConfirmation": "new-password",
        },
    )

    assert response.status_code == 400
    assert response.json()["fieldErrors"] == {"token": "Expired or already used."}


def test_an_expired_confirmation_link_is_refused(
    client: Any, db_session: Session, sent: list
) -> None:
    register(client)
    token = token_for(sent, "verify_email")
    record = db_session.get(SingleUseToken, digest_token(token))
    record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()

    response = client.post("/api/v1/auth/email-verifications", json={"token": token})

    assert response.status_code == 400


def test_an_unknown_token_is_refused(client: Any) -> None:
    response = client.post("/api/v1/auth/email-verifications", json={"token": "not-a-real-token"})

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_asking_again_supersedes_the_outstanding_link(client: Any, sent: list) -> None:
    """Two live links per address would mean a forwarded old email still works after
    the person asked for a fresh one, which is the situation resending is meant to end."""
    register(client)
    superseded = token_for(sent, "verify_email")

    resend = client.post(
        "/api/v1/auth/email-verification-requests", json={"email": REGISTER["email"]}
    )
    assert resend.status_code == 202
    replacement = token_for(sent, "verify_email")
    assert replacement != superseded

    assert (
        client.post("/api/v1/auth/email-verifications", json={"token": superseded}).status_code
        == 400
    )
    assert (
        client.post("/api/v1/auth/email-verifications", json={"token": replacement}).status_code
        == 200
    )


@pytest.mark.parametrize(
    ("path", "payload_key"),
    [
        ("/api/v1/auth/email-verification-requests", "email"),
        ("/api/v1/auth/password-reset-requests", "email"),
    ],
)
def test_link_requests_do_not_reveal_who_has_an_account(
    client: Any, sent: list, path: str, payload_key: str
) -> None:
    register(client)
    sent.clear()

    known = client.post(path, json={payload_key: REGISTER["email"]})
    unknown = client.post(path, json={payload_key: "nobody@example.com"})

    assert known.status_code == unknown.status_code == 202
    assert known.content == unknown.content == b""
    # Only the real address was mailed; the responses gave that away to nobody.
    assert [to for _kind, to, _token in sent] == [REGISTER["email"]]


def test_resending_to_an_already_confirmed_address_sends_nothing_and_still_answers_202(
    client: Any, sent: list
) -> None:
    register(client)
    client.post("/api/v1/auth/email-verifications", json={"token": token_for(sent, "verify_email")})
    sent.clear()

    response = client.post(
        "/api/v1/auth/email-verification-requests", json={"email": REGISTER["email"]}
    )

    assert response.status_code == 202
    assert sent == []


# --- what an unconfirmed address is refused ---------------------------------


def session_for(client: Any, email: str, password: str = PASSWORD) -> dict:
    response = client.post("/api/v1/auth/sessions", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


def test_an_unconfirmed_job_seeker_can_sign_in_but_cannot_order(
    client: Any, service: Any, sent: list
) -> None:
    """Gating actions rather than sign-in: locking a new account out over a slow
    email helps nobody, but taking money from an address we cannot reach does harm."""
    register(client)
    session = session_for(client, REGISTER["email"])
    assert session["user"]["emailVerified"] is False

    response = client.post(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {session['accessToken']}"},
        json={
            "serviceId": service.id,
            "startsAt": "2030-01-01T09:00:00Z",
            "modality": "online",
            "timezone": "Australia/Melbourne",
        },
    )

    assert response.status_code == 403
    assert response.json()["code"] == "EMAIL_NOT_VERIFIED"


def test_an_unconfirmed_counsellor_cannot_publish_a_service(
    client: Any, db_session: Session, sent: list
) -> None:
    """Publishing needs both kinds of trust, and this isolates the second one.

    The account is approved by the Platform Owner here on purpose: that check runs
    first, so without it the refusal would be FORBIDDEN for the other reason and this
    test would pass while the email gate did nothing.
    """
    account = register(client, email="unconfirmed.counsellor@example.com", role="counsellor")
    db_session.get(User, account["id"]).verification_status = "verified"
    db_session.commit()
    session = session_for(client, "unconfirmed.counsellor@example.com")

    response = client.post(
        "/api/v1/me/services",
        headers={"Authorization": f"Bearer {session['accessToken']}"},
        json={
            "title": "Interview coaching",
            "description": "Practice and feedback.",
            "priceMinor": 9500,
            "currency": "AUD",
            "modalities": ["online"],
        },
    )

    assert response.status_code == 403
    assert response.json()["code"] == "EMAIL_NOT_VERIFIED"


def test_confirming_the_address_lifts_the_order_gate(
    client: Any, service: Any, sent: list
) -> None:
    register(client)
    confirmed = client.post(
        "/api/v1/auth/email-verifications", json={"token": token_for(sent, "verify_email")}
    ).json()

    response = client.post(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {confirmed['accessToken']}"},
        json={
            "serviceId": service.id,
            "startsAt": "2030-01-01T09:00:00Z",
            "modality": "online",
            "timezone": "Australia/Melbourne",
        },
    )

    # Not 403: whether this slot is actually offered is a different question.
    assert response.status_code != 403, response.text


# --- resetting a password ---------------------------------------------------


def test_reset_changes_the_password_and_ends_every_other_session(
    client: Any, db_session: Session, sent: list
) -> None:
    """A reset usually means the account was compromised, so leaving the attacker's
    sessions alive would defeat it. Both halves matter: the refresh token can no
    longer extend the session, and the access token already issued stops being taken."""
    account = register(client)
    existing = session_for(client, REGISTER["email"])
    client.post("/api/v1/auth/password-reset-requests", json={"email": REGISTER["email"]})
    new_password = "a-brand-new-password"

    response = client.post(
        "/api/v1/auth/password-resets",
        json={
            "token": token_for(sent, "password_reset"),
            "password": new_password,
            "passwordConfirmation": new_password,
        },
    )

    assert response.status_code == 204
    db_session.expire_all()
    user = db_session.get(User, account["id"])
    assert verify_password(new_password, user.password_hash)
    assert user.sessions_invalidated_at is not None

    stale = client.get(
        "/api/v1/me/bookings", headers={"Authorization": f"Bearer {existing['accessToken']}"}
    )
    assert stale.status_code == 401
    refreshed = client.post(
        "/api/v1/auth/sessions/refresh", json={"refreshToken": existing["refreshToken"]}
    )
    assert refreshed.status_code == 401
    assert db_session.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == account["id"], RefreshToken.revoked_at.is_(None)
        )
    ).all() == []
    assert session_for(client, REGISTER["email"], new_password)["user"]["id"] == account["id"]


def test_reset_requires_the_confirmation_to_match_and_leaves_the_link_unspent(
    client: Any, db_session: Session, sent: list
) -> None:
    account = register(client)
    client.post("/api/v1/auth/password-reset-requests", json={"email": REGISTER["email"]})
    token = token_for(sent, "password_reset")

    mismatched = client.post(
        "/api/v1/auth/password-resets",
        json={"token": token, "password": "one-password", "passwordConfirmation": "another"},
    )

    assert mismatched.status_code == 400
    assert "passwordConfirmation" in mismatched.json()["fieldErrors"]
    # A typo must not burn the link and force the person to ask for another.
    assert db_session.get(SingleUseToken, digest_token(token)).used_at is None
    db_session.expire_all()
    assert verify_password(PASSWORD, db_session.get(User, account["id"]).password_hash)


def test_a_reset_link_works_exactly_once(client: Any, sent: list) -> None:
    register(client)
    client.post("/api/v1/auth/password-reset-requests", json={"email": REGISTER["email"]})
    token = token_for(sent, "password_reset")
    new_password = "first-new-password"
    body = {"token": token, "password": new_password, "passwordConfirmation": new_password}

    assert client.post("/api/v1/auth/password-resets", json=body).status_code == 204
    assert client.post("/api/v1/auth/password-resets", json=body).status_code == 400


def test_a_reset_link_cannot_confirm_an_address(
    client: Any, db_session: Session, sent: list
) -> None:
    account = register(client)
    client.post("/api/v1/auth/password-reset-requests", json={"email": REGISTER["email"]})

    response = client.post(
        "/api/v1/auth/email-verifications", json={"token": token_for(sent, "password_reset")}
    )

    assert response.status_code == 400
    db_session.expire_all()
    assert db_session.get(User, account["id"]).email_verified_at is None


def test_an_expired_reset_link_is_refused(client: Any, db_session: Session, sent: list) -> None:
    register(client)
    client.post("/api/v1/auth/password-reset-requests", json={"email": REGISTER["email"]})
    token = token_for(sent, "password_reset")
    db_session.get(SingleUseToken, digest_token(token)).expires_at = datetime.now(UTC) - timedelta(
        seconds=1
    )
    db_session.commit()

    response = client.post(
        "/api/v1/auth/password-resets",
        json={"token": token, "password": "new-password", "passwordConfirmation": "new-password"},
    )

    assert response.status_code == 400


def test_a_tampered_or_never_issued_token_is_refused(
    client: Any, db_session: Session
) -> None:
    """Noise, not a real token with a flipped bit: nothing was ever minted to match
    its digest, so this is indistinguishable from any other string a stranger could
    have typed — the endpoint must not need a genuine record to say no."""
    account = register(client)

    response = client.post(
        "/api/v1/auth/password-resets",
        json={
            "token": "not-a-token-anyone-was-ever-sent",
            "password": "new-password",
            "passwordConfirmation": "new-password",
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    db_session.expire_all()
    assert verify_password(PASSWORD, db_session.get(User, account["id"]).password_hash)


def test_after_a_reset_the_old_password_no_longer_authenticates(
    client: Any, sent: list
) -> None:
    register(client)
    client.post("/api/v1/auth/password-reset-requests", json={"email": REGISTER["email"]})
    new_password = "a-brand-new-password"
    client.post(
        "/api/v1/auth/password-resets",
        json={
            "token": token_for(sent, "password_reset"),
            "password": new_password,
            "passwordConfirmation": new_password,
        },
    )

    old = client.post(
        "/api/v1/auth/sessions", json={"email": REGISTER["email"], "password": PASSWORD},
    )

    assert old.status_code == 401
    assert old.json()["code"] == "INVALID_CREDENTIALS"
    # The new one still does, so this is the old password failing, not the account.
    revived = session_for(client, REGISTER["email"], new_password)
    assert revived["user"]["email"] == REGISTER["email"]
