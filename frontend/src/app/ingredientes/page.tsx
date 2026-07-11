"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Categoria, Ingrediente } from "@/lib/types";

const UNIDADES = ["kg", "g", "mg", "litro", "ml", "cl", "unidad"];

export default function IngredientesPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [buscar, setBuscar] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");

  // Form state
  const [form, setForm] = useState({
    nombre: "",
    categoria_id: 0,
    unidad_compra: "kg",
    cantidad_compra: 1,
    precio_compra: 0,
    unidad_uso: "g",
    merma_porcentaje: 0,
    proveedor: "",
    notas: "",
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      apiFetch<Ingrediente[]>(
        `/api/ingredientes?${filtroCategoria ? `categoria_id=${filtroCategoria}&` : ""}${buscar ? `buscar=${encodeURIComponent(buscar)}` : ""}`
      ),
      apiFetch<Categoria[]>("/api/categorias?tipo=ingrediente"),
    ])
      .then(([i, c]) => {
        setIngredientes(i);
        setCategorias(c);
        if (c.length > 0 && form.categoria_id === 0) {
          setForm((f) => ({ ...f, categoria_id: c[0].id }));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [filtroCategoria, buscar]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch("/api/ingredientes", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({
      nombre: "",
      categoria_id: categorias[0]?.id || 0,
      unidad_compra: "kg",
      cantidad_compra: 1,
      precio_compra: 0,
      unidad_uso: "g",
      merma_porcentaje: 0,
      proveedor: "",
      notas: "",
    });
    fetchData();
  };

  const handlePriceUpdate = async (id: number) => {
    const price = parseFloat(editPriceValue);
    if (isNaN(price)) return;
    await apiFetch(`/api/ingredientes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ precio_compra: price }),
    });
    setEditingPrice(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este ingrediente?")) return;
    try {
      await apiFetch(`/api/ingredientes/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Ingredientes</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {showForm ? "Cancelar" : "+ Nuevo Ingrediente"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar ingrediente..."
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-lg p-4 space-y-4"
        >
          <h3 className="font-semibold">Nuevo Ingrediente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nombre</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Categoría</label>
              <select
                value={form.categoria_id}
                onChange={(e) => setForm({ ...form, categoria_id: parseInt(e.target.value) })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Proveedor</label>
              <input
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Unidad compra</label>
              <select
                value={form.unidad_compra}
                onChange={(e) => setForm({ ...form, unidad_compra: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cantidad compra</label>
              <input
                type="number"
                step="any"
                required
                value={form.cantidad_compra}
                onChange={(e) => setForm({ ...form, cantidad_compra: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Precio compra (CHF)</label>
              <input
                type="number"
                step="any"
                required
                value={form.precio_compra}
                onChange={(e) => setForm({ ...form, precio_compra: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Unidad uso</label>
              <select
                value={form.unidad_uso}
                onChange={(e) => setForm({ ...form, unidad_uso: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Merma (%)</label>
              <input
                type="number"
                step="any"
                min="0"
                max="99"
                value={form.merma_porcentaje}
                onChange={(e) => setForm({ ...form, merma_porcentaje: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Crear Ingrediente
          </button>
        </form>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-slate-500 text-center py-10">Cargando...</p>
      ) : ingredientes.length === 0 ? (
        <p className="text-slate-500 text-center py-10">No hay ingredientes. Crea uno para empezar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 font-medium">Nombre</th>
                <th className="pb-2 font-medium">Categoría</th>
                <th className="pb-2 font-medium">Proveedor</th>
                <th className="pb-2 font-medium text-right">Precio Compra</th>
                <th className="pb-2 font-medium text-right">Merma</th>
                <th className="pb-2 font-medium text-right">Coste/{"{"}u. uso{"}"}</th>
                <th className="pb-2 font-medium text-right">Recetas</th>
                <th className="pb-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingredientes.map((ing) => (
                <tr key={ing.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 font-medium">{ing.nombre}</td>
                  <td className="py-2 text-slate-500">{ing.categoria_nombre}</td>
                  <td className="py-2 text-slate-500">{ing.proveedor || "—"}</td>
                  <td className="py-2 text-right">
                    {editingPrice === ing.id ? (
                      <span className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="any"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handlePriceUpdate(ing.id);
                            if (e.key === "Escape") setEditingPrice(null);
                          }}
                          className="w-20 border border-blue-400 rounded px-1 py-0.5 text-sm text-right"
                          autoFocus
                        />
                        <button
                          onClick={() => handlePriceUpdate(ing.id)}
                          className="text-green-600 text-xs"
                        >
                          ✓
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPrice(ing.id);
                          setEditPriceValue(String(ing.precio_compra));
                        }}
                        className="hover:text-blue-600 cursor-pointer"
                        title="Click para editar precio"
                      >
                        {ing.precio_compra.toFixed(2)} CHF/{ing.unidad_compra}
                      </button>
                    )}
                  </td>
                  <td className="py-2 text-right">{ing.merma_porcentaje}%</td>
                  <td className="py-2 text-right font-mono text-xs">
                    {ing.coste_por_unidad_uso.toFixed(4)} CHF/{ing.unidad_uso}
                  </td>
                  <td className="py-2 text-right text-slate-500">{ing.num_recetas}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(ing.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                      title="Eliminar"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
