"""add precio_venta to ingredientes

Revision ID: 8d7af49d6470
Revises: d168f9d38ad7
Create Date: 2026-08-04 17:42:36.727839

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d7af49d6470'
down_revision: Union[str, Sequence[str], None] = 'd168f9d38ad7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # precio_eur and precio_venta already exist in the DB.
    # This migration aligns the model with the existing schema.
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
