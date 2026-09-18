"""Creating the administrator account from configuration.

The platform_owner role is never handed out by registration, so without this a
deployment with seeding switched off has no way into the administration area at
all. The properties that matter are that it runs independently of the demo seed,
and that running it again changes nothing.
"""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import User
from app.security import hash_password, verify_password
from app.seed import ensure_platform_owner

EMAIL = "admin@yoir.app"
PASSWORD = "admin@123"


@pytest.fixture
def configured(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "admin_email", EMAIL, raising=False)
    monkeypatch.setattr(settings, "admin_password", PASSWORD, raising=False)


def owners(db: Session) -> list[User]:
    return list(db.scalars(select(User).where(User.role == "platform_owner")))


def test_the_administrator_is_created_from_configuration(
    db_session: Session, configured: None
) -> None:
    ensure_platform_owner(db_session)

    (owner,) = owners(db_session)
    assert owner.email == EMAIL
    assert owner.role == "platform_owner"
    assert verify_password(PASSWORD, owner.password_hash)
    # Nobody can send this account a confirmation link, and it neither books nor
    # publishes, so it must not start behind the unverified-email gate.
    assert owner.email_verified_at is not None


def test_the_address_is_normalised_the_way_registration_normalises_it(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Otherwise the account could not sign in: login lowercases what it is given."""
    settings = get_settings()
    monkeypatch.setattr(settings, "admin_email", "  Admin@Yoir.App  ", raising=False)
    monkeypatch.setattr(settings, "admin_password", PASSWORD, raising=False)

    ensure_platform_owner(db_session)

    (owner,) = owners(db_session)
    assert owner.email == EMAIL


def test_running_again_creates_nothing_and_changes_nothing(
    db_session: Session, configured: None
) -> None:
    """Every redeploy runs this. It must not reset a password changed since, or the
    administrator would silently lose their own change on the next deployment."""
    ensure_platform_owner(db_session)
    (owner,) = owners(db_session)
    owner.password_hash = hash_password("a-password-they-chose-themselves")
    owner.name = "Renamed By Hand"
    db_session.commit()

    ensure_platform_owner(db_session)

    (owner,) = owners(db_session)
    assert owner.name == "Renamed By Hand"
    assert verify_password("a-password-they-chose-themselves", owner.password_hash)
    assert not verify_password(PASSWORD, owner.password_hash)


def test_nothing_happens_without_both_variables(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = get_settings()
    for email, password in ((EMAIL, ""), ("", PASSWORD), ("", "")):
        monkeypatch.setattr(settings, "admin_email", email, raising=False)
        monkeypatch.setattr(settings, "admin_password", password, raising=False)

        ensure_platform_owner(db_session)

        assert owners(db_session) == []


def test_an_existing_ordinary_account_is_never_promoted(
    db_session: Session, configured: None, caplog: pytest.LogCaptureFixture
) -> None:
    """Configuration must not be able to hand administration rights to an account
    somebody registered for themselves."""
    db_session.add(
        User(name="Not An Admin", email=EMAIL, password_hash=hash_password("x"),
             role="job_seeker")
    )
    db_session.commit()
    caplog.set_level("ERROR")

    ensure_platform_owner(db_session)

    assert owners(db_session) == []
    stored = db_session.scalar(select(User).where(User.email == EMAIL))
    assert stored.role == "job_seeker"
    assert EMAIL in caplog.text


def test_the_administrator_can_sign_in_and_open_the_admin_area(
    client: Any, db_session: Session, configured: None
) -> None:
    """The point of the whole exercise, proved end to end rather than by inspection."""
    ensure_platform_owner(db_session)

    session = client.post("/api/v1/auth/sessions", json={"email": EMAIL, "password": PASSWORD})
    assert session.status_code == 200, session.text
    assert session.json()["user"]["role"] == "platform_owner"

    headers = {"Authorization": f"Bearer {session.json()['accessToken']}"}
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 200
