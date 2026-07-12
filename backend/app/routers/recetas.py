from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Categoria, Ingrediente, LineaReceta, Receta
from app.schemas import (
    LineaRecetaOut,
    RecetaCreate,
    RecetaDetailOut,
    RecetaOut,
    RecetaUpdate,
)
from app.services.costes import (
    coste_linea,
    coste_por_racion,
    coste_total_receta,
    margen_real,
)

router = APIRouter(prefix="/api/recetas", tags=["recetas"])


def _receta_to_out(r: Receta, db: Session) -> dict:
    ct = coste_total_receta(r, db)
    cpp = coste_por_racion(r, db)
    mr = margen_real(r, db)
    return {
        **{c.key: getattr(r, c.key) for c in Receta.__table__.columns},
        "coste_total": round(ct, 4),
        "coste_por_porcion": round(cpp, 4),
        "margen_real": round(mr, 2) if mr is not None else None,
        "categoria_nombre": r.categoria_rel.nombre if r.categoria_rel else "",
    }


def _linea_to_out(linea: LineaReceta, db: Session) -> dict:
    cl = 0.0
    try:
        cl = coste_linea(linea, db)
    except (ValueError, ZeroDivisionError):
        pass
    return {
        "id": linea.id,
        "ingrediente_id": linea.ingrediente_id,
        "subreceta_id": linea.subreceta_id,
        "cantidad": linea.cantidad,
        "unidad": linea.unidad,
        "nombre_ingrediente": linea.ingrediente_rel.nombre if linea.ingrediente_rel else None,
        "nombre_subreceta": linea.subreceta_rel.nombre if linea.subreceta_rel else None,
        "coste_linea": round(cl, 4),
    }


@router.get("", response_model=list[RecetaOut])
def listar_recetas(
    categoria_id: Optional[int] = None,
    es_subreceta: Optional[bool] = None,
    buscar: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Receta).options(
        joinedload(Receta.categoria_rel),
        joinedload(Receta.lineas).joinedload(LineaReceta.ingrediente_rel),
        joinedload(Receta.lineas).joinedload(LineaReceta.subreceta_rel),
    )
    if categoria_id:
        q = q.filter(Receta.categoria_id == categoria_id)
    if es_subreceta is not None:
        q = q.filter(Receta.es_subreceta == es_subreceta)
    if buscar:
        q = q.filter(Receta.nombre.ilike(f"%{buscar}%"))
    recetas = q.order_by(Receta.nombre).all()
    return [_receta_to_out(r, db) for r in recetas]


@router.get("/{receta_id}", response_model=RecetaDetailOut)
def obtener_receta(receta_id: int, db: Session = Depends(get_db)):
    r = (
        db.query(Receta)
        .options(
            joinedload(Receta.categoria_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.ingrediente_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.subreceta_rel),
        )
        .filter(Receta.id == receta_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Receta no encontrada")
    out = _receta_to_out(r, db)
    out["lineas"] = [_linea_to_out(l, db) for l in r.lineas]
    return out


@router.post("", response_model=RecetaDetailOut, status_code=201)
def crear_receta(data: RecetaCreate, db: Session = Depends(get_db)):
    cat = db.get(Categoria, data.categoria_id)
    if not cat:
        raise HTTPException(400, "Categoría no encontrada")

    receta = Receta(
        nombre=data.nombre,
        categoria_id=data.categoria_id,
        porciones_por_lote=data.porciones_por_lote,
        precio_venta=data.precio_venta,
        es_subreceta=data.es_subreceta,
        notas=data.notas,
    )
    db.add(receta)
    db.flush()

    for linea_data in data.lineas:
        linea = LineaReceta(
            receta_id=receta.id,
            ingrediente_id=linea_data.ingrediente_id,
            subreceta_id=linea_data.subreceta_id,
            cantidad=linea_data.cantidad,
            unidad=linea_data.unidad,
        )
        db.add(linea)

    db.commit()

    r = (
        db.query(Receta)
        .options(
            joinedload(Receta.categoria_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.ingrediente_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.subreceta_rel),
        )
        .filter(Receta.id == receta.id)
        .first()
    )

    out = _receta_to_out(r, db)
    out["lineas"] = [_linea_to_out(l, db) for l in r.lineas]
    return out


@router.put("/{receta_id}", response_model=RecetaDetailOut)
def actualizar_receta(
    receta_id: int, data: RecetaUpdate, db: Session = Depends(get_db)
):
    r = db.get(Receta, receta_id)
    if not r:
        raise HTTPException(404, "Receta no encontrada")

    updates = data.model_dump(exclude_unset=True)
    lineas_nuevas = updates.pop("lineas", None)

    for key, val in updates.items():
        setattr(r, key, val)

    if lineas_nuevas is not None:
        db.query(LineaReceta).filter(LineaReceta.receta_id == receta_id).delete()
        for linea_data in lineas_nuevas:
            linea = LineaReceta(receta_id=receta_id, **linea_data)
            db.add(linea)

    db.commit()

    r = (
        db.query(Receta)
        .options(
            joinedload(Receta.categoria_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.ingrediente_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.subreceta_rel),
        )
        .filter(Receta.id == receta_id)
        .first()
    )

    out = _receta_to_out(r, db)
    out["lineas"] = [_linea_to_out(l, db) for l in r.lineas]
    return out


@router.delete("/{receta_id}")
def eliminar_receta(receta_id: int, db: Session = Depends(get_db)):
    r = db.get(Receta, receta_id)
    if not r:
        raise HTTPException(404, "Receta no encontrada")
    used_as_sub = (
        db.query(LineaReceta)
        .filter(LineaReceta.subreceta_id == receta_id)
        .count()
    )
    if used_as_sub > 0:
        raise HTTPException(
            400,
            f"No se puede eliminar: se usa como sub-receta en {used_as_sub} receta(s)",
        )
    db.delete(r)
    db.commit()
    return {"ok": True}
