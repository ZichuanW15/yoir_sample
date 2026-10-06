"""Upgrade a real 0005 schema without rebuilding users or losing profile data."""

import pytest
from alembic import command
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.exc import IntegrityError

from app.migrations import alembic_config, upgrade_database
from app.models import Diagnosis, User


@pytest.fixture
def diagnosis_database(tmp_path):
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'diagnosis-upgrade.sqlite3'}")
    command.upgrade(alembic_config(engine), "0005")
    with engine.begin() as connection:
        connection.execute(User.__table__.insert().values(
            id="existing-seeker", name="Existing Seeker", email="existing@example.com",
            password_hash="unchanged-private-hash", role="job_seeker",
            headline="Existing headline", career_goals="An existing career goal",
        ))
    yield engine
    engine.dispose()


def test_diagnosis_upgrade_preserves_existing_user_and_creates_owned_unique_table(
    diagnosis_database,
):
    with diagnosis_database.connect() as connection:
        before = dict(connection.execute(select(User.__table__)).mappings().one())
    assert "diagnoses" not in inspect(diagnosis_database).get_table_names()

    upgrade_database(diagnosis_database)
    upgrade_database(diagnosis_database)

    inspector = inspect(diagnosis_database)
    assert {column["name"] for column in inspector.get_columns("diagnoses")} == {
        column.name for column in Diagnosis.__table__.columns
    }
    assert any(
        foreign["constrained_columns"] == ["job_seeker_id"]
        and foreign["referred_table"] == "users"
        and foreign["referred_columns"] == ["id"]
        for foreign in inspector.get_foreign_keys("diagnoses")
    )
    with diagnosis_database.connect() as connection:
        assert dict(connection.execute(select(User.__table__)).mappings().one()) == before
        assert connection.execute(select(Diagnosis.__table__)).first() is None
    with diagnosis_database.begin() as connection:
        connection.execute(Diagnosis.__table__.insert().values(
            id="first", job_seeker_id="existing-seeker", questionnaire_version="yoir-six-step-v1",
            answers={"other": {}}, revision=0,
        ))
    with pytest.raises(IntegrityError), diagnosis_database.begin() as connection:
        connection.execute(Diagnosis.__table__.insert().values(
            id="second", job_seeker_id="existing-seeker", questionnaire_version="yoir-six-step-v1",
            answers={"other": {}}, revision=0,
        ))


def test_diagnosis_migration_can_be_reversed_without_removing_existing_profiles(
    diagnosis_database,
):
    upgrade_database(diagnosis_database)
    command.downgrade(alembic_config(diagnosis_database), "0005")
    assert "diagnoses" not in inspect(diagnosis_database).get_table_names()
    with diagnosis_database.connect() as connection:
        assert connection.execute(select(User.__table__.c.headline)).scalar() == "Existing headline"
    upgrade_database(diagnosis_database)
    assert "diagnoses" in inspect(diagnosis_database).get_table_names()
