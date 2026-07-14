import math
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import InventarioRegistro, LineaPedido, Pedido, Ingrediente


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

    pedidos_recibidos = (
        db.query(LineaPedido.cantidad_recibida, Pedido.fecha_recepcion)
        .join(Pedido)
        .filter(
            LineaPedido.ingrediente_id == ingrediente_id,
            Pedido.estado == "recibido",
            Pedido.fecha_recepcion >= inicio,
            LineaPedido.cantidad_recibida.isnot(None),
        )
        .all()
    )

    inventarios = (
        db.query(InventarioRegistro)
        .filter(
            InventarioRegistro.ingrediente_id == ingrediente_id,
            InventarioRegistro.fecha_registro >= inicio,
        )
        .order_by(InventarioRegistro.fecha_registro)
        .all()
    )

    semana_data: dict[str, float] = {}

    for qty, fecha in pedidos_recibidos:
        if qty and fecha:
            iso = fecha.isocalendar()
            key = f"w{iso[1]}.{str(iso[0])[2:]}"
            semana_data[key] = semana_data.get(key, 0) + qty

    if inventarios and len(inventarios) >= 2:
        for i in range(1, len(inventarios)):
            prev = inventarios[i - 1]
            curr = inventarios[i]
            iso = curr.fecha_registro.isocalendar()
            key = f"w{iso[1]}.{str(iso[0])[2:]}"
            pedido_semana = semana_data.get(key, 0)
            consumo = prev.cantidad + pedido_semana - curr.cantidad
            if consumo > 0:
                semana_data[key] = consumo

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

        historial = consumo_semanal(ing.id, db)
        if len(historial) < 3:
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

        weekly_vals = [h["cantidad"] for h in historial]
        avg = sum(weekly_vals) / len(weekly_vals)
        variance = sum((v - avg) ** 2 for v in weekly_vals) / len(weekly_vals)
        std_dev = math.sqrt(variance)
        safety = min(1.65 * std_dev, 0.5 * media)
        par_level = media + safety

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
