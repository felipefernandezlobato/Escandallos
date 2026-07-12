"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Categoria, Ingrediente, Receta, LineaRecetaInput } from "@/lib/types";
import Link from "next/link";

const UNIDADES = ["kg", "g", "mg", "litro", "ml", "cl", "unidad"];

export default function NuevaRecetaPage() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [subrecetas, setSubrecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    nombre: "",
    categoria_id: 0,
    porciones_por_lote: 1,
    precio_venta: null as number | null,
    es_subreceta: false,
    unidad_rendimiento: null as string | null,
    notas: "",
    lineas: [] as LineaRecetaInput[],
  });

  useEffect(() => {
    Promise.all([
      apiFetch<Categoria[]>("/api/categorias?tipo=receta"),
      apiFetch<Ingrediente[]>("/api/ingredientes"),
      apiFetch<Receta[]>("/api/recetas?es_subreceta=true"),
    ]).then(([cats, ings, subs]) => {
      setCategorias(cats);
      setIngredientes(ings);
      setSubrecetas(subs);
      if (cats.length > 0) setForm((f) => ({ ...f, categoria_id: cats[0].id }));
      setLoading(false);
    });
  }, []);

  const addLinea = (tipo: "ingrediente" | "subreceta") => {
    setForm({
      ...form,
      lineas: [
        ...form.lineas,
        {
          ingrediente_id: tipo === "ingrediente" ? (ingredientes[0]?.id || null) : null,
          subreceta_id: tipo === "subreceta" ? (subrecetas[0]?.id || null) : null,
          cantidad: 1,
          unidad: tipo === "ingrediente" ? (ingredientes[0]?.unidad_uso || "g") : "unidad",
        },
      ],
    });
  };

  const removeLinea = (index: number) => {
    setForm({ ...form, lineas: form.lineas.filter((_, i) => i !== index) });
  };

  const updateLinea = (index: number, field: string, value: any) => {
    const lineas = [...form.lineas];
    (lineas[index] as any)[field] = value;
    setForm({ ...form, lineas });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await apiFetch<any>("/api/recetas", {
      method: "POST",
      body: JSON.stringify(form),
    });
    router.push(`/recetas/${result.id}`);
  };

  if (loading) return <p className="text-[#6B5E52] py-10 text-center">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/recetas" className="text-sm text-[#8B1A2B] hover:underline">← Volver a recetas</Link>
        <h1 className="text-2xl font-bold mt-1">Nueva Receta</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#6B5E52] mb-1">Nombre</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#6B5E52] mb-1">Categoría</label>
              <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: parseInt(e.target.value) })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm">
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#6B5E52] mb-1">Porciones por lote</label>
              <input type="number" min="1" value={form.porciones_por_lote} onChange={(e) => setForm({ ...form, porciones_por_lote: parseInt(e.target.value) || 1 })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#6B5E52] mb-1">Precio venta (CHF) — opcional</label>
              <input type="number" step="any" value={form.precio_venta ?? ""} onChange={(e) => setForm({ ...form, precio_venta: e.target.value ? parseFloat(e.target.value) : null })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={form.es_subreceta} onChange={(e) => setForm({ ...form, es_subreceta: e.target.checked })} />
              <label className="text-sm">Es sub-receta reutilizable</label>
            </div>
            {form.es_subreceta && (
              <div>
                <label className="block text-xs text-[#6B5E52] mb-1">Unidad de rendimiento</label>
                <select value={form.unidad_rendimiento ?? ""} onChange={(e) => setForm({ ...form, unidad_rendimiento: e.target.value || null })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm">
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
            <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full border border-[#D4C4A8] rounded px-3 py-2 text-sm" rows={2} />
          </div>
        </div>

        {/* Lines */}
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Ingredientes</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => addLinea("ingrediente")} className="text-sm text-[#8B1A2B] hover:text-[#6B1420]">+ Ingrediente</button>
              {subrecetas.length > 0 && (
                <button type="button" onClick={() => addLinea("subreceta")} className="text-sm text-purple-600 hover:text-purple-800">+ Sub-receta</button>
              )}
            </div>
          </div>
          {form.lineas.length === 0 ? (
            <p className="text-sm text-[#6B5E52]/70">Añade ingredientes a la receta</p>
          ) : (
            <div className="space-y-2">
              {form.lineas.map((linea, i) => (
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
                  <input type="number" step="any" value={linea.cantidad} onChange={(e) => updateLinea(i, "cantidad", parseFloat(e.target.value) || 0)} className="w-20 border border-[#D4C4A8] rounded px-2 py-1 text-sm" placeholder="Cant." />
                  <select value={linea.unidad} onChange={(e) => updateLinea(i, "unidad", e.target.value)} className="border border-[#D4C4A8] rounded px-2 py-1 text-sm">
                    {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button type="button" onClick={() => removeLinea(i)} className="text-red-500 text-lg hover:text-red-700">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="bg-[#8B1A2B] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420]">Crear Receta</button>
      </form>
    </div>
  );
}
