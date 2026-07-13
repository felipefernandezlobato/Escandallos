from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Ingrediente,
    InventarioRegistro,
    LineaPedido,
    Pedido,
)
from app.services.conversiones import to_week_key
from app.services.consumo import recomendacion_pedido
from app.services.costes import crear_historial_precio
from app.schemas import (
    LineaPedidoOut,
    PedidoCreate,
    PedidoDetailOut,
    PedidoOut,
    PedidoUpdate,
    RecibirPedidoRequest,
)

router = APIRouter(prefix="/api/pedidos", tags=["pedidos"])


def _pedido_to_out(p: Pedido) -> dict:
    total = sum(
        (l.cantidad_recibida or l.cantidad_pedida) * (l.precio_unitario or 0)
        for l in p.lineas
    )
    return {
        "id": p.id,
        "fecha": p.fecha,
        "proveedor": p.proveedor,
        "estado": p.estado,
        "notas": p.notas,
        "fecha_recepcion": p.fecha_recepcion,
        "num_lineas": len(p.lineas),
        "total_estimado": round(total, 2),
    }


def _linea_to_out(l: LineaPedido) -> dict:
    return {
        "id": l.id,
        "ingrediente_id": l.ingrediente_id,
        "cantidad_pedida": l.cantidad_pedida,
        "unidad": l.unidad,
        "cantidad_recibida": l.cantidad_recibida,
        "precio_unitario": l.precio_unitario,
        "ingrediente_nombre": l.ingrediente_rel.nombre if l.ingrediente_rel else "",
    }


@router.get("", response_model=list[PedidoOut])
def listar_pedidos(
    proveedor: Optional[str] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(Pedido).options(joinedload(Pedido.lineas))
    if proveedor:
        q = q.filter(Pedido.proveedor.ilike(f"%{proveedor}%"))
    if estado:
        q = q.filter(Pedido.estado == estado)
    pedidos = q.order_by(Pedido.fecha.desc()).all()
    return [_pedido_to_out(p) for p in pedidos]


@router.get("/pivot")
def pedidos_pivot(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    from sqlalchemy import func as sqlfunc

    lineas = (
        db.query(LineaPedido)
        .join(Pedido)
        .filter(Pedido.estado == "recibido")
        .all()
    )

    fechas_set: set[str] = set()
    by_ing: dict[int, dict] = {}

    for l in lineas:
        pedido = db.get(Pedido, l.pedido_id)
        if not pedido or not pedido.fecha_recepcion:
            continue
        fecha_str = to_week_key(pedido.fecha_recepcion)
        fechas_set.add(fecha_str)

        if l.ingrediente_id not in by_ing:
            ing = db.get(Ingrediente, l.ingrediente_id)
            by_ing[l.ingrediente_id] = {
                "ingrediente_id": l.ingrediente_id,
                "ingrediente_nombre": ing.nombre if ing else "",
                "unidad": l.unidad,
                "fechas": {},
            }
        qty = l.cantidad_recibida if l.cantidad_recibida is not None else l.cantidad_pedida
        by_ing[l.ingrediente_id]["fechas"][fecha_str] = (
            by_ing[l.ingrediente_id]["fechas"].get(fecha_str, 0) + round(qty, 2)
        )

    fechas_sorted = sorted(fechas_set, reverse=True)

    order_counts: dict[int, int] = {}
    order_rows = (
        db.query(LineaPedido.ingrediente_id, sqlfunc.count(sqlfunc.distinct(Pedido.fecha)))
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


@router.get("/por-proveedor")
def pedidos_por_proveedor(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    items = recomendacion_pedido(db)
    por_proveedor: dict[str, list] = {}
    for item in items:
        prov = item["proveedor"]
        por_proveedor.setdefault(prov, []).append(item)
    return por_proveedor


@router.get("/{pedido_id}", response_model=PedidoDetailOut)
def obtener_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    p = (
        db.query(Pedido)
        .options(
            joinedload(Pedido.lineas).joinedload(LineaPedido.ingrediente_rel)
        )
        .filter(Pedido.id == pedido_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    out = _pedido_to_out(p)
    out["lineas"] = [_linea_to_out(l) for l in p.lineas]
    return out


@router.post("", response_model=PedidoDetailOut, status_code=201)
def crear_pedido(
    data: PedidoCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    pedido = Pedido(
        proveedor=data.proveedor,
        notas=data.notas,
        estado="borrador",
    )
    db.add(pedido)
    db.flush()

    for linea_data in data.lineas:
        linea = LineaPedido(
            pedido_id=pedido.id,
            ingrediente_id=linea_data.ingrediente_id,
            cantidad_pedida=linea_data.cantidad_pedida,
            unidad=linea_data.unidad,
            precio_unitario=linea_data.precio_unitario,
        )
        db.add(linea)
    db.commit()

    p = (
        db.query(Pedido)
        .options(
            joinedload(Pedido.lineas).joinedload(LineaPedido.ingrediente_rel)
        )
        .filter(Pedido.id == pedido.id)
        .first()
    )
    out = _pedido_to_out(p)
    out["lineas"] = [_linea_to_out(l) for l in p.lineas]
    return out


@router.put("/{pedido_id}", response_model=PedidoDetailOut)
def actualizar_pedido(
    pedido_id: int,
    data: PedidoUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    p = db.get(Pedido, pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado == "recibido":
        raise HTTPException(400, "No se puede modificar un pedido ya recibido")

    updates = data.model_dump(exclude_unset=True)
    lineas_nuevas = updates.pop("lineas", None)

    for key, val in updates.items():
        setattr(p, key, val)

    if lineas_nuevas is not None:
        db.query(LineaPedido).filter(LineaPedido.pedido_id == pedido_id).delete()
        for linea_data in lineas_nuevas:
            linea = LineaPedido(pedido_id=pedido_id, **linea_data)
            db.add(linea)

    db.commit()

    p = (
        db.query(Pedido)
        .options(
            joinedload(Pedido.lineas).joinedload(LineaPedido.ingrediente_rel)
        )
        .filter(Pedido.id == pedido_id)
        .first()
    )
    out = _pedido_to_out(p)
    out["lineas"] = [_linea_to_out(l) for l in p.lineas]
    return out


@router.delete("/{pedido_id}")
def eliminar_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    p = db.get(Pedido, pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado == "recibido":
        raise HTTPException(400, "No se puede eliminar un pedido ya recibido")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/{pedido_id}/enviar")
def enviar_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    p = db.get(Pedido, pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado != "borrador":
        raise HTTPException(400, f"Solo se puede enviar un pedido en borrador (actual: {p.estado})")
    p.estado = "enviado"
    db.commit()
    return {"ok": True}


@router.post("/{pedido_id}/recibir")
def recibir_pedido(
    pedido_id: int,
    data: RecibirPedidoRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    p = (
        db.query(Pedido)
        .options(joinedload(Pedido.lineas))
        .filter(Pedido.id == pedido_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado == "recibido":
        raise HTTPException(400, "Este pedido ya fue recibido")

    lineas_map = {l.id: l for l in p.lineas}
    precios_actualizados = 0

    for item in data.lineas:
        linea = lineas_map.get(item.linea_id)
        if not linea:
            continue
        linea.cantidad_recibida = item.cantidad_recibida
        if item.precio_unitario is not None:
            linea.precio_unitario = item.precio_unitario

            ing = db.get(Ingrediente, linea.ingrediente_id)
            if ing and item.precio_unitario != ing.precio_compra:
                crear_historial_precio(db, ing.id, ing.precio_compra, item.precio_unitario)
                ing.precio_compra = item.precio_unitario
                ing.fecha_actualizacion = date.today()
                precios_actualizados += 1

    p.estado = "recibido"
    p.fecha_recepcion = date.today()

    for linea in p.lineas:
        if not linea.cantidad_recibida or linea.cantidad_recibida <= 0:
            continue
        ultimo = (
            db.query(InventarioRegistro)
            .filter(InventarioRegistro.ingrediente_id == linea.ingrediente_id)
            .order_by(InventarioRegistro.fecha_registro.desc())
            .first()
        )
        stock_actual = ultimo.cantidad if ultimo else 0
        nueva_cantidad = stock_actual + linea.cantidad_recibida
        unidad = ultimo.unidad if ultimo else linea.unidad
        db.add(InventarioRegistro(
            ingrediente_id=linea.ingrediente_id,
            cantidad=nueva_cantidad,
            unidad=unidad,
            fecha_registro=date.today(),
            notas=f"Pedido #{p.id} recibido",
        ))

    db.commit()

    return {"ok": True, "precios_actualizados": precios_actualizados}
