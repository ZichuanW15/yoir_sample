from collections.abc import Iterator
from datetime import UTC, datetime

from sqlalchemy import DateTime, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import get_settings

settings = get_settings()

_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)
engine = create_engine(settings.database_url, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class UtcDateTime(TypeDecorator):
    """A timestamp that is always UTC-aware in Python, on every engine.

    PostgreSQL round-trips `timestamptz` with its offset intact, but SQLite has no
    timezone type at all, so `DateTime(timezone=True)` silently hands back a naive
    datetime there. Pydantic then serialises it with no offset, and a JavaScript
    client parses an offset-less timestamp as *local* time — so a hold set 15
    minutes in the future reads as hours in the past for anyone not on UTC.

    Attaching UTC on the way out removes that whole class of bug at the boundary,
    rather than leaving every reader to remember to correct for it.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        # A naive value reaching the database is taken as the UTC it was meant to be;
        # anything else is normalised so stored values are directly comparable.
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one SQLAlchemy session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
