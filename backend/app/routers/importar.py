import io
from datetime import date
from typing import Optional

import pdfplumber
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Categoria, HistorialPrecio, Ingrediente
from app.schemas import (
    ImportarConfirmItem,
    ImportarConfirmRequest,
    ImportarMatchItem,
    ImportarPreviewOut,
    ImportarRequest,
)

router = APIRouter(prefix="/api/importar", tags=["importar"])


@router.post("/pdf")
async def extraer_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se aceptan ficheros PDF")
    content = await file.read()
    text_pages = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_pages.append(text)
    return {"texto": "\n\n".join(text_pages), "paginas": len(text_pages)}


def _find_match(nombre: str, db: Session) -> Optional[Ingrediente]:
    exact = (
        db.query(Ingrediente)
        .filter(Ingrediente.nombre.ilike(nombre))
        .first()
    )
    if exact:
        return exact
    partial = (
        db.query(Ingrediente)
        .filter(Ingrediente.nombre.ilike(f"%{nombre}%"))
        .order_by(func.length(Ingrediente.nombre))
        .first()
    )
    return partial


@router.post("/preview", response_model=ImportarPreviewOut)
def preview_importacion(data: ImportarRequest, db: Session = Depends(get_db)):
    matches = []
    for item in data.items:
        ing = _find_match(item.nombre, db)
        if ing:
            matches.append(ImportarMatchItem(
                item=item,
                ingrediente_id=ing.id,
                ingrediente_nombre=ing.nombre,
                precio_anterior=ing.precio_compra,
                es_nuevo=False,
            ))
        else:
            matches.append(ImportarMatchItem(
                item=item,
                es_nuevo=True,
            ))
    return ImportarPreviewOut(
        proveedor=data.proveedor,
        fecha=data.fecha,
        matches=matches,
    )


@router.post("/confirm")
def confirmar_importacion(data: ImportarConfirmRequest, db: Session = Depends(get_db)):
    actualizados = 0
    creados = 0

    for item in data.items:
        if item.crear_nuevo:
            cat_id = item.categoria_id
            if not cat_id:
                cat = db.query(Categoria).filter(Categoria.tipo == "ingrediente").first()
                if cat:
                    cat_id = cat.id
                else:
                    raise HTTPException(400, "No hay categorías de ingrediente disponibles")

            ing = Ingrediente(
                nombre=item.nombre,
                categoria_id=cat_id,
                unidad_compra=item.unidad_compra,
                cantidad_compra=item.cantidad_compra,
                precio_compra=item.precio_compra,
                unidad_uso=item.unidad_compra,
                proveedor=data.proveedor,
                fecha_actualizacion=date.today(),
            )
            db.add(ing)
            creados += 1
        elif item.ingrediente_id:
            ing = db.get(Ingrediente, item.ingrediente_id)
            if not ing:
                continue
            if ing.precio_compra != item.precio_compra:
                historial = HistorialPrecio(
                    ingrediente_id=ing.id,
                    precio_anterior=ing.precio_compra,
                    precio_nuevo=item.precio_compra,
                )
                db.add(historial)
            ing.precio_compra = item.precio_compra
            ing.cantidad_compra = item.cantidad_compra
            ing.proveedor = data.proveedor
            ing.fecha_actualizacion = date.today()
            actualizados += 1

    db.commit()
    return {"actualizados": actualizados, "creados": creados}
