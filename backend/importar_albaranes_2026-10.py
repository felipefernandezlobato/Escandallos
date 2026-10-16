# -*- coding: utf-8 -*-
"""Importa los 11 albaranes de Pfaff (sept-oct 2026) y Caporaso (15.10.2026).

Deja en la app las dos cosas que pidio el usuario:
  - TODAS las observaciones con su fecha en precios_proveedor
  - la mas reciente como ingredientes.precio_compra, y cada salto en historial_precios

Precios: Pfaff y Caporaso facturan EXKL MWST, asi que se guarda el precio CON IVA
(2.6%, y 8.1% para el prosecco) porque la app trabaja inkl MWST.

NO se aplica la regla del proveedor mas barato en este lote: los precios de Prodega
que ganarian la comparacion son casi todos del 2026-07-12 (carga inicial), y meterlos
por delante de entregas reales de septiembre/octubre falsearia los escandallos.

NO se toca unidad_compra ni unidad_uso.

Uso:  python importar_albaranes_2026-10.py             (dry run)
      python importar_albaranes_2026-10.py --aplicar
"""
import collections
import os
import sys
from datetime import date

sys.path.insert(0, "/tmp/fact")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_HxCRZJiBM3K0@ep-sparkling-morning-asxoz7zv.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require",
)
from albaranes import ALBARANES  # noqa: E402
from mapeo import MAPEO, NO_MAPEADOS  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import Ingrediente, PrecioProveedor, HistorialPrecio, Proveedor  # noqa: E402

APLICAR = "--aplicar" in sys.argv
db = SessionLocal()
try:
    prov_id = {p.nombre: p.id for p in db.query(Proveedor).all()}

    # ingrediente -> [(fecha, precio_inkl_por_unidad, proveedor, nº albaran)]
    obs = collections.defaultdict(list)
    for prov, num, fecha, _, lineas in ALBARANES:
        assert prov in prov_id, f"proveedor desconocido: {prov}"
        for desc, qty, uni, precio, imp in lineas:
            if desc.startswith("__PFAND__") or desc in NO_MAPEADOS:
                continue
            iid, nom, div, iva = MAPEO[desc]
            obs[iid].append((date.fromisoformat(fecha), round(precio * (1 + iva) / div, 4), prov, num))

    n_pp = n_hist = n_ing = 0
    for iid, lista in sorted(obs.items()):
        lista.sort()
        ing = db.get(Ingrediente, iid)
        assert ing is not None, f"ingrediente {iid} no existe"
        anterior = ing.precio_compra

        for fecha, precio, prov, num in lista:
            # una fila por observacion: asi quedan en la app el viejo y el nuevo
            if APLICAR:
                db.add(PrecioProveedor(
                    ingrediente_id=iid,
                    proveedor_id=prov_id[prov],
                    precio=precio,
                    cantidad=1.0,
                    unidad=ing.unidad_compra,
                    precio_por_unidad=precio,
                    fecha=fecha,
                    notas=f"Albaran {prov} {num} {fecha.strftime('%d.%m.%Y')}",
                ))
            n_pp += 1

            if anterior is None or abs(precio - anterior) > 0.005:
                if APLICAR:
                    db.add(HistorialPrecio(
                        ingrediente_id=iid,
                        precio_anterior=anterior,
                        precio_nuevo=precio,
                        fecha_cambio=fecha,
                    ))
                n_hist += 1
                anterior = precio

        ultima_fecha, ultimo_precio, ultimo_prov, _ = lista[-1]
        if ing.precio_compra is None or abs(ultimo_precio - ing.precio_compra) > 0.005 or ing.proveedor != ultimo_prov:
            if APLICAR:
                ing.precio_compra = ultimo_precio
                ing.proveedor = ultimo_prov
            n_ing += 1

    print(f"ingredientes afectados          : {len(obs)}")
    print(f"filas en precios_proveedor      : {n_pp}")
    print(f"filas en historial_precios      : {n_hist}")
    print(f"ingredientes con precio_compra nuevo: {n_ing}")
    print(f"productos del albaran NO mapeados   : {len(NO_MAPEADOS)} (no se tocan)")

    if not APLICAR:
        db.rollback()
        print("\nDRY RUN. Nada escrito. Repite con --aplicar.")
    else:
        db.commit()
        print("\nAplicado.")
finally:
    db.close()
