"""US-08: durable current-session logout, replay protection and safe failures.

The small protected probe is mounted on an isolated test application, never on
the product router. It exercises the real shared authentication dependency for
all three roles; separate checks cover the existing product booking endpoints.
"""

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from threading import Barrier
from typing import Annotated

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import Base, SessionLocal, engine, get_db
from app.errors import register_error_handlers
from app.models import RevokedToken, User
from app.routers import auth
from app.security import get_current_user, hash_password

LOGIN_URL = "/api/v1/auth/sessions"
LOGOUT_URL = f"{LOGIN_URL}/current"
PROTECTED_URL = "/test-only/private"
PASSWORD = "private-logout-test-password"


@pytest.fixture
def auth_app() -> FastAPI:
    test_app = FastAPI()
    register_error_handlers(test_app)
    test_app.include_router(auth.router, prefix="/api/v1")

    @test_app.get(PROTECTED_URL)
    def authenticated_probe(user: Annotated[User, Depends(get_current_user)]) -> dict:
        return {"id": user.id, "role": user.role}

    return test_app


@pytest.fixture
def auth_client(auth_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(auth_app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture
def logout_user(db_session: Session) -> User:
    user = User(
        name="Session Test Account",
        email="session.test@example.com",
        password_hash=hash_password(PASSWORD),
        role="job_seeker",
    )
    db_session.add(user)
    db_session.commit()
    return user


def login(client: TestClient, user: User) -> str:
    response = client.post(LOGIN_URL, json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200
    return response.json()["accessToken"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def assert_logged_out(response) -> None:
    assert response.status_code == 204
    assert response.content == b""
    assert "set-cookie" not in response.headers
    assert response.headers["x-request-id"]


def assert_authentication_required(response) -> None:
    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["code"] == "AUTHENTICATION_REQUIRED"
    assert response.json()["message"]
    assert response.json()["requestId"] == response.headers["x-request-id"]
    assert "accessToken" not in response.json()
    assert "set-cookie" not in response.headers


def revoked_rows() -> list[dict]:
    with SessionLocal() as db:
        table = Base.metadata.tables["revoked_tokens"]
        return [dict(row) for row in db.execute(select(table)).mappings()]


def sign(claims: dict) -> str:
    settings = get_settings()
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def valid_claims(user: User) -> dict:
    return {
        "sub": user.id,
        "role": user.role,
        "exp": int((datetime.now(UTC) + timedelta(minutes=5)).timestamp()),
    }


@pytest.mark.parametrize("role", ["job_seeker", "counsellor", "platform_owner"])
def test_each_role_can_log_out_without_disabling_other_sessions_or_relogin(
    auth_client: TestClient, logout_user: User, db_session: Session, role: str
) -> None:
    logout_user.role = role
    db_session.commit()
    first = login(auth_client, logout_user)
    second = login(auth_client, logout_user)
    assert first != second
    assert auth_client.get(PROTECTED_URL, headers=bearer(first)).json() == {
        "id": logout_user.id,
        "role": role,
    }

    assert_logged_out(auth_client.delete(LOGOUT_URL, headers=bearer(first)))
    assert_authentication_required(auth_client.get(PROTECTED_URL, headers=bearer(first)))
    assert auth_client.get(PROTECTED_URL, headers=bearer(second)).status_code == 200
    third = login(auth_client, logout_user)
    assert third not in (first, second)
    assert auth_client.get(PROTECTED_URL, headers=bearer(third)).status_code == 200
    assert_authentication_required(auth_client.get(PROTECTED_URL, headers=bearer(first)))


def test_logout_is_idempotent_and_persists_only_a_digest_with_expiry(
    auth_client: TestClient, logout_user: User
) -> None:
    token = login(auth_client, logout_user)
    for _ in range(3):
        assert_logged_out(auth_client.delete(LOGOUT_URL, headers=bearer(token)))

    rows = revoked_rows()
    assert len(rows) == 1
    assert rows[0]["token_digest"] == sha256(token.rsplit(".", 1)[0].encode()).hexdigest()
    assert rows[0]["revoked_at"] is not None
    expires_at = rows[0]["expires_at"]
    if expires_at.tzinfo is None:  # SQLite does not retain timezone metadata.
        expires_at = expires_at.replace(tzinfo=UTC)
    settings = get_settings()
    claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    assert expires_at.timestamp() == claims["exp"]
    assert token not in repr(rows)
    assert token.split(".")[2] not in repr(rows)
    assert PASSWORD not in repr(rows)
    assert logout_user.password_hash not in repr(rows)


@pytest.mark.parametrize("logout_padding", ["", "=", "=="])
def test_alternate_signature_padding_cannot_bypass_revocation(
    auth_client: TestClient, logout_user: User, logout_padding: str
) -> None:
    token = login(auth_client, logout_user)
    assert_logged_out(auth_client.delete(LOGOUT_URL, headers=bearer(token + logout_padding)))
    for padding in ("", "=", "=="):
        assert_authentication_required(
            auth_client.get(PROTECTED_URL, headers=bearer(token + padding))
        )
        assert_logged_out(auth_client.delete(LOGOUT_URL, headers=bearer(token + padding)))
    assert len(revoked_rows()) == 1


def test_existing_signed_token_without_jti_can_be_used_then_revoked(
    auth_client: TestClient, logout_user: User
) -> None:
    token = sign(valid_claims(logout_user))
    assert auth_client.get(PROTECTED_URL, headers=bearer(token)).status_code == 200
    assert_logged_out(auth_client.delete(LOGOUT_URL, headers=bearer(token)))
    assert_authentication_required(auth_client.get(PROTECTED_URL, headers=bearer(token)))


def test_revocation_survives_a_new_application_and_database_session(
    auth_client: TestClient, logout_user: User
) -> None:
    token = login(auth_client, logout_user)
    assert_logged_out(auth_client.delete(LOGOUT_URL, headers=bearer(token)))
    # A second app has no access to the first app's state or dependency cache.
    separate_app = FastAPI()
    register_error_handlers(separate_app)

    @separate_app.get(PROTECTED_URL)
    def protected(user: Annotated[User, Depends(get_current_user)]) -> dict:
        return {"id": user.id}

    with TestClient(separate_app, raise_server_exceptions=False) as separate_client:
        assert_authentication_required(
            separate_client.get(PROTECTED_URL, headers=bearer(token))
        )
    assert len(revoked_rows()) == 1


def test_logout_protects_existing_booking_endpoints_without_blocking_public_browsing(
    client: TestClient, logout_user: User, service
) -> None:
    token = login(client, logout_user)
    headers = bearer(token)
    # A missing order reaches normal business handling while authenticated.
    payment_url = "/api/v1/orders/missing-order/payments/stub"
    assert client.post(payment_url, headers=headers).status_code == 404
    assert_logged_out(client.delete(LOGOUT_URL, headers=headers))
    assert_authentication_required(client.post(payment_url, headers=headers))
    assert_authentication_required(
        client.post(
            "/api/v1/orders",
            headers=headers,
            json={
                "serviceId": service.id,
                "slotId": "missing-slot",
                "timezone": "Australia/Melbourne",
                "modality": "online",
            },
        )
    )
    for path in ("/api/v1/services", f"/api/v1/services/{service.id}"):
        assert client.get(path).status_code == 200
        assert client.get(path, headers=headers).status_code == 200


@pytest.mark.parametrize(
    "authorization",
    [None, "", "Bearer", "Bearer ", "Basic abc", "Bearer malformed", "Bearer a.b.c"],
)
def test_missing_or_malformed_logout_credentials_are_not_successful(
    auth_client: TestClient, authorization: str | None
) -> None:
    headers = {} if authorization is None else {"Authorization": authorization}
    assert_authentication_required(auth_client.delete(LOGOUT_URL, headers=headers))
    assert revoked_rows() == []


@pytest.mark.parametrize(
    "changes",
    [
        {"exp": 0},
        {"exp": None},
        {"exp": True},
        {"exp": "later"},
        {"exp": float("nan")},
        {"exp": float("inf")},
        {"sub": None},
        {"sub": ""},
        {"sub": 123},
        {"sub": ["somebody"]},
        {"role": None},
        {"role": "invalid-role"},
        {"role": ["job_seeker"]},
        {"jti": None},
        {"jti": ""},
        {"jti": 123},
        {"iat": None},
        {"iat": True},
        {"iat": "invalid-time"},
    ],
)
def test_invalid_signed_claims_cannot_log_out_or_access_private_endpoints(
    auth_client: TestClient, logout_user: User, changes: dict
) -> None:
    token = sign({**valid_claims(logout_user), **changes})
    assert_authentication_required(auth_client.delete(LOGOUT_URL, headers=bearer(token)))
    assert_authentication_required(auth_client.get(PROTECTED_URL, headers=bearer(token)))
    assert revoked_rows() == []


@pytest.mark.parametrize("missing", ["sub", "role", "exp"])
def test_required_signed_claims_cannot_be_omitted(
    auth_client: TestClient, logout_user: User, missing: str
) -> None:
    claims = valid_claims(logout_user)
    del claims[missing]
    token = sign(claims)
    assert_authentication_required(auth_client.delete(LOGOUT_URL, headers=bearer(token)))
    assert revoked_rows() == []


def test_unknown_account_token_cannot_claim_logout_success(auth_client: TestClient) -> None:
    token = sign(
        {
            "sub": "missing-user",
            "role": "job_seeker",
            "exp": int((datetime.now(UTC) + timedelta(minutes=5)).timestamp()),
        }
    )
    assert_authentication_required(auth_client.delete(LOGOUT_URL, headers=bearer(token)))
    assert revoked_rows() == []


def test_failed_logout_commit_rolls_back_and_does_not_claim_success(
    auth_client: TestClient,
    auth_app: FastAPI,
    logout_user: User,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    token = login(auth_client, logout_user)

    def request_db():
        yield db_session

    def fail_commit() -> None:
        db_session.flush()
        raise OperationalError("private revocation SQL", {}, RuntimeError("database unavailable"))

    auth_app.dependency_overrides[get_db] = request_db
    try:
        with monkeypatch.context() as patch:
            patch.setattr(db_session, "commit", fail_commit)
            response = auth_client.delete(LOGOUT_URL, headers=bearer(token))
            assert response.status_code == 500
            assert response.json()["code"] == "INTERNAL_ERROR"
            assert "private" not in response.text
            assert "database unavailable" not in response.text
            assert token not in response.text
            assert not db_session.in_transaction()
            assert revoked_rows() == []
        assert auth_client.get(PROTECTED_URL, headers=bearer(token)).status_code == 200
        assert_logged_out(auth_client.delete(LOGOUT_URL, headers=bearer(token)))
        assert_authentication_required(auth_client.get(PROTECTED_URL, headers=bearer(token)))
    finally:
        auth_app.dependency_overrides.pop(get_db, None)


@pytest.mark.parametrize("method,path", [("GET", PROTECTED_URL), ("DELETE", LOGOUT_URL)])
def test_unavailable_revocation_store_fails_closed(
    auth_client: TestClient, logout_user: User, method: str, path: str
) -> None:
    token = login(auth_client, logout_user)

    def reject_revocation_store(_connection, _cursor, statement, _parameters, _context, _many):
        if "revoked_tokens" in statement.lower():
            raise OperationalError("private revocation SQL", {}, RuntimeError("store offline"))

    event.listen(engine, "before_cursor_execute", reject_revocation_store)
    try:
        response = auth_client.request(method, path, headers=bearer(token))
    finally:
        event.remove(engine, "before_cursor_execute", reject_revocation_store)
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert "private" not in response.text
    assert "store offline" not in response.text
    assert token not in response.text
    assert revoked_rows() == []
    assert auth_client.get(PROTECTED_URL, headers=bearer(token)).status_code == 200


def test_concurrent_logout_requests_are_idempotent(
    auth_client: TestClient, auth_app: FastAPI, logout_user: User
) -> None:
    token = login(auth_client, logout_user)
    both_authenticated = Barrier(2)

    class RacingSession(Session):
        def get(self, entity, ident, *args, **kwargs):
            result = super().get(entity, ident, *args, **kwargs)
            if entity is User:
                # Force both requests to validate the account before either can
                # revoke it. Merely starting threads together can run serially.
                assert result is not None
                both_authenticated.wait(timeout=10)
            return result

    def concurrent_db():
        with RacingSession(bind=engine, autoflush=False, expire_on_commit=False) as db:
            yield db

    def logout():
        return auth_client.delete(LOGOUT_URL, headers=bearer(token))

    auth_app.dependency_overrides[get_db] = concurrent_db
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            requests = [executor.submit(logout) for _ in range(2)]
            responses = [request.result(timeout=15) for request in requests]
    finally:
        auth_app.dependency_overrides.pop(get_db, None)
    for response in responses:
        assert_logged_out(response)
    assert len(revoked_rows()) == 1
    assert_authentication_required(auth_client.get(PROTECTED_URL, headers=bearer(token)))


def test_logout_cleans_only_revocations_expired_for_at_least_one_day(
    auth_client: TestClient,
    logout_user: User,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    token = login(auth_client, logout_user)
    now = datetime.now(UTC).replace(microsecond=0)

    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return now if tz is not None else now.replace(tzinfo=None)

    monkeypatch.setattr(auth, "datetime", FixedDatetime)
    expiries = {
        "long-expired": now - timedelta(days=2),
        "exactly-one-day": now - timedelta(days=1),
        "almost-one-day": now - timedelta(days=1) + timedelta(seconds=1),
        "just-expired": now - timedelta(seconds=1),
        "still-valid": now + timedelta(hours=1),
    }
    digests = {label: sha256(label.encode()).hexdigest() for label in expiries}
    db_session.add_all(
        RevokedToken(token_digest=digests[label], expires_at=expiry)
        for label, expiry in expiries.items()
    )
    db_session.commit()

    assert_logged_out(auth_client.delete(LOGOUT_URL, headers=bearer(token)))
    assert {row["token_digest"] for row in revoked_rows()} == {
        digests["almost-one-day"],
        digests["just-expired"],
        digests["still-valid"],
        sha256(token.rsplit(".", 1)[0].encode()).hexdigest(),
    }
