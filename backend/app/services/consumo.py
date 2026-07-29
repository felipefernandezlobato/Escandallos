import math
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.models import InventarioRegistro, LineaPedido, Pedido, Ingrediente, Proveedor


def _base_unit(unit_str: str) -> str:
    """Extract the base unit family from a unit string.
    'kg' → 'kg', 'unidad (450g)' → 'unidad', 'litro' → 'litro'
    """
    u = unit_str.strip().lower()
    if u.startswith("unidad"):
        return "unidad"
    return u


def _units_compatible(a: str, b: str) -> bool:
    ba, bb = _base_unit(a), _base_unit(b)
    if ba == bb:
        return True
    from app.services.conversiones import son_compatibles
    return son_compatibles(ba, bb)


def _convert_qty(qty: float, from_unit: str, to_unit: str) -> float:
    if from_unit == to_unit or _base_unit(from_unit) == _base_unit(to_unit) == "unidad":
        return qty
    from app.services.conversiones import convertir, son_compatibles
    bf, bt = _base_unit(from_unit), _base_unit(to_unit)
    if son_compatibles(bf, bt):
        return convertir(qty, bf, bt)
    return qty


def consumo_semanal(ingrediente_id: int, db: Session, semanas: int = 12) -> list[dict]:
    """Calculate weekly consumption based on received orders and inventory changes.

    Uses the most recent N weeks of data available, not a fixed window from today.
    """
    most_recent = (
        db.query(func.max(Pedido.fecha_recepcion))
        .filter(Pedido.estado == "recibido")
        .scalar()
    )
    if not most_recent:
        return []
    inicio = most_recent - timedelta(weeks=semanas)

    # Determine target unit from inventory records or ingredient
    ing = db.query(Ingrediente).get(ingrediente_id)
    all_inventarios = (
        db.query(InventarioRegistro)
        .filter(
            InventarioRegistro.ingrediente_id == ingrediente_id,
            InventarioRegistro.fecha_registro >= inicio,
        )
        .order_by(InventarioRegistro.fecha_registro)
        .all()
    )
    # Exclude "Pedido recibido" records — they duplicate order data and inflate consumption
    inventarios = [r for r in all_inventarios if not (r.notas and "recibido" in r.notas.lower())]
    if all_inventarios:
        target_unit = all_inventarios[-1].unidad
    else:
        target_unit = ing.unidad_compra if ing else "unidad"

    pedidos_recibidos = (
        db.query(LineaPedido.cantidad_recibida, LineaPedido.unidad, Pedido.fecha_recepcion)
        .join(Pedido)
        .filter(
            LineaPedido.ingrediente_id == ingrediente_id,
            Pedido.estado == "recibido",
            Pedido.fecha_recepcion >= inicio,
            LineaPedido.cantidad_recibida.isnot(None),
        )
        .all()
    )

    semana_data: dict[str, float] = {}

    if inventarios and len(inventarios) >= 2:
        # Use inventory-based calculation (preferred — accounts for actual stock changes)
        pass
    else:
        # Fallback: use received orders as proxy for consumption
        for qty, order_unit, fecha in pedidos_recibidos:
            if qty and fecha:
                iso = fecha.isocalendar()
                key = f"w{iso[1]}.{str(iso[0])[2:]}"
                converted = _convert_qty(qty, order_unit or target_unit, target_unit)
                semana_data[key] = semana_data.get(key, 0) + converted

    if inventarios and len(inventarios) >= 2:
        for i in range(1, len(inventarios)):
            prev = inventarios[i - 1]
            curr = inventarios[i]
            if not _units_compatible(prev.unidad, curr.unidad):
                continue
            prev_qty = _convert_qty(prev.cantidad, prev.unidad, target_unit)
            curr_qty = _convert_qty(curr.cantidad, curr.unidad, target_unit)
            days_gap = (curr.fecha_registro - prev.fecha_registro).days
            weeks_spanned = max(1, round(days_gap / 7))

            received_between = 0
            for qty_r, unit_r, fecha_r in pedidos_recibidos:
                if qty_r and fecha_r and prev.fecha_registro < fecha_r <= curr.fecha_registro:
                    received_between += _convert_qty(qty_r, unit_r or target_unit, target_unit)

            consumo = prev_qty + received_between - curr_qty
            if consumo > 0:
                weekly = round(consumo / weeks_spanned, 2)
                d = prev.fecha_registro
                for w in range(weeks_spanned):
                    week_date = d + timedelta(weeks=w + 1)
                    if week_date > curr.fecha_registro:
                        week_date = curr.fecha_registro
                    iso = week_date.isocalendar()
                    key = f"w{iso[1]}.{str(iso[0])[2:]}"
                    semana_data[key] = semana_data.get(key, 0) + weekly

    result = []
    for key in sorted(semana_data.keys()):
        result.append({"semana": key, "cantidad": round(semana_data[key], 2)})

    return result


def consumo_medio_semanal(ingrediente_id: int, db: Session, semanas: int = 8) -> float:
    historial = consumo_semanal(ingrediente_id, db, semanas)
    if not historial:
        return 0.0
    total = sum(h["cantidad"] for h in historial)
    return round(total / len(historial), 2)


def stock_actual(ingrediente_id: int, db: Session) -> Optional[dict]:
    ultimo = (
        db.query(InventarioRegistro)
        .filter(InventarioRegistro.ingrediente_id == ingrediente_id)
        .order_by(InventarioRegistro.fecha_registro.desc())
        .first()
    )
    if not ultimo:
        return None
    return {
        "cantidad": ultimo.cantidad,
        "unidad": ultimo.unidad,
        "fecha": ultimo.fecha_registro,
    }


def tendencia_consumo(historial: list[dict]) -> str:
    if len(historial) < 4:
        return "estable"
    mitad = len(historial) // 2
    primera = sum(h["cantidad"] for h in historial[:mitad]) / mitad
    segunda = sum(h["cantidad"] for h in historial[mitad:]) / (len(historial) - mitad)
    if segunda > primera * 1.15:
        return "subiendo"
    elif segunda < primera * 0.85:
        return "bajando"
    return "estable"


def ciclo_pedido_semanas(ingrediente_id: int, db: Session) -> float:
    """Auto-detect ordering cycle in weeks from order history.
    Returns 1.0 (weekly) as default when insufficient data.
    """
    order_dates = (
        db.query(distinct(Pedido.fecha_recepcion))
        .join(LineaPedido)
        .filter(
            LineaPedido.ingrediente_id == ingrediente_id,
            Pedido.estado == "recibido",
            LineaPedido.cantidad_recibida.isnot(None),
        )
        .order_by(Pedido.fecha_recepcion)
        .all()
    )
    if len(order_dates) < 3:
        return 1.0
    dates = [d[0] for d in order_dates]
    gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
    avg_days = sum(gaps) / len(gaps)
    return max(1.0, round(avg_days / 7, 1))


def _lead_time_weeks(ingrediente_id: int, db: Session) -> float:
    """Look up lead time from the ingredient's supplier. Default 2 days."""
    ing = db.query(Ingrediente).get(ingrediente_id)
    if ing and ing.proveedor:
        prov = db.query(Proveedor).filter(Proveedor.nombre == ing.proveedor).first()
        if prov:
            return prov.lead_time_dias / 7.0
    return 2.0 / 7.0


def _supplier_cycle_override(ingrediente_id: int, db: Session) -> Optional[float]:
    """Check if the supplier has a fixed ordering cycle override."""
    ing = db.query(Ingrediente).get(ingrediente_id)
    if ing and ing.proveedor:
        prov = db.query(Proveedor).filter(Proveedor.nombre == ing.proveedor).first()
        if prov and prov.ciclo_pedido_dias:
            return prov.ciclo_pedido_dias / 7.0
    return None


def calcular_par_y_safety(
    ingrediente_id: int, db: Session
) -> dict:
    """Calculate safety stock and par level using auto-detected ordering cycle
    and supplier-specific lead time.
    Returns dict with cycle_weeks, lead_weeks, safety_stock, par_level,
    or None values when insufficient data.
    """
    media = consumo_medio_semanal(ingrediente_id, db)
    if media <= 0:
        return {"cycle_weeks": 1.0, "lead_weeks": None, "safety_stock": None, "par_level": None}

    historial = consumo_semanal(ingrediente_id, db)
    if len(historial) < 3:
        return {"cycle_weeks": 1.0, "lead_weeks": None, "safety_stock": None, "par_level": None}

    weekly_vals = [h["cantidad"] for h in historial]
    avg = sum(weekly_vals) / len(weekly_vals)
    variance = sum((v - avg) ** 2 for v in weekly_vals) / len(weekly_vals)
    std_dev = math.sqrt(variance)

    cycle_override = _supplier_cycle_override(ingrediente_id, db)
    cycle_weeks = cycle_override if cycle_override else ciclo_pedido_semanas(ingrediente_id, db)
    lead_weeks = _lead_time_weeks(ingrediente_id, db)

    min_safety = media * 2 / 7  # at least 2 days of consumption
    safety = round(max(1.65 * std_dev * math.sqrt(lead_weeks), min_safety), 1)
    safety = min(safety, media * cycle_weeks * 0.5)
    par_level = round(media * (cycle_weeks + lead_weeks) + safety, 1)
    safety = round(safety, 1)

    return {
        "cycle_weeks": round(cycle_weeks, 2),
        "lead_weeks": round(lead_weeks, 2),
        "safety_stock": safety,
        "par_level": par_level,
    }


def recomendacion_pedido(
    db: Session, ingrediente_ids: Optional[List[int]] = None
) -> list[dict]:
    """Order-Up-To system: pedir = par_level - stock_actual.
    Par level = consumo_medio + safety_stock (1.65 × std_dev).

    When ingrediente_ids is provided, only calculate for those ingredients.
    Always includes items even when cantidad_sugerida is 0.
    """
    if ingrediente_ids:
        ingredientes = (
            db.query(Ingrediente)
            .filter(Ingrediente.id.in_(ingrediente_ids))
            .order_by(Ingrediente.nombre)
            .all()
        )
    else:
        return []

    resultado = []

    for ing in ingredientes:
        media = consumo_medio_semanal(ing.id, db)
        stk = stock_actual(ing.id, db)
        stock_qty = stk["cantidad"] if stk else 0
        unidad = stk["unidad"] if stk else ing.unidad_compra

        if media <= 0:
            resultado.append({
                "ingrediente_id": ing.id,
                "ingrediente_nombre": ing.nombre,
                "proveedor": ing.proveedor or "Sin proveedor",
                "stock_actual": round(stock_qty, 2),
                "unidad": unidad,
                "consumo_medio_semanal": 0,
                "cantidad_sugerida": 0,
                "par_level": 0,
                "dias_stock": None,
                "nota": "Sin datos de consumo",
            })
            continue

        calc = calcular_par_y_safety(ing.id, db)

        if calc["par_level"] is None:
            resultado.append({
                "ingrediente_id": ing.id,
                "ingrediente_nombre": ing.nombre,
                "proveedor": ing.proveedor or "Sin proveedor",
                "stock_actual": round(stock_qty, 2),
                "unidad": unidad,
                "consumo_medio_semanal": round(media, 2),
                "cantidad_sugerida": 0,
                "par_level": 0,
                "dias_stock": None,
                "nota": "Pocas semanas de historial",
            })
            continue

        par_level = calc["par_level"]
        cantidad_sugerida = max(0, round(par_level - stock_qty, 1))

        consumo_diario = media / 7
        dias_stock = stock_qty / consumo_diario if consumo_diario > 0 else None

        resultado.append({
            "ingrediente_id": ing.id,
            "ingrediente_nombre": ing.nombre,
            "proveedor": ing.proveedor or "Sin proveedor",
            "stock_actual": round(stock_qty, 2),
            "unidad": unidad,
            "consumo_medio_semanal": round(media, 2),
            "cantidad_sugerida": round(cantidad_sugerida, 1),
            "par_level": round(par_level, 1),
            "dias_stock": round(dias_stock, 1) if dias_stock is not None else None,
        })

    return resultado
