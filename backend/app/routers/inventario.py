from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Ingrediente, InventarioRegistro, LineaPedido, Pedido
from app.schemas import (
    ConsumoOut,
    ConsumoSemanalItem,
    InventarioRegistroOut,
    InventarioSnapshotCreate,
    InventarioSnapshotOut,
    RecomendacionItem,
    RecomendacionOut,
    StockHistorialItem,
)
from app.services.consumo import (
    consumo_medio_semanal,
    consumo_semanal,
    recomendacion_pedido,
    stock_actual,
    tendencia_consumo,
)

router = APIRouter(prefix="/api/inventario", tags=["inventario"])


@router.post("", status_code=201)
def registrar_inventario(
    data: InventarioSnapshotCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    fecha = date.fromisoformat(data.fecha) if data.fecha else date.today()
    creados = 0
    for reg in data.registros:
        ing = db.get(Ingrediente, reg.ingrediente_id)
        if not ing:
            continue
        registro = InventarioRegistro(
            ingrediente_id=reg.ingrediente_id,
            cantidad=reg.cantidad,
            unidad=reg.unidad,
            fecha_registro=fecha,
            notas=reg.notas,
        )
        db.add(registro)
        creados += 1
    db.commit()
    return {"ok": True, "registros_creados": creados}


@router.get("")
def listar_inventario(
    fecha: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    fechas = (
        db.query(InventarioRegistro.fecha_registro)
        .distinct()
        .order_by(InventarioRegistro.fecha_registro.desc())
        .all()
    )
    fechas_list = [f[0] for f in fechas]

    if fecha:
        target = date.fromisoformat(fecha)
    elif fechas_list:
        target = fechas_list[0]
    else:
        return {"fechas": [], "snapshot": None}

    registros = (
        db.query(InventarioRegistro)
        .filter(InventarioRegistro.fecha_registro == target)
        .all()
    )
    items = []
    for r in registros:
        ing = db.get(Ingrediente, r.ingrediente_id)
        items.append({
            "id": r.id,
            "ingrediente_id": r.ingrediente_id,
            "cantidad": r.cantidad,
            "unidad": r.unidad,
            "fecha_registro": r.fecha_registro,
            "notas": r.notas,
            "ingrediente_nombre": ing.nombre if ing else "",
        })

    return {
        "fechas": [str(f) for f in fechas_list],
        "snapshot": {
            "fecha": str(target),
            "registros": items,
            "total_items": len(items),
        },
    }


@router.get("/pivot")
def inventario_pivot(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    registros = (
        db.query(InventarioRegistro)
        .order_by(InventarioRegistro.fecha_registro.desc())
        .all()
    )
    def to_week(d):
        iso = d.isocalendar()
        return f"w{iso[1]}.{str(iso[0])[2:]}"

    fechas_set: set[str] = set()
    by_ing: dict[int, dict] = {}
    for r in registros:
        week = to_week(r.fecha_registro)
        fechas_set.add(week)
        if r.ingrediente_id not in by_ing:
            ing = db.get(Ingrediente, r.ingrediente_id)
            by_ing[r.ingrediente_id] = {
                "ingrediente_id": r.ingrediente_id,
                "ingrediente_nombre": ing.nombre if ing else "",
                "unidad": r.unidad,
                "fechas": {},
            }
        by_ing[r.ingrediente_id]["fechas"][week] = r.cantidad

    fechas_sorted = sorted(fechas_set, reverse=True)

    # Count distinct weeks ordered for sorting (frequency, not volume)
    order_counts: dict[int, int] = {}
    order_rows = (
        db.query(LineaPedido.ingrediente_id, func.count(func.distinct(Pedido.fecha)))
        .join(Pedido)
        .group_by(LineaPedido.ingrediente_id)
        .all()
    )
    for ing_id, cnt in order_rows:
        order_counts[ing_id] = cnt

    return {
        "fechas": fechas_sorted,
        "ingredientes": sorted(
            by_ing.values(),
            key=lambda x: -order_counts.get(x["ingrediente_id"], 0),
        ),
    }


@router.get("/actual")
def stock_actual_todos(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    subq = (
        db.query(
            InventarioRegistro.ingrediente_id,
            func.max(InventarioRegistro.fecha_registro).label("max_fecha"),
        )
        .group_by(InventarioRegistro.ingrediente_id)
        .subquery()
    )
    registros = (
        db.query(InventarioRegistro)
        .join(
            subq,
            (InventarioRegistro.ingrediente_id == subq.c.ingrediente_id)
            & (InventarioRegistro.fecha_registro == subq.c.max_fecha),
        )
        .all()
    )
    result = []
    for r in registros:
        ing = db.get(Ingrediente, r.ingrediente_id)
        result.append({
            "ingrediente_id": r.ingrediente_id,
            "ingrediente_nombre": ing.nombre if ing else "",
            "cantidad": r.cantidad,
            "unidad": r.unidad,
            "fecha_registro": str(r.fecha_registro),
        })
    return result


@router.get("/recomendacion")
def obtener_recomendacion(
    ingrediente_ids: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ids = None
    if ingrediente_ids:
        ids = [int(x) for x in ingrediente_ids.split(",") if x.strip()]
    items = recomendacion_pedido(db, ingrediente_ids=ids)
    return RecomendacionOut(fecha=date.today(), items=items)


@router.get("/ultimo-conteo")
def ultimo_conteo(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rows = (
        db.query(
            InventarioRegistro.ingrediente_id,
            func.max(InventarioRegistro.fecha_registro).label("ultima_fecha"),
        )
        .group_by(InventarioRegistro.ingrediente_id)
        .all()
    )
    return {str(ing_id): str(fecha) for ing_id, fecha in rows}


@router.get("/alertas-stock")
def alertas_stock(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    cutoff = date.today() - timedelta(days=30)

    ingredientes = db.query(Ingrediente).order_by(Ingrediente.nombre).all()
    alertas = []
    for ing in ingredientes:
        media = consumo_medio_semanal(ing.id, db)
        if media <= 0:
            continue
        stk = stock_actual(ing.id, db)
        if stk is None or stk["fecha"] < cutoff:
            continue
        stock_qty = stk["cantidad"]
        consumo_diario = media / 7
        dias = stock_qty / consumo_diario if consumo_diario > 0 else None
        if dias is not None and dias < 2:
            alertas.append({
                "ingrediente_id": ing.id,
                "ingrediente_nombre": ing.nombre,
                "stock_actual": round(stock_qty, 2),
                "unidad": stk["unidad"],
                "dias_stock": round(dias, 1),
                "consumo_diario": round(consumo_diario, 2),
            })
    alertas.sort(key=lambda x: x["dias_stock"])
    return alertas


@router.get("/coste-semanal")
def coste_semanal_proveedores(
    semanas: int = 12,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    most_recent = (
        db.query(func.max(Pedido.fecha_recepcion))
        .filter(Pedido.estado == "recibido")
        .scalar()
    )
    if not most_recent:
        return []
    inicio = most_recent - timedelta(weeks=semanas)

    pedidos = (
        db.query(Pedido)
        .filter(Pedido.estado == "recibido", Pedido.fecha_recepcion >= inicio)
        .all()
    )
    from collections import defaultdict
    by_week: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for p in pedidos:
        if not p.fecha_recepcion:
            continue
        iso = p.fecha_recepcion.isocalendar()
        key = f"w{iso[1]}.{str(iso[0])[2:]}"
        lineas = db.query(LineaPedido).filter(LineaPedido.pedido_id == p.id).all()
        total = sum((l.cantidad_recibida or l.cantidad_pedida) * (l.precio_unitario or 0) for l in lineas)
        by_week[key][p.proveedor] += total

    result = []
    for week in sorted(by_week.keys()):
        entry = {"semana": week, "proveedores": {}}
        for prov, total in by_week[week].items():
            entry["proveedores"][prov] = round(total, 2)
        entry["total"] = round(sum(by_week[week].values()), 2)
        result.append(entry)
    return result


@router.get("/consumo/{ingrediente_id}")
def obtener_consumo(
    ingrediente_id: int,
    semanas: int = 12,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ing = db.get(Ingrediente, ingrediente_id)
    if not ing:
        raise HTTPException(404, "Ingrediente no encontrado")

    historial = consumo_semanal(ingrediente_id, db, semanas)
    media = consumo_medio_semanal(ingrediente_id, db)
    trend = tendencia_consumo(historial)

    registros_stock = (
        db.query(InventarioRegistro)
        .filter(InventarioRegistro.ingrediente_id == ingrediente_id)
        .order_by(InventarioRegistro.fecha_registro.asc())
        .all()
    )

    # Order-Up-To (Par Level) system for fixed weekly ordering
    # target_stock = consumo_medio + safety_stock
    # safety_stock = 1.65 × std_dev (95% service level)
    # order_qty = target_stock - current_stock
    rop = None  # safety stock level
    eoq = None  # target stock (par level)
    if media > 0 and len(historial) >= 3:
        import math
        weekly_vals = [h["cantidad"] for h in historial]
        avg = sum(weekly_vals) / len(weekly_vals)
        variance = sum((v - avg) ** 2 for v in weekly_vals) / len(weekly_vals)
        std_dev = math.sqrt(variance)
        safety = min(1.65 * std_dev, 0.5 * media)
        safety = round(safety, 1)
        rop = safety
        eoq = round(media + safety, 1)

    return ConsumoOut(
        ingrediente_id=ing.id,
        ingrediente_nombre=ing.nombre,
        consumo_medio=media,
        unidad=ing.unidad_uso,
        tendencia=trend,
        reorder_point=rop,
        eoq=eoq,
        safety_stock=rop,
        par_level=eoq,
        historial=[
            ConsumoSemanalItem(semana=h["semana"], cantidad=h["cantidad"], unidad=ing.unidad_uso)
            for h in historial
        ],
        stock_historial=[
            StockHistorialItem(
                fecha=str(r.fecha_registro),
                cantidad=r.cantidad,
                unidad=r.unidad,
            )
            for r in registros_stock
        ],
    )
