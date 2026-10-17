"""US-36 / QA #201: migrate and retain the purchased meeting-area snapshot.

Use a private PostgreSQL schema when the QA suite runs on PostgreSQL, or a
temporary SQLite file for local checks. The application fixture database is not
downgraded; these checks own and remove only their separate migration target.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from alembic import command
from sqlalchemy import MetaData, create_engine, inspect, text

from app.db import engine
from app.migrations import alembic_config, upgrade_database


@pytest.fixture
def migration_database(tmp_path):
    if engine.dialect.name == "postgresql":
        schema = "qa_area_migration_" + uuid4().hex
        with engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        isolated = create_engine(
            engine.url, connect_args={"options": f"-csearch_path={schema}"},
        )
        try:
            yield isolated
        finally:
            isolated.dispose()
            with engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    else:
        isolated = create_engine(f"sqlite+pysqlite:///{tmp_path / 'meeting-area.sqlite3'}")
        try:
            yield isolated
        finally:
            isolated.dispose()


def _seed_revision_0011(database, *, city="Melbourne", state="VIC"):
    command.upgrade(alembic_config(database), "0011")
    metadata = MetaData()
    metadata.reflect(
        bind=database, only=("users", "services", "availability_windows", "orders", "bookings"),
    )
    tables = metadata.tables
    start = datetime(2026, 10, 10, 9, tzinfo=UTC)
    with database.begin() as connection:
        for user_id, role in (("seeker", "job_seeker"), ("professional", "counsellor")):
            connection.execute(tables["users"].insert().values(
                id=user_id, name=user_id, email=f"{user_id}@example.test",
                password_hash="qa-fixture", role=role, created_at=start,
            ))
        connection.execute(tables["services"].insert().values(
            id="service", counsellor_id="professional", title="Current service title",
            description="Migration fixture", price_minor=9500, currency="AUD",
            modalities=["in_person"], location_state=state, location_city=city, active=True,
        ))
        connection.execute(tables["availability_windows"].insert().values(
            id="window", counsellor_id="professional", starts_at=start,
            ends_at=start + timedelta(hours=3), modalities=["in_person"],
        ))
        connection.execute(tables["orders"].insert().values(
            id="order", job_seeker_id="seeker", service_id="service", window_id="window",
            starts_at=start, ends_at=start + timedelta(hours=1), amount_minor=9500,
            currency="AUD", timezone="Australia/Melbourne", modality="in_person",
            status="confirmed", payment_status="paid", created_at=start,
            service_title="Previously frozen title", pre_session_brief="Preserve preparation note",
        ))
        connection.execute(tables["bookings"].insert().values(
            id="booking", order_id="order", service_id="service", window_id="window",
            job_seeker_id="seeker", counsellor_id="professional",
            starts_at=start, ends_at=start + timedelta(hours=1),
            timezone="Australia/Melbourne", modality="in_person", status="confirmed",
            payment_status="paid", meeting_address="Preserve street address", created_at=start,
        ))


def _snapshot(database, *, omit_area=False):
    with database.connect() as connection:
        return {
            table: sorted([
                {key: value for key, value in row.items()
                 if not (omit_area and table == "orders" and key == "meeting_area")}
                for row in connection.execute(text(f'SELECT * FROM "{table}"')).mappings()
            ], key=repr)
            for table in inspect(database).get_table_names()
            if table != "alembic_version"
        }


def _revision(database):
    with database.connect() as connection:
        return connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


@pytest.mark.parametrize(("city", "state", "expected"), [
    ("Melbourne", "VIC", "Melbourne, VIC"),
    (None, None, ""),
    ("Melbourne", None, ""),
    (None, "VIC", ""),
    ("", "VIC", ""),
    ("Melbourne", "", ""),
], ids=["full", "no-area", "city-only", "state-only", "empty-city", "empty-state"])
def test_migration_0012_backfills_area_without_changing_existing_data(
    migration_database, city, state, expected,
):
    _seed_revision_0011(migration_database, city=city, state=state)
    before = _snapshot(migration_database)
    command.upgrade(alembic_config(migration_database), "0012")
    assert _revision(migration_database) == "0012"
    with migration_database.connect() as connection:
        area = connection.execute(text("SELECT meeting_area FROM orders")).scalar_one()
    assert area == expected
    assert _snapshot(migration_database, omit_area=True) == before


@pytest.mark.parametrize("saved_area", ["Original area, TAS", ""])
def test_repeated_startup_upgrade_never_rewrites_existing_area_snapshot(
    migration_database, saved_area,
):
    _seed_revision_0011(migration_database)
    upgrade_database(migration_database)
    with migration_database.begin() as connection:
        connection.execute(text("UPDATE orders SET meeting_area = :area"), {"area": saved_area})
        connection.execute(text("UPDATE services SET location_city = 'Geelong'"))
    before = _snapshot(migration_database)
    upgrade_database(migration_database)
    upgrade_database(migration_database)
    assert _snapshot(migration_database) == before


def test_meeting_area_downgrade_preserves_other_data_and_can_upgrade_again(migration_database):
    _seed_revision_0011(migration_database)
    command.upgrade(alembic_config(migration_database), "0012")
    before = _snapshot(migration_database, omit_area=True)
    command.downgrade(alembic_config(migration_database), "0011")
    assert _revision(migration_database) == "0011"
    assert "meeting_area" not in {
        column["name"] for column in inspect(migration_database).get_columns("orders")
    }
    assert _snapshot(migration_database) == before
    command.upgrade(alembic_config(migration_database), "0012")
    assert _revision(migration_database) == "0012"
    with migration_database.connect() as connection:
        assert connection.execute(text("SELECT meeting_area FROM orders")).scalar_one() == (
            "Melbourne, VIC"
        )
    assert _snapshot(migration_database, omit_area=True) == before
