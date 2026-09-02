import math
from collections import OrderedDict
from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.models import InventarioRegistro, LineaPedido, MermaRegistro, Pedido, Ingrediente, Proveedor


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


def _child_ids(ingrediente_id: int, db: Session) -> list[int]:
    """Return list of leaf ingredient IDs recursively.
    If a child is itself a parent, returns its children instead (flattens the tree).
    Returns empty list if the ingredient has no children (is a leaf).
    """
    hijos = (
        db.query(Ingrediente.id)
        .filter(Ingrediente.grupo_ingrediente_id == ingrediente_id)
        .all()
    )
    if not hijos:
        return []
    result = []
    for (h_id,) in hijos:
        grandchildren = _child_ids(h_id, db)
        if grandchildren:
            result.extend(grandchildren)
        else:
            result.append(h_id)
    return result


def _consumo_semanal_leaf(ingrediente_id: int, db: Session, semanas: int = 12) -> list[dict]:
    """Calculate weekly consumption for a single (leaf) ingredient."""
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
    filtered = [r for r in all_inventarios if not (r.notas and "recibido" in r.notas.lower())]
    if all_inventarios:
        target_unit = all_inventarios[-1].unidad
    else:
        target_unit = ing.unidad_compra if ing else "unidad"

    # Aggregate same-day records (BRU1 + BRU2 entries) into single data points
    from collections import OrderedDict
    day_sums: OrderedDict[date, float] = OrderedDict()
    day_units: dict[date, str] = {}
    for r in filtered:
        day_sums[r.fecha_registro] = day_sums.get(r.fecha_registro, 0) + r.cantidad
        if r.fecha_registro not in day_units:
            day_units[r.fecha_registro] = r.unidad

    class _AggRecord:
        def __init__(self, fecha, cantidad, unidad):
            self.fecha_registro = fecha
            self.cantidad = cantidad
            self.unidad = unidad
            self.notas = None

    inventarios = [_AggRecord(f, q, day_units[f]) for f, q in day_sums.items()]

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


def consumo_semanal(ingrediente_id: int, db: Session, semanas: int = 12) -> list[dict]:
    """Calculate weekly consumption based on received orders and inventory changes.

    If the ingredient is a parent (has children), aggregates consumption from all children.
    Uses the most recent N weeks of data available, not a fixed window from today.
    """
    children = _child_ids(ingrediente_id, db)
    if not children:
        return _consumo_semanal_leaf(ingrediente_id, db, semanas)

    # Aggregate consumption from all children
    merged: dict[str, float] = {}
    for child_id in children:
        child_data = _consumo_semanal_leaf(child_id, db, semanas)
        for item in child_data:
            merged[item["semana"]] = merged.get(item["semana"], 0) + item["cantidad"]

    return [
        {"semana": key, "cantidad": round(merged[key], 2)}
        for key in sorted(merged.keys())
    ]


def consumo_medio_semanal(ingrediente_id: int, db: Session, semanas: int = 8) -> float:
    ing = db.query(Ingrediente).get(ingrediente_id)
    if ing and ing.consumo_override_semanal is not None:
        return round(ing.consumo_override_semanal, 2)
    historial = consumo_semanal(ingrediente_id, db, semanas)
    if not historial:
        return 0.0
    total = sum(h["cantidad"] for h in historial)
    return round(total / len(historial), 2)


def _es_pedido_recibido(registro) -> bool:
    """A "Pedido recibido" insert is tagged only via a free-text notas marker
    (no dedicated column) — see recibir_pedido() in routers/pedidos.py."""
    return bool(registro.notas and "recibido" in registro.notas.lower())


def _day_total(records: list) -> float:
    """Sum quantities across distinct ubicaciones for same-day records of one
    ingredient. Records must be pre-sorted by id ascending. Two records at the
    SAME ubicacion on the same day are a correction (latest wins, not summed);
    two records at DIFFERENT ubicaciones (e.g. BRU1 + BRU2) are genuinely
    additive."""
    by_loc: dict = {}
    for r in records:
        by_loc[r.ubicacion] = r.cantidad
    return sum(by_loc.values())


def _stock_actual_leaf(ingrediente_id: int, db: Session) -> Optional[dict]:
    """Get latest stock for a single (leaf) ingredient.
    Café (cat 5): sums same-day records per distinct ubicacion (BRU1 + BRU2),
    with same-ubicacion same-day duplicates treated as a correction.
    Other: takes the last record of the latest day (correction overwrites).

    Also returns `fecha_conteo`: the date of the latest MANUAL count record,
    excluding "Pedido recibido" inserts. stock_actual() uses this (instead of
    the raw latest date) to decide whether this leaf was part of the group's
    latest counting session — receiving an order for one flavor must not
    fake a new session that zeroes out siblings that weren't in that delivery.
    """
    ultimo = (
        db.query(InventarioRegistro)
        .filter(InventarioRegistro.ingrediente_id == ingrediente_id)
        .order_by(InventarioRegistro.fecha_registro.desc(), InventarioRegistro.id.desc())
        .first()
    )
    if not ultimo:
        return None

    ing = db.query(Ingrediente).get(ingrediente_id)
    is_cafe = ing and ing.categoria_id == CAFE_CATEGORIA_ID
    es_recibido = _es_pedido_recibido(ultimo)

    if is_cafe:
        registros_dia = (
            db.query(InventarioRegistro)
            .filter(
                InventarioRegistro.ingrediente_id == ingrediente_id,
                InventarioRegistro.fecha_registro == ultimo.fecha_registro,
            )
            .order_by(InventarioRegistro.id.asc())
            .all()
        )
        cantidad = _day_total(registros_dia)
    else:
        cantidad = ultimo.cantidad

    fecha_conteo = ultimo.fecha_registro
    if es_recibido:
        historial = (
            db.query(InventarioRegistro)
            .filter(InventarioRegistro.ingrediente_id == ingrediente_id)
            .order_by(InventarioRegistro.fecha_registro.desc(), InventarioRegistro.id.desc())
            .all()
        )
        conteo = next((r for r in historial if not _es_pedido_recibido(r)), None)
        fecha_conteo = conteo.fecha_registro if conteo else None

    return {
        "cantidad": cantidad,
        "unidad": ultimo.unidad,
        "ubicacion": ultimo.ubicacion,
        "fecha": ultimo.fecha_registro,
        "fecha_conteo": fecha_conteo,
        "es_recibido": es_recibido,
    }


CAFE_CATEGORIA_ID = 5

def stock_actual(ingrediente_id: int, db: Session) -> Optional[dict]:
    """Get latest stock. If parent, sum latest stock of all children.
    For café (categoria_id=5), including frozen tube flavor groups: a flavor
    left blank on count day is 0, not carried forward — only children counted
    (by a manual count) on the most recent count session contribute to the
    total. "Pedido recibido" inserts never define that session themselves —
    a flavor bumped by a received order always contributes its current value.
    For other categories: use each child's last known stock."""
    children = _child_ids(ingrediente_id, db)
    if not children:
        return _stock_actual_leaf(ingrediente_id, db)

    ing = db.query(Ingrediente).get(ingrediente_id)
    zero_if_uncounted = ing and ing.categoria_id == CAFE_CATEGORIA_ID

    child_stocks = []
    latest_fecha = None
    latest_fecha_conteo = None
    for child_id in children:
        stk = _stock_actual_leaf(child_id, db)
        child_stocks.append(stk)
        if stk:
            if latest_fecha is None or stk["fecha"] > latest_fecha:
                latest_fecha = stk["fecha"]
            if stk["fecha_conteo"] and (
                latest_fecha_conteo is None or stk["fecha_conteo"] > latest_fecha_conteo
            ):
                latest_fecha_conteo = stk["fecha_conteo"]

    if latest_fecha is None:
        return None

    total = 0.0
    unidad = None
    for stk in child_stocks:
        if stk:
            if unidad is None:
                unidad = stk["unidad"]
            if zero_if_uncounted:
                if stk["es_recibido"] or stk["fecha_conteo"] == latest_fecha_conteo:
                    total += stk["cantidad"]
            else:
                total += stk["cantidad"]

    if unidad is None:
        return None

    return {
        "cantidad": round(total, 3),
        "unidad": unidad,
        "fecha": latest_fecha,
    }


def stock_base_recepcion_pedido(ingrediente_id: int, db: Session) -> dict:
    """Effective current stock for a single leaf ingredient, used as the
    baseline when adding stock from a received order (recibir_pedido). For
    café items in a synchronized counting group, applies the same
    "zero if not counted in the group's latest session" rule as stock_actual()
    — so a flavor that was blank (0) in the last count doesn't inherit a
    stale pre-zero quantity just because its own last raw record predates
    that session. Falls back to the leaf's raw last known value otherwise."""
    leaf = _stock_actual_leaf(ingrediente_id, db)
    if not leaf:
        return {"cantidad": 0.0, "unidad": None, "ubicacion": None}

    ing = db.query(Ingrediente).get(ingrediente_id)
    if not (ing and ing.categoria_id == CAFE_CATEGORIA_ID and ing.grupo_ingrediente_id):
        return leaf
    if leaf["es_recibido"]:
        return leaf

    latest_fecha_conteo = None
    for sib_id in _child_ids(ing.grupo_ingrediente_id, db):
        sib = _stock_actual_leaf(sib_id, db)
        if sib and sib["fecha_conteo"] and (
            latest_fecha_conteo is None or sib["fecha_conteo"] > latest_fecha_conteo
        ):
            latest_fecha_conteo = sib["fecha_conteo"]

    if latest_fecha_conteo is not None and leaf["fecha_conteo"] != latest_fecha_conteo:
        return {"cantidad": 0.0, "unidad": leaf["unidad"], "ubicacion": leaf["ubicacion"]}
    return leaf


def stock_historial_serie(ingrediente_id: int, db: Session) -> list[dict]:
    """Full stock-over-time series for charts, using the same semantics as
    stock_actual() at every historical date: each child's last known quantity
    as of that date, carried forward, zeroed out on café sync-count dates it
    wasn't part of. "Pedido recibido" inserts never define a sync-count date
    themselves — they only bump their own leaf's running total (mirrors the
    fecha_conteo/es_recibido logic in _stock_actual_leaf/stock_actual)."""
    children = _child_ids(ingrediente_id, db)
    ing = db.query(Ingrediente).get(ingrediente_id)
    target_ids = children or [ingrediente_id]

    zero_if_uncounted = bool(children) and ing.categoria_id == CAFE_CATEGORIA_ID

    all_registros = (
        db.query(InventarioRegistro)
        .filter(InventarioRegistro.ingrediente_id.in_(target_ids))
        .order_by(InventarioRegistro.fecha_registro.asc(), InventarioRegistro.id.asc())
        .all()
    )
    if not all_registros:
        return []

    per_child: dict[int, list] = {}
    for r in all_registros:
        per_child.setdefault(r.ingrediente_id, []).append(r)

    sum_same_day = ing.categoria_id == CAFE_CATEGORIA_ID
    dates = sorted({r.fecha_registro for r in all_registros})
    idx = {cid: 0 for cid in per_child}
    last_val: dict[int, tuple] = {cid: None for cid in per_child}  # (cantidad, fecha, es_recibido)
    last_conteo_fecha: dict[int, object] = {cid: None for cid in per_child}
    unidad = all_registros[-1].unidad
    series = []
    for d in dates:
        for cid, regs in per_child.items():
            day_date = None
            day_records: list = []
            while idx[cid] < len(regs) and regs[idx[cid]].fecha_registro <= d:
                r = regs[idx[cid]]
                if day_date is None or r.fecha_registro != day_date:
                    day_date = r.fecha_registro
                    day_records = [r]
                elif sum_same_day:
                    day_records.append(r)
                else:
                    day_records = [r]
                idx[cid] += 1
            if day_date is not None:
                day_total = _day_total(day_records) if sum_same_day else day_records[-1].cantidad
                es_recibido = all(_es_pedido_recibido(r) for r in day_records)
                last_val[cid] = (day_total, day_date, es_recibido)
                if not es_recibido:
                    last_conteo_fecha[cid] = day_date
        latest_fecha_conteo = max(
            (f for f in last_conteo_fecha.values() if f is not None), default=None
        )
        total = 0.0
        for cid, val in last_val.items():
            if val is None:
                continue
            cantidad, fecha, es_recibido = val
            if zero_if_uncounted and not es_recibido and last_conteo_fecha[cid] != latest_fecha_conteo:
                continue
            total += cantidad
        series.append({"fecha": str(d), "cantidad": round(total, 2), "unidad": unidad})
    return series


def stock_por_ubicacion(ingrediente_id: int, db: Session) -> dict:
    """Return stock breakdown by location for items with ubicacion data.

    Returns dict like {"BRU1": {"cantidad": 5, "unidad": "kg"}, "BRU2": {"cantidad": 3, "unidad": "kg"}}.
    For items without location data, returns empty dict.
    Also aggregates children if the ingredient is a parent.
    """
    target_ids = _child_ids(ingrediente_id, db) or [ingrediente_id]

    result: dict[str, dict] = {}
    for tid in target_ids:
        # Get the latest inventory record per location for this ingredient
        registros = (
            db.query(InventarioRegistro)
            .filter(
                InventarioRegistro.ingrediente_id == tid,
                InventarioRegistro.ubicacion.isnot(None),
            )
            .order_by(InventarioRegistro.fecha_registro.desc())
            .all()
        )
        seen_locations: set[str] = set()
        for r in registros:
            loc = r.ubicacion
            if loc not in seen_locations:
                seen_locations.add(loc)
                if loc not in result:
                    result[loc] = {"cantidad": 0.0, "unidad": r.unidad}
                result[loc]["cantidad"] += r.cantidad

    # Round quantities
    for loc in result:
        result[loc]["cantidad"] = round(result[loc]["cantidad"], 3)

    return result


def movimientos_ingrediente(ingrediente_id: int, db: Session) -> list[dict]:
    """Combined +/- movement feed for an ingredient (or all its children, if
    it's a parent group like the frozen-tube "Tubos Frozen Bru1/Bru2").

    Three real sources, merged and sorted by date (most recent first):
    - "pedido": a received order line (real, positive) — cantidad_recibida.
    - "merma": a waste record (real, negative) — cantidad.
    - "conteo": a manual inventory count (inferred), shown as the delta vs
      the previous manual count for that same leaf. "Pedido recibido" inserts
      are excluded here — they're already surfaced as "pedido" events, and
      including them would both double-count and inflate the next real
      count's delta. Free-text notas (e.g. a hand-written "Traspaso...") are
      passed through as `detalle` so transfers are still visible, even
      though they aren't classified as their own event type.

    Each item also includes `sabor` (the leaf's own nombre) when the target
    has children, so a combined feed across flavors can be told apart.
    """
    children = _child_ids(ingrediente_id, db)
    target_ids = children or [ingrediente_id]
    nombres = (
        {i.id: i.nombre for i in db.query(Ingrediente).filter(Ingrediente.id.in_(target_ids)).all()}
        if children
        else {}
    )

    eventos: list[dict] = []

    conteos = (
        db.query(InventarioRegistro)
        .filter(InventarioRegistro.ingrediente_id.in_(target_ids))
        .order_by(InventarioRegistro.ingrediente_id, InventarioRegistro.fecha_registro.asc(), InventarioRegistro.id.asc())
        .all()
    )
    # The InventarioRegistro row a "Pedido recibido" insert creates already
    # holds the resulting stock total — reuse it as `cantidad_actual` for the
    # matching "pedido" event below instead of recomputing it.
    stock_tras_recibido: dict[tuple[int, str], float] = {
        (r.ingrediente_id, str(r.fecha_registro)): r.cantidad
        for r in conteos
        if _es_pedido_recibido(r)
    }

    pedidos = (
        db.query(LineaPedido, Pedido)
        .join(Pedido, LineaPedido.pedido_id == Pedido.id)
        .filter(
            LineaPedido.ingrediente_id.in_(target_ids),
            Pedido.estado == "recibido",
            LineaPedido.cantidad_recibida.isnot(None),
            LineaPedido.cantidad_recibida > 0,
        )
        .all()
    )
    for linea, pedido in pedidos:
        fecha = str(pedido.fecha_recepcion or pedido.fecha)
        eventos.append({
            "fecha": fecha,
            "tipo": "pedido",
            "cantidad": linea.cantidad_recibida,
            "unidad": linea.unidad,
            "detalle": f"Pedido #{pedido.id} — {pedido.proveedor}",
            "sabor": nombres.get(linea.ingrediente_id),
            "cantidad_actual": stock_tras_recibido.get((linea.ingrediente_id, fecha)),
        })

    mermas = (
        db.query(MermaRegistro)
        .filter(MermaRegistro.ingrediente_id.in_(target_ids))
        .all()
    )
    for m in mermas:
        eventos.append({
            "fecha": str(m.fecha),
            "tipo": "merma",
            "cantidad": -m.cantidad,
            "unidad": m.unidad,
            "detalle": m.notas or m.motivo,
            "sabor": nombres.get(m.ingrediente_id),
            "cantidad_actual": None,
        })

    anterior: dict[int, InventarioRegistro] = {}
    for r in conteos:
        prev = anterior.get(r.ingrediente_id)
        if _es_pedido_recibido(r):
            # Already surfaced as its own "pedido" event above — still update
            # the running baseline so the NEXT manual count's delta reflects
            # only what changed since the delivery, not the delivery itself.
            anterior[r.ingrediente_id] = r
            continue
        if prev is not None and prev.fecha_registro == r.fecha_registro:
            # Same-day correction (not a new session) — replace, don't diff.
            anterior[r.ingrediente_id] = r
            continue
        delta = r.cantidad - (prev.cantidad if prev else 0)
        eventos.append({
            "fecha": str(r.fecha_registro),
            "tipo": "conteo",
            "cantidad": round(delta, 3),
            "unidad": r.unidad,
            "detalle": r.notas,
            "cantidad_actual": r.cantidad,
            "sabor": nombres.get(r.ingrediente_id),
        })
        anterior[r.ingrediente_id] = r

    eventos.sort(key=lambda e: e["fecha"], reverse=True)
    return eventos


FROZEN_TUBE_PARENT_BY_UBICACION = {"BRU1": 289, "BRU2": 290}  # Tubos Frozen Bru1 / Bru2


def historial_frozen_por_ubicacion(ubicacion: str, db: Session) -> dict:
    """Daily pivot of frozen-tube flavor stock at a single location (BRU1 or
    BRU2), for the "Historial de Conteos" table on ingredientes/289 and /290.

    Location is determined by which parent a flavor belongs to (289=Bru1,
    290=Bru2) — every frozen flavor has two separate child ingredients, one
    per location (e.g. "Frozen Ethiopia Karamo Bru1" id 375 under 289, and
    "Frozen Ethiopia Karamo Bru2" id 387 under 290) — NOT by the `ubicacion`
    column on InventarioRegistro/MermaRegistro. That column is unreliable for
    these ingredients: a delivery received via recibir_pedido() inherits
    whatever ubicacion the ingredient's last record had, so once one manual
    count is entered without setting it, every subsequent auto-inserted
    "Pedido recibido" row keeps inheriting a null ubicacion forever after —
    which is exactly what silently hid Karamo/Perla's 2026-08-20 delivery
    from this table (its InventarioRegistro existed, cantidad_actual and
    all, just with ubicacion=None instead of 'BRU1'/'BRU2'). Since each
    flavor's location is already fully determined by which of the two
    per-location ingredients a record was saved against, that column simply
    isn't needed to scope this query.

    Flavors are identified via grupo_ingrediente_id (same structural relation
    movimientos_ingrediente uses for the "Movimientos" table on the same
    page) — NOT via `suplemento_frozen` (a pricing field that can be unset
    for a flavor that's still actively counted, e.g. the documented "Frozen
    Nicaragua El Suspiro missing frozen pricing columns" gap; filtering on it
    silently dropped any such flavor's counts from this table).

    Only `activo=True` flavors are included, matching the "Stock Frozen
    Tubes" comparison table above it on the same page (backed by
    /api/menu/frozen, also active-only) — a discontinued flavor keeps its
    historical InventarioRegistro rows for cost/records purposes, but
    shouldn't keep showing up in a table meant to reflect what's currently
    being counted.

    Each date column is every day with a movement (count, order, or waste)
    for ANY flavor at this location — not weekly-sampled like the /inventario
    historial tab. A flavor that wasn't part of the location's most recent
    synchronized counting session shows 0 for that date rather than its
    stale prior value — same "zero if not counted in the latest session"
    rule stock_actual()/stock_historial_serie() already apply for café (see
    CLAUDE.md "Inventory Stock Rules"), just kept per-flavor here instead of
    summed into one total. Receiving an order is exempt from this — a
    delivery always shows the flavor's own bumped total, matching
    stock_actual()'s es_recibido carve-out (a delivery for one flavor must
    not make it look "missed" just because it wasn't part of a manual count).
    """
    parent_id = FROZEN_TUBE_PARENT_BY_UBICACION.get(ubicacion)
    tubo_ids_set = set(_child_ids(parent_id, db)) if parent_id else set()
    if not tubo_ids_set:
        return {"ubicacion": ubicacion, "fechas": [], "sabores": []}

    tubos = (
        db.query(Ingrediente)
        .filter(Ingrediente.id.in_(tubo_ids_set), Ingrediente.activo.is_(True))
        .all()
    )
    # Same ordering as "Stock Frozen Tubes" (/api/menu/frozen): most expensive
    # first, by coste_kg_frozen, treating missing cost as 0.
    tubos.sort(key=lambda t: -(t.coste_kg_frozen or 0))
    tubo_ids = [t.id for t in tubos]
    nombres = {t.id: t.nombre for t in tubos}

    registros = (
        db.query(InventarioRegistro)
        .filter(InventarioRegistro.ingrediente_id.in_(tubo_ids))
        .order_by(InventarioRegistro.ingrediente_id, InventarioRegistro.fecha_registro.asc(), InventarioRegistro.id.asc())
        .all()
    )
    mermas = (
        db.query(MermaRegistro)
        .filter(MermaRegistro.ingrediente_id.in_(tubo_ids))
        .all()
    )

    per_child_days: dict[int, dict] = {}
    for r in registros:
        # Later id on the same day overwrites — same-day correction, not a
        # second event. Each of these ingredients is already single-location
        # by construction (see docstring), so unlike _day_total elsewhere,
        # same-day records are never summed across ubicaciones here.
        per_child_days.setdefault(r.ingrediente_id, {})[r.fecha_registro] = r

    mermas_by_child_day: dict[tuple, list] = {}
    for m in mermas:
        mermas_by_child_day.setdefault((m.ingrediente_id, m.fecha), []).append(m)

    fechas = sorted(
        {d for days in per_child_days.values() for d in days}
        | {d for (_cid, d) in mermas_by_child_day}
    )

    # Walk dates chronologically, tracking each flavor's last known value and
    # last REAL (non-pedido) count date, to determine the location's latest
    # synchronized counting session at each point in time — mirrors
    # stock_historial_serie()'s per-child bookkeeping, kept unsummed.
    last_val: dict[int, tuple] = {}  # tid -> (cantidad, es_recibido)
    last_conteo_fecha: dict[int, object] = {}
    per_child_valores: dict[int, dict] = {tid: {} for tid in tubo_ids}
    for d in fechas:
        for tid in tubo_ids:
            r = per_child_days.get(tid, {}).get(d)
            if r is None:
                continue
            es_recibido = _es_pedido_recibido(r)
            last_val[tid] = (r.cantidad, es_recibido)
            if not es_recibido:
                last_conteo_fecha[tid] = d

        latest_fecha_conteo = max(
            (f for f in last_conteo_fecha.values() if f is not None), default=None
        )

        for tid in tubo_ids:
            val = last_val.get(tid)
            if val is None:
                cantidad = None  # never counted yet at this location
            else:
                cantidad_val, es_recibido = val
                if es_recibido or last_conteo_fecha.get(tid) == latest_fecha_conteo:
                    cantidad = cantidad_val
                else:
                    cantidad = 0.0  # not part of the latest session

            eventos = []
            r = per_child_days.get(tid, {}).get(d)
            if r is not None and _es_pedido_recibido(r):
                eventos.append({"tipo": "pedido", "detalle": r.notas, "cantidad": None})
            for m in mermas_by_child_day.get((tid, d), []):
                eventos.append({"tipo": "merma", "detalle": m.notas or m.motivo, "cantidad": -m.cantidad})

            per_child_valores[tid][str(d)] = {"cantidad": cantidad, "eventos": eventos}

    sabores = []
    for tid in tubo_ids:
        valores = per_child_valores[tid]
        has_data = any(v["cantidad"] is not None or v["eventos"] for v in valores.values())
        if not has_data:
            continue
        days = per_child_days.get(tid, {})
        unidad = days[max(days)].unidad if days else None
        sabores.append({
            "ingrediente_id": tid,
            "nombre": nombres[tid],
            "unidad": unidad,
            "valores": valores,
        })

    return {"ubicacion": ubicacion, "fechas": [str(d) for d in fechas], "sabores": sabores}


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
    ing = db.query(Ingrediente).get(ingrediente_id)
    if ing and ing.par_level_override is not None:
        media = consumo_medio_semanal(ingrediente_id, db)
        return {
            "cycle_weeks": 1.0,
            "lead_weeks": None,
            "safety_stock": 0,
            "par_level": ing.par_level_override,
        }

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


def consumo_medio_batch(
    ingrediente_ids: List[int], db: Session, semanas: int = 8
) -> Dict[int, dict]:
    """Batch-compute weekly consumption mean and trend for many leaf ingredients.

    Returns {ingrediente_id: {"consumo_medio": float, "tendencia": str}}.
    Uses 3 bulk queries instead of 3×N individual ones.
    """
    if not ingrediente_ids:
        return {}

    most_recent = (
        db.query(func.max(Pedido.fecha_recepcion))
        .filter(Pedido.estado == "recibido")
        .scalar()
    )
    if not most_recent:
        return {iid: {"consumo_medio": 0.0, "tendencia": "estable"} for iid in ingrediente_ids}

    inicio = most_recent - timedelta(weeks=semanas)

    # Bulk load inventory records
    all_inv = (
        db.query(InventarioRegistro)
        .filter(
            InventarioRegistro.ingrediente_id.in_(ingrediente_ids),
            InventarioRegistro.fecha_registro >= inicio,
        )
        .order_by(InventarioRegistro.fecha_registro)
        .all()
    )
    inv_by_id: Dict[int, list] = {iid: [] for iid in ingrediente_ids}
    for r in all_inv:
        inv_by_id.setdefault(r.ingrediente_id, []).append(r)

    # Bulk load received orders
    all_orders = (
        db.query(
            LineaPedido.ingrediente_id,
            LineaPedido.cantidad_recibida,
            LineaPedido.unidad,
            Pedido.fecha_recepcion,
        )
        .join(Pedido)
        .filter(
            LineaPedido.ingrediente_id.in_(ingrediente_ids),
            Pedido.estado == "recibido",
            Pedido.fecha_recepcion >= inicio,
            LineaPedido.cantidad_recibida.isnot(None),
        )
        .all()
    )
    orders_by_id: Dict[int, list] = {iid: [] for iid in ingrediente_ids}
    for ing_id, qty, unit, fecha in all_orders:
        orders_by_id.setdefault(ing_id, []).append((qty, unit, fecha))

    # Bulk load ingredients for unit info
    ings = db.query(Ingrediente).filter(Ingrediente.id.in_(ingrediente_ids)).all()
    ing_map = {i.id: i for i in ings}

    result: Dict[int, dict] = {}
    for iid in ingrediente_ids:
        ing = ing_map.get(iid)
        if ing and ing.consumo_override_semanal is not None:
            result[iid] = {
                "consumo_medio": round(ing.consumo_override_semanal, 2),
                "tendencia": "estable",
            }
            continue

        raw_inv = inv_by_id.get(iid, [])
        filtered = [r for r in raw_inv if not (r.notas and "recibido" in r.notas.lower())]
        target_unit = raw_inv[-1].unidad if raw_inv else (ing.unidad_compra if ing else "unidad")

        # Aggregate same-day records
        day_sums: OrderedDict[date, float] = OrderedDict()
        day_units: dict[date, str] = {}
        for r in filtered:
            day_sums[r.fecha_registro] = day_sums.get(r.fecha_registro, 0) + r.cantidad
            if r.fecha_registro not in day_units:
                day_units[r.fecha_registro] = r.unidad

        inventarios = [
            type("R", (), {"fecha_registro": f, "cantidad": q, "unidad": day_units[f]})
            for f, q in day_sums.items()
        ]

        pedidos = orders_by_id.get(iid, [])
        semana_data: dict[str, float] = {}

        if inventarios and len(inventarios) >= 2:
            pass
        else:
            for qty, order_unit, fecha in pedidos:
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
                for qty_r, unit_r, fecha_r in pedidos:
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

        historial = [
            {"semana": key, "cantidad": round(semana_data[key], 2)}
            for key in sorted(semana_data.keys())
        ]

        if historial:
            consumo_medio = round(sum(h["cantidad"] for h in historial) / len(historial), 2)
        else:
            consumo_medio = 0.0

        result[iid] = {
            "consumo_medio": consumo_medio,
            "tendencia": tendencia_consumo(historial),
        }

    return result
