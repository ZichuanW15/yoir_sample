"""US-36 — freeze the in-person meeting area onto each order, as its title already is.

Existing orders are backfilled from their service's current area. That is the best
available record: a move made before this revision cannot be recovered.

Revision ID: 0012
Revises: 0011
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.add_column(sa.Column("meeting_area", sa.String(), nullable=True))
    # Same rule as Service.meeting_area(): "City, STATE" only when both are set.
    op.execute(
        "UPDATE orders SET meeting_area = COALESCE(("
        "SELECT CASE WHEN COALESCE(services.location_city, '') <> '' "
        "AND COALESCE(services.location_state, '') <> '' "
        "THEN services.location_city || ', ' || services.location_state ELSE '' END "
        "FROM services WHERE services.id = orders.service_id), '') "
        "WHERE meeting_area IS NULL"
    )


def downgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.drop_column("meeting_area")
