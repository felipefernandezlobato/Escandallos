from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import Categoria, HistorialPrecio, Ingrediente, LineaReceta, Receta
from app.schemas import AlertaOut, RankingItem, TendenciaItem
from app.services.costes import coste_por_racion, coste_total_receta, margen_real

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/alertas", response_model=list[AlertaOut])
def obtener_alertas(db: Session = Depends(get_db), user=Depends(get_current_user)):
    alertas: list[AlertaOut] = []

    recetas = (
        db.query(Receta)
        .options(
            joinedload(Receta.categoria_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.ingrediente_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.subreceta_rel),
        )
        .filter(Receta.es_subreceta == False)
        .all()
    )
    for r in recetas:
        if not r.precio_venta:
            alertas.append(AlertaOut(
                tipo="sin_precio",
                mensaje=f"'{r.nombre}' no tiene precio de venta definido",
                receta_id=r.id,
            ))
            continue
        mr = margen_real(r, db)
        if mr is not None and r.categoria_rel and r.categoria_rel.margen_objetivo:
            if mr < r.categoria_rel.margen_objetivo:
                alertas.append(AlertaOut(
                    tipo="margen_bajo",
                    mensaje=f"'{r.nombre}' tiene margen {mr:.1f}% (objetivo: {r.categoria_rel.margen_objetivo:.0f}%)",
                    receta_id=r.id,
                ))

    cambios_recientes = (
        db.query(HistorialPrecio)
        .options(joinedload(HistorialPrecio.ingrediente_rel))
        .order_by(HistorialPrecio.fecha_cambio.desc())
        .limit(10)
        .all()
    )
    for h in cambios_recientes:
        ing = h.ingrediente_rel
        if ing:
            diff = ((h.precio_nuevo - h.precio_anterior) / h.precio_anterior * 100) if h.precio_anterior else 0
            alertas.append(AlertaOut(
                tipo="precio_cambio",
                mensaje=f"'{ing.nombre}' cambió de {h.precio_anterior:.2f}€ a {h.precio_nuevo:.2f}€ ({diff:+.1f}%)",
                ingrediente_id=ing.id,
            ))

    return alertas


@router.get("/rankings", response_model=list[RankingItem])
def obtener_rankings(
    categoria_id: Optional[int] = None,
    orden: str = "margen_desc",
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(Receta).options(
        joinedload(Receta.categoria_rel),
        joinedload(Receta.lineas).joinedload(LineaReceta.ingrediente_rel),
        joinedload(Receta.lineas).joinedload(LineaReceta.subreceta_rel),
    ).filter(Receta.es_subreceta == False)

    if categoria_id:
        q = q.filter(Receta.categoria_id == categoria_id)

    recetas = q.all()
    items = []
    for r in recetas:
        cpp = coste_por_racion(r, db)
        mr = margen_real(r, db)
        items.append(RankingItem(
            id=r.id,
            nombre=r.nombre,
            categoria=r.categoria_rel.nombre if r.categoria_rel else "",
            coste_por_porcion=round(cpp, 4),
            precio_venta=r.precio_venta,
            margen=round(mr, 2) if mr is not None else None,
        ))

    if orden == "margen_desc":
        items.sort(key=lambda x: x.margen if x.margen is not None else -999, reverse=True)
    elif orden == "margen_asc":
        items.sort(key=lambda x: x.margen if x.margen is not None else 999)
    elif orden == "coste_desc":
        items.sort(key=lambda x: x.coste_por_porcion, reverse=True)
    elif orden == "coste_asc":
        items.sort(key=lambda x: x.coste_por_porcion)

    return items


@router.get("/tendencias", response_model=list[TendenciaItem])
def obtener_tendencias(
    ingrediente_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(HistorialPrecio).options(
        joinedload(HistorialPrecio.ingrediente_rel)
    ).order_by(HistorialPrecio.fecha_cambio.asc())
    if ingrediente_id:
        q = q.filter(HistorialPrecio.ingrediente_id == ingrediente_id)
    historial = q.limit(200).all()

    items = []
    for h in historial:
        ing = h.ingrediente_rel
        nombre = ing.nombre if ing else "?"
        items.append(TendenciaItem(
            fecha=str(h.fecha_cambio) if h.fecha_cambio else "",
            valor=h.precio_nuevo,
            nombre=nombre,
        ))
    return items
