"""US-03 / #96: stable duplicate errors, no extra accounts and safe retries."""

import sqlite3
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine, get_db
from app.main import app
from app.models import User
from app.routers import auth

REGISTER_URL = "/api/v1/auth/users"
REGISTER = {
    "name": "Original Account",
    "email": "original@example.com",
    "password": "original-private-password",
    "passwordConfirmation": "original-private-password",
    "role": "job_seeker",
}


def assert_duplicate(response) -> None:
    assert response.status_code == 409
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {
        "code": "VALIDATION_ERROR",
        "message": "An account with this email already exists.",
        "fieldErrors": {"email": "Already registered."},
        "requestId": response.headers["x-request-id"],
    }
    assert response.json()["requestId"]
    assert "set-cookie" not in response.headers
    assert "location" not in response.headers


def user_rows() -> list[dict]:
    with SessionLocal() as db:
        return [dict(row) for row in db.execute(select(User.__table__)).mappings()]


@pytest.mark.parametrize("existing_role", ["job_seeker", "counsellor"])
@pytest.mark.parametrize("attempted_role", ["job_seeker", "counsellor"])
@pytest.mark.parametrize(
    "email", ["original@example.com", "ORIGINAL@EXAMPLE.COM", "  Original@Example.com  "]
)
def test_duplicate_preserves_original_account_and_allows_corrected_email(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    existing_role: str,
    attempted_role: str,
    email: str,
) -> None:
    created = client.post(REGISTER_URL, json={**REGISTER, "role": existing_role})
    assert created.status_code == 201
    before = user_rows()
    attempt = {
        **REGISTER,
        "email": email,
        "name": "Replacement Name",
        "role": attempted_role,
        "password": "a-different-password",
        "passwordConfirmation": "a-different-password",
    }
    with monkeypatch.context() as patch:
        hasher = Mock(side_effect=AssertionError("Known duplicates must not be hashed"))
        issue_token = Mock(side_effect=AssertionError("Registration must not issue tokens"))
        patch.setattr(auth, "hash_password", hasher)
        patch.setattr(auth, "create_access_token", issue_token)
        for _ in range(2):
            response = client.post(REGISTER_URL, json=attempt)
            assert_duplicate(response)
            assert attempt["password"] not in response.text
            assert before[0]["password_hash"] not in response.text
        hasher.assert_not_called()
        issue_token.assert_not_called()
    assert user_rows() == before

    corrected = client.post(REGISTER_URL, json={**attempt, "email": "unused@example.com"})
    assert corrected.status_code == 201
    assert corrected.json()["email"] == "unused@example.com"
    assert corrected.json()["name"] == attempt["name"]
    assert corrected.json()["role"] == attempted_role
    rows = user_rows()
    assert len(rows) == 2
    assert next(row for row in rows if row["id"] == created.json()["id"]) == before[0]


def postgres_error(code: str, constraint: str | None) -> Exception:
    # Model psycopg2's public diagnostic attributes without depending on server text.
    error = Exception("private database diagnostic")
    error.pgcode = code
    error.diag = SimpleNamespace(constraint_name=constraint)
    return error


def sqlite_error(message: str, code: int) -> sqlite3.IntegrityError:
    error = sqlite3.IntegrityError(message)
    error.sqlite_errorcode = code
    return error


@pytest.mark.parametrize("stage", ["flush", "commit"])
@pytest.mark.parametrize(
    ("original_error", "expected_status"),
    [
        (postgres_error("23505", "ix_users_email"), 409),
        (postgres_error("23505", "users_pkey"), 500),
        (postgres_error("23505", "another_unique_index"), 500),
        (postgres_error("23505", None), 500),
        (postgres_error("23502", "ix_users_email"), 500),
        (
            sqlite_error("UNIQUE constraint failed: users.email", sqlite3.SQLITE_CONSTRAINT_UNIQUE),
            409,
        ),
        (
            sqlite_error(
                "UNIQUE constraint failed: users.id", sqlite3.SQLITE_CONSTRAINT_PRIMARYKEY
            ),
            500,
        ),
        (
            sqlite_error("UNIQUE constraint failed: users.name", sqlite3.SQLITE_CONSTRAINT_UNIQUE),
            500,
        ),
        (
            sqlite_error(
                "NOT NULL constraint failed: users.email", sqlite3.SQLITE_CONSTRAINT_NOTNULL
            ),
            500,
        ),
        (Exception("UNIQUE constraint failed: users.email"), 500),
    ],
)
def test_write_conflicts_roll_back_and_only_email_uniqueness_maps_to_409(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    stage: str,
    original_error: Exception,
    expected_status: int,
) -> None:
    failure = Mock(side_effect=IntegrityError("private SQL", {}, original_error))

    def request_db():
        yield db_session

    app.dependency_overrides[get_db] = request_db
    try:
        with monkeypatch.context() as patch:
            patch.setattr(db_session, stage, failure)
            response = client.post(REGISTER_URL, json=REGISTER)
            failure.assert_called_once()
            assert response.status_code == expected_status
            if expected_status == 409:
                assert_duplicate(response)
            else:
                assert response.json()["code"] == "INTERNAL_ERROR"
                assert response.json()["message"] == "Something went wrong."
            assert "private" not in response.text
            assert "constraint" not in response.text
            assert REGISTER["password"] not in response.text
            assert not db_session.in_transaction()
            assert user_rows() == []
        # Reuse this very session: rollback must leave it usable, not only close it.
        retried = client.post(REGISTER_URL, json={**REGISTER, "email": "retry@example.com"})
        assert retried.status_code == 201
        assert len(user_rows()) == 1
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_email_unique_index_matches_postgresql_conflict_diagnostic() -> None:
    indexes = inspect(engine).get_indexes("users")
    assert any(
        index["name"] == "ix_users_email"
        and index["unique"]
        and index["column_names"] == ["email"]
        for index in indexes
    )


def test_concurrent_registration_commits_one_account_and_allows_loser_to_retry(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    after_pre_check = Barrier(2)
    real_hash = auth.hash_password

    def hash_after_both_pre_checks(password: str) -> str:
        # Both requests must see no existing account before either can insert it.
        after_pre_check.wait(timeout=10)
        return real_hash(password)

    attempts = [
        {**REGISTER, "name": "First Request"},
        {**REGISTER, "email": REGISTER["email"].upper(), "name": "Second Request"},
    ]
    with monkeypatch.context() as patch:
        patch.setattr(auth, "hash_password", hash_after_both_pre_checks)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(client.post, REGISTER_URL, json=attempt) for attempt in attempts]
            responses = [future.result(timeout=20) for future in futures]
    assert sorted(response.status_code for response in responses) == [201, 409]
    winner = next(response for response in responses if response.status_code == 201)
    loser_index = next(i for i, response in enumerate(responses) if response.status_code == 409)
    assert_duplicate(responses[loser_index])
    rows = user_rows()
    assert len(rows) == 1
    assert rows[0]["id"] == winner.json()["id"]
    assert rows[0]["name"] == winner.json()["name"]
    assert rows[0]["email"] == REGISTER["email"]

    retry = client.post(
        REGISTER_URL, json={**attempts[loser_index], "email": "retry@example.com"}
    )
    assert retry.status_code == 201
    assert len(user_rows()) == 2
