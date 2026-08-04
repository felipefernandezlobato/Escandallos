import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Ingrediente, Categoria
from app.services.consumo import consumo_medio_semanal, consumo_semanal, stock_actual, tendencia_consumo

router = APIRouter(prefix="/api/cafe", tags=["cafe"])

# Parent/aggregator name prefixes to exclude
_PARENT_PREFIXES = (
    "Café en grano",
    "Coffee Retail",
    "Retail ",
    "Tubos Frozen",
    "Cápsulas Dabov",
)

# Color mapping by grupo_ingrediente_id
_COLOR_BY_GROUP: dict[int, str] = {
    73: "MARRÓN",
    326: "MARRÓN",
    277: "ROJO",
    325: "ROJO",
    327: "BLACK",
    328: "GOLD",
}

# Sort order for colors
_COLOR_ORDER: dict[str, int] = {
    "MARRÓN": 0,
    "ROJO": 1,
    "GOLD": 2,
    "BLACK": 3,
}


def _detect_format(nombre: str) -> Optional[str]:
    """Detect coffee format from ingredient name. Returns None to skip."""
    n = nombre.lower()
    if "frozen" in n or "tubos frozen" in n:
        return None
    if "1kg" in n or "1 kg" in n:
        return "1kg"
    if "200g" in n or "200 g" in n:
        return "200g"
    if "130g" in n or "130 g" in n or "100g" in n or "100 g" in n:
        return "130g"
    if "cápsula" in n or "capsula" in n:
        return "Cápsulas"
    return "Otros"


def _detect_color(ing: Ingrediente) -> Optional[str]:
    """Detect coffee color/blend from group or name."""
    if ing.grupo_ingrediente_id and ing.grupo_ingrediente_id in _COLOR_BY_GROUP:
        return _COLOR_BY_GROUP[ing.grupo_ingrediente_id]
    n = ing.nombre.lower()
    if "marrón" in n or "marron" in n:
        return "MARRÓN"
    if "rojo" in n:
        return "ROJO"
    if "black" in n:
        return "BLACK"
    if "gold" in n:
        return "GOLD"
    return None


def _is_parent_name(nombre: str) -> bool:
    """Check if this is a parent/aggregator item by name prefix."""
    for prefix in _PARENT_PREFIXES:
        if nombre.startswith(prefix):
            return True
    return False


def _has_children(ing_id: int, db: Session) -> bool:
    """Check if an ingredient has child items."""
    return db.query(Ingrediente.id).filter(
        Ingrediente.grupo_ingrediente_id == ing_id
    ).first() is not None


class PvpUpdateRequest(BaseModel):
    precio_venta: float


@router.get("/catalogo")
def catalogo_cafe(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return all coffee products grouped by format for the cafe catalog."""
    # Get all categories with seccion='cafe'
    cafe_cat_ids = [
        c.id for c in db.query(Categoria.id).filter(Categoria.seccion == "cafe").all()
    ]
    if not cafe_cat_ids:
        return {"resumen": {"total_skus": 0, "skus_activos": 0, "valor_stock": 0, "margen_medio": 0, "sin_pvp": 0}, "secciones": []}

    # Query all ingredientes in cafe categories
    all_cafe = (
        db.query(Ingrediente)
        .filter(Ingrediente.categoria_id.in_(cafe_cat_ids))
        .all()
    )

    # Filter: keep leaf items, exclude parents/aggregators
    items = []
    for ing in all_cafe:
        # Skip parent/aggregator names
        if _is_parent_name(ing.nombre):
            continue
        # Skip items that have children (they are virtual totals)
        if _has_children(ing.id, db):
            continue
        items.append(ing)

    # Build catalog items grouped by format
    format_sections: dict[str, list[dict]] = {}
    total_skus = 0
    skus_activos = 0
    valor_stock = 0.0
    margins = []
    sin_pvp = 0

    for ing in items:
        fmt = _detect_format(ing.nombre)
        if fmt is None:
            continue  # Skip frozen items

        total_skus += 1
        if ing.activo:
            skus_activos += 1

        # Stock
        stk = stock_actual(ing.id, db)
        stock_qty = stk["cantidad"] if stk else 0.0
        stock_unit = stk["unidad"] if stk else ing.unidad_compra

        # Consumo
        historial = consumo_semanal(ing.id, db, semanas=8)
        consumo_medio = consumo_medio_semanal(ing.id, db, semanas=8)
        tendencia = tendencia_consumo(historial)

        # Valor stock
        if ing.activo and stock_qty > 0:
            valor_stock += stock_qty * ing.precio_compra

        # Margin
        pvp = ing.precio_venta
        coste = ing.precio_compra
        margen = None
        if pvp and pvp > 0:
            margen = round((pvp - coste) / pvp * 100, 1)
            margins.append(margen)
        elif ing.activo:
            sin_pvp += 1

        color = _detect_color(ing)

        item_data = {
            "id": ing.id,
            "nombre": ing.nombre,
            "proveedor": ing.proveedor or "",
            "color": color,
            "coste": round(coste, 2),
            "precio_eur": ing.precio_eur,
            "pvp": pvp,
            "margen": margen,
            "stock": round(stock_qty, 2),
            "unidad": stock_unit,
            "consumo_semanal": consumo_medio,
            "tendencia": tendencia,
            "activo": ing.activo,
        }

        if fmt not in format_sections:
            format_sections[fmt] = []
        format_sections[fmt].append(item_data)

    # Sort items within each section: by color order, then alphabetically
    for fmt in format_sections:
        format_sections[fmt].sort(
            key=lambda x: (_COLOR_ORDER.get(x["color"] or "", 99), x["nombre"])
        )

    # Build ordered sections list
    section_order = ["1kg", "200g", "130g", "Cápsulas", "Otros"]
    secciones = []
    for fmt in section_order:
        if fmt in format_sections:
            secciones.append({
                "nombre": fmt,
                "items": format_sections[fmt],
            })

    # Summary
    margen_medio = round(sum(margins) / len(margins), 1) if margins else 0.0

    return {
        "resumen": {
            "total_skus": total_skus,
            "skus_activos": skus_activos,
            "valor_stock": round(valor_stock, 2),
            "margen_medio": margen_medio,
            "sin_pvp": sin_pvp,
        },
        "secciones": secciones,
    }


@router.put("/catalogo/{ingrediente_id}/pvp")
def update_pvp(
    ingrediente_id: int,
    body: PvpUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update the sale price (PVP) for a coffee ingredient."""
    ing = db.query(Ingrediente).get(ingrediente_id)
    if not ing:
        raise HTTPException(404, "Ingrediente no encontrado")

    ing.precio_venta = body.precio_venta
    db.commit()
    db.refresh(ing)

    # Return updated item info
    stk = stock_actual(ing.id, db)
    stock_qty = stk["cantidad"] if stk else 0.0
    stock_unit = stk["unidad"] if stk else ing.unidad_compra

    pvp = ing.precio_venta
    coste = ing.precio_compra
    margen = None
    if pvp and pvp > 0:
        margen = round((pvp - coste) / pvp * 100, 1)

    return {
        "id": ing.id,
        "nombre": ing.nombre,
        "proveedor": ing.proveedor or "",
        "color": _detect_color(ing),
        "coste": round(coste, 2),
        "precio_eur": ing.precio_eur,
        "pvp": pvp,
        "margen": margen,
        "stock": round(stock_qty, 2),
        "unidad": stock_unit,
        "activo": ing.activo,
    }
