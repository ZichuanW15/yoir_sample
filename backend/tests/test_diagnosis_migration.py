"""Carry both pre-merge schemas forward without losing users or booking details."""

import warnings
from datetime import UTC, datetime, timedelta

import pytest
from alembic import command
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import MetaData, create_engine, inspect, select
from sqlalchemy.exc import IntegrityError

from app.migrations import alembic_config, upgrade_database
from app.models import Diagnosis

EXISTING_TABLES = ("users", "services", "availability_windows", "orders", "bookings")
#: The newest revision, which an upgrade runs to. The diagnosis revision, 0009, sits
#: below it: US-53's reviews table (0010) was added after it.
HEAD = "0010"
BRIEF = "Please review my existing resume before the session."
ADDRESS = "Room 2, 123 Example Street, Melbourne VIC"


def _revision(engine):
    with engine.connect() as connection:
        return MigrationContext.configure(connection).get_current_revision()


def _snapshot(engine):
    """Reflect each actual schema: latest ORM defaults cannot leak into old tables."""
    metadata = MetaData()
    names = list(EXISTING_TABLES)
    if "diagnoses" in inspect(engine).get_table_names():
        names.append("diagnoses")
    metadata.reflect(bind=engine, only=names)
    with engine.connect() as connection:
        return {
            name: [dict(row) for row in connection.execute(
                select(metadata.tables[name]).order_by(metadata.tables[name].c.id),
            ).mappings()]
            for name in names
        }


@pytest.fixture(params=["0005", "0008"])
def diagnosis_database(tmp_path, request):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'diagnosis-upgrade.sqlite3'}")
    try:
        command.upgrade(alembic_config(engine), request.param)
        metadata = MetaData()
        metadata.reflect(bind=engine, only=EXISTING_TABLES)
        tables = metadata.tables
        start = datetime(2026, 10, 10, 9, tzinfo=UTC)
        end = start + timedelta(hours=1)
        with engine.begin() as connection:
            for user_id, role in (
                ("existing-seeker", "job_seeker"), ("existing-professional", "counsellor"),
            ):
                values = dict(
                    id=user_id, name=user_id, email=f"{user_id}@example.com",
                    password_hash="unchanged-private-hash", role=role, created_at=start,
                    headline="Existing headline", career_goals="An existing career goal",
                    qualifications=["Existing qualification"], expertise=["Resume"],
                    languages=["English"],
                )
                if request.param == "0008":
                    values["profile_visibility"] = "restricted"
                connection.execute(tables["users"].insert().values(**values))
            connection.execute(tables["services"].insert().values(
                id="existing-service", counsellor_id="existing-professional",
                title="Resume review", description="An existing service", price_minor=9500,
                currency="AUD", modalities=["in_person"], active=True,
            ))
            connection.execute(tables["availability_windows"].insert().values(
                id="existing-window", counsellor_id="existing-professional",
                starts_at=start, ends_at=end, modalities=["in_person"],
            ))
            shared = dict(
                service_id="existing-service", window_id="existing-window",
                job_seeker_id="existing-seeker", starts_at=start, ends_at=end,
                timezone="Australia/Melbourne", modality="in_person", status="confirmed",
                payment_status="paid", created_at=start,
            )
            order = dict(
                id="existing-order", **shared, amount_minor=9500, currency="AUD",
                platform_fee_minor=950, counsellor_payout_minor=8550,
                payment_intent_id="pi_existing",
            )
            booking = dict(
                id="existing-booking", **shared, order_id="existing-order",
                counsellor_id="existing-professional",
            )
            if request.param == "0008":
                order["pre_session_brief"] = BRIEF
                booking["meeting_address"] = ADDRESS
            connection.execute(tables["orders"].insert().values(**order))
            connection.execute(tables["bookings"].insert().values(**booking))
        yield engine, request.param
    finally:
        engine.dispose()


def _insert_diagnosis(engine):
    with engine.begin() as connection:
        connection.execute(Diagnosis.__table__.insert().values(
            id="first", job_seeker_id="existing-seeker", questionnaire_version="yoir-six-step-v1",
            answers={"now": "job", "goal": "resume", "tried": [], "other": {}}, revision=3,
        ))


def test_diagnosis_migrations_have_one_unambiguous_head_after_dev():
    # A duplicate revision ID can corrupt the graph without being a normal fork.
    # Alembic warns for it; do not let a seemingly correct head hide that warning.
    with warnings.catch_warnings():
        warnings.filterwarnings("error", message=r"Revision .* is present more than once")
        script = ScriptDirectory.from_config(alembic_config())
        revisions = list(script.walk_revisions())
        assert script.get_heads() == [HEAD]
        assert script.get_revision("0009").down_revision == "0008"
        assert len(revisions) == len({revision.revision for revision in revisions})
        for current, previous in (
            ("0006", "0005"), ("0007", "0006"), ("0008", "0007"), ("0010", "0009"),
        ):
            assert script.get_revision(current).down_revision == previous


def test_diagnosis_upgrade_preserves_existing_data_and_creates_owned_unique_table(
    diagnosis_database,
):
    engine, starting_revision = diagnosis_database
    before = _snapshot(engine)
    assert "diagnoses" not in inspect(engine).get_table_names()

    upgrade_database(engine)
    assert _revision(engine) == HEAD

    after = _snapshot(engine)
    for name, rows in before.items():
        assert len(after[name]) == len(rows)
        for old, new in zip(rows, after[name], strict=True):
            assert {key: new[key] for key in old} == old
    assert {row["profile_visibility"] for row in after["users"]} == {
        "public" if starting_revision == "0005" else "restricted",
    }
    assert after["orders"][0]["pre_session_brief"] == (
        None if starting_revision == "0005" else BRIEF
    )
    assert after["bookings"][0]["meeting_address"] == (
        None if starting_revision == "0005" else ADDRESS
    )
    assert after["diagnoses"] == []
    inspector = inspect(engine)
    assert {column["name"] for column in inspector.get_columns("diagnoses")} == {
        column.name for column in Diagnosis.__table__.columns
    }
    assert any(
        foreign["constrained_columns"] == ["job_seeker_id"]
        and foreign["referred_table"] == "users"
        and foreign["referred_columns"] == ["id"]
        for foreign in inspector.get_foreign_keys("diagnoses")
    )

    _insert_diagnosis(engine)
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(Diagnosis.__table__.insert().values(
            id="second", job_seeker_id="existing-seeker", questionnaire_version="yoir-six-step-v1",
            answers={"other": {}}, revision=0,
        ))
    saved = _snapshot(engine)
    upgrade_database(engine)
    upgrade_database(engine)
    assert _revision(engine) == HEAD
    assert _snapshot(engine) == saved


def test_diagnosis_downgrade_preserves_dev_fields_and_all_other_rows(diagnosis_database):
    engine, _ = diagnosis_database
    upgrade_database(engine)
    _insert_diagnosis(engine)
    before = _snapshot(engine)

    command.downgrade(alembic_config(engine), "0008")

    assert _revision(engine) == "0008"
    assert "diagnoses" not in inspect(engine).get_table_names()
    assert _snapshot(engine) == {name: rows for name, rows in before.items() if name != "diagnoses"}
    for table, column in (
        ("users", "profile_visibility"), ("orders", "pre_session_brief"),
        ("bookings", "meeting_address"),
    ):
        assert column in {item["name"] for item in inspect(engine).get_columns(table)}

    upgrade_database(engine)
    assert _revision(engine) == HEAD
    # Downgrade intentionally drops diagnosis data, but no other member data.
    assert _snapshot(engine) == {**before, "diagnoses": []}
