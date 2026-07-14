import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Categoria, Ingrediente, Receta, LineaReceta, HistorialPrecio,
    Proveedor, PrecioProveedor, InventarioRegistro, Pedido, LineaPedido,
)
from app.services.costes import coste_por_racion, coste_total_receta, margen_real

router = APIRouter(prefix="/api", tags=["backup"])


@router.get("/backup/descargar")
def descargar_backup(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Export all data as JSON for backup purposes."""
    data = {
        "categorias": [
            {"id": c.id, "nombre": c.nombre, "tipo": c.tipo, "margen_objetivo": c.margen_objetivo}
            for c in db.query(Categoria).all()
        ],
        "ingredientes": [
            {
                "id": i.id, "nombre": i.nombre, "categoria_id": i.categoria_id,
                "unidad_compra": i.unidad_compra, "cantidad_compra": i.cantidad_compra,
                "precio_compra": i.precio_compra, "unidad_uso": i.unidad_uso,
                "merma_porcentaje": i.merma_porcentaje, "proveedor": i.proveedor,
                "notas": i.notas, "fecha_actualizacion": str(i.fecha_actualizacion) if i.fecha_actualizacion else None,
                "excluir_pedidos": i.excluir_pedidos,
            }
            for i in db.query(Ingrediente).all()
        ],
        "recetas": [
            {
                "id": r.id, "nombre": r.nombre, "categoria_id": r.categoria_id,
                "porciones_por_lote": r.porciones_por_lote, "precio_venta": r.precio_venta,
                "es_subreceta": r.es_subreceta, "unidad_rendimiento": r.unidad_rendimiento,
                "notas": r.notas,
            }
            for r in db.query(Receta).all()
        ],
        "lineas_receta": [
            {
                "id": l.id, "receta_id": l.receta_id, "ingrediente_id": l.ingrediente_id,
                "subreceta_id": l.subreceta_id, "cantidad": l.cantidad, "unidad": l.unidad,
            }
            for l in db.query(LineaReceta).all()
        ],
        "historial_precios": [
            {
                "id": h.id, "ingrediente_id": h.ingrediente_id,
                "precio_anterior": h.precio_anterior, "precio_nuevo": h.precio_nuevo,
                "fecha_cambio": str(h.fecha_cambio) if h.fecha_cambio else None,
            }
            for h in db.query(HistorialPrecio).all()
        ],
        "inventario_registros": [
            {
                "id": r.id, "ingrediente_id": r.ingrediente_id, "cantidad": r.cantidad,
                "unidad": r.unidad, "fecha_registro": str(r.fecha_registro), "notas": r.notas,
            }
            for r in db.query(InventarioRegistro).all()
        ],
        "pedidos": [
            {
                "id": p.id, "fecha": str(p.fecha), "proveedor": p.proveedor,
                "estado": p.estado, "notas": p.notas,
                "fecha_recepcion": str(p.fecha_recepcion) if p.fecha_recepcion else None,
            }
            for p in db.query(Pedido).all()
        ],
        "lineas_pedido": [
            {
                "id": l.id, "pedido_id": l.pedido_id, "ingrediente_id": l.ingrediente_id,
                "cantidad_pedida": l.cantidad_pedida, "unidad": l.unidad,
                "cantidad_recibida": l.cantidad_recibida, "precio_unitario": l.precio_unitario,
            }
            for l in db.query(LineaPedido).all()
        ],
    }
    content = json.dumps(data, ensure_ascii=False, indent=2)
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=escandallos_backup.json"},
    )


@router.get("/export/ingredientes")
def exportar_ingredientes(db: Session = Depends(get_db), user=Depends(get_current_user)):
    ingredientes = db.query(Ingrediente).order_by(Ingrediente.nombre).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Nombre", "Categoría", "Unidad Compra", "Cantidad Compra",
        "Precio Compra", "Unidad Uso", "Merma %", "Proveedor", "Fecha Actualización",
    ])
    for ing in ingredientes:
        cat_nombre = ing.categoria_rel.nombre if ing.categoria_rel else ""
        writer.writerow([
            ing.id, ing.nombre, cat_nombre, ing.unidad_compra,
            ing.cantidad_compra, ing.precio_compra, ing.unidad_uso,
            ing.merma_porcentaje, ing.proveedor or "", ing.fecha_actualizacion,
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ingredientes.csv"},
    )


@router.get("/export/recetas")
def exportar_recetas(db: Session = Depends(get_db), user=Depends(get_current_user)):
    recetas = (
        db.query(Receta)
        .options(
            joinedload(Receta.categoria_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.ingrediente_rel),
            joinedload(Receta.lineas).joinedload(LineaReceta.subreceta_rel),
        )
        .order_by(Receta.nombre)
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Nombre", "Categoría", "Porciones/Lote", "Precio Venta",
        "Es Subreceta", "Coste Total", "Coste/Porción", "Margen %",
    ])
    for r in recetas:
        ct = coste_total_receta(r, db)
        cpp = coste_por_racion(r, db)
        mr = margen_real(r, db)
        cat_nombre = r.categoria_rel.nombre if r.categoria_rel else ""
        writer.writerow([
            r.id, r.nombre, cat_nombre, r.porciones_por_lote,
            r.precio_venta or "", "Sí" if r.es_subreceta else "No",
            round(ct, 4), round(cpp, 4),
            f"{mr:.1f}" if mr is not None else "",
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=recetas.csv"},
    )
