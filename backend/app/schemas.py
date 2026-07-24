from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- Categorias ---

class CategoriaBase(BaseModel):
    nombre: str
    tipo: str = Field(pattern="^(ingrediente|receta)$")
    margen_objetivo: Optional[float] = None


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = None
    margen_objetivo: Optional[float] = None


class CategoriaOut(CategoriaBase):
    id: int

    model_config = {"from_attributes": True}


# --- Ingredientes ---

class IngredienteBase(BaseModel):
    nombre: str
    categoria_id: int
    unidad_compra: str
    cantidad_compra: float = Field(default=1, gt=0)
    precio_compra: float
    unidad_uso: str
    merma_porcentaje: float = Field(default=0, ge=0, lt=100)
    proveedor: Optional[str] = None
    notas: Optional[str] = None


class IngredienteCreate(IngredienteBase):
    pass


class IngredienteUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria_id: Optional[int] = None
    unidad_compra: Optional[str] = None
    cantidad_compra: Optional[float] = None
    precio_compra: Optional[float] = None
    unidad_uso: Optional[str] = None
    merma_porcentaje: Optional[float] = None
    proveedor: Optional[str] = None
    notas: Optional[str] = None


class IngredienteOut(IngredienteBase):
    id: int
    fecha_actualizacion: Optional[date] = None
    coste_por_unidad_uso: float = 0.0
    num_recetas: int = 0
    categoria_nombre: str = ""
    precios_proveedores: dict[str, float] = {}
    excluir_pedidos: bool = False

    model_config = {"from_attributes": True}


# --- Historial Precios ---

class HistorialPrecioOut(BaseModel):
    id: int
    ingrediente_id: int
    precio_anterior: float
    precio_nuevo: float
    fecha_cambio: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Lineas de Receta ---

class LineaRecetaBase(BaseModel):
    ingrediente_id: Optional[int] = None
    subreceta_id: Optional[int] = None
    cantidad: float
    unidad: str


class LineaRecetaCreate(LineaRecetaBase):
    pass


class LineaRecetaOut(LineaRecetaBase):
    id: int
    nombre_ingrediente: Optional[str] = None
    nombre_subreceta: Optional[str] = None
    coste_linea: float = 0.0

    model_config = {"from_attributes": True}


# --- Recetas ---

class RecetaBase(BaseModel):
    nombre: str
    categoria_id: int
    porciones_por_lote: float = Field(default=1, gt=0)
    precio_venta: Optional[float] = None
    precio_venta_bru2: Optional[float] = None
    es_subreceta: bool = False
    unidad_rendimiento: Optional[str] = None
    notas: Optional[str] = None


class RecetaCreate(RecetaBase):
    lineas: list[LineaRecetaCreate] = []


class RecetaUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria_id: Optional[int] = None
    porciones_por_lote: Optional[float] = None
    precio_venta: Optional[float] = None
    precio_venta_bru2: Optional[float] = None
    es_subreceta: Optional[bool] = None
    unidad_rendimiento: Optional[str] = None
    notas: Optional[str] = None
    lineas: Optional[list[LineaRecetaCreate]] = None


class RecetaOut(RecetaBase):
    id: int
    coste_total: float = 0.0
    coste_por_porcion: float = 0.0
    margen_real: Optional[float] = None
    categoria_nombre: str = ""
    fecha_creacion: Optional[datetime] = None
    fecha_modificacion: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RecetaDetailOut(RecetaOut):
    lineas: list[LineaRecetaOut] = []


# --- Importar ---

class ImportarItem(BaseModel):
    nombre: str
    cantidad: float
    unidad: str
    precio_total: float
    precio_unitario: float


class ImportarRequest(BaseModel):
    proveedor: str
    fecha: str
    items: list[ImportarItem]


class ImportarMatchItem(BaseModel):
    item: ImportarItem
    ingrediente_id: Optional[int] = None
    ingrediente_nombre: Optional[str] = None
    precio_anterior: Optional[float] = None
    es_nuevo: bool = False


class ImportarPreviewOut(BaseModel):
    proveedor: str
    fecha: str
    matches: list[ImportarMatchItem]


class ImportarConfirmItem(BaseModel):
    ingrediente_id: Optional[int] = None
    nombre: str
    unidad_compra: str
    cantidad_compra: float
    precio_compra: float
    crear_nuevo: bool = False
    categoria_id: Optional[int] = None


class ImportarConfirmRequest(BaseModel):
    proveedor: str
    items: list[ImportarConfirmItem]


# --- Dashboard ---

class AlertaOut(BaseModel):
    tipo: str
    mensaje: str
    receta_id: Optional[int] = None
    ingrediente_id: Optional[int] = None


class RankingItem(BaseModel):
    id: int
    nombre: str
    categoria: str
    coste_por_porcion: float
    precio_venta: Optional[float] = None
    margen: Optional[float] = None


class TendenciaItem(BaseModel):
    fecha: str
    valor: float
    nombre: str


# --- Inventario ---

class InventarioRegistroCreate(BaseModel):
    ingrediente_id: int
    cantidad: float
    unidad: str
    notas: Optional[str] = None


class InventarioRegistroUpdate(BaseModel):
    cantidad: Optional[float] = None
    unidad: Optional[str] = None
    notas: Optional[str] = None


class InventarioSnapshotCreate(BaseModel):
    fecha: Optional[str] = None
    registros: list[InventarioRegistroCreate]


class InventarioRegistroOut(BaseModel):
    id: int
    ingrediente_id: int
    cantidad: float
    unidad: str
    fecha_registro: date
    notas: Optional[str] = None
    ingrediente_nombre: str = ""

    model_config = {"from_attributes": True}


class InventarioSnapshotOut(BaseModel):
    fecha: date
    registros: list[InventarioRegistroOut]
    total_items: int = 0


# --- Pedidos ---

class LineaPedidoCreate(BaseModel):
    ingrediente_id: int
    cantidad_pedida: float
    unidad: str
    precio_unitario: Optional[float] = None


class LineaPedidoUpdate(BaseModel):
    cantidad_pedida: Optional[float] = None
    cantidad_recibida: Optional[float] = None
    precio_unitario: Optional[float] = None
    unidad: Optional[str] = None


class LineaPedidoOut(BaseModel):
    id: int
    ingrediente_id: int
    cantidad_pedida: float
    unidad: str
    cantidad_recibida: Optional[float] = None
    precio_unitario: Optional[float] = None
    ingrediente_nombre: str = ""

    model_config = {"from_attributes": True}


class PedidoCreate(BaseModel):
    proveedor: str
    notas: Optional[str] = None
    lineas: list[LineaPedidoCreate] = []


class PedidoUpdate(BaseModel):
    proveedor: Optional[str] = None
    estado: Optional[str] = None
    notas: Optional[str] = None
    lineas: Optional[list[LineaPedidoCreate]] = None
    fecha_recepcion: Optional[date] = None


class PedidoOut(BaseModel):
    id: int
    fecha: date
    proveedor: str
    estado: str
    notas: Optional[str] = None
    fecha_recepcion: Optional[date] = None
    num_lineas: int = 0
    total_estimado: float = 0.0

    model_config = {"from_attributes": True}


class PedidoDetailOut(PedidoOut):
    lineas: list[LineaPedidoOut] = []


class RecibirLineaItem(BaseModel):
    linea_id: int
    cantidad_recibida: float
    precio_unitario: Optional[float] = None


class RecibirPedidoRequest(BaseModel):
    lineas: list[RecibirLineaItem]


# --- Recomendación ---

class RecomendacionItem(BaseModel):
    ingrediente_id: int
    ingrediente_nombre: str
    proveedor: str
    stock_actual: float
    unidad: str
    consumo_medio_semanal: float
    cantidad_sugerida: float
    par_level: float = 0
    dias_stock: Optional[float] = None
    nota: Optional[str] = None


class RecomendacionOut(BaseModel):
    fecha: date
    items: list[RecomendacionItem]


# --- Consumo ---

class ConsumoSemanalItem(BaseModel):
    semana: str
    cantidad: float
    unidad: str


class StockHistorialItem(BaseModel):
    fecha: str
    cantidad: float
    unidad: str


class ConsumoOut(BaseModel):
    ingrediente_id: int
    ingrediente_nombre: str
    consumo_medio: float
    unidad: str
    tendencia: str = "estable"
    reorder_point: Optional[float] = None
    eoq: Optional[float] = None
    safety_stock: Optional[float] = None
    par_level: Optional[float] = None
    historial: list[ConsumoSemanalItem] = []
    stock_historial: list[StockHistorialItem] = []
