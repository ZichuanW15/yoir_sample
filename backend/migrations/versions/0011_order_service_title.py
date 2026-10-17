"""US-36 — freeze the service title onto each order, as its amounts already are.

Existing orders are backfilled from their service's current title. That is the best
available record: a rename made before this revision cannot be recovered.

Revision ID: 0011
Revises: 0010
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.add_column(sa.Column("service_title", sa.String(), nullable=True))
    op.execute(
        "UPDATE orders SET service_title = "
        "(SELECT services.title FROM services WHERE services.id = orders.service_id) "
        "WHERE service_title IS NULL"
    )


def downgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.drop_column("service_title")
