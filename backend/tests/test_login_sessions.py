"""US-06 / #99 and US-07 / #102: role-aware login and safe credential failures."""

from datetime import UTC, datetime, timedelta
from unittest.mock import Mock

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import security
from app.db import SessionLocal
from app.models import Order, User
from app.routers import auth
from app.schemas import LoginRequest
from app.security import hash_password

LOGIN_URL = "/api/v1/auth/sessions"
PASSWORD = "my-private-password"


def persist_account(
    db: Session,
    *,
    role: str = "job_seeker",
    password: str = PASSWORD,
    password_hash: str | None = None,
) -> User:
    """Create an existing account, not a public platform-owner provisioning flow."""
    account = User(
        name="Session Tester",
        email="session.tester@example.com",
        password_hash=password_hash if password_hash is not None else hash_password(password),
        role=role,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def assert_generic_credential_failure(response) -> dict:
    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert set(body) == {"code", "message", "requestId"}
    assert body["code"] == "INVALID_CREDENTIALS"
    assert body["message"] == "The email or password is incorrect."
    assert isinstance(body["requestId"], str) and body["requestId"]
    assert response.headers["x-request-id"] == body["requestId"]
    assert "set-cookie" not in response.headers
    return {key: value for key, value in body.items() if key != "requestId"}


@pytest.mark.parametrize("role", ["job_seeker", "counsellor", "platform_owner"])
def test_login_returns_only_public_user_fields_and_signed_expiring_session(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch, role: str
) -> None:
    account = persist_account(db_session, role=role)
    monkeypatch.setattr(security.settings, "access_token_ttl_minutes", 60)
    before = datetime.now(UTC)
    response = client.post(
        LOGIN_URL,
        json={"email": "  SESSION.TESTER@Example.com  ", "password": PASSWORD},
    )
    after = datetime.now(UTC)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"accessToken", "expiresAt", "user"}
    assert body["user"] == {
        "id": account.id,
        "name": account.name,
        "email": account.email,
        "role": role,
    }
    assert "set-cookie" not in response.headers
    assert PASSWORD not in response.text
    assert account.password_hash not in response.text
    expires_at = datetime.fromisoformat(body["expiresAt"])
    assert expires_at.utcoffset() == timedelta(0)
    # NumericDate is second-precision; the HTTP timestamp must identify that expiry.
    assert before + timedelta(minutes=60, seconds=-1) <= expires_at
    assert expires_at <= after + timedelta(minutes=60)
    claims = jwt.decode(
        body["accessToken"],
        security.settings.jwt_secret,
        algorithms=[security.settings.jwt_algorithm],
    )
    assert claims["sub"] == account.id
    assert claims["role"] == role
    assert isinstance(claims["jti"], str) and claims["jti"]
    assert claims["exp"] == pytest.approx(expires_at.timestamp(), abs=1)
    assert not {"password", "password_hash", "passwordHash", "email", "name"} & claims.keys()
    with SessionLocal() as verification_db:
        persisted = verification_db.get(User, account.id)
        assert persisted.role == role
        assert persisted.password_hash == account.password_hash
        assert len(verification_db.scalars(select(User)).all()) == 1


def test_repeated_logins_at_the_same_instant_have_independent_session_ids(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    account = persist_account(db_session)
    instant = datetime.now(UTC).replace(microsecond=0)

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return instant.astimezone(tz) if tz is not None else instant.replace(tzinfo=None)

    monkeypatch.setattr(security, "datetime", FrozenDatetime)
    responses = [
        client.post(LOGIN_URL, json={"email": account.email, "password": PASSWORD})
        for _ in range(2)
    ]

    assert [response.status_code for response in responses] == [200, 200]
    bodies = [response.json() for response in responses]
    assert bodies[0]["expiresAt"] == bodies[1]["expiresAt"]
    assert bodies[0]["accessToken"] != bodies[1]["accessToken"]
    claims = [
        jwt.decode(
            body["accessToken"],
            security.settings.jwt_secret,
            algorithms=[security.settings.jwt_algorithm],
        )
        for body in bodies
    ]
    assert claims[0]["jti"] != claims[1]["jti"]
    assert claims[0]["sub"] == claims[1]["sub"] == account.id


@pytest.mark.parametrize("password", ["  private password  ", "密码🔐 café passphrase"])
def test_login_preserves_exact_password_whitespace_and_unicode(
    client: TestClient, db_session: Session, password: str
) -> None:
    account = persist_account(db_session, password=password)
    changed_password = password.strip() if password.startswith(" ") else "密码🔐 cafe passphrase"
    rejected = client.post(
        LOGIN_URL, json={"email": account.email, "password": changed_password}
    )
    assert_generic_credential_failure(rejected)

    accepted = client.post(LOGIN_URL, json={"email": account.email, "password": password})
    assert accepted.status_code == 200
    assert accepted.json()["user"]["id"] == account.id


@pytest.mark.parametrize("role", ["job_seeker", "counsellor", "platform_owner"])
def test_wrong_password_and_unknown_email_are_indistinguishable_and_allow_retry(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch, role: str
) -> None:
    account = persist_account(db_session, role=role)
    issue_token = Mock(wraps=auth.create_access_token)
    monkeypatch.setattr(auth, "create_access_token", issue_token)

    wrong_password = client.post(
        LOGIN_URL, json={"email": account.email, "password": "a-wrong-password"}
    )
    unknown_email = client.post(
        LOGIN_URL, json={"email": "unknown@example.com", "password": PASSWORD}
    )
    assert assert_generic_credential_failure(wrong_password) == assert_generic_credential_failure(
        unknown_email
    )
    issue_token.assert_not_called()
    for response in (wrong_password, unknown_email):
        assert account.email not in response.text
        assert account.password_hash not in response.text
        assert PASSWORD not in response.text

    corrected = client.post(LOGIN_URL, json={"email": account.email, "password": PASSWORD})
    assert corrected.status_code == 200
    assert corrected.json()["user"]["role"] == role
    issue_token.assert_called_once_with(account.id, role)
    with SessionLocal() as verification_db:
        assert len(verification_db.scalars(select(User)).all()) == 1
        assert verification_db.get(User, account.id).password_hash == account.password_hash


@pytest.mark.parametrize("known_email", [False, True])
def test_bad_credentials_perform_one_real_argon2_verification(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    known_email: bool,
) -> None:
    account = persist_account(db_session)
    # Spy through to the actual hasher: a dummy lookup must not bypass Argon2.
    # This checks work performed, not response-time equality.
    hasher = Mock(wraps=security._hasher)
    monkeypatch.setattr(security, "_hasher", hasher)
    issue_token = Mock(side_effect=AssertionError("Bad credentials must not issue a token"))
    monkeypatch.setattr(auth, "create_access_token", issue_token)
    response = client.post(
        LOGIN_URL,
        json={
            "email": account.email if known_email else "unknown@example.com",
            "password": "a-wrong-password",
        },
    )

    assert_generic_credential_failure(response)
    expected_hash = account.password_hash if known_email else security._dummy_password_hash
    hasher.verify.assert_called_once_with(expected_hash, "a-wrong-password")
    issue_token.assert_not_called()


def test_matching_dummy_password_cannot_authenticate_an_unknown_account(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    hasher = Mock(wraps=security._hasher)
    hasher.verify.return_value = True
    monkeypatch.setattr(security, "_hasher", hasher)
    issue_token = Mock(side_effect=AssertionError("A dummy match is not an account login"))
    monkeypatch.setattr(auth, "create_access_token", issue_token)
    response = client.post(
        LOGIN_URL, json={"email": "unknown@example.com", "password": PASSWORD}
    )

    assert_generic_credential_failure(response)
    hasher.verify.assert_called_once_with(security._dummy_password_hash, PASSWORD)
    issue_token.assert_not_called()
    with SessionLocal() as verification_db:
        assert verification_db.scalars(select(User)).all() == []


@pytest.mark.parametrize(
    "stored_hash",
    [
        "",
        "not-an-argon2-hash",
        "$argon2id$v=19$m=65536,t=3,p=4$invalid$invalid",
        "$argon2id$v=19$m=invalid,t=3,p=4$c2FsdA$aGFzaA",
    ],
)
def test_unusable_stored_password_hash_returns_the_same_generic_401(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    stored_hash: str,
) -> None:
    account = persist_account(db_session, password_hash=stored_hash)
    issue_token = Mock(side_effect=AssertionError("An unusable hash must never issue a token"))
    monkeypatch.setattr(auth, "create_access_token", issue_token)
    response = client.post(LOGIN_URL, json={"email": account.email, "password": PASSWORD})

    assert_generic_credential_failure(response)
    issue_token.assert_not_called()
    assert PASSWORD not in response.text
    if stored_hash:
        assert stored_hash not in response.text


@pytest.mark.parametrize(
    ("payload", "invalid_field"),
    [
        ({"password": PASSWORD}, "email"),
        ({"email": "session.tester@example.com"}, "password"),
        ({"email": "invalid-email", "password": PASSWORD}, "email"),
        ({"email": None, "password": PASSWORD}, "email"),
        ({"email": 123, "password": PASSWORD}, "email"),
        ({"email": "session.tester@example.com", "password": None}, "password"),
        ({"email": "session.tester@example.com", "password": 123}, "password"),
        ({"email": "session.tester@example.com", "password": ""}, "password"),
        (
            {"email": "session.tester@example.com", "password": PASSWORD, "role": "platform_owner"},
            "role",
        ),
        (
            {"email": "session.tester@example.com", "password": PASSWORD, "userId": "another-user"},
            "userId",
        ),
        (
            {
                "email": "session.tester@example.com",
                "password": PASSWORD,
                "accessToken": "injected",
            },
            "accessToken",
        ),
    ],
)
def test_invalid_login_input_is_rejected_before_verification_or_token_issuance(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    payload: dict,
    invalid_field: str,
) -> None:
    verifier = Mock(side_effect=AssertionError("Invalid input must not verify credentials"))
    issue_token = Mock(side_effect=AssertionError("Invalid input must not issue a token"))
    monkeypatch.setattr(auth, "verify_password", verifier)
    monkeypatch.setattr(auth, "create_access_token", issue_token)
    response = client.post(LOGIN_URL, json=payload)

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert invalid_field in body["fieldErrors"]
    assert body["requestId"] == response.headers["x-request-id"]
    assert not {"accessToken", "expiresAt", "user"} & body.keys()
    assert PASSWORD not in response.text
    verifier.assert_not_called()
    issue_token.assert_not_called()


@pytest.mark.parametrize("persisted_role", ["job_seeker", "counsellor", "platform_owner"])
@pytest.mark.parametrize("operation", ["create_order", "pay_order"])
def test_protected_booking_permissions_follow_database_role_not_token_role(
    client: TestClient, db_session: Session, persisted_role: str, operation: str
) -> None:
    account = persist_account(db_session, role=persisted_role)
    response = client.post(LOGIN_URL, json={"email": account.email, "password": PASSWORD})
    assert response.status_code == 200
    claims = jwt.decode(
        response.json()["accessToken"],
        security.settings.jwt_secret,
        algorithms=[security.settings.jwt_algorithm],
    )
    # This is a legitimately signed but stale/wrong role, not a bad-signature test.
    # A stale role must neither grant booking access nor revoke a persisted permission.
    claims["role"] = "counsellor" if persisted_role == "job_seeker" else "job_seeker"
    token = jwt.encode(
        claims, security.settings.jwt_secret, algorithm=security.settings.jwt_algorithm
    )
    headers = {"Authorization": f"Bearer {token}"}
    if operation == "create_order":
        protected = client.post(
            "/api/v1/orders",
            headers=headers,
            json={
                "serviceId": "does-not-exist",
                "slotId": "does-not-exist",
                "modality": "online",
                "timezone": "Australia/Melbourne",
            },
        )
    else:
        protected = client.post("/api/v1/orders/does-not-exist/payments/stub", headers=headers)

    if persisted_role == "job_seeker":
        # 404 shows that authorization passed and the real resource lookup ran.
        assert protected.status_code == 404
        assert protected.json()["code"] == "NOT_FOUND"
    else:
        assert protected.status_code == 403
        assert protected.json()["code"] == "FORBIDDEN"
    with SessionLocal() as verification_db:
        assert verification_db.scalars(select(Order)).all() == []


def test_login_password_is_hidden_from_model_representations() -> None:
    request = LoginRequest(email="session.tester@example.com", password=PASSWORD)
    assert PASSWORD not in repr(request)
    assert PASSWORD not in str(request)
    assert request.password == PASSWORD


def test_login_openapi_describes_public_validation_and_generic_failure_contract(
    client: TestClient,
) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    document = response.json()
    operation = document["paths"][LOGIN_URL]["post"]
    assert operation.get("security", []) == []
    assert {"200", "400", "401"} <= operation["responses"].keys()
    assert "422" not in operation["responses"]
    request_schema = document["components"]["schemas"]["LoginRequest"]
    assert request_schema["additionalProperties"] is False
    assert set(request_schema["required"]) == {"email", "password"}
    password = request_schema["properties"]["password"]
    assert password["format"] == "password"
    assert password["writeOnly"] is True
