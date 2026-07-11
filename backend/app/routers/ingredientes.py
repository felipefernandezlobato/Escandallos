from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Categoria, HistorialPrecio, Ingrediente, LineaReceta, Receta
from app.schemas import (
    HistorialPrecioOut,
    IngredienteCreate,
    IngredienteOut,
    IngredienteUpdate,
    RecetaOut,
)
from app.services.costes import (
    coste_por_racion,
    coste_por_unidad_uso,
    coste_total_receta,
    margen_real,
    recetas_afectadas_por_ingrediente,
)

router = APIRouter(prefix="/api/ingredientes", tags=["ingredientes"])


def _to_out(ing: Ingrediente, db: Session) -> dict:
    num_recetas = (
        db.query(LineaReceta)
        .filter(LineaReceta.ingrediente_id == ing.id)
        .count()
    )
    cat_nombre = ""
    if ing.categoria_rel:
        cat_nombre = ing.categoria_rel.nombre
    cpu = 0.0
    try:
        cpu = coste_por_unidad_uso(ing)
    except (ValueError, ZeroDivisionError):
        pass
    return {
        **{c.key: getattr(ing, c.key) for c in Ingrediente.__table__.columns},
        "coste_por_unidad_uso": round(cpu, 6),
        "num_recetas": num_recetas,
        "categoria_nombre": cat_nombre,
    }


@router.get("", response_model=list[IngredienteOut])
def listar_ingredientes(
    categoria_id: Optional[int] = None,
    buscar: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Ingrediente).options(joinedload(Ingrediente.categoria_rel))
    if categoria_id:
        q = q.filter(Ingrediente.categoria_id == categoria_id)
    if buscar:
        q = q.filter(Ingrediente.nombre.ilike(f"%{buscar}%"))
    ingredientes = q.order_by(Ingrediente.nombre).all()
    return [_to_out(ing, db) for ing in ingredientes]


@router.get("/{ingrediente_id}", response_model=IngredienteOut)
def obtener_ingrediente(ingrediente_id: int, db: Session = Depends(get_db)):
    ing = (
        db.query(Ingrediente)
        .options(joinedload(Ingrediente.categoria_rel))
        .filter(Ingrediente.id == ingrediente_id)
        .first()
    )
    if not ing:
        raise HTTPException(404, "Ingrediente no encontrado")
    return _to_out(ing, db)


@router.post("", response_model=IngredienteOut, status_code=201)
def crear_ingrediente(data: IngredienteCreate, db: Session = Depends(get_db)):
    cat = db.get(Categoria, data.categoria_id)
    if not cat:
        raise HTTPException(400, "Categoría no encontrada")
    ing = Ingrediente(**data.model_dump(), fecha_actualizacion=date.today())
    db.add(ing)
    db.commit()
    db.refresh(ing)
    ing = (
        db.query(Ingrediente)
        .options(joinedload(Ingrediente.categoria_rel))
        .filter(Ingrediente.id == ing.id)
        .first()
    )
    return _to_out(ing, db)


@router.put("/{ingrediente_id}", response_model=IngredienteOut)
def actualizar_ingrediente(
    ingrediente_id: int, data: IngredienteUpdate, db: Session = Depends(get_db)
):
    ing = (
        db.query(Ingrediente)
        .options(joinedload(Ingrediente.categoria_rel))
        .filter(Ingrediente.id == ingrediente_id)
        .first()
    )
    if not ing:
        raise HTTPException(404, "Ingrediente no encontrado")

    updates = data.model_dump(exclude_unset=True)
    precio_cambio = "precio_compra" in updates and updates["precio_compra"] != ing.precio_compra

    if precio_cambio:
        historial = HistorialPrecio(
            ingrediente_id=ing.id,
            precio_anterior=ing.precio_compra,
            precio_nuevo=updates["precio_compra"],
        )
        db.add(historial)

    for key, val in updates.items():
        setattr(ing, key, val)
    ing.fecha_actualizacion = date.today()
    db.commit()

    if precio_cambio or "merma_porcentaje" in updates or "cantidad_compra" in updates:
        _recalcular_cascada(ing.id, db)

    db.refresh(ing)
    return _to_out(ing, db)


@router.delete("/{ingrediente_id}")
def eliminar_ingrediente(ingrediente_id: int, db: Session = Depends(get_db)):
    ing = db.get(Ingrediente, ingrediente_id)
    if not ing:
        raise HTTPException(404, "Ingrediente no encontrado")
    num_recetas = (
        db.query(LineaReceta)
        .filter(LineaReceta.ingrediente_id == ingrediente_id)
        .count()
    )
    if num_recetas > 0:
        raise HTTPException(
            400,
            f"No se puede eliminar: se usa en {num_recetas} receta(s)",
        )
    db.delete(ing)
    db.commit()
    return {"ok": True}


@router.get("/{ingrediente_id}/historial", response_model=list[HistorialPrecioOut])
def historial_precios(ingrediente_id: int, db: Session = Depends(get_db)):
    ing = db.get(Ingrediente, ingrediente_id)
    if not ing:
        raise HTTPException(404, "Ingrediente no encontrado")
    return (
        db.query(HistorialPrecio)
        .filter(HistorialPrecio.ingrediente_id == ingrediente_id)
        .order_by(HistorialPrecio.fecha_cambio.desc())
        .all()
    )


@router.get("/{ingrediente_id}/recetas", response_model=list[RecetaOut])
def recetas_con_ingrediente(ingrediente_id: int, db: Session = Depends(get_db)):
    ing = db.get(Ingrediente, ingrediente_id)
    if not ing:
        raise HTTPException(404, "Ingrediente no encontrado")
    recetas = recetas_afectadas_por_ingrediente(ingrediente_id, db)
    result = []
    for r in recetas:
        r = (
            db.query(Receta)
            .options(joinedload(Receta.categoria_rel))
            .filter(Receta.id == r.id)
            .first()
        )
        ct = coste_total_receta(r, db)
        cpp = coste_por_racion(r, db)
        mr = margen_real(r, db)
        result.append({
            **{c.key: getattr(r, c.key) for c in Receta.__table__.columns},
            "coste_total": round(ct, 4),
            "coste_por_porcion": round(cpp, 4),
            "margen_real": round(mr, 2) if mr is not None else None,
            "categoria_nombre": r.categoria_rel.nombre if r.categoria_rel else "",
        })
    return result


def _recalcular_cascada(ingrediente_id: int, db: Session):
    recetas = recetas_afectadas_por_ingrediente(ingrediente_id, db)
    for receta in recetas:
        ct = coste_total_receta(receta, db)
        cpp = coste_por_racion(receta, db)
        receta.coste_total = ct
        receta.coste_por_porcion = cpp
    db.commit()
