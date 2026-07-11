"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Categoria } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ConfiguracionPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editMargen, setEditMargen] = useState("");

  const [newCat, setNewCat] = useState({ nombre: "", tipo: "ingrediente" as string, margen_objetivo: "" });

  const fetchCategorias = () => {
    setLoading(true);
    apiFetch<Categoria[]>("/api/categorias")
      .then(setCategorias)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch("/api/categorias", {
      method: "POST",
      body: JSON.stringify({
        nombre: newCat.nombre,
        tipo: newCat.tipo,
        margen_objetivo: newCat.tipo === "receta" && newCat.margen_objetivo ? parseFloat(newCat.margen_objetivo) : null,
      }),
    });
    setNewCat({ nombre: "", tipo: "ingrediente", margen_objetivo: "" });
    setShowForm(false);
    fetchCategorias();
  };

  const handleUpdate = async (id: number) => {
    await apiFetch(`/api/categorias/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        nombre: editName,
        margen_objetivo: editMargen ? parseFloat(editMargen) : null,
      }),
    });
    setEditingId(null);
    fetchCategorias();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      await apiFetch(`/api/categorias/${id}`, { method: "DELETE" });
      fetchCategorias();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const ingredienteCats = categorias.filter((c) => c.tipo === "ingrediente");
  const recetaCats = categorias.filter((c) => c.tipo === "receta");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Configuración</h1>

      {/* Categories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Categorías</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nueva Categoría"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nombre</label>
              <input required value={newCat.nombre} onChange={(e) => setNewCat({ ...newCat, nombre: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tipo</label>
              <select value={newCat.tipo} onChange={(e) => setNewCat({ ...newCat, tipo: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm">
                <option value="ingrediente">Ingrediente</option>
                <option value="receta">Receta</option>
              </select>
            </div>
            {newCat.tipo === "receta" && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Margen objetivo (%)</label>
                <input type="number" step="any" value={newCat.margen_objetivo} onChange={(e) => setNewCat({ ...newCat, margen_objetivo: e.target.value })} className="w-24 border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
            )}
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Crear</button>
          </form>
        )}

        {loading ? (
          <p className="text-slate-500 text-center">Cargando...</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Ingredient categories */}
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Categorías de Ingredientes</h3>
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                {ingredienteCats.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between px-4 py-2">
                    {editingId === cat.id ? (
                      <span className="flex items-center gap-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm w-32" />
                        <button onClick={() => handleUpdate(cat.id)} className="text-green-600 text-xs">Guardar</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 text-xs">Cancelar</button>
                      </span>
                    ) : (
                      <span className="text-sm">{cat.nombre}</span>
                    )}
                    <span className="flex gap-2">
                      <button onClick={() => { setEditingId(cat.id); setEditName(cat.nombre); setEditMargen(""); }} className="text-blue-600 text-xs hover:underline">Editar</button>
                      <button onClick={() => handleDelete(cat.id)} className="text-red-500 text-xs hover:underline">Eliminar</button>
                    </span>
                  </div>
                ))}
                {ingredienteCats.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">Sin categorías</p>}
              </div>
            </div>

            {/* Recipe categories */}
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Categorías de Recetas</h3>
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                {recetaCats.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between px-4 py-2">
                    {editingId === cat.id ? (
                      <span className="flex items-center gap-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm w-28" />
                        <input type="number" step="any" placeholder="Margen %" value={editMargen} onChange={(e) => setEditMargen(e.target.value)} className="w-20 border border-slate-300 rounded px-2 py-1 text-sm" />
                        <button onClick={() => handleUpdate(cat.id)} className="text-green-600 text-xs">Guardar</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 text-xs">Cancelar</button>
                      </span>
                    ) : (
                      <span className="text-sm">
                        {cat.nombre}
                        {cat.margen_objetivo !== null && (
                          <span className="ml-2 text-xs text-slate-400">({cat.margen_objetivo}%)</span>
                        )}
                      </span>
                    )}
                    <span className="flex gap-2">
                      <button onClick={() => { setEditingId(cat.id); setEditName(cat.nombre); setEditMargen(cat.margen_objetivo?.toString() || ""); }} className="text-blue-600 text-xs hover:underline">Editar</button>
                      <button onClick={() => handleDelete(cat.id)} className="text-red-500 text-xs hover:underline">Eliminar</button>
                    </span>
                  </div>
                ))}
                {recetaCats.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">Sin categorías</p>}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Backup & Export */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Datos</h2>
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Copia de Seguridad</h3>
              <div className="flex gap-2">
                <a
                  href={`${API_BASE}/api/backup/descargar`}
                  className="bg-slate-100 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                  download
                >
                  Descargar Backup
                </a>
                <label className="bg-slate-100 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors cursor-pointer">
                  Restaurar Backup
                  <input
                    type="file"
                    accept=".db"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append("file", file);
                      await fetch(`${API_BASE}/api/backup/restaurar`, {
                        method: "POST",
                        body: formData,
                      });
                      alert("Backup restaurado. Recarga la página.");
                      window.location.reload();
                    }}
                  />
                </label>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Exportar CSV</h3>
              <div className="flex gap-2">
                <a
                  href={`${API_BASE}/api/export/ingredientes`}
                  className="bg-slate-100 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                  download
                >
                  Exportar Ingredientes
                </a>
                <a
                  href={`${API_BASE}/api/export/recetas`}
                  className="bg-slate-100 px-4 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                  download
                >
                  Exportar Recetas
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Unit system */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Sistema de Unidades</h2>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2 pr-8 font-medium">Familia</th>
                  <th className="pb-2 pr-8 font-medium">Unidades</th>
                  <th className="pb-2 font-medium">Conversiones</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-t border-slate-100">
                  <td className="py-2 pr-8 font-medium">Peso</td>
                  <td className="py-2 pr-8">kg, g, mg</td>
                  <td className="py-2">1 kg = 1000 g = 1.000.000 mg</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="py-2 pr-8 font-medium">Volumen</td>
                  <td className="py-2 pr-8">litro, ml, cl</td>
                  <td className="py-2">1 litro = 1000 ml = 100 cl</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="py-2 pr-8 font-medium">Unidad</td>
                  <td className="py-2 pr-8">unidad</td>
                  <td className="py-2">Sin conversión</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
