# -*- coding: utf-8 -*-
"""Precios de hoy del webshop de Transgourmet/Prodega (articulos ya comprados).

El webshop muestra el precio de lista EXKL MWST y sin el descuento online. Lo que
se paga de verdad es  precio_web x 0.99 (Rabatt 1%) x 1.026 (MWST 2.6%). Calibrado
contra el pedido 13469935: Erdbeeren 6.13->6.07, Ahornsirup 22.54->22.31,
Chia 7.80->7.72, Joghurt 4.65->4.60, Halbhartkaese 12.21->12.09.

Los articulos "in Aktion" quedan fuera: son promo temporal, no precio de referencia.

precio_compra solo se mueve cuando Prodega es el mas barato comparando datos
FRESCOS (desde 2026-09-01) o cuando Prodega ya era el proveedor del ingrediente.
Las filas de julio 2026 de la carga inicial no cuentan como competencia.

Uso:  python importar_webshop_prodega_2026-10-16.py            (dry run)
      python importar_webshop_prodega_2026-10-16.py --aplicar
"""
import json
import os
import sys
from datetime import date

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_HxCRZJiBM3K0@ep-sparkling-morning-asxoz7zv.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require",
)
from app.database import SessionLocal  # noqa: E402
from app.models import Ingrediente, PrecioProveedor, HistorialPrecio, Proveedor  # noqa: E402

APLICAR = "--aplicar" in sys.argv
HOY = date(2026, 10, 16)
FRESCO_DESDE = date(2026, 9, 1)
datos = json.load(open("/tmp/fact/final.json"))

db = SessionLocal()
try:
    prodega = db.query(Proveedor).filter(Proveedor.nombre == "Prodega").one()
    n_pp = n_hist = 0
    cambios, solo_fila = [], []

    for nom, unidad, appu, precio_web, dif, art in datos["norm"]:
        ing = db.query(Ingrediente).filter(Ingrediente.nombre == nom).one()

        if APLICAR:
            db.add(PrecioProveedor(
                ingrediente_id=ing.id, proveedor_id=prodega.id,
                precio=precio_web, cantidad=1.0, unidad=ing.unidad_compra,
                precio_por_unidad=precio_web, fecha=HOY,
                notas=f"Webshop Transgourmet art.{art} (lista -1% -incl MWST)",
            ))
        n_pp += 1

        # Competencia fresca: el precio ACTUAL de cada otro proveedor, no el minimo
        # historico. Con el minimo, Frambuesa comparaba contra los 20.93 de Pfaff del
        # 12.09 en vez de los 28.32 del 02.10, y Prodega parecia perder cuando gana.
        ultimo_por_prov = {}
        for p in db.query(PrecioProveedor).filter(
            PrecioProveedor.ingrediente_id == ing.id,
            PrecioProveedor.proveedor_id != prodega.id,
            PrecioProveedor.fecha >= FRESCO_DESDE,
        ).order_by(PrecioProveedor.fecha, PrecioProveedor.id).all():
            if p.precio_por_unidad and p.precio_por_unidad > 0:
                ultimo_por_prov[p.proveedor_id] = p.precio_por_unidad
        mejor_otro = min(ultimo_por_prov.values()) if ultimo_por_prov else None
        gana_prodega = mejor_otro is None or precio_web <= mejor_otro
        era_prodega = (ing.proveedor or "") == "Prodega"

        actual = round((ing.precio_compra or 0) / (ing.cantidad_compra or 1), 4)
        if (gana_prodega or era_prodega) and abs(precio_web - actual) > 0.005:
            cambios.append((nom, actual, precio_web, ing.proveedor, mejor_otro))
            if APLICAR:
                if abs((ing.precio_compra or 0) - precio_web) > 0.005:
                    db.add(HistorialPrecio(
                        ingrediente_id=ing.id, precio_anterior=ing.precio_compra,
                        precio_nuevo=precio_web * (ing.cantidad_compra or 1),
                        fecha_cambio=HOY,
                    ))
                    n_hist += 1
                ing.precio_compra = round(precio_web * (ing.cantidad_compra or 1), 4)
                ing.proveedor = "Prodega"
        else:
            solo_fila.append((nom, actual, precio_web, mejor_otro))

    print(f"filas nuevas en precios_proveedor : {n_pp}")
    print(f"precio_compra que cambia          : {len(cambios)}")
    print(f"solo se guarda la observacion     : {len(solo_fila)}")
    print(f"en Aktion, fuera                  : {len(datos['promo'])}")
    print()
    print("--- cambia precio_compra ---")
    for nom, a, b, prov, otro in sorted(cambios, key=lambda r: -abs((r[2]-r[1])/r[1])):
        o = f"otro fresco: {otro}" if otro else "sin competencia fresca"
        print(f"  {nom:<26}{a:>10} -> {b:<10} ({(b-a)/a*100:+6.1f}%)  antes: {prov or '-':<9} {o}")
    print()
    print("--- solo observacion (el otro proveedor sigue mejor o no cambia) ---")
    for nom, a, b, otro in solo_fila:
        print(f"  {nom:<26}{a:>10}  webshop {b:<10} {'otro fresco: '+str(otro) if otro else ''}")

    if not APLICAR:
        db.rollback(); print("\nDRY RUN. Nada escrito.")
    else:
        db.commit(); print(f"\nAplicado. {n_pp} filas de precio y {n_hist} de historial.")
finally:
    db.close()
