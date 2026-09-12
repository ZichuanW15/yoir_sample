"""US-06/08: published session API and non-destructive revocation schema rollout."""

from sqlalchemy import create_engine, inspect, select

from app.db import Base
from app.main import app
from app.models import User


def test_logout_publishes_bearer_security_and_empty_success_contract() -> None:
    schema = app.openapi()
    logout = schema["paths"]["/api/v1/auth/sessions/current"]["delete"]
    assert logout["operationId"] == "logout"
    assert logout["x-requirement-ids"] == ["US-08"]
    assert logout["security"] == [{"bearerAuth": []}]
    assert schema["components"]["securitySchemes"]["bearerAuth"]["scheme"] == "bearer"
    assert "content" not in logout["responses"]["204"]
    assert "401" in logout["responses"]


def test_startup_adds_revocation_table_without_resetting_existing_accounts() -> None:
    # A separate in-memory database models a deployment with the old users table.
    legacy = create_engine("sqlite+pysqlite:///:memory:")
    try:
        User.__table__.create(legacy)
        with legacy.begin() as connection:
            connection.execute(User.__table__.insert().values(
                id="existing-account", name="Existing", email="existing@example.com",
                password_hash="existing-stored-value", role="job_seeker",
            ))
        Base.metadata.create_all(legacy)
        Base.metadata.create_all(legacy)  # Startup can run again without a reset.
        assert "revoked_tokens" in inspect(legacy).get_table_names()
        with legacy.connect() as connection:
            rows = connection.execute(select(User.__table__)).mappings().all()
        assert len(rows) == 1
        assert rows[0]["id"] == "existing-account"
        assert rows[0]["password_hash"] == "existing-stored-value"
    finally:
        legacy.dispose()
