"""Alembic environment, wired to the application's own settings and metadata.

The URL is taken from app.config rather than alembic.ini so that a migration can
never run against a different database than the one the app is about to serve —
which is the failure mode that makes "it worked locally" deployments dangerous.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.db import Base

# Importing the models is what populates Base.metadata for autogenerate.
from app import models  # noqa: F401  isort:skip

config = context.config
# Only the alembic CLI gets its logging configured from alembic.ini. When the
# application runs migrations itself on startup it sets this false, because that
# file is written for a short-lived command-line process: it pins the root logger
# at WARNING and replaces its handler, which for a long-lived server means every
# log.info it makes afterwards is thrown away.
if config.config_file_name is not None and config.attributes.get("configure_logging", True):
    # disable_existing_loggers defaults to True, which would switch off every logger
    # the application has already created — including the Stripe gateway's error
    # logging.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

config.set_main_option("sqlalchemy.url", get_settings().database_url.replace("%", "%%"))
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # SQLite cannot ALTER most things in place; batch mode rewrites the table.
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # The application hands its own engine over in `config.attributes` so that a
    # migration always runs against the database the caller meant, not whatever
    # DATABASE_URL happens to resolve to at that moment. Tests rely on this, and so
    # would anything that ever migrates more than one database.
    connectable = config.attributes.get("connectable")
    if connectable is None:
        connectable = engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=connection.dialect.name == "sqlite",
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
