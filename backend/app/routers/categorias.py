from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Categoria
from app.schemas import CategoriaCreate, CategoriaOut, CategoriaUpdate

router = APIRouter(prefix="/api/categorias", tags=["categorias"])


@router.get("", response_model=list[CategoriaOut])
def listar_categorias(tipo: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Categoria)
    if tipo:
        q = q.filter(Categoria.tipo == tipo)
    return q.order_by(Categoria.nombre).all()


@router.get("/{categoria_id}", response_model=CategoriaOut)
def obtener_categoria(categoria_id: int, db: Session = Depends(get_db)):
    cat = db.get(Categoria, categoria_id)
    if not cat:
        raise HTTPException(404, "Categoría no encontrada")
    return cat


@router.post("", response_model=CategoriaOut, status_code=201)
def crear_categoria(data: CategoriaCreate, db: Session = Depends(get_db)):
    existing = db.query(Categoria).filter(Categoria.nombre == data.nombre).first()
    if existing:
        raise HTTPException(400, "Ya existe una categoría con ese nombre")
    cat = Categoria(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{categoria_id}", response_model=CategoriaOut)
def actualizar_categoria(
    categoria_id: int, data: CategoriaUpdate, db: Session = Depends(get_db)
):
    cat = db.get(Categoria, categoria_id)
    if not cat:
        raise HTTPException(404, "Categoría no encontrada")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(cat, key, val)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{categoria_id}")
def eliminar_categoria(categoria_id: int, db: Session = Depends(get_db)):
    cat = db.get(Categoria, categoria_id)
    if not cat:
        raise HTTPException(404, "Categoría no encontrada")
    db.delete(cat)
    db.commit()
    return {"ok": True}
