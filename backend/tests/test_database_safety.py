"""Unit tests for the QA database reset safety gate.

These tests exercise URL parsing only; they never connect to the supplied URLs.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from qa_database_safety import UnsafeTestDatabaseError, validate_database_reset_target


def _sqlite_url(database_path: Path) -> str:
    return f"sqlite+pysqlite:///{database_path}"


def test_qa_managed_temporary_sqlite_database_is_allowed(tmp_path: Path) -> None:
    database_path = tmp_path / "test.sqlite3"

    validate_database_reset_target(
        _sqlite_url(database_path),
        allow_database_reset=None,
        temporary_sqlite_path=database_path,
    )


def test_non_qa_sqlite_database_is_rejected(tmp_path: Path) -> None:
    qa_database_path = tmp_path / "qa" / "test.sqlite3"
    other_database_path = tmp_path / "application.sqlite3"

    with pytest.raises(UnsafeTestDatabaseError, match="QA-managed temporary database"):
        validate_database_reset_target(
            _sqlite_url(other_database_path),
            allow_database_reset="true",
            temporary_sqlite_path=qa_database_path,
        )


@pytest.mark.parametrize("database_name", ["yoir_test", "sprint1_test"])
def test_approved_postgresql_test_database_with_explicit_flag_is_allowed(
    database_name: str,
) -> None:
    validate_database_reset_target(
        f"postgresql+psycopg://yoir:secret@localhost:5432/{database_name}",
        allow_database_reset="true",
    )


def test_ordinary_postgresql_database_is_rejected_without_leaking_password() -> None:
    with pytest.raises(UnsafeTestDatabaseError, match="not an approved test database") as exc:
        validate_database_reset_target(
            "postgresql+psycopg://yoir:super-secret@localhost:5432/yoir",
            allow_database_reset="true",
        )

    assert "super-secret" not in str(exc.value)


def test_postgresql_test_database_without_explicit_flag_is_rejected() -> None:
    with pytest.raises(UnsafeTestDatabaseError, match="YOIR_QA_ALLOW_DATABASE_RESET=true"):
        validate_database_reset_target(
            "postgresql+psycopg://yoir:secret@localhost:5432/yoir_test",
            allow_database_reset=None,
        )


@pytest.mark.parametrize("query_key", ["dbname", "database"])
def test_postgresql_query_cannot_override_approved_database_name(query_key: str) -> None:
    with pytest.raises(UnsafeTestDatabaseError, match="database-name overrides"):
        validate_database_reset_target(
            "postgresql+psycopg://yoir:secret@localhost:5432/yoir_test"
            f"?{query_key}=yoir",
            allow_database_reset="true",
        )


def test_malformed_database_url_is_rejected() -> None:
    with pytest.raises(UnsafeTestDatabaseError, match="DATABASE_URL is malformed"):
        validate_database_reset_target(
            "postgresql+psycopg://[not-a-valid-host/yoir_test",
            allow_database_reset="true",
        )
