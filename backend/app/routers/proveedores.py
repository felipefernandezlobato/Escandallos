from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Ingrediente, Proveedor, PrecioProveedor

router = APIRouter(prefix="/api/proveedores", tags=["proveedores"])


class ProveedorCreate(BaseModel):
    nombre: str
    notas: Optional[str] = None


class PrecioCreate(BaseModel):
    ingrediente_id: int
    proveedor_id: int
    precio: float
    unidad: str
    cantidad: float = 1
    notas: Optional[str] = None


@router.get("")
def listar_proveedores(db: Session = Depends(get_db)):
    provs = db.query(Proveedor).order_by(Proveedor.nombre).all()
    return [{"id": p.id, "nombre": p.nombre, "notas": p.notas, "num_precios": len(p.precios)} for p in provs]


@router.post("", status_code=201)
def crear_proveedor(data: ProveedorCreate, db: Session = Depends(get_db)):
    existing = db.query(Proveedor).filter(Proveedor.nombre == data.nombre).first()
    if existing:
        return {"id": existing.id, "nombre": existing.nombre}
    p = Proveedor(nombre=data.nombre, notas=data.notas)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "nombre": p.nombre}


@router.delete("/{proveedor_id}")
def eliminar_proveedor(proveedor_id: int, db: Session = Depends(get_db)):
    p = db.get(Proveedor, proveedor_id)
    if not p:
        raise HTTPException(404, "Proveedor no encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/precios", status_code=201)
def crear_precio(data: PrecioCreate, db: Session = Depends(get_db)):
    ing = db.get(Ingrediente, data.ingrediente_id)
    if not ing:
        raise HTTPException(400, "Ingrediente no encontrado")
    prov = db.get(Proveedor, data.proveedor_id)
    if not prov:
        raise HTTPException(400, "Proveedor no encontrado")

    precio_por_unidad = data.precio / data.cantidad if data.cantidad > 0 else data.precio

    existing = (
        db.query(PrecioProveedor)
        .filter(PrecioProveedor.ingrediente_id == data.ingrediente_id,
                PrecioProveedor.proveedor_id == data.proveedor_id)
        .first()
    )
    if existing:
        existing.precio = data.precio
        existing.unidad = data.unidad
        existing.cantidad = data.cantidad
        existing.precio_por_unidad = precio_por_unidad
        existing.notas = data.notas
    else:
        pp = PrecioProveedor(
            ingrediente_id=data.ingrediente_id,
            proveedor_id=data.proveedor_id,
            precio=data.precio,
            unidad=data.unidad,
            cantidad=data.cantidad,
            precio_por_unidad=precio_por_unidad,
            notas=data.notas,
        )
        db.add(pp)
    db.commit()
    return {"ok": True, "precio_por_unidad": precio_por_unidad}


@router.get("/comparar/{ingrediente_id}")
def comparar_precios(ingrediente_id: int, db: Session = Depends(get_db)):
    ing = db.get(Ingrediente, ingrediente_id)
    if not ing:
        raise HTTPException(404, "Ingrediente no encontrado")
    precios = (
        db.query(PrecioProveedor)
        .options(joinedload(PrecioProveedor.proveedor_rel))
        .filter(PrecioProveedor.ingrediente_id == ingrediente_id)
        .order_by(PrecioProveedor.precio_por_unidad)
        .all()
    )
    return {
        "ingrediente": {"id": ing.id, "nombre": ing.nombre, "precio_actual": ing.precio_compra},
        "precios": [
            {
                "proveedor": p.proveedor_rel.nombre,
                "proveedor_id": p.proveedor_id,
                "precio": p.precio,
                "unidad": p.unidad,
                "cantidad": p.cantidad,
                "precio_por_unidad": p.precio_por_unidad,
                "fecha": str(p.fecha),
                "notas": p.notas,
            }
            for p in precios
        ],
    }


@router.get("/comparar")
def comparar_todos(db: Session = Depends(get_db)):
    precios = (
        db.query(PrecioProveedor)
        .options(
            joinedload(PrecioProveedor.proveedor_rel),
            joinedload(PrecioProveedor.ingrediente_rel),
        )
        .order_by(PrecioProveedor.ingrediente_id, PrecioProveedor.precio_por_unidad)
        .all()
    )

    result = {}
    for p in precios:
        ing_name = p.ingrediente_rel.nombre
        if ing_name not in result:
            result[ing_name] = {
                "ingrediente_id": p.ingrediente_id,
                "precio_actual": p.ingrediente_rel.precio_compra,
                "proveedores": [],
            }
        result[ing_name]["proveedores"].append({
            "proveedor": p.proveedor_rel.nombre,
            "precio_por_unidad": p.precio_por_unidad,
            "precio": p.precio,
            "cantidad": p.cantidad,
            "unidad": p.unidad,
            "fecha": str(p.fecha),
        })

    return [{"nombre": k, **v} for k, v in sorted(result.items())]
