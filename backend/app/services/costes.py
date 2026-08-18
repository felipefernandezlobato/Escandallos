from __future__ import annotations

from typing import List, Optional, Set

from sqlalchemy.orm import Session

from app.models import Ingrediente, LineaReceta, Receta
from app.services.conversiones import cantidad_en_unidades_uso, convertir


def crear_historial_precio(db: Session, ingrediente_id: int, precio_anterior: float, precio_nuevo: float):
    from app.models import HistorialPrecio
    db.add(HistorialPrecio(
        ingrediente_id=ingrediente_id,
        precio_anterior=precio_anterior,
        precio_nuevo=precio_nuevo,
    ))


def coste_por_unidad_uso(ingrediente: Ingrediente) -> float:
    cantidad_uso = cantidad_en_unidades_uso(
        ingrediente.cantidad_compra,
        ingrediente.unidad_compra,
        ingrediente.unidad_uso,
    )
    if cantidad_uso <= 0:
        return 0.0
    factor_merma = 1 - (ingrediente.merma_porcentaje / 100)
    if factor_merma <= 0:
        raise ValueError(f"Merma no puede ser 100% o más para '{ingrediente.nombre}'")
    return (ingrediente.precio_compra / cantidad_uso) / factor_merma


def coste_linea(
    linea: LineaReceta,
    db: Session,
    visited: Optional[Set[int]] = None,
    ubicacion: str = "bru1",
) -> float:
    if visited is None:
        visited = set()

    cantidad_linea = linea.cantidad
    if ubicacion == "bru2" and linea.cantidad_bru2 is not None:
        cantidad_linea = linea.cantidad_bru2

    if linea.ingrediente_id is not None:
        ingrediente = linea.ingrediente_rel
        cpu = coste_por_unidad_uso(ingrediente)
        cantidad_convertida = convertir(cantidad_linea, linea.unidad, ingrediente.unidad_uso)
        return cpu * cantidad_convertida

    if linea.subreceta_id is not None:
        sub = linea.subreceta_rel
        if sub.id in visited:
            return 0.0
        porciones = sub.porciones_por_lote if sub.porciones_por_lote > 0 else 1
        coste_por_porcion = coste_total_receta(sub, db, visited, ubicacion) / porciones
        # Convert quantity to the sub-recipe's yield unit so that
        # e.g. 70 g of a sub-recipe yielding 8.947 kg becomes 0.070 kg.
        cantidad = cantidad_linea
        if sub.unidad_rendimiento and linea.unidad != sub.unidad_rendimiento:
            try:
                cantidad = convertir(
                    cantidad_linea, linea.unidad, sub.unidad_rendimiento
                )
            except ValueError:
                pass  # incompatible units — fall back to raw quantity
        return coste_por_porcion * cantidad

    return 0.0


def coste_total_receta(
    receta: Receta,
    db: Session,
    visited: Optional[Set[int]] = None,
    ubicacion: str = "bru1",
) -> float:
    if visited is None:
        visited = set()
    visited = visited | {receta.id}
    total = 0.0
    for linea in receta.lineas:
        total += coste_linea(linea, db, visited, ubicacion)
    return total


def coste_por_racion(receta: Receta, db: Session, ubicacion: str = "bru1") -> float:
    total = coste_total_receta(receta, db, ubicacion=ubicacion)
    if receta.porciones_por_lote <= 0:
        return total
    return total / receta.porciones_por_lote


def margen_real(receta: Receta, db: Session) -> "float | None":
    if not receta.precio_venta or receta.precio_venta <= 0:
        return None
    coste = coste_por_racion(receta, db)
    return ((receta.precio_venta - coste) / receta.precio_venta) * 100


def recetas_afectadas_por_ingrediente(
    ingrediente_id: int, db: Session
) -> list[Receta]:
    lineas = (
        db.query(LineaReceta)
        .filter(LineaReceta.ingrediente_id == ingrediente_id)
        .all()
    )
    receta_ids = {l.receta_id for l in lineas}

    subreceta_ids = {l.receta_id for l in lineas}
    while True:
        lineas_padres = (
            db.query(LineaReceta)
            .filter(LineaReceta.subreceta_id.in_(subreceta_ids))
            .all()
        )
        nuevas_ids = {l.receta_id for l in lineas_padres} - receta_ids
        if not nuevas_ids:
            break
        receta_ids |= nuevas_ids
        subreceta_ids = nuevas_ids

    return db.query(Receta).filter(Receta.id.in_(receta_ids)).all()
