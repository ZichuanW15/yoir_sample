"""Rebuild a *deployment* database to the current schema, with no data but the owner.

    DATABASE_URL=postgresql://... \
    YOIR_CONFIRM_DESTROY_HOST=<the database host> \
    python reset_deployment_db.py

This is a one-time tool for standing an environment up, not part of any deploy.
Running it destroys every table and every row in the target database, which is not
recoverable. It is deliberately separate from `reset_db.py`: that one rebuilds a
developer's own database and loads demo data, while this one leaves an environment
holding nothing but the administrator account.

The guard is the host name, typed out. A wrong DATABASE_URL is the realistic way to
destroy the wrong database, and a yes/no prompt does nothing to catch it — naming
the host means the person has to have looked at which database they are pointed at.

Afterwards the database is at the newest migration with an empty `alembic_version`
history behind it, so the next deployment upgrades rather than rebuilds, and every
deployment after this one preserves its data.
"""

import os
import sys

from sqlalchemy import MetaData, create_engine, inspect, text


def main() -> int:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("DATABASE_URL is not set.", file=sys.stderr)
        return 2

    engine = create_engine(url, pool_pre_ping=True)
    database = engine.url.database or ""
    # A server-backed database is identified by its host. A file-backed one has no
    # host, and confirming an empty string is something a typo can do by accident,
    # so those confirm their path instead.
    target = engine.url.host or database
    if not target:
        print("Cannot identify the target database from DATABASE_URL.", file=sys.stderr)
        return 2

    print(f"Target: {database} on {engine.url.host or '(local file)'}")
    inspector = inspect(engine)
    tables = sorted(inspector.get_table_names())
    if tables:
        with engine.connect() as connection:
            for table in tables:
                count = connection.execute(text(f'SELECT count(*) FROM "{table}"')).scalar()
                print(f"  {table:32s} {count:>8} rows  — will be destroyed")
    else:
        print("  (no tables; nothing to destroy)")

    confirmation = os.environ.get("YOIR_CONFIRM_DESTROY_HOST", "")
    if confirmation != target:
        print(
            f"\nRefusing to continue. Set YOIR_CONFIRM_DESTROY_HOST to exactly:\n"
            f"  {target}\n"
            f"(got {confirmation!r})",
            file=sys.stderr,
        )
        return 1

    # Reflect and drop, rather than dropping what the models declare: tables a past
    # schema left behind have to go too, or the next startup finds a database with
    # tables and no migration history and refuses to guess what it is looking at.
    reflected = MetaData()
    reflected.reflect(bind=engine)
    reflected.drop_all(bind=engine)
    print(f"\nDropped {len(reflected.tables)} tables.")

    # Imported only now: importing the app builds its own engine from DATABASE_URL,
    # and nothing should touch the product engine before the target is confirmed.
    from app.db import SessionLocal
    from app.db import engine as product_engine
    from app.migrations import upgrade_database
    from app.seed import ensure_platform_owner

    upgrade_database(product_engine)
    print("Schema rebuilt from migrations.")

    with SessionLocal() as db:
        ensure_platform_owner(db)

    from sqlalchemy import func, select

    from app.models import Booking, Service, User

    with SessionLocal() as db:
        for label, model in (("users", User), ("services", Service), ("bookings", Booking)):
            print(f"  {label:10s} {db.scalar(select(func.count()).select_from(model))}")
        for owner in db.scalars(select(User).where(User.role == "platform_owner")):
            print(f"  administrator: {owner.email}")
    engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
