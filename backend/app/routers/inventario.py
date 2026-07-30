from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Ingrediente, InventarioRegistro, LineaPedido, Pedido
from app.services.conversiones import to_week_key
from app.schemas import (
    ConsumoOut,
    ConsumoSemanalItem,
    InventarioRegistroOut,
    InventarioRegistroUpdate,
    InventarioSnapshotCreate,
    InventarioSnapshotOut,
    RecomendacionItem,
    RecomendacionOut,
    StockHistorialItem,
)
from app.services.consumo import (
    calcular_par_y_safety,
    consumo_medio_semanal,
    consumo_semanal,
    recomendacion_pedido,
    stock_actual,
    stock_por_ubicacion,
    tendencia_consumo,
)

router = APIRouter(prefix="/api/inventario", tags=["inventario"])


@router.get("/con-registros")
def ingredientes_con_registros(db: Session = Depends(get_db), user=Depends(get_current_user)):
    ids = [r[0] for r in db.query(distinct(InventarioRegistro.ingrediente_id)).all()]
    return ids


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
            ubicacion=reg.ubicacion,
        )
        db.add(registro)
        creados += 1
    db.commit()
    return {"ok": True, "registros_creados": creados}


@router.delete("/{registro_id}")
def eliminar_registro_inventario(
    registro_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    reg = db.get(InventarioRegistro, registro_id)
    if not reg:
        raise HTTPException(404, "Registro no encontrado")
    db.delete(reg)
    db.commit()
    return {"ok": True}


@router.put("/{registro_id}")
def actualizar_registro_inventario(
    registro_id: int,
    data: InventarioRegistroUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    reg = db.get(InventarioRegistro, registro_id)
    if not reg:
        raise HTTPException(404, "Registro no encontrado")

    updates = data.model_dump(exclude_unset=True)
    for key, val in updates.items():
        setattr(reg, key, val)

    db.commit()

    ing = db.get(Ingrediente, reg.ingrediente_id)
    return {
        "id": reg.id,
        "ingrediente_id": reg.ingrediente_id,
        "cantidad": reg.cantidad,
        "unidad": reg.unidad,
        "fecha_registro": reg.fecha_registro,
        "notas": reg.notas,
        "ingrediente_nombre": ing.nombre if ing else "",
    }


@router.get("")
def listar_inventario(
    fecha: Optional[str] = None,
    semana: Optional[str] = None,
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

    # Group dates by week for the week selector
    semanas_list = []
    seen_weeks = set()
    for f in fechas_list:
        wk = to_week_key(f)
        if wk not in seen_weeks:
            seen_weeks.add(wk)
            semanas_list.append(wk)

    if semana:
        all_registros = (
            db.query(InventarioRegistro)
            .order_by(InventarioRegistro.fecha_registro.desc())
            .all()
        )
        week_registros = [r for r in all_registros if to_week_key(r.fecha_registro) == semana]
        if not week_registros:
            registros = []
        else:
            latest_date = week_registros[0].fecha_registro
            registros = [r for r in week_registros if r.fecha_registro == latest_date]
        ing_ids = {r.ingrediente_id for r in registros}
        ings = {i.id: i for i in db.query(Ingrediente).filter(Ingrediente.id.in_(ing_ids)).all()}
        items = []
        for r in registros:
            ing = ings.get(r.ingrediente_id)
            items.append({
                "id": r.id,
                "ingrediente_id": r.ingrediente_id,
                "cantidad": round(r.cantidad, 3),
                "unidad": r.unidad,
                "fecha_registro": r.fecha_registro,
                "notas": r.notas,
                "ingrediente_nombre": ing.nombre if ing else "",
            })
        return {
            "fechas": [str(f) for f in fechas_list],
            "semanas": semanas_list,
            "snapshot": {
                "fecha": semana,
                "registros": items,
                "total_items": len(items),
            },
        }

    if fecha:
        target = date.fromisoformat(fecha)
    elif fechas_list:
        target = fechas_list[0]
    else:
        return {"fechas": [], "semanas": [], "snapshot": None}

    registros = (
        db.query(InventarioRegistro)
        .filter(InventarioRegistro.fecha_registro == target)
        .all()
    )
    ing_ids = {r.ingrediente_id for r in registros}
    ings = {i.id: i for i in db.query(Ingrediente).filter(Ingrediente.id.in_(ing_ids)).all()}
    items = []
    for r in registros:
        ing = ings.get(r.ingrediente_id)
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
        "semanas": semanas_list,
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

    ing_ids = {r.ingrediente_id for r in registros}
    ings = {i.id: i for i in db.query(Ingrediente).filter(Ingrediente.id.in_(ing_ids)).all()}

    fechas_set: set[str] = set()
    by_ing: dict[int, dict] = {}
    for r in registros:
        week = to_week_key(r.fecha_registro)
        fechas_set.add(week)
        if r.ingrediente_id not in by_ing:
            ing = ings.get(r.ingrediente_id)
            by_ing[r.ingrediente_id] = {
                "ingrediente_id": r.ingrediente_id,
                "ingrediente_nombre": ing.nombre if ing else "",
                "unidad": r.unidad,
                "fechas": {},
            }
        if week not in by_ing[r.ingrediente_id]["fechas"]:
            by_ing[r.ingrediente_id]["fechas"][week] = round(r.cantidad, 2)

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
    ing_ids = {r.ingrediente_id for r in registros}
    ings = {i.id: i for i in db.query(Ingrediente).filter(Ingrediente.id.in_(ing_ids)).all()}
    result = []
    for r in registros:
        ing = ings.get(r.ingrediente_id)
        item = {
            "ingrediente_id": r.ingrediente_id,
            "ingrediente_nombre": ing.nombre if ing else "",
            "cantidad": r.cantidad,
            "unidad": r.unidad,
            "fecha_registro": str(r.fecha_registro),
            "activo": ing.activo if ing else True,
            "grupo_ingrediente_id": ing.grupo_ingrediente_id if ing else None,
            "ubicacion": r.ubicacion,
        }
        # Include location breakdown if the ingredient has location data
        ubicaciones = stock_por_ubicacion(r.ingrediente_id, db)
        if ubicaciones:
            item["ubicaciones"] = ubicaciones
        result.append(item)
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
    subq = (
        db.query(
            InventarioRegistro.ingrediente_id,
            func.max(InventarioRegistro.fecha_registro).label("max_fecha"),
        )
        .group_by(InventarioRegistro.ingrediente_id)
        .subquery()
    )
    rows = (
        db.query(InventarioRegistro.ingrediente_id, InventarioRegistro.fecha_registro, InventarioRegistro.unidad)
        .join(
            subq,
            (InventarioRegistro.ingrediente_id == subq.c.ingrediente_id)
            & (InventarioRegistro.fecha_registro == subq.c.max_fecha),
        )
        .all()
    )
    return {
        str(ing_id): {"fecha": str(fecha), "unidad": unidad}
        for ing_id, fecha, unidad in rows
    }


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


@router.get("/cafe-resumen")
def cafe_resumen(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    parents = (
        db.query(Ingrediente)
        .filter(
            Ingrediente.id.in_(
                db.query(Ingrediente.grupo_ingrediente_id)
                .filter(Ingrediente.grupo_ingrediente_id.isnot(None))
                .distinct()
            )
        )
        .all()
    )
    result = []
    for p in parents:
        media = consumo_medio_semanal(p.id, db)
        calc = calcular_par_y_safety(p.id, db)
        stk = stock_actual(p.id, db)
        stk_qty = stk["cantidad"] if stk else 0
        stk_unit = stk["unidad"] if stk else p.unidad_compra
        ubicaciones = stock_por_ubicacion(p.id, db)
        hist = consumo_semanal(p.id, db)
        trend = tendencia_consumo(hist)
        result.append({
            "id": p.id,
            "nombre": p.nombre,
            "consumo_medio": media,
            "unidad": stk_unit,
            "tendencia": trend,
            "safety_stock": calc["safety_stock"],
            "par_level": calc["par_level"],
            "stock": round(stk_qty, 1),
            "ubicaciones": ubicaciones if ubicaciones else None,
        })
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

    from app.services.consumo import calcular_par_y_safety, _child_ids

    child_ids = _child_ids(ingrediente_id, db)
    if child_ids:
        # Parent: aggregate stock history from all children by date
        all_registros = (
            db.query(InventarioRegistro)
            .filter(InventarioRegistro.ingrediente_id.in_(child_ids))
            .order_by(InventarioRegistro.fecha_registro.asc())
            .all()
        )
        by_date: dict[str, float] = {}
        display_unit = ing.unidad_compra
        for r in all_registros:
            key = str(r.fecha_registro)
            by_date[key] = by_date.get(key, 0) + r.cantidad
            display_unit = r.unidad
        stock_points: list[StockHistorialItem] = [
            StockHistorialItem(fecha=f, cantidad=round(q, 2), unidad=display_unit)
            for f, q in sorted(by_date.items())
        ]
    else:
        all_registros = (
            db.query(InventarioRegistro)
            .filter(InventarioRegistro.ingrediente_id == ingrediente_id)
            .order_by(InventarioRegistro.fecha_registro.asc())
            .all()
        )
        display_unit = ing.unidad_compra
        if all_registros:
            display_unit = all_registros[-1].unidad
        stock_points = [
            StockHistorialItem(fecha=str(r.fecha_registro), cantidad=r.cantidad, unidad=r.unidad)
            for r in all_registros
        ]

    calc = calcular_par_y_safety(ingrediente_id, db)
    rop = calc["safety_stock"]
    eoq = calc["par_level"]

    return ConsumoOut(
        ingrediente_id=ing.id,
        ingrediente_nombre=ing.nombre,
        consumo_medio=media,
        unidad=display_unit,
        tendencia=trend,
        reorder_point=rop,
        eoq=eoq,
        safety_stock=rop,
        par_level=eoq,
        cycle_weeks=calc["cycle_weeks"],
        lead_weeks=calc.get("lead_weeks"),
        historial=[
            ConsumoSemanalItem(semana=h["semana"], cantidad=h["cantidad"], unidad=display_unit)
            for h in historial
        ],
        stock_historial=stock_points,
    )
