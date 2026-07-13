"""add_inventario_pedidos_tables

Revision ID: 23223cfeee9c
Revises: 5b3701069a72
Create Date: 2026-07-13 12:33:53.825521

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '23223cfeee9c'
down_revision: Union[str, Sequence[str], None] = '5b3701069a72'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'inventario_registros',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('ingrediente_id', sa.Integer(), sa.ForeignKey('ingredientes.id'), nullable=False),
        sa.Column('cantidad', sa.Float(), nullable=False),
        sa.Column('unidad', sa.String(20), nullable=False),
        sa.Column('fecha_registro', sa.Date(), server_default=sa.func.current_date()),
        sa.Column('notas', sa.Text(), nullable=True),
    )
    op.create_table(
        'pedidos',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('fecha', sa.Date(), server_default=sa.func.current_date()),
        sa.Column('proveedor', sa.String(200), nullable=False),
        sa.Column('estado', sa.String(20), nullable=False, server_default='borrador'),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('fecha_recepcion', sa.Date(), nullable=True),
    )
    op.create_table(
        'lineas_pedido',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('pedido_id', sa.Integer(), sa.ForeignKey('pedidos.id'), nullable=False),
        sa.Column('ingrediente_id', sa.Integer(), sa.ForeignKey('ingredientes.id'), nullable=False),
        sa.Column('cantidad_pedida', sa.Float(), nullable=False),
        sa.Column('unidad', sa.String(20), nullable=False),
        sa.Column('cantidad_recibida', sa.Float(), nullable=True),
        sa.Column('precio_unitario', sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('lineas_pedido')
    op.drop_table('pedidos')
    op.drop_table('inventario_registros')
