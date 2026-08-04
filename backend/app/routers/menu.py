import re
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
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


def _latest_stock(ingrediente_id: int, db: Session) -> float:
    """Return the sum of quantities from the latest inventory date for an ingredient."""
    max_fecha = (
        db.query(func.max(InventarioRegistro.fecha_registro))
        .filter(InventarioRegistro.ingrediente_id == ingrediente_id)
        .scalar()
    )
    if max_fecha is None:
        return 0.0
    rows = (
        db.query(InventarioRegistro.cantidad)
        .filter(
            InventarioRegistro.ingrediente_id == ingrediente_id,
            InventarioRegistro.fecha_registro == max_fecha,
        )
        .all()
    )
    return sum(r[0] for r in rows)


def _has_pending_order(ingrediente_id: int, db: Session) -> bool:
    """Check if there is a pending order line for the given ingredient."""
    count = (
        db.query(LineaPedido.id)
        .join(Pedido, LineaPedido.pedido_id == Pedido.id)
        .filter(
            LineaPedido.ingrediente_id == ingrediente_id,
            Pedido.estado.in_(["borrador", "enviado"]),
        )
        .limit(1)
        .count()
    )
    return count > 0


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

    result = []
    for name, tubes in groups.items():
        # Use the first tube's values (they should be the same across Bru1/Bru2)
        representative = tubes[0]
        coste_kg = representative.coste_kg_frozen or 0.0
        supplement = representative.suplemento_frozen or 0.0

        # Check visibility:
        # a) Sum stock of all frozen tube variants
        tube_stock = sum(_latest_stock(t.id, db) for t in tubes)

        # b) Check source bag stock via frozen_origen_id
        source_ids = {t.frozen_origen_id for t in tubes if t.frozen_origen_id is not None}
        source_stock = sum(_latest_stock(sid, db) for sid in source_ids)

        # c) Check pending orders for source bag ingredients
        has_pending = any(_has_pending_order(sid, db) for sid in source_ids)

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
        # Stock data for the cafe catalog page
        bru1_tubes = [t for t in tubes if "bru1" in t.nombre.lower()]
        bru2_tubes = [t for t in tubes if "bru2" in t.nombre.lower()]
        item["stock_bru1"] = sum(_latest_stock(t.id, db) for t in bru1_tubes)
        item["stock_bru2"] = sum(_latest_stock(t.id, db) for t in bru2_tubes)
        item["stock_bolsa"] = source_stock
        item["disponible"] = visible
        result.append(item)

    # Sort by coste_kg_frozen DESC (most expensive first)
    result.sort(key=lambda x: -(x.get("coste_kg_frozen") or 0))

    # Add constants and rename internal field
    for item in result:
        item["doppio_pvp"] = 3.90
        item["doppio_cost"] = 0.41
        item["grams_per_tube"] = 19
        item["chf_per_kg"] = round(item.pop("coste_kg_frozen"), 2)

    return result
