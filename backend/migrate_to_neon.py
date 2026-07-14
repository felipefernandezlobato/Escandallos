"""
One-time migration script: SQLite -> Neon PostgreSQL.

Usage:
    DATABASE_URL="postgresql://..." python migrate_to_neon.py
"""

import os
import sys

from sqlalchemy import create_engine, text, inspect

SQLITE_URL = "sqlite:///data/escandallos.db"
PG_URL = os.environ.get("DATABASE_URL")

if not PG_URL:
    print("Error: set DATABASE_URL env var to your Neon PostgreSQL connection string")
    sys.exit(1)

sqlite_engine = create_engine(SQLITE_URL)
pg_engine = create_engine(PG_URL)

TABLES_IN_ORDER = [
    "categorias",
    "ingredientes",
    "recetas",
    "lineas_receta",
    "historial_precios",
    "proveedores",
    "precios_proveedor",
    "inventario_registros",
    "pedidos",
    "lineas_pedido",
]

# Tables that reference ingredientes — need orphan cleanup
FK_TO_INGREDIENTES = {
    "historial_precios": "ingrediente_id",
    "lineas_receta": "ingrediente_id",
    "inventario_registros": "ingrediente_id",
    "lineas_pedido": "ingrediente_id",
    "precios_proveedor": "ingrediente_id",
}

FK_TO_RECETAS = {
    "lineas_receta": "receta_id",
}


def migrate():
    pg_inspector = inspect(pg_engine)
    existing = pg_inspector.get_table_names()
    if "categorias" not in existing:
        print("Error: target database has no tables. Run 'alembic upgrade head' first.")
        sys.exit(1)

    sqlite_tables = inspect(sqlite_engine).get_table_names()

    # Read all data from SQLite first
    all_data = {}
    with sqlite_engine.connect() as src:
        for table in TABLES_IN_ORDER:
            if table not in sqlite_tables:
                all_data[table] = ([], [])
                continue
            cols = [c["name"] for c in inspect(sqlite_engine).get_columns(table)]
            rows = src.execute(text(f"SELECT * FROM {table}")).fetchall()
            all_data[table] = (cols, [dict(zip(cols, row)) for row in rows])

    # Get valid IDs for FK cleanup
    valid_ing_ids = {r["id"] for r in all_data["ingredientes"][1]}
    valid_receta_ids = {r["id"] for r in all_data["recetas"][1]}
    valid_pedido_ids = {r["id"] for r in all_data["pedidos"][1]} if "pedidos" in all_data else set()
    valid_proveedor_ids = {r["id"] for r in all_data["proveedores"][1]} if "proveedores" in all_data else set()

    # Get PG column types for boolean conversion
    pg_col_types = {}
    for table in TABLES_IN_ORDER:
        if table in existing:
            pg_col_types[table] = {c["name"]: str(c["type"]) for c in pg_inspector.get_columns(table)}

    with pg_engine.connect() as dst:
        # Delete in reverse order to respect FK constraints
        for table in reversed(TABLES_IN_ORDER):
            if table in existing:
                dst.execute(text(f"DELETE FROM {table}"))

        for table in TABLES_IN_ORDER:
            cols, rows = all_data[table]
            if not rows:
                print(f"  {table}: 0 rows (empty or missing)")
                continue

            # Filter orphan records
            original_count = len(rows)
            if table in FK_TO_INGREDIENTES:
                fk_col = FK_TO_INGREDIENTES[table]
                rows = [r for r in rows if r.get(fk_col) in valid_ing_ids]
            if table in FK_TO_RECETAS:
                fk_col = FK_TO_RECETAS[table]
                rows = [r for r in rows if r.get(fk_col) is None or r.get(fk_col) in valid_receta_ids]
            if table == "lineas_pedido":
                rows = [r for r in rows if r.get("pedido_id") in valid_pedido_ids]
            if table == "precios_proveedor":
                rows = [r for r in rows if r.get("proveedor_id") in valid_proveedor_ids]

            skipped = original_count - len(rows)

            if not rows:
                print(f"  {table}: 0 rows (all orphaned)")
                continue

            # Fix SQLite integer booleans -> Python bool for PostgreSQL
            types = pg_col_types.get(table, {})
            for row in rows:
                for col_name, val in list(row.items()):
                    if "BOOLEAN" in types.get(col_name, "") and isinstance(val, int):
                        row[col_name] = bool(val)

            # Only insert columns that exist in PG
            pg_existing_cols = set(pg_col_types.get(table, {}).keys())
            insert_cols = [c for c in cols if c in pg_existing_cols]
            for row in rows:
                for key in list(row.keys()):
                    if key not in pg_existing_cols:
                        del row[key]

            placeholders = ", ".join([f":{c}" for c in insert_cols])
            col_names = ", ".join(insert_cols)
            insert_sql = text(f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})")

            dst.execute(insert_sql, rows)
            suffix = f" ({skipped} orphans skipped)" if skipped else ""
            print(f"  {table}: {len(rows)} rows migrated{suffix}")

        # Reset sequences
        for table in TABLES_IN_ORDER:
            if table not in existing:
                continue
            try:
                max_id = dst.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table}")).scalar()
                seq_name = f"{table}_id_seq"
                dst.execute(text(f"SELECT setval('{seq_name}', :val, true)"), {"val": max(max_id, 1)})
            except Exception:
                pass

        dst.commit()

    print("\nMigration complete!")


if __name__ == "__main__":
    print(f"Migrating from {SQLITE_URL}")
    print(f"         to   {PG_URL[:50]}...")
    print()
    migrate()
