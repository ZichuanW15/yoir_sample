"""Bring the database to the current schema on startup.

`create_all()` only ever created missing *tables*. It silently ignored new columns
on tables that already existed, which is why a deployment could start cleanly and
then fail on the first request that touched a column the code expected and the
database had never heard of. Migrations replace it.

A database arrives in one of three states, and the difference matters enough to
check rather than guess:

  * versioned      — it has an `alembic_version` row; upgrade from wherever it is.
  * empty          — no tables at all; run every migration from the beginning.
  * pre-Alembic    — it has the schema that existed before migrations were adopted.
                     Stamp it at that baseline, then upgrade. This is a one-time
                     adoption, and it is recognised by a signature rather than
                     assumed, so an unfamiliar schema stops the app instead of
                     being mangled by a migration written for a different one.
"""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import Engine, inspect

log = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parent.parent
BASELINE_REVISION = "0001"

#: Tables and columns that together identify the pre-Alembic schema, and nothing
#: else. `availability_slots` was removed in 0002 and `orders.slot_id` with it, so a
#: database showing both is unambiguously sitting at the baseline.
BASELINE_SIGNATURE_TABLE = "availability_slots"
BASELINE_SIGNATURE_COLUMN = ("orders", "slot_id")


def alembic_config(engine: Engine | None = None) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    # Migrations run inside the application process on startup, and alembic.ini
    # configures logging for the *alembic CLI*: root at WARNING, with its own
    # handler and formatter. Applying that here reconfigures the running server's
    # logging for the rest of its life, silencing every log.info the application
    # makes — which is how "the confirmation email was sent" became invisible.
    config.attributes["configure_logging"] = False
    if engine is not None:
        # env.py migrates this engine rather than re-reading DATABASE_URL, so the
        # database inspected below and the one migrated are always the same one.
        config.attributes["connectable"] = engine
    return config


def _current_revision(engine: Engine) -> str | None:
    with engine.connect() as connection:
        return MigrationContext.configure(connection).get_current_revision()


def _looks_like_baseline(engine: Engine) -> bool:
    inspector = inspect(engine)
    if BASELINE_SIGNATURE_TABLE not in inspector.get_table_names():
        return False
    table, column = BASELINE_SIGNATURE_COLUMN
    if table not in inspector.get_table_names():
        return False
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade_database(engine: Engine) -> None:
    """Run every outstanding migration. Safe to call on every start."""
    config = alembic_config(engine)

    if _current_revision(engine) is not None:
        command.upgrade(config, "head")
        return

    if not inspect(engine).get_table_names():
        log.info("Empty database: creating the schema from migrations.")
        command.upgrade(config, "head")
        return

    if _looks_like_baseline(engine):
        # Adopting migrations on a database that predates them. Stamping records
        # where it already is; it does not run 0001 against existing tables.
        log.warning(
            "Database has no migration history but matches the pre-Alembic schema. "
            "Stamping it at %s and upgrading.", BASELINE_REVISION,
        )
        command.stamp(config, BASELINE_REVISION)
        command.upgrade(config, "head")
        return

    raise RuntimeError(
        "This database has tables but no migration history, and its schema is not the "
        "one migrations were adopted from. Refusing to guess which migrations it "
        "needs. Inspect it and `alembic stamp` the revision it actually matches."
    )
