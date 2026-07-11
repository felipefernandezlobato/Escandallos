import csv
import io
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Ingrediente, LineaReceta, Receta
from app.services.costes import coste_por_racion, coste_total_receta, margen_real

router = APIRouter(prefix="/api", tags=["backup"])

DB_PATH = Path("data/escandallos.db")


@router.get("/backup/descargar")
def descargar_backup():
    if not DB_PATH.exists():
        return {"error": "Base de datos no encontrada"}
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    shutil.copy2(DB_PATH, tmp.name)
    return FileResponse(
        tmp.name,
        filename="escandallos_backup.db",
        media_type="application/octet-stream",
    )


@router.post("/backup/restaurar")
async def restaurar_backup(file: UploadFile = File(...)):
    content = await file.read()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DB_PATH, "wb") as f:
        f.write(content)
    return {"ok": True, "mensaje": "Backup restaurado. Reinicia el servidor para aplicar."}


@router.get("/export/ingredientes")
def exportar_ingredientes(db: Session = Depends(get_db)):
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
def exportar_recetas(db: Session = Depends(get_db)):
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
