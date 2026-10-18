"""Shared fixtures for QA-owned tests of the existing backend implementation.

The local fallback is SQLite so the suite can exercise the API on machines that
do not have PostgreSQL.  CI supplies an isolated PostgreSQL DATABASE_URL.  A
SQLite run must never be reported as PostgreSQL integration evidence.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from qa_database_safety import ALLOW_DATABASE_RESET_ENV, validate_database_reset_target
from sqlalchemy import delete, text
from sqlalchemy.orm import Session

_temporary_database_dir: Path | None = None
_live_only_session = False

# These are populated in pytest_configure, before test modules are collected.
# Delaying product imports is important: a separately running live server owns its
# database, and collecting only test_live_api.py must not even initialise the local
# destructive fixture harness.
Base: Any = None
SessionLocal: Any = None
Service: Any = None
User: Any = None
app: Any = None
create_access_token: Any = None
engine: Any = None
hash_password: Any = None

_DATABASE_CLEANUP_ORDER = (
    "processed_webhook_events",
    "revoked_tokens",
    "refresh_tokens",
    "reviews",
    "bookings",
    "orders",
    "availability_windows",
    "services",
    "single_use_tokens",
    "diagnoses",
    "users",
)


def _is_live_only_selection(config: pytest.Config) -> bool:
    """Return whether every explicitly selected node is the live-smoke module."""

    selected_paths = [str(argument).split("::", 1)[0] for argument in config.args]
    return bool(selected_paths) and all(
        Path(path).name == "test_live_api.py" for path in selected_paths
    )


def pytest_configure(config: pytest.Config) -> None:
    """Configure destructive local fixtures only when local tests are selected."""

    global Base, Service, SessionLocal, User, app, create_access_token, engine
    global hash_password, _live_only_session, _temporary_database_dir

    config.addinivalue_line(
        "markers",
        "live: black-box HTTP test against a separately managed server and database",
    )
    config.addinivalue_line(
        "markers",
        "future_contract: retained architecture, unimplemented capability or unapproved "
        "policy check; exclude from implemented-feature QA",
    )
    _live_only_session = _is_live_only_selection(config)
    if _live_only_session:
        return

    if "DATABASE_URL" not in os.environ:
        _temporary_database_dir = Path(tempfile.mkdtemp(prefix="yoir-qa-backend-"))
        database_path = _temporary_database_dir / "test.sqlite3"
        os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{database_path}"

    validate_database_reset_target(
        os.environ["DATABASE_URL"],
        allow_database_reset=os.environ.get(ALLOW_DATABASE_RESET_ENV),
        temporary_sqlite_path=(
            _temporary_database_dir / "test.sqlite3"
            if _temporary_database_dir is not None
            else None
        ),
    )

    os.environ.setdefault("JWT_SECRET", "qa-test-secret-that-is-at-least-32-characters")
    os.environ.setdefault("SEED_ON_STARTUP", "false")
    os.environ.setdefault("CORS_ALLOW_ORIGINS", "http://localhost:8081")

    # Settings read backend/.env, and a developer working on payments will have real
    # Stripe keys in theirs. STRIPE_SECRET_KEY is what switches the whole app from
    # the payment stub to live card payments, so without this the suite would behave
    # differently on their machine than in CI — and would reach out to Stripe.
    # Assigned, not setdefault: an inherited value has to be overridden too. The
    # payment tests opt back in explicitly via the `stripe_enabled` fixture.
    # The same applies to Mailgun, and more sharply: with a key and domain present
    # the suite does not merely behave differently, it makes live HTTP calls to the
    # provider and tries to send real email to fixture addresses. Assigned, not
    # setdefault: an inherited value has to be overridden too.
    for third_party_variable in (
        "STRIPE_SECRET_KEY",
        "STRIPE_PUBLISHABLE_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_CONNECT_WEBHOOK_SECRET",
        "MAILGUN_API_KEY",
        "MAILGUN_DOMAIN",
    ):
        os.environ[third_party_variable] = ""

    from app.db import Base as ProductBase
    from app.db import SessionLocal as ProductSessionLocal
    from app.db import engine as product_engine
    from app.main import app as product_app
    from app.models import Service as ProductService
    from app.models import User as ProductUser
    from app.security import create_access_token as product_create_access_token
    from app.security import hash_password as product_hash_password

    Base = ProductBase
    SessionLocal = ProductSessionLocal
    Service = ProductService
    User = ProductUser
    app = product_app
    create_access_token = product_create_access_token
    engine = product_engine
    hash_password = product_hash_password


@pytest.fixture(scope="session")
def client() -> Iterator[Any]:
    if _live_only_session:
        raise pytest.UsageError("The in-process client is unavailable in a live-only run.")

    from fastapi.testclient import TestClient

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)
    # Alembic owns this table outside ORM metadata. Leaving it stamped at head
    # after dropping the product tables prevents the next QA run migrating them.
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
    engine.dispose()
    if _temporary_database_dir is not None:
        shutil.rmtree(_temporary_database_dir)


@pytest.fixture(autouse=True)
def clean_database(request: pytest.FixtureRequest) -> Iterator[None]:
    if request.node.get_closest_marker("live") is not None:
        yield
        return

    # Resolve this fixture dynamically so a live-only invocation never starts the
    # in-process application or registers its destructive session teardown.
    request.getfixturevalue("client")
    with SessionLocal() as db:
        for table_name in _DATABASE_CLEANUP_ORDER:
            table = Base.metadata.tables.get(table_name)
            if table is not None:
                db.execute(delete(table))
        db.commit()
    yield


@pytest.fixture
def db_session() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db


@pytest.fixture
def counsellor(db_session: Session) -> Any:
    user = User(
        name="Maya Chen",
        email="maya@example.com",
        password_hash=hash_password("password123"),
        role="counsellor",
        email_verified_at=datetime.now(UTC),
        introduction="Career counsellor specialising in interviews.",
        verification_status="verified",
        overall_rating=4.9,
        review_count=46,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def service(db_session: Session, counsellor: Any) -> Any:
    item = Service(
        counsellor_id=counsellor.id,
        title="Interview confidence coaching",
        description="Behavioural questions, delivery and practical feedback.",
        price_minor=9500,
        currency="AUD",
        modalities=["online"],
        active=True,
        average_rating=4.9,
        review_count=28,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def job_seeker(db_session: Session) -> Any:
    user = User(
        name="Alex Job Seeker",
        email="alex.jobseeker@example.com",
        password_hash=hash_password("password123"),
        role="job_seeker",
        email_verified_at=datetime.now(UTC),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def platform_owner(db_session: Session) -> Any:
    """The administration role. Registration never hands it out, so it only ever
    exists because somebody put it in the database deliberately."""
    user = User(
        name="Yoir Admin",
        email="admin@example.com",
        password_hash=hash_password("password123"),
        role="platform_owner",
        email_verified_at=datetime.now(UTC),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def platform_owner_headers(platform_owner: Any) -> dict[str, str]:
    token, _ = create_access_token(platform_owner.id, platform_owner.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def job_seeker_headers(job_seeker: Any) -> dict[str, str]:
    token, _ = create_access_token(job_seeker.id, job_seeker.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def counsellor_headers(counsellor: Any) -> dict[str, str]:
    token, _ = create_access_token(counsellor.id, counsellor.role)
    return {"Authorization": f"Bearer {token}"}
