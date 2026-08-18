"""add cantidad_bru2 to lineas_receta

Revision ID: f3a8c1d92e01
Revises: 4ceaf836438a
Create Date: 2026-08-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a8c1d92e01'
down_revision: Union[str, Sequence[str], None] = '4ceaf836438a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('lineas_receta', sa.Column('cantidad_bru2', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('lineas_receta', 'cantidad_bru2')
