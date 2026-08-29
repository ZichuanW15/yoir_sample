"""QA checks for the existing seed fixture and environment defaults."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import User
from app.security import hash_password
from app.seed import seed

BACKEND = Path(__file__).resolve().parents[1]


def test_seed_json_references_and_domains_are_valid() -> None:
    data = json.loads((BACKEND / "app" / "seed_data.json").read_text())
    job_seekers = data["job_seekers"]
    counsellors = data["counsellors"]
    services = data["services"]
    job_seeker_emails = [row["email"].lower() for row in job_seekers]
    emails = [row["email"].lower() for row in counsellors]

    assert len(job_seekers) == 2
    assert len(counsellors) == 4
    assert len(services) == 7
    assert len(job_seeker_emails) == len(set(job_seeker_emails))
    assert len(emails) == len(set(emails))
    assert set(job_seeker_emails).isdisjoint(emails)
    assert all(row["name"] and row["password"] for row in job_seekers)
    assert all(row["counsellor_email"].lower() in emails for row in services)
    assert all(row["currency"] == "AUD" for row in services)
    assert all(set(row["modalities"]).issubset({"online", "in_person"}) for row in services)
    assert all(row["title"] and row["description"] for row in services)
    assert all(isinstance(row["price_minor"], int) and row["price_minor"] >= 0 for row in services)


@pytest.mark.xfail(
    strict=True,
    reason="seed() only checks the services table and duplicates existing counsellor emails",
)
def test_seed_is_safe_when_users_exist_but_services_are_empty(db_session: Session) -> None:
    db_session.add(
        User(
            name="Existing Maya",
            email="maya@example.com",
            password_hash=hash_password("password123"),
            role="counsellor",
        )
    )
    db_session.commit()
    seed(db_session)


@pytest.mark.xfail(
    strict=True,
    reason="Backend defaults enable wildcard CORS, automatic seed and an insecure JWT secret",
)
def test_default_configuration_is_safe_for_shared_environment(monkeypatch) -> None:
    for key in (
        "DATABASE_URL",
        "JWT_SECRET",
        "CORS_ALLOW_ORIGINS",
        "SEED_ON_STARTUP",
    ):
        monkeypatch.delenv(key, raising=False)
    settings = Settings(_env_file=None)
    assert settings.jwt_secret != "dev-only-insecure-secret-change-me-please-32b"
    assert settings.cors_allow_origins != "*"
    assert settings.seed_on_startup is False
