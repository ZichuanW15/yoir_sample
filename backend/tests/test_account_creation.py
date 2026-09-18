"""US-02 / #93: committed accounts, hash-only credentials and no implicit login."""

from unittest.mock import Mock

import pytest
from argon2 import PasswordHasher, extract_parameters
from argon2.exceptions import HashingError
from argon2.profiles import RFC_9106_LOW_MEMORY
from fastapi.testclient import TestClient
from sqlalchemy import event, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.main import app
from app.models import User
from app.routers import auth
from app.schemas import RegisterRequest

REGISTER = {
    "name": "  Emily Account  ",
    "email": "Emily.Account@Example.com",
    "password": "a-private-password",
    "passwordConfirmation": "a-private-password",
    "role": "job_seeker",
}
REGISTER_URL = "/api/v1/auth/users"


@pytest.mark.parametrize(
    "password", ["12345678", "  a secret password  ", "密码🔐 café passphrase"]
)
def test_account_is_committed_with_only_a_verifiable_hash(
    client: TestClient, password: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    issue_token = Mock(side_effect=AssertionError("Registration must not create a session"))
    monkeypatch.setattr(auth, "create_access_token", issue_token)
    response = client.post(
        REGISTER_URL,
        json={**REGISTER, "password": password, "passwordConfirmation": password},
    )

    assert response.status_code == 201
    assert response.json() == {
        "id": response.json()["id"],
        "name": "Emily Account",
        "email": "emily.account@example.com",
        "role": "job_seeker",
        # A new account starts unconfirmed; the link is on its way, not yet followed.
        "emailVerified": False,
    }
    assert "set-cookie" not in response.headers
    assert "location" not in response.headers
    issue_token.assert_not_called()

    # A new session proves persistence, rather than reading the request's identity map.
    with SessionLocal() as db:
        rows = db.execute(select(User.__table__)).mappings().all()
        assert len(rows) == 1
        row = rows[0]
        assert row["id"] == response.json()["id"]
        assert row["role"] == "job_seeker"
        assert row["created_at"] is not None
        assert not {"password", "password_confirmation", "passwordConfirmation"} & row.keys()
        assert all(password not in value for value in row.values() if isinstance(value, str))
        assert extract_parameters(row["password_hash"]) == RFC_9106_LOW_MEMORY
        assert PasswordHasher().verify(row["password_hash"], password)
        assert row["password_hash"] not in response.text
    assert password not in response.text


def test_same_password_gets_an_independent_salt_per_account(client: TestClient) -> None:
    for email in ("emily@example.com", "sam@example.com"):
        assert client.post(REGISTER_URL, json={**REGISTER, "email": email}).status_code == 201

    with SessionLocal() as db:
        hashes = db.scalars(select(User.password_hash)).all()
    assert len(hashes) == 2
    assert hashes[0] != hashes[1]
    assert hashes[0].split("$")[4] != hashes[1].split("$")[4]
    for password_hash in hashes:
        assert PasswordHasher().verify(password_hash, REGISTER["password"])


def test_created_account_can_log_in_only_with_its_password(client: TestClient) -> None:
    created = client.post(REGISTER_URL, json=REGISTER)
    assert created.status_code == 201
    credentials = {"email": REGISTER["email"], "password": "not-the-password"}
    rejected = client.post("/api/v1/auth/sessions", json=credentials)
    assert rejected.status_code == 401
    assert "accessToken" not in rejected.json()

    logged_in = client.post(
        "/api/v1/auth/sessions", json={**credentials, "password": REGISTER["password"]}
    )
    assert logged_in.status_code == 200
    assert logged_in.json()["user"] == created.json()
    assert logged_in.json()["accessToken"]


@pytest.mark.parametrize(
    "changes",
    [
        {"name": " \t "},
        {"email": "invalid"},
        {"password": "short", "passwordConfirmation": "short"},
        {"passwordConfirmation": "a-different-password"},
        {"role": "platform_owner"},
        {"role": "admin"},
        {"passwordHash": "client-controlled-hash"},
        {"verificationStatus": "verified"},
    ],
)
def test_invalid_registration_never_hashes_or_creates_an_account(
    client: TestClient, changes: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    hasher = Mock(side_effect=AssertionError("Invalid input must fail before hashing"))
    monkeypatch.setattr(auth, "hash_password", hasher)
    response = client.post(REGISTER_URL, json={**REGISTER, **changes})

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert response.json()["fieldErrors"]
    hasher.assert_not_called()
    with SessionLocal() as db:
        assert db.scalars(select(User)).all() == []


def test_hashing_failure_does_not_create_an_account_or_claim_success(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        auth, "hash_password", Mock(side_effect=HashingError("internal hashing failure"))
    )
    response = client.post(REGISTER_URL, json=REGISTER)

    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert response.json()["message"] == "Something went wrong."
    assert response.json()["requestId"]
    assert "internal hashing failure" not in response.text
    assert REGISTER["password"] not in response.text
    with SessionLocal() as db:
        assert db.scalars(select(User)).all() == []


def test_failed_commit_rolls_back_a_flushed_account(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail_commit() -> None:
        db_session.flush()
        raise OperationalError("internal insert", {}, RuntimeError("database unavailable"))

    monkeypatch.setattr(db_session, "commit", fail_commit)

    def request_db():
        yield db_session

    app.dependency_overrides[get_db] = request_db
    try:
        response = client.post(REGISTER_URL, json=REGISTER)
        assert response.status_code == 500
        assert response.json()["code"] == "INTERNAL_ERROR"
        assert "database unavailable" not in response.text
        assert "internal insert" not in response.text
        assert REGISTER["password"] not in response.text
        # Roll back at the write boundary, not only when the dependency is closed.
        assert not db_session.in_transaction()
        assert db_session.scalars(select(User)).all() == []
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.parametrize("expire_on_commit", [False, True])
def test_committed_registration_does_not_depend_on_a_second_database_read(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    expire_on_commit: bool,
) -> None:
    monkeypatch.setattr(db_session, "expire_on_commit", expire_on_commit)
    committed = False

    def after_commit(_session) -> None:
        nonlocal committed
        committed = True

    def reject_post_commit_read(_orm_execute_state) -> None:
        if committed:
            raise OperationalError("post-commit read", {}, RuntimeError("read failed"))

    def request_db():
        yield db_session

    event.listen(db_session, "after_commit", after_commit)
    event.listen(db_session, "do_orm_execute", reject_post_commit_read)
    app.dependency_overrides[get_db] = request_db
    try:
        response = client.post(REGISTER_URL, json=REGISTER)
    finally:
        app.dependency_overrides.pop(get_db, None)
        event.remove(db_session, "after_commit", after_commit)
        event.remove(db_session, "do_orm_execute", reject_post_commit_read)

    assert response.status_code == 201
    assert committed
    with SessionLocal() as db:
        assert db.get(User, response.json()["id"]) is not None


def test_registration_credentials_are_omitted_from_model_representations() -> None:
    request = RegisterRequest.model_validate(REGISTER)
    assert REGISTER["password"] not in repr(request)
    assert REGISTER["password"] not in str(request)
    # Hiding credentials in debug representations must not alter the accepted request.
    assert request.password == REGISTER["password"]
    assert request.password_confirmation == REGISTER["passwordConfirmation"]
