#!/bin/bash
# Ensure database schema is up to date before starting the app
python -c "
from sqlalchemy import create_engine, inspect, text
engine = create_engine('sqlite:///./data/escandallos.db')

with engine.connect() as conn:
    inspector = inspect(engine)

    # If no alembic_version table, stamp to the correct state
    if not inspector.has_table('alembic_version'):
        # Figure out which migration the DB is actually at
        has_inventario = inspector.has_table('inventario_registros')
        cols = [c['name'] for c in inspector.get_columns('ingredientes')] if inspector.has_table('ingredientes') else []
        has_excluir = 'excluir_pedidos' in cols

        if has_excluir:
            rev = '0ade3c6521f7'
        elif has_inventario:
            rev = '23223cfeee9c'
        else:
            rev = '5b3701069a72'

        import subprocess
        subprocess.run(['alembic', 'stamp', rev], check=True)
        print(f'Alembic stamped to {rev}')
    else:
        # Check if stamp is wrong (stamped head but column missing)
        cols = [c['name'] for c in inspector.get_columns('ingredientes')]
        if 'excluir_pedidos' not in cols:
            conn.execute(text('UPDATE alembic_version SET version_num = :v'), {'v': '23223cfeee9c'})
            conn.commit()
            print('Fixed alembic stamp: excluir_pedidos column missing, reset to 23223cfeee9c')

print('Starting alembic upgrade...')
"
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
