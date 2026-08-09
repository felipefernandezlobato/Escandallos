from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Ingrediente, MermaRegistro, Receta
from app.schemas import (
    MermaAnalisisOut,
    MermaPorCategoriaItem,
    MermaPorMotivoItem,
    MermaPorTiempoItem,
    MermaRegistroCreate,
    MermaRegistroOut,
    MermaRegistroUpdate,
    MermaResumenOut,
    MermaTopItem,
)
from app.services.costes import coste_por_racion, coste_por_unidad_uso

router = APIRouter(prefix="/api/mermas", tags=["mermas"])


def _to_out(reg: MermaRegistro) -> dict:
    d = {
        "id": reg.id,
        "ingrediente_id": reg.ingrediente_id,
        "receta_id": reg.receta_id,
        "nombre_libre": reg.nombre_libre,
        "cantidad": reg.cantidad,
        "unidad": reg.unidad,
        "motivo": reg.motivo,
        "notas": reg.notas,
        "fecha": reg.fecha,
        "ubicacion": reg.ubicacion,
        "coste_unitario": reg.coste_unitario,
        "coste_total": reg.coste_total,
        "ingrediente_nombre": None,
        "receta_nombre": None,
        "categoria_nombre": None,
    }
    if reg.ingrediente_rel:
        d["ingrediente_nombre"] = reg.ingrediente_rel.nombre
        if reg.ingrediente_rel.categoria_rel:
            d["categoria_nombre"] = reg.ingrediente_rel.categoria_rel.nombre
    if reg.receta_rel:
        d["receta_nombre"] = reg.receta_rel.nombre
        if reg.receta_rel.categoria_rel:
            d["categoria_nombre"] = reg.receta_rel.categoria_rel.nombre
    return d


@router.post("", status_code=201)
def crear_merma(
    data: MermaRegistroCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    fecha = date.fromisoformat(data.fecha) if data.fecha else date.today()

    coste_unit = 0.0
    if data.ingrediente_id:
        ing = db.get(Ingrediente, data.ingrediente_id)
        if not ing:
            raise HTTPException(404, "Ingrediente no encontrado")
        coste_unit = coste_por_unidad_uso(ing)
    elif data.receta_id:
        receta = db.get(Receta, data.receta_id)
        if not receta:
            raise HTTPException(404, "Receta no encontrada")
        coste_unit = coste_por_racion(receta, db)

    coste_total = round(data.cantidad * coste_unit, 4)

    registro = MermaRegistro(
        ingrediente_id=data.ingrediente_id,
        receta_id=data.receta_id,
        nombre_libre=data.nombre_libre,
        cantidad=data.cantidad,
        unidad=data.unidad,
        motivo=data.motivo,
        notas=data.notas,
        fecha=fecha,
        ubicacion=data.ubicacion,
        coste_unitario=round(coste_unit, 4),
        coste_total=coste_total,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return _to_out(registro)


@router.get("/analisis")
def analisis_mermas(
    periodo: str = Query("semana", pattern="^(dia|semana|mes)$"),
    ubicacion: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(MermaRegistro)
    if ubicacion:
        q = q.filter(MermaRegistro.ubicacion == ubicacion)

    if fecha_desde:
        q = q.filter(MermaRegistro.fecha >= date.fromisoformat(fecha_desde))
    if fecha_hasta:
        q = q.filter(MermaRegistro.fecha <= date.fromisoformat(fecha_hasta))

    registros = q.order_by(MermaRegistro.fecha.desc()).all()

    today = date.today()
    if periodo == "dia":
        current_start = today
        prev_start = today - timedelta(days=1)
        prev_end = today - timedelta(days=1)
    elif periodo == "semana":
        current_start = today - timedelta(days=today.weekday())
        prev_start = current_start - timedelta(days=7)
        prev_end = current_start - timedelta(days=1)
    else:
        current_start = today.replace(day=1)
        if today.month == 1:
            prev_start = today.replace(year=today.year - 1, month=12, day=1)
        else:
            prev_start = today.replace(month=today.month - 1, day=1)
        prev_end = current_start - timedelta(days=1)

    current_regs = [r for r in registros if r.fecha >= current_start]
    prev_regs = [r for r in registros if prev_start <= r.fecha <= prev_end]

    coste_actual = sum(r.coste_total for r in current_regs)
    coste_anterior = sum(r.coste_total for r in prev_regs)
    cambio = None
    if coste_anterior > 0:
        cambio = round(((coste_actual - coste_anterior) / coste_anterior) * 100, 1)

    resumen = MermaResumenOut(
        total_eventos=len(current_regs),
        coste_total=round(coste_actual, 2),
        periodo=periodo,
        coste_periodo_anterior=round(coste_anterior, 2) if prev_regs else None,
        cambio_porcentaje=cambio,
    )

    # --- Por tiempo ---
    tiempo_map: dict[str, dict] = defaultdict(lambda: {"eventos": 0, "coste": 0.0})
    for r in registros:
        if periodo == "dia":
            key = r.fecha.isoformat()
        elif periodo == "semana":
            iso = r.fecha.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
        else:
            key = f"{r.fecha.year}-{r.fecha.month:02d}"
        tiempo_map[key]["eventos"] += 1
        tiempo_map[key]["coste"] += r.coste_total

    por_tiempo = [
        MermaPorTiempoItem(periodo=k, eventos=v["eventos"], coste=round(v["coste"], 2))
        for k, v in sorted(tiempo_map.items())
    ]

    # --- Por categoria ---
    cat_map: dict[str, dict] = defaultdict(lambda: {"eventos": 0, "coste": 0.0})
    for r in registros:
        cat = "Otro"
        if r.ingrediente_rel and r.ingrediente_rel.categoria_rel:
            cat = r.ingrediente_rel.categoria_rel.nombre
        elif r.receta_rel and r.receta_rel.categoria_rel:
            cat = r.receta_rel.categoria_rel.nombre
        cat_map[cat]["eventos"] += 1
        cat_map[cat]["coste"] += r.coste_total

    por_categoria = sorted(
        [MermaPorCategoriaItem(categoria=k, eventos=v["eventos"], coste=round(v["coste"], 2))
         for k, v in cat_map.items()],
        key=lambda x: x.coste,
        reverse=True,
    )

    # --- Por motivo ---
    motivo_map: dict[str, dict] = defaultdict(lambda: {"eventos": 0, "coste": 0.0})
    for r in registros:
        motivo_map[r.motivo]["eventos"] += 1
        motivo_map[r.motivo]["coste"] += r.coste_total

    por_motivo = sorted(
        [MermaPorMotivoItem(motivo=k, eventos=v["eventos"], coste=round(v["coste"], 2))
         for k, v in motivo_map.items()],
        key=lambda x: x.coste,
        reverse=True,
    )

    # --- Top items ---
    item_map: dict[str, dict] = defaultdict(lambda: {"eventos": 0, "cantidad": 0.0, "unidad": "", "coste": 0.0})
    for r in registros:
        name = r.nombre_libre or ""
        if r.ingrediente_rel:
            name = r.ingrediente_rel.nombre
        elif r.receta_rel:
            name = r.receta_rel.nombre
        item_map[name]["eventos"] += 1
        item_map[name]["cantidad"] += r.cantidad
        item_map[name]["unidad"] = r.unidad
        item_map[name]["coste"] += r.coste_total

    top_items = sorted(
        [MermaTopItem(nombre=k, eventos=v["eventos"], cantidad_total=round(v["cantidad"], 2),
                      unidad=v["unidad"], coste_total=round(v["coste"], 2))
         for k, v in item_map.items()],
        key=lambda x: x.coste_total,
        reverse=True,
    )[:10]

    return MermaAnalisisOut(
        resumen=resumen,
        por_tiempo=por_tiempo,
        por_categoria=por_categoria,
        por_motivo=por_motivo,
        top_items=top_items,
    )


@router.get("/{merma_id}")
def obtener_merma(
    merma_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    reg = db.get(MermaRegistro, merma_id)
    if not reg:
        raise HTTPException(404, "Registro de merma no encontrado")
    return _to_out(reg)


@router.get("")
def listar_mermas(
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    motivo: Optional[str] = None,
    ubicacion: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(MermaRegistro)
    if fecha_desde:
        q = q.filter(MermaRegistro.fecha >= date.fromisoformat(fecha_desde))
    if fecha_hasta:
        q = q.filter(MermaRegistro.fecha <= date.fromisoformat(fecha_hasta))
    if motivo:
        q = q.filter(MermaRegistro.motivo == motivo)
    if ubicacion:
        q = q.filter(MermaRegistro.ubicacion == ubicacion)

    total = q.count()
    registros = q.order_by(MermaRegistro.fecha.desc(), MermaRegistro.id.desc()).offset(offset).limit(limit).all()
    return {"total": total, "registros": [_to_out(r) for r in registros]}


@router.put("/{merma_id}")
def actualizar_merma(
    merma_id: int,
    data: MermaRegistroUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    reg = db.get(MermaRegistro, merma_id)
    if not reg:
        raise HTTPException(404, "Registro de merma no encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(reg, field, value)

    if data.cantidad is not None:
        reg.coste_total = round(reg.cantidad * reg.coste_unitario, 4)

    db.commit()
    db.refresh(reg)
    return _to_out(reg)


@router.delete("/{merma_id}")
def eliminar_merma(
    merma_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    reg = db.get(MermaRegistro, merma_id)
    if not reg:
        raise HTTPException(404, "Registro de merma no encontrado")
    db.delete(reg)
    db.commit()
    return {"ok": True}
