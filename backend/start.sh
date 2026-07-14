#!/bin/bash
# Stamp alembic version if this is the first deploy (tables exist but no alembic_version)
python -c "
from sqlalchemy import create_engine, inspect
engine = create_engine('sqlite:///./data/escandallos.db')
if not inspect(engine).has_table('alembic_version'):
    import subprocess
    subprocess.run(['alembic', 'stamp', 'head'], check=True)
    print('Alembic stamped to head (first deploy)')
else:
    print('Alembic version table exists, skipping stamp')
"
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
