"""Unit tests for the QA database reset safety gate.

These tests exercise URL parsing only; they never connect to the supplied URLs.
"""

from __future__ import annotations

import ast
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


@pytest.mark.xfail(
    strict=True,
    reason=(
        "reset_db.py imports the product engine and drops every table without validating a test "
        "database name or requiring YOIR_QA_ALLOW_DATABASE_RESET=true"
    ),
)
@pytest.mark.future_contract
def test_manual_reset_script_validates_target_before_destructive_import() -> None:
    reset_script = Path(__file__).resolve().parents[1] / "reset_db.py"
    tree = ast.parse(reset_script.read_text(encoding="utf-8"))
    imported_names = {
        alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom)
        for alias in node.names
    }

    assert "validate_database_reset_target" in imported_names
    source_lines = reset_script.read_text(encoding="utf-8").splitlines()
    validation_line = next(
        index
        for index, line in enumerate(source_lines)
        if "validate_database_reset_target(" in line
    )
    product_db_import_line = next(
        index for index, line in enumerate(source_lines) if "from app.db import" in line
    )
    assert validation_line < product_db_import_line


def test_per_test_cleanup_empties_every_table_before_what_it_references() -> None:
    """PostgreSQL enforces foreign keys and the local SQLite run does not, so a table
    missing from the cleanup list passes locally and errors every test in CI. Checked
    against the models here, so a new table fails on SQLite too."""
    from conftest import _DATABASE_CLEANUP_ORDER

    from app.db import Base

    assert set(_DATABASE_CLEANUP_ORDER) == set(Base.metadata.tables)
    position = {name: index for index, name in enumerate(_DATABASE_CLEANUP_ORDER)}
    for table in Base.metadata.tables.values():
        for foreign_key in table.foreign_keys:
            parent = foreign_key.column.table.name
            if parent != table.name:
                assert position[table.name] < position[parent], (
                    f"{table.name} must be emptied before {parent}, which it references"
                )
