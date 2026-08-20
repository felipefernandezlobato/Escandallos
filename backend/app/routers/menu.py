import re
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Ingrediente, InventarioRegistro, LineaPedido, Pedido

router = APIRouter(prefix="/api/menu", tags=["menu"])

_BRU_SUFFIX = re.compile(r"\s+Bru[12]$", re.IGNORECASE)


def _coffee_name(nombre: str) -> str:
    """Strip 'Frozen ' prefix and ' Bru1'/' Bru2' suffix to get the coffee name."""
    name = nombre
    if name.lower().startswith("frozen "):
        name = name[len("Frozen "):]
    name = _BRU_SUFFIX.sub("", name)
    return name.strip()


def _batch_latest_stocks(
    ingredient_ids: list[int], db: Session, group_of: Optional[dict[int, int]] = None
) -> dict[int, dict]:
    """Batch-load latest stock for many ingredients.
    Returns {id: {"total": float, "by_location": {loc: qty}}}.

    group_of (optional {ingrediente_id: parent_group_id}): when given, an
    ingredient's stock is zeroed if its own latest MANUAL COUNT date doesn't
    match the most recent count date recorded across all ingredients sharing
    its group — a flavor left blank on count day is 0, not carried forward,
    matching the café "zero if not counted in the latest session" rule.
    "Pedido recibido" inserts (see recibir_pedido() in routers/pedidos.py,
    tagged only via a free-text notas marker) never define that session
    themselves — a flavor bumped by a received order always contributes its
    current value, even if no sibling was counted that same day.
    """
    if not ingredient_ids:
        return {}

    # Get max date per ingredient in one query
    max_dates = (
        db.query(
            InventarioRegistro.ingrediente_id,
            func.max(InventarioRegistro.fecha_registro).label("max_fecha"),
        )
        .filter(InventarioRegistro.ingrediente_id.in_(ingredient_ids))
        .group_by(InventarioRegistro.ingrediente_id)
        .all()
    )
    date_map = {row[0]: row[1] for row in max_dates}

    if not date_map:
        return {iid: {"total": 0.0, "by_location": {}} for iid in ingredient_ids}

    # Same as max_dates but excluding "Pedido recibido" inserts — this is the
    # date that actually defines a synchronized counting session.
    conteo_dates = (
        db.query(
            InventarioRegistro.ingrediente_id,
            func.max(InventarioRegistro.fecha_registro).label("max_fecha"),
        )
        .filter(
            InventarioRegistro.ingrediente_id.in_(ingredient_ids),
            or_(
                InventarioRegistro.notas.is_(None),
                ~InventarioRegistro.notas.ilike("%recibido%"),
            ),
        )
        .group_by(InventarioRegistro.ingrediente_id)
        .all()
    )
    conteo_date_map = {row[0]: row[1] for row in conteo_dates}

    group_max_date: dict[int, object] = {}
    if group_of:
        for iid, fecha in conteo_date_map.items():
            gid = group_of.get(iid)
            if gid is None:
                continue
            if gid not in group_max_date or fecha > group_max_date[gid]:
                group_max_date[gid] = fecha

    # Build filter conditions for each ingredient's latest date
    conditions = [
        and_(
            InventarioRegistro.ingrediente_id == iid,
            InventarioRegistro.fecha_registro == fecha,
        )
        for iid, fecha in date_map.items()
    ]

    rows = (
        db.query(
            InventarioRegistro.ingrediente_id,
            InventarioRegistro.ubicacion,
            InventarioRegistro.cantidad,
        )
        .filter(or_(*conditions))
        .order_by(InventarioRegistro.id.asc())
        .all()
    ) if conditions else []

    # A same-day, same-location duplicate is a correction (latest wins), not
    # additive — only genuinely different ubicaciones (BRU1 + BRU2) should sum.
    latest_by_loc: dict[tuple, float] = {}
    for iid, loc, qty in rows:
        latest_by_loc[(iid, loc)] = qty

    result: dict[int, dict] = {iid: {"total": 0.0, "by_location": {}} for iid in ingredient_ids}
    for (iid, loc), qty in latest_by_loc.items():
        if group_of:
            gid = group_of.get(iid)
            # If this ingredient's own latest record IS a "Pedido recibido"
            # insert (i.e. no manual count shares that exact date), always
            # include it — only a stale manual count that missed the group's
            # latest session gets zeroed.
            es_recibido = date_map.get(iid) != conteo_date_map.get(iid)
            if gid is not None and not es_recibido and conteo_date_map.get(iid) != group_max_date.get(gid):
                continue
        result[iid]["total"] += qty
        key = loc or "SIN"
        result[iid]["by_location"][key] = result[iid]["by_location"].get(key, 0) + qty

    return result


def _batch_has_pending_orders(ingredient_ids: list[int], db: Session) -> set[int]:
    """Batch-check which ingredients have pending order lines."""
    if not ingredient_ids:
        return set()

    rows = (
        db.query(LineaPedido.ingrediente_id)
        .join(Pedido, LineaPedido.pedido_id == Pedido.id)
        .filter(
            LineaPedido.ingrediente_id.in_(ingredient_ids),
            Pedido.estado.in_(["borrador", "enviado"]),
        )
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


@router.get("/frozen")
def menu_frozen(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return frozen tubes that should appear on the menu based on availability."""
    frozen_tubes = (
        db.query(Ingrediente)
        .filter(Ingrediente.suplemento_frozen.isnot(None))
        .all()
    )

    # Group by deduplicated coffee name
    groups: dict[str, list[Ingrediente]] = defaultdict(list)
    for tube in frozen_tubes:
        name = _coffee_name(tube.nombre)
        groups[name].append(tube)

    # Collect all IDs we need stock for (tubes + source bags)
    all_tube_ids = [t.id for t in frozen_tubes]
    all_source_ids = list({t.frozen_origen_id for t in frozen_tubes if t.frozen_origen_id is not None})
    all_ids = list(set(all_tube_ids + all_source_ids))

    # Group each id by its real parent (Tubos Frozen Bru1/Bru2 for tubes, its
    # own retail-color group for source bags) so a flavor left blank on count
    # day reads as 0 instead of carrying forward a stale count.
    group_rows = (
        db.query(Ingrediente.id, Ingrediente.grupo_ingrediente_id)
        .filter(Ingrediente.id.in_(all_ids))
        .all()
    )
    group_of = {iid: gid for iid, gid in group_rows if gid is not None}

    # Batch-load all stocks and pending orders
    stocks = _batch_latest_stocks(all_ids, db, group_of=group_of)
    pending_ids = _batch_has_pending_orders(all_source_ids, db)

    result = []
    for name, tubes in groups.items():
        representative = tubes[0]
        coste_kg = representative.coste_kg_frozen or 0.0
        supplement = representative.suplemento_frozen or 0.0

        tube_stock = sum(stocks.get(t.id, {}).get("total", 0.0) for t in tubes)

        source_ids = {t.frozen_origen_id for t in tubes if t.frozen_origen_id is not None}
        source_stock = sum(stocks.get(sid, {}).get("total", 0.0) for sid in source_ids)

        has_pending = bool(source_ids & pending_ids)

        visible = tube_stock > 0 or source_stock > 0 or has_pending
        if not visible:
            continue

        chf_per_tube = coste_kg * 0.019  # 19g per tube
        doppio_cost = 0.41
        base_price = 3.90

        origen_id = representative.frozen_origen_id
        item = {
            "name": name,
            "chf_per_tube": round(chf_per_tube, 4),
            "supplement": supplement,
            "origen_id": origen_id,
        }

        if chf_per_tube > 0:
            item["multi_total"] = round((base_price + supplement) / chf_per_tube, 2)
        else:
            item["multi_total"] = None

        denominator = chf_per_tube - doppio_cost
        if denominator > 0:
            item["multi_supplement"] = round(supplement / denominator, 2)
        else:
            item["multi_supplement"] = None

        item["coste_kg_frozen"] = coste_kg

        bru1_tubes = [t for t in tubes if "bru1" in t.nombre.lower()]
        bru2_tubes = [t for t in tubes if "bru2" in t.nombre.lower()]
        item["stock_bru1"] = sum(stocks.get(t.id, {}).get("total", 0.0) for t in bru1_tubes)
        item["stock_bru2"] = sum(stocks.get(t.id, {}).get("total", 0.0) for t in bru2_tubes)
        item["stock_bolsa"] = source_stock

        bolsa_by_loc: dict[str, float] = {}
        for sid in source_ids:
            for loc, qty in stocks.get(sid, {}).get("by_location", {}).items():
                bolsa_by_loc[loc] = bolsa_by_loc.get(loc, 0) + qty
        item["stock_bolsa_bru1"] = bolsa_by_loc.get("BRU1", 0)
        item["stock_bolsa_bru2"] = bolsa_by_loc.get("BRU2", 0)
        item["disponible"] = visible
        result.append(item)

    result.sort(key=lambda x: -(x.get("coste_kg_frozen") or 0))

    for item in result:
        item["doppio_pvp"] = 3.90
        item["doppio_cost"] = 0.41
        item["grams_per_tube"] = 19
        item["chf_per_kg"] = round(item.pop("coste_kg_frozen"), 2)

    return result
