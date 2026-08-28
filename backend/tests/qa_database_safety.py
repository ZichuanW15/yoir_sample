"""Pure validation helpers for destructive QA database setup."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

ALLOW_DATABASE_RESET_ENV = "YOIR_QA_ALLOW_DATABASE_RESET"


class UnsafeTestDatabaseError(RuntimeError):
    """Raised before QA setup can touch an unsafe database target."""


def validate_database_reset_target(
    database_url: str,
    *,
    allow_database_reset: str | None,
    temporary_sqlite_path: Path | None = None,
) -> None:
    """Reject unsafe reset targets without opening a database connection.

    The local test harness owns one temporary SQLite file, so only that exact
    file is accepted without an explicit reset flag. PostgreSQL requires both
    an unmistakable test database name and an explicit opt-in.
    """

    try:
        split_url = urlsplit(database_url)
        if not split_url.scheme or "://" not in database_url:
            raise ValueError
        # Accessing hostname makes urllib validate bracketed host syntax.
        _ = split_url.hostname
        parsed_url = make_url(database_url)
        backend_name = parsed_url.get_backend_name()
    except (ArgumentError, TypeError, ValueError):
        raise UnsafeTestDatabaseError(
            "Refusing destructive QA database setup: DATABASE_URL is malformed."
        ) from None

    if backend_name == "sqlite":
        if parsed_url.database is None or temporary_sqlite_path is None:
            raise UnsafeTestDatabaseError(
                "Refusing destructive QA database setup: SQLite is allowed only for the "
                "QA-managed temporary database."
            )

        configured_path = Path(parsed_url.database).resolve()
        expected_path = temporary_sqlite_path.resolve()
        if configured_path != expected_path:
            raise UnsafeTestDatabaseError(
                "Refusing destructive QA database setup: SQLite is allowed only for the "
                "QA-managed temporary database."
            )
        return

    if backend_name == "postgresql":
        query_keys = {key.casefold() for key in parsed_url.query}
        if query_keys & {"database", "dbname"}:
            raise UnsafeTestDatabaseError(
                "Refusing destructive QA database setup: PostgreSQL database-name "
                "overrides are not allowed."
            )

        database_name = parsed_url.database
        if database_name is None or not (
            database_name == "yoir_test" or database_name.endswith("_test")
        ):
            raise UnsafeTestDatabaseError(
                "Refusing destructive QA database setup: PostgreSQL database name is not "
                "an approved test database."
            )

        if (allow_database_reset or "").strip().lower() != "true":
            raise UnsafeTestDatabaseError(
                "Refusing destructive QA database setup: "
                f"{ALLOW_DATABASE_RESET_ENV}=true is required for PostgreSQL."
            )
        return

    raise UnsafeTestDatabaseError(
        "Refusing destructive QA database setup: only the QA-managed temporary SQLite "
        "database or an explicitly approved PostgreSQL test database is allowed."
    )
