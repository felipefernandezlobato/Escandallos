"""add merma_registros

Revision ID: 4ceaf836438a
Revises: 8d7af49d6470
Create Date: 2026-08-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4ceaf836438a'
down_revision: Union[str, None] = '8d7af49d6470'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'merma_registros',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('ingrediente_id', sa.Integer(), sa.ForeignKey('ingredientes.id'), nullable=True),
        sa.Column('receta_id', sa.Integer(), sa.ForeignKey('recetas.id'), nullable=True),
        sa.Column('nombre_libre', sa.String(200), nullable=True),
        sa.Column('cantidad', sa.Float(), nullable=False),
        sa.Column('unidad', sa.String(20), nullable=False),
        sa.Column('motivo', sa.String(20), nullable=False),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('fecha', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')),
        sa.Column('ubicacion', sa.String(10), nullable=True),
        sa.Column('coste_unitario', sa.Float(), nullable=False, server_default=sa.text('0')),
        sa.Column('coste_total', sa.Float(), nullable=False, server_default=sa.text('0')),
    )


def downgrade() -> None:
    op.drop_table('merma_registros')
