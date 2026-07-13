export interface Categoria {
  id: number;
  nombre: string;
  tipo: "ingrediente" | "receta";
  margen_objetivo: number | null;
}

export interface Ingrediente {
  id: number;
  nombre: string;
  categoria_id: number;
  unidad_compra: string;
  cantidad_compra: number;
  precio_compra: number;
  unidad_uso: string;
  merma_porcentaje: number;
  proveedor: string | null;
  notas: string | null;
  fecha_actualizacion: string | null;
  coste_por_unidad_uso: number;
  num_recetas: number;
  categoria_nombre: string;
  precios_proveedores?: Record<string, number>;
  excluir_pedidos?: boolean;
}

export interface LineaReceta {
  id: number;
  ingrediente_id: number | null;
  subreceta_id: number | null;
  cantidad: number;
  unidad: string;
  nombre_ingrediente: string | null;
  nombre_subreceta: string | null;
  coste_linea: number;
}

export interface LineaRecetaInput {
  ingrediente_id?: number | null;
  subreceta_id?: number | null;
  cantidad: number;
  unidad: string;
}

export interface Receta {
  id: number;
  nombre: string;
  categoria_id: number;
  porciones_por_lote: number; // kg for sub-recipes, servings for regular
  precio_venta: number | null;
  es_subreceta: boolean;
  unidad_rendimiento: string | null;
  notas: string | null;
  coste_total: number;
  coste_por_porcion: number;
  margen_real: number | null;
  categoria_nombre: string;
  fecha_creacion: string | null;
  fecha_modificacion: string | null;
}

export interface RecetaDetail extends Receta {
  lineas: LineaReceta[];
}

export interface HistorialPrecio {
  id: number;
  ingrediente_id: number;
  precio_anterior: number;
  precio_nuevo: number;
  fecha_cambio: string | null;
}

export interface Alerta {
  tipo: string;
  mensaje: string;
  receta_id: number | null;
  ingrediente_id: number | null;
}

export interface RankingItem {
  id: number;
  nombre: string;
  categoria: string;
  coste_por_porcion: number;
  precio_venta: number | null;
  margen: number | null;
}

export interface ImportarItem {
  nombre: string;
  cantidad: number;
  unidad: string;
  precio_total: number;
  precio_unitario: number;
}

export interface ImportarMatch {
  item: ImportarItem;
  ingrediente_id: number | null;
  ingrediente_nombre: string | null;
  precio_anterior: number | null;
  es_nuevo: boolean;
}

export interface ImportarPreview {
  proveedor: string;
  fecha: string;
  matches: ImportarMatch[];
}

// --- Inventario ---

export interface InventarioRegistro {
  id: number;
  ingrediente_id: number;
  cantidad: number;
  unidad: string;
  fecha_registro: string;
  notas: string | null;
  ingrediente_nombre: string;
}

export interface InventarioSnapshot {
  fecha: string;
  registros: InventarioRegistro[];
  total_items: number;
}

// --- Pedidos ---

export interface LineaPedido {
  id: number;
  ingrediente_id: number;
  cantidad_pedida: number;
  unidad: string;
  cantidad_recibida: number | null;
  precio_unitario: number | null;
  ingrediente_nombre: string;
}

export interface Pedido {
  id: number;
  fecha: string;
  proveedor: string;
  estado: string;
  notas: string | null;
  fecha_recepcion: string | null;
  num_lineas: number;
  total_estimado: number;
}

export interface PedidoDetail extends Pedido {
  lineas: LineaPedido[];
}

export interface RecomendacionItem {
  ingrediente_id: number;
  ingrediente_nombre: string;
  proveedor: string;
  stock_actual: number;
  unidad: string;
  consumo_medio_semanal: number;
  cantidad_sugerida: number;
  par_level: number;
  dias_stock: number | null;
  nota?: string | null;
}

export interface ConsumoSemanal {
  semana: string;
  cantidad: number;
  unidad: string;
}

export interface ConsumoData {
  ingrediente_id: number;
  ingrediente_nombre: string;
  consumo_medio: number;
  unidad: string;
  tendencia: string;
  historial: ConsumoSemanal[];
  reorder_point?: number | null;
  eoq?: number | null;
  safety_stock?: number | null;
  par_level?: number | null;
  stock_historial?: Array<{ fecha: string; cantidad: number; unidad: string }>;
}
