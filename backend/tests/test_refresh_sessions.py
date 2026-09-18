"""US-06 — a session that slides instead of asking for a password every hour.

The security of a ninety-day session rests entirely on rotation: each refresh spends
its token and issues a successor, so a token presented twice means a copy exists.
These tests pin that behaviour, because the feature is only safe while it holds.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import RefreshToken, User
from app.security import hash_password

LOGIN = "/api/v1/auth/sessions"
REFRESH = "/api/v1/auth/sessions/refresh"
LOGOUT = "/api/v1/auth/sessions/current"
PASSWORD = "correct-horse-battery"


@pytest.fixture
def account(db_session: Session) -> User:
    user = User(
        name="Sliding Session",
        email="sliding@example.com",
        password_hash=hash_password(PASSWORD),
        role="job_seeker",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def login(client: TestClient, client_kind: str = "native") -> dict[str, Any]:
    response = client.post(
        LOGIN, json={"email": "sliding@example.com", "password": PASSWORD, "client": client_kind},
    )
    assert response.status_code == 200
    return response.json()


def test_login_issues_a_refresh_token_alongside_the_access_token(
    client: TestClient, account: User,
) -> None:
    body = login(client)

    assert body["refreshToken"]
    assert body["refreshExpiresAt"]
    # The access token expires in an hour; the session does not.
    assert body["refreshExpiresAt"] > body["expiresAt"]


def test_the_refresh_token_is_stored_only_as_a_digest(
    client: TestClient, db_session: Session, account: User,
) -> None:
    """A database leak must not hand over usable credentials."""
    body = login(client)

    stored = list(db_session.scalars(select(RefreshToken)))
    assert len(stored) == 1
    assert stored[0].token_digest != body["refreshToken"]
    assert body["refreshToken"] not in stored[0].token_digest
    assert len(stored[0].token_digest) == 64  # sha256 hex


def test_refreshing_returns_a_working_session_and_rotates_the_token(
    client: TestClient, account: User,
) -> None:
    first = login(client)

    second = client.post(REFRESH, json={"refreshToken": first["refreshToken"], "client": "native"})

    assert second.status_code == 200
    rotated = second.json()
    assert rotated["refreshToken"] != first["refreshToken"]
    assert rotated["user"]["id"] == account.id
    # The new access token works on a protected route.
    assert client.get(
        "/api/v1/me/bookings", headers={"Authorization": f"Bearer {rotated['accessToken']}"},
    ).status_code == 200


def test_a_spent_refresh_token_cannot_be_used_again(
    client: TestClient, account: User,
) -> None:
    first = login(client)
    client.post(REFRESH, json={"refreshToken": first["refreshToken"]})

    replay = client.post(REFRESH, json={"refreshToken": first["refreshToken"]})

    assert replay.status_code == 401


def test_replaying_a_spent_token_revokes_the_whole_family(
    client: TestClient, db_session: Session, account: User,
) -> None:
    """The theft detection that makes a long session defensible.

    A spent token turning up again means two copies exist and there is no way to tell
    the owner from the thief, so the lineage is destroyed and both sign in again.
    """
    first = login(client)
    second = client.post(REFRESH, json={"refreshToken": first["refreshToken"]}).json()

    # The attacker replays the token they stole.
    assert client.post(REFRESH, json={"refreshToken": first["refreshToken"]}).status_code == 401

    # The victim's still-unused token dies with it.
    assert client.post(REFRESH, json={"refreshToken": second["refreshToken"]}).status_code == 401
    db_session.expire_all()
    assert all(row.revoked_at is not None for row in db_session.scalars(select(RefreshToken)))


def test_a_long_chain_of_refreshes_keeps_one_family(
    client: TestClient, db_session: Session, account: User,
) -> None:
    token = login(client)["refreshToken"]
    for _ in range(5):
        token = client.post(REFRESH, json={"refreshToken": token}).json()["refreshToken"]

    families = {row.family_id for row in db_session.scalars(select(RefreshToken))}
    assert len(families) == 1


def test_an_expired_refresh_token_is_refused(
    client: TestClient, db_session: Session, account: User,
) -> None:
    login(client)
    record = db_session.scalar(select(RefreshToken))
    record.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    assert client.post(REFRESH, json={"refreshToken": "anything"}).status_code == 401


@pytest.mark.parametrize("bogus", ["", "not-a-token", "x" * 200])
def test_an_unknown_refresh_token_is_refused(
    client: TestClient, account: User, bogus: str,
) -> None:
    response = client.post(REFRESH, json={"refreshToken": bogus})
    assert response.status_code in (400, 401)


def test_the_web_window_is_shorter_than_the_native_one(
    client: TestClient, db_session: Session, account: User,
) -> None:
    """A browser keeps the token in localStorage, which any script on the origin can
    read, so it is not given a device-length session."""
    web = login(client, "web")
    db_session.query(RefreshToken).delete()
    db_session.commit()
    native = login(client, "native")

    settings = get_settings()
    assert settings.refresh_token_ttl_days_web < settings.refresh_token_ttl_days_native
    assert web["refreshExpiresAt"] < native["refreshExpiresAt"]


def test_logging_out_kills_the_refresh_token_too(
    client: TestClient, account: User,
) -> None:
    """Denylisting the access token alone would end nothing: the refresh token could
    mint a new one seconds later."""
    session = login(client)

    logout = client.request(
        "DELETE",
        LOGOUT,
        headers={"Authorization": f"Bearer {session['accessToken']}"},
        json={"refreshToken": session["refreshToken"]},
    )

    assert logout.status_code == 204
    assert client.post(REFRESH, json={"refreshToken": session["refreshToken"]}).status_code == 401


def test_one_persons_refresh_token_cannot_be_killed_by_another(
    client: TestClient, db_session: Session, account: User,
) -> None:
    victim = login(client)
    other = User(
        name="Someone Else", email="someone.else@example.com",
        password_hash=hash_password(PASSWORD), role="job_seeker",
    )
    db_session.add(other)
    db_session.commit()
    attacker = client.post(
        LOGIN, json={"email": "someone.else@example.com", "password": PASSWORD},
    ).json()

    client.request(
        "DELETE", LOGOUT,
        headers={"Authorization": f"Bearer {attacker['accessToken']}"},
        json={"refreshToken": victim["refreshToken"]},
    )

    # The victim's session is untouched: logout may only revoke its own family.
    assert client.post(REFRESH, json={"refreshToken": victim["refreshToken"]}).status_code == 200
