"""Split pre-2026-10-14 cafe delivery rows into their two shops.

A receipt used to write ONE row holding BRU1 + BRU2 + what arrived, tagged with
a single shop, so the pivot could not show a (BRU1+BRU2) breakdown for that
week. Where the arithmetic reconciles exactly, the row is replaced by the two
rows the new recibir_pedido() would have written.

Totals are never changed: BRU1_nuevo + BRU2 == the figure already stored. Any
row that does not reconcile to the cent is skipped.

Usage:  python backfill_desglose.py            (dry run)
        python backfill_desglose.py --aplicar   (writes)
"""
import collections
import os
import re
import sys

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_HxCRZJiBM3K0@ep-sparkling-morning-asxoz7zv.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require",
)
from sqlalchemy import create_engine, text  # noqa: E402
from app.services.consumo import _es_fila_de_pedido  # noqa: E402

APLICAR = "--aplicar" in sys.argv
e = create_engine(os.environ["DATABASE_URL"])


class _Fila:
    def __init__(self, notas):
        self.notas = notas


with e.connect() as c:
    filas = list(c.execute(text("""
        SELECT r.id, r.ingrediente_id, i.nombre, r.cantidad, r.unidad, r.ubicacion,
               r.fecha_registro, r.notas
        FROM inventario_registros r
        JOIN ingredientes i ON i.id = r.ingrediente_id
        JOIN categorias cat ON cat.id = i.categoria_id
        WHERE cat.seccion = 'cafe'
          AND r.notas ~ '^Pedido( #[0-9]+)? recibido$'
          AND r.ubicacion IS NOT NULL
          AND COALESCE(i.grupo_ingrediente_id, 0) NOT IN (289, 290)
        ORDER BY r.fecha_registro, r.id""")))

    todos = collections.defaultdict(list)
    for r in c.execute(text("""SELECT id, ingrediente_id, cantidad, ubicacion, notas, fecha_registro
                               FROM inventario_registros ORDER BY fecha_registro, id""")):
        todos[r.ingrediente_id].append(r)

    recibido = {}
    for r in c.execute(text("""SELECT p.id pid, l.ingrediente_id, l.cantidad_recibida
                               FROM lineas_pedido l JOIN pedidos p ON p.id = l.pedido_id
                               WHERE l.cantidad_recibida IS NOT NULL""")):
        recibido[(r.pid, r.ingrediente_id)] = r.cantidad_recibida

plan, saltadas = [], []
for f in filas:
    motivo = None
    m = re.match(r"^Pedido #(\d+) recibido$", f.notas.strip())
    if not m:
        motivo = "nota sin numero de pedido"
    else:
        pid = int(m.group(1))
        mismo_dia = [x for x in todos[f.ingrediente_id] if x.fecha_registro == f.fecha_registro]
        entregas_dia = [x for x in mismo_dia if _es_fila_de_pedido(_Fila(x.notas))]
        if len({x.ubicacion for x in mismo_dia if x.ubicacion}) > 1:
            motivo = "el dia ya tiene las dos tiendas"
        elif len(entregas_dia) > 1:
            motivo = "varias entregas el mismo dia"
        else:
            rec = recibido.get((pid, f.ingrediente_id))
            previos = [x for x in todos[f.ingrediente_id]
                       if x.fecha_registro < f.fecha_registro and x.ubicacion
                       and not _es_fila_de_pedido(_Fila(x.notas))]
            if rec is None:
                motivo = "sin cantidad_recibida"
            elif not previos:
                motivo = "sin conteos por tienda previos"
            else:
                ultima = max(x.fecha_registro for x in previos)
                por_ubi = {}
                for x in [y for y in previos if y.fecha_registro == ultima]:
                    por_ubi[x.ubicacion] = x.cantidad  # mayor id gana
                b1 = por_ubi.get("BRU1", 0.0)
                b2 = por_ubi.get("BRU2", 0.0)
                if abs(b1 + b2 + rec - f.cantidad) > 1e-9:
                    motivo = f"no cuadra ({b1}+{b2}+{rec} != {f.cantidad})"
                else:
                    plan.append({
                        "fila_id": f.id, "ing": f.ingrediente_id, "nombre": f.nombre,
                        "fecha": f.fecha_registro, "notas": f.notas, "unidad": f.unidad,
                        "antes": f.cantidad, "ubic_antes": f.ubicacion,
                        "bru1": b1 + rec, "bru2": b2,
                        "hay_bru2": "BRU2" in por_ubi,
                    })
    if motivo:
        saltadas.append((f.nombre, f.fecha_registro, f.cantidad, motivo))

print(f"{'articulo':<32}{'fecha':<12}{'antes':>7}  ->  desglose")
print("-" * 82)
for p in plan:
    extra = "" if p["hay_bru2"] else "   (sin fila BRU2: nunca se conto alli)"
    print(f"{p['nombre']:<32}{str(p['fecha']):<12}{p['antes']:>7}  ->  "
          f"BRU1={p['bru1']} BRU2={p['bru2']}{extra}")
    assert abs(p["bru1"] + p["bru2"] - p["antes"]) < 1e-9, "el total cambiaria"

print()
print(f"a modificar: {len(plan)} filas")
print(f"saltadas   : {len(saltadas)}")
for s in saltadas:
    print(f"   - {s[0]} {s[1]} ({s[2]}): {s[3]}")

if not APLICAR:
    print("\nDRY RUN. Nada escrito. Repite con --aplicar para guardar.")
    sys.exit(0)

from app.models import InventarioRegistro  # noqa: E402
from app.database import SessionLocal  # noqa: E402

db = SessionLocal()
try:
    for p in plan:
        fila = db.get(InventarioRegistro, p["fila_id"])
        assert fila is not None and abs(fila.cantidad - p["antes"]) < 1e-9, "la fila cambio"
        fila.cantidad = p["bru1"]
        fila.ubicacion = "BRU1"
        if p["hay_bru2"]:
            db.add(InventarioRegistro(
                ingrediente_id=p["ing"], cantidad=p["bru2"], unidad=p["unidad"],
                fecha_registro=p["fecha"], notas=p["notas"], ubicacion="BRU2",
            ))
    db.commit()
    print(f"\nAplicado: {len(plan)} filas repartidas.")
finally:
    db.close()
