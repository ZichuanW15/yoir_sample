"""Migrations are what makes a deploy unattended, so the paths they take are pinned.

`create_all()` only ever created missing tables; a new column on an existing table
never reached the database, and the deployment failed on the first request that
needed it. These tests cover the three states a database can arrive in and the one
case where guessing would be worse than stopping.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from alembic import command
from sqlalchemy import create_engine, inspect, text

from app.db import Base
from app.migrations import BASELINE_REVISION, alembic_config, upgrade_database


@pytest.fixture
def database(tmp_path: Path):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'migrate.db'}")
    yield engine
    engine.dispose()


def tables(engine) -> set[str]:
    return {t for t in inspect(engine).get_table_names() if t != "alembic_version"}


def test_an_empty_database_is_built_entirely_from_migrations(database) -> None:
    upgrade_database(database)

    assert tables(database) == set(Base.metadata.tables)


def test_the_migrated_schema_matches_the_models_column_for_column(database) -> None:
    """The check create_all could never fail, and the reason migrations exist."""
    upgrade_database(database)

    inspector = inspect(database)
    drift = {
        name: sorted(
            {c.name for c in table.columns}
            - {c["name"] for c in inspector.get_columns(name)}
        )
        for name, table in Base.metadata.tables.items()
        if {c.name for c in table.columns} - {c["name"] for c in inspector.get_columns(name)}
    }
    assert drift == {}


def test_running_twice_is_a_no_op(database) -> None:
    """Startup calls this every time, including on a container that just restarted."""
    upgrade_database(database)
    before = tables(database)

    upgrade_database(database)

    assert tables(database) == before


def legacy_database_with_data(engine) -> None:
    """Stand up the pre-Alembic schema, with a booking, and strip the version row."""
    command.upgrade(alembic_config(engine), "0001")
    with engine.begin() as c:
        c.execute(text("DELETE FROM alembic_version"))
        c.execute(text(
            "INSERT INTO users (id,name,email,password_hash,role,verification_status,"
            "review_count) VALUES ('u1','Maya','m@e.com','h','counsellor','verified',0)"
        ))
        c.execute(text(
            "INSERT INTO users (id,name,email,password_hash,role,verification_status,"
            "review_count) VALUES ('u2','Alex','a@e.com','h','job_seeker','pending',0)"
        ))
        c.execute(text(
            "INSERT INTO services (id,counsellor_id,title,description,price_minor,currency,"
            "modalities,active,review_count) "
            "VALUES ('s1','u1','Coaching','d',9500,'AUD','[\"online\"]',1,0)"
        ))
        c.execute(text(
            "INSERT INTO availability_slots (id,service_id,starts_at,ends_at,status) "
            "VALUES ('sl1','s1','2026-10-01 09:00:00','2026-10-01 10:00:00','booked')"
        ))
        c.execute(text(
            "INSERT INTO orders (id,job_seeker_id,service_id,slot_id,amount_minor,currency,"
            "timezone,modality,status,payment_status) VALUES "
            "('o1','u2','s1','sl1',9500,'AUD','Australia/Melbourne','online','confirmed','paid')"
        ))
        c.execute(text(
            "INSERT INTO bookings (id,order_id,service_id,slot_id,job_seeker_id,counsellor_id,"
            "starts_at,ends_at,timezone,modality,status,payment_status) VALUES "
            "('b1','o1','s1','sl1','u2','u1','2026-10-01 09:00:00','2026-10-01 10:00:00',"
            "'Australia/Melbourne','online','confirmed','paid')"
        ))


def test_a_database_predating_migrations_is_adopted_without_being_rebuilt(database) -> None:
    """The deployed database's case: real data, no migration history."""
    legacy_database_with_data(database)

    upgrade_database(database)

    assert tables(database) == set(Base.metadata.tables)
    with database.connect() as c:
        # Nobody was dropped on the way through.
        assert c.execute(text("SELECT count(*) FROM users")).scalar() == 2
        assert c.execute(text("SELECT count(*) FROM services")).scalar() == 1


def test_adoption_carries_slots_across_as_windows_owned_by_the_counsellor(database) -> None:
    """Availability moved from the service to the person, so the rows have to move too."""
    legacy_database_with_data(database)

    upgrade_database(database)

    with database.connect() as c:
        window = c.execute(text(
            "SELECT id, counsellor_id, starts_at, ends_at FROM availability_windows"
        )).one()
        assert window.counsellor_id == "u1"  # resolved through the service
        # The order and booking follow the slot they already pointed at.
        assert c.execute(text("SELECT window_id FROM orders")).scalar() == window.id
        assert c.execute(text("SELECT window_id FROM bookings")).scalar() == window.id
        # The order gained its own span, which it never had before.
        assert c.execute(text("SELECT starts_at FROM orders")).scalar() is not None


def test_an_unrecognised_schema_stops_rather_than_being_guessed_at(database) -> None:
    """Refusing is the safe answer.

    Running a migration written for one schema against a different one corrupts it
    quietly. A deployment that will not start is recoverable; a half-migrated
    production database is much less so.
    """
    with database.begin() as c:
        c.execute(text("CREATE TABLE something_unexpected (id TEXT)"))

    with pytest.raises(RuntimeError, match="Refusing to guess"):
        upgrade_database(database)


def test_the_baseline_names_a_revision_that_exists() -> None:
    """Adoption stamps this exact revision, so a rename must not silently orphan it."""
    from alembic.script import ScriptDirectory

    revisions = {r.revision for r in ScriptDirectory.from_config(alembic_config()).walk_revisions()}
    assert BASELINE_REVISION in revisions
