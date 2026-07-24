"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { Categoria, RecetaDetail, Ingrediente, Receta, LineaRecetaInput } from "@/lib/types";
import Link from "next/link";

const UNIDADES = ["kg", "g", "mg", "litro", "ml", "cl", "unidad"];

export default function RecetaDetailPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [receta, setReceta] = useState<RecetaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [subrecetas, setSubrecetas] = useState<Receta[]>([]);
  const [editForm, setEditForm] = useState({
    nombre: "",
    categoria_id: 0,
    porciones_por_lote: 1,
    precio_venta: null as number | null,
    precio_venta_bru2: null as number | null,
    es_subreceta: false,
    unidad_rendimiento: null as string | null,
    notas: "",
    lineas: [] as LineaRecetaInput[],
  });

  const fetchReceta = () => {
    setLoading(true);
    apiFetch<RecetaDetail>(`/api/recetas/${id}`)
      .then(setReceta)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReceta();
  }, [id]);

  const startEditing = async () => {
    if (!receta) return;
    const [cats, ings, subs] = await Promise.all([
      apiFetch<Categoria[]>("/api/categorias?tipo=receta"),
      apiFetch<Ingrediente[]>("/api/ingredientes"),
      apiFetch<Receta[]>("/api/recetas?es_subreceta=true"),
    ]);
    setCategorias(cats);
    setIngredientes(ings);
    setSubrecetas(subs.filter((s) => s.id !== receta.id));
    setEditForm({
      nombre: receta.nombre,
      categoria_id: receta.categoria_id,
      porciones_por_lote: receta.porciones_por_lote,
      precio_venta: receta.precio_venta,
      precio_venta_bru2: receta.precio_venta_bru2,
      es_subreceta: receta.es_subreceta,
      unidad_rendimiento: receta.unidad_rendimiento || null,
      notas: receta.notas || "",
      lineas: receta.lineas.map((l) => ({
        ingrediente_id: l.ingrediente_id,
        subreceta_id: l.subreceta_id,
        cantidad: l.cantidad,
        unidad: l.unidad,
      })),
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await apiFetch(`/api/recetas/${id}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      setEditing(false);
      fetchReceta();
    } catch (err) {
      toast("Error al guardar: " + (err as Error).message, "error");
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta receta?")) return;
    try {
      await apiFetch(`/api/recetas/${id}`, { method: "DELETE" });
      router.push("/recetas");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const addLinea = (tipo: "ingrediente" | "subreceta") => {
    setEditForm({
      ...editForm,
      lineas: [
        ...editForm.lineas,
        {
          ingrediente_id: tipo === "ingrediente" ? (ingredientes[0]?.id || null) : null,
          subreceta_id: tipo === "subreceta" ? (subrecetas[0]?.id || null) : null,
          cantidad: 1,
          unidad: "g",
        },
      ],
    });
  };

  const removeLinea = (index: number) => {
    setEditForm({
      ...editForm,
      lineas: editForm.lineas.filter((_, i) => i !== index),
    });
  };

  const updateLinea = (index: number, field: string, value: any) => {
    const lineas = [...editForm.lineas];
    (lineas[index] as any)[field] = value;
    setEditForm({ ...editForm, lineas });
  };

  if (loading) return <p className="text-[#6B5E52] py-10 text-center">Cargando...</p>;
  if (!receta) return <p className="text-red-500 py-10 text-center">Receta no encontrada</p>;

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Editar Receta</h1>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm border border-[#D4C4A8] hover:bg-[#F5F0E8]">Cancelar</button>
            <button onClick={handleSave} className="bg-[#8B1A2B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420]">Guardar</button>
          </div>
        </div>

        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#6B5E52] mb-1">Nombre</label>
              <input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#6B5E52] mb-1">Categoría</label>
              <select value={editForm.categoria_id} onChange={(e) => setEditForm({ ...editForm, categoria_id: parseInt(e.target.value) })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm">
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6B5E52] mb-1">Porciones por lote</label>
              <input type="number" min="1" value={editForm.porciones_por_lote} onChange={(e) => setEditForm({ ...editForm, porciones_por_lote: parseInt(e.target.value) || 1 })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#6B5E52] mb-1">Precio venta (CHF)</label>
              <input type="number" step="any" value={editForm.precio_venta ?? ""} onChange={(e) => setEditForm({ ...editForm, precio_venta: e.target.value ? parseFloat(e.target.value) : null })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#6B5E52] mb-1">Precio venta Bru2 (CHF)</label>
              <input type="number" step="any" value={editForm.precio_venta_bru2 ?? ""} onChange={(e) => setEditForm({ ...editForm, precio_venta_bru2: e.target.value ? parseFloat(e.target.value) : null })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={editForm.es_subreceta} onChange={(e) => setEditForm({ ...editForm, es_subreceta: e.target.checked })} />
              <label className="text-sm">Es sub-receta</label>
            </div>
            {editForm.es_subreceta && (
              <div>
                <label className="block text-xs text-[#6B5E52] mb-1">Unidad de rendimiento</label>
                <select value={editForm.unidad_rendimiento ?? ""} onChange={(e) => setEditForm({ ...editForm, unidad_rendimiento: e.target.value || null })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm">
                  <option value="">ración</option>
                  <option value="kg">kg</option>
                  <option value="litro">litro</option>
                  <option value="unidad">unidad</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-[#6B5E52] mb-1">Notas</label>
            <textarea value={editForm.notas} onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm" rows={2} />
          </div>
        </div>

        {/* Edit lines */}
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Ingredientes de la receta</h3>
            <div className="flex gap-2">
              <button onClick={() => addLinea("ingrediente")} className="text-sm text-[#8B1A2B] hover:text-[#6B1420]">+ Ingrediente</button>
              {subrecetas.length > 0 && (
                <button onClick={() => addLinea("subreceta")} className="text-sm text-purple-600 hover:text-purple-800">+ Sub-receta</button>
              )}
            </div>
          </div>
          {editForm.lineas.length === 0 ? (
            <p className="text-sm text-[#6B5E52]/70">Añade ingredientes a la receta</p>
          ) : (
            <div className="space-y-2">
              {editForm.lineas.map((linea, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-2 bg-[#F5F0E8] rounded">
                  {linea.subreceta_id ? (
                    <select value={linea.subreceta_id ?? ""} onChange={(e) => updateLinea(i, "subreceta_id", parseInt(e.target.value))} className="border border-[#D4C4A8] rounded px-2 py-1 text-sm flex-1 min-w-[150px]">
                      {subrecetas.map((s) => <option key={s.id} value={s.id}>{s.nombre} (sub)</option>)}
                    </select>
                  ) : (
                    <select value={linea.ingrediente_id ?? ""} onChange={(e) => updateLinea(i, "ingrediente_id", parseInt(e.target.value))} className="border border-[#D4C4A8] rounded px-2 py-1 text-sm flex-1 min-w-[150px]">
                      {ingredientes.map((ing) => <option key={ing.id} value={ing.id}>{ing.nombre}</option>)}
                    </select>
                  )}
                  <input type="number" step="any" value={linea.cantidad} onChange={(e) => updateLinea(i, "cantidad", parseFloat(e.target.value) || 0)} className="w-20 border border-[#D4C4A8] rounded px-2 py-1 text-sm" />
                  <select value={linea.unidad} onChange={(e) => updateLinea(i, "unidad", e.target.value)} className="border border-[#D4C4A8] rounded px-2 py-1 text-sm">
                    {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={() => removeLinea(i)} className="text-red-500 text-sm hover:text-red-700">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/recetas" className="text-sm text-[#8B1A2B] hover:underline">← Volver a recetas</Link>
          <h1 className="text-2xl font-bold mt-1">{receta.nombre}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={startEditing} className="bg-[#8B1A2B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420]">Editar</button>
          <button onClick={handleDelete} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200">Eliminar</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Coste total</p>
          <p className="text-xl font-bold">{receta.coste_total.toFixed(2)} CHF</p>
        </div>
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">
            Coste/{receta.unidad_rendimiento || "ración"}
          </p>
          <p className="text-xl font-bold">{receta.coste_por_porcion.toFixed(2)} CHF</p>
        </div>
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Precio venta</p>
          <p className="text-xl font-bold">{receta.precio_venta ? `${receta.precio_venta.toFixed(2)} CHF` : "—"}</p>
        </div>
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Multiplicador</p>
          <p className="text-xl font-bold">
            {receta.precio_venta && receta.coste_por_porcion > 0
              ? `x${(receta.precio_venta / receta.coste_por_porcion).toFixed(1)}`
              : "—"}
          </p>
        </div>
      </div>

      {/* Bru2 cost row — only shown when recipe has excluded ingredients */}
      {(() => {
        const BRU2_EXCLUDE_ING = ["brotes de cebolla", "chilli flakes", "mohn", "rúcola"];
        const BRU2_EXCLUDE_SUB = ["rúcola tostada"];
        const excludedCost = receta.lineas.reduce((sum, l) => {
          if (l.nombre_ingrediente && BRU2_EXCLUDE_ING.includes(l.nombre_ingrediente.toLowerCase())) return sum + l.coste_linea;
          if (l.nombre_subreceta && BRU2_EXCLUDE_SUB.includes(l.nombre_subreceta.toLowerCase())) return sum + l.coste_linea;
          return sum;
        }, 0);
        if (excludedCost <= 0) return null;
        const bru2Total = receta.coste_total - excludedCost;
        const bru2PerPortion = bru2Total / receta.porciones_por_lote;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#F2E8EA] border border-[#8B1A2B]/20 rounded-lg p-4">
              <p className="text-xs text-[#8B1A2B]">Coste total Bru2</p>
              <p className="text-xl font-bold">{bru2Total.toFixed(2)} CHF</p>
            </div>
            <div className="bg-[#F2E8EA] border border-[#8B1A2B]/20 rounded-lg p-4">
              <p className="text-xs text-[#8B1A2B]">Coste/{receta.unidad_rendimiento || "ración"} Bru2</p>
              <p className="text-xl font-bold">{bru2PerPortion.toFixed(2)} CHF</p>
            </div>
            <div className="bg-[#F2E8EA] border border-[#8B1A2B]/20 rounded-lg p-4">
              <p className="text-xs text-[#8B1A2B]">Precio venta Bru2</p>
              <p className="text-xl font-bold">{receta.precio_venta_bru2 ? `${receta.precio_venta_bru2.toFixed(2)} CHF` : "—"}</p>
            </div>
            <div className="bg-[#F2E8EA] border border-[#8B1A2B]/20 rounded-lg p-4">
              <p className="text-xs text-[#8B1A2B]">Multiplicador Bru2</p>
              <p className="text-xl font-bold">
                {receta.precio_venta_bru2 && bru2PerPortion > 0
                  ? `x${(receta.precio_venta_bru2 / bru2PerPortion).toFixed(1)}`
                  : "—"}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Info */}
      <div className="flex flex-wrap gap-4 text-sm text-[#6B5E52]">
        <span>Categoría: <strong className="text-[#1A1A1A]">{receta.categoria_nombre}</strong></span>
        <span>Porciones/lote: <strong className="text-[#1A1A1A]">{receta.porciones_por_lote}</strong></span>
        {receta.es_subreceta && <span className="px-2 py-0.5 rounded bg-[#F2E8EA] text-[#8B1A2B] text-xs">Sub-receta</span>}
      </div>

      {/* Lines table */}
      <div className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5F0E8] text-left text-[#6B5E52] border-b border-[#E8DFD3]">
              <th className="px-4 py-2 font-medium">Ingrediente</th>
              <th className="px-4 py-2 font-medium text-right">Cantidad</th>
              <th className="px-4 py-2 font-medium">Unidad</th>
              <th className="px-4 py-2 font-medium text-right">CHF/kg</th>
              <th className="px-4 py-2 font-medium text-right">Coste</th>
            </tr>
          </thead>
          <tbody>
            {receta.lineas.map((l) => (
              <tr key={l.id} className="border-b border-[#E8DFD3]/50">
                <td className="px-4 py-2">
                  {l.nombre_subreceta ? (
                    <span>
                      <span className="text-purple-600 text-xs mr-1">SUB</span>
                      <Link href={`/recetas/${l.subreceta_id}`} className="text-[#8B1A2B] hover:underline">{l.nombre_subreceta}</Link>
                    </span>
                  ) : l.ingrediente_id ? (
                    <Link href={`/ingredientes/${l.ingrediente_id}`} className="text-[#8B1A2B] hover:underline">{l.nombre_ingrediente}</Link>
                  ) : (
                    l.nombre_ingrediente
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {(l.unidad === "kg" || l.unidad === "litro") && l.cantidad < 1
                    ? l.unidad === "kg" ? Math.round(l.cantidad * 1000) : Math.round(l.cantidad * 1000)
                    : l.cantidad}
                </td>
                <td className="px-4 py-2">
                  {(l.unidad === "kg" || l.unidad === "litro") && l.cantidad < 1
                    ? l.unidad === "kg" ? "g" : "ml"
                    : l.unidad}
                </td>
                <td className="px-4 py-2 text-right text-[#6B5E52]">
                  {l.cantidad > 0 ? (l.coste_linea / l.cantidad * (l.unidad === "kg" ? 1 : l.unidad === "g" ? 1000 : l.unidad === "litro" ? 1 : 1)).toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2 text-right font-medium">{l.coste_linea.toFixed(2)} CHF</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#F5F0E8] font-semibold">
              <td className="px-4 py-2" colSpan={4}>Total</td>
              <td className="px-4 py-2 text-right">{receta.coste_total.toFixed(2)} CHF</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {receta.notas && (
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-1">Notas</h3>
          <p className="text-sm text-[#6B5E52] whitespace-pre-wrap">{receta.notas}</p>
        </div>
      )}
    </div>
  );
}
