#!/bin/bash
# Ensure database schema is up to date before starting the app
python -c "
from sqlalchemy import create_engine, inspect, text
engine = create_engine('sqlite:///./data/escandallos.db')

with engine.connect() as conn:
    inspector = inspect(engine)

    # Detect actual DB state based on which tables/columns exist
    has_categorias = inspector.has_table('categorias')
    has_inventario = inspector.has_table('inventario_registros')
    cols = [c['name'] for c in inspector.get_columns('ingredientes')] if inspector.has_table('ingredientes') else []
    has_excluir = 'excluir_pedidos' in cols

    print(f'DB state: categorias={has_categorias}, inventario={has_inventario}, excluir_pedidos={has_excluir}')

    if has_excluir:
        target = '0ade3c6521f7'
    elif has_inventario:
        target = '23223cfeee9c'
    elif has_categorias:
        target = '5b3701069a72'
    else:
        target = None

    if target:
        # Force stamp to detected state (whether or not alembic_version exists)
        if inspector.has_table('alembic_version'):
            conn.execute(text('DELETE FROM alembic_version'))
            conn.commit()
        import subprocess
        subprocess.run(['alembic', 'stamp', target], check=True)
        print(f'Stamped to {target}')
    else:
        print('Empty database, alembic will create everything')

print('Running alembic upgrade head...')
"
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
