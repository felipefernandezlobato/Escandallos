"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Categoria, Receta } from "@/lib/types";
import Link from "next/link";

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [buscar, setBuscar] = useState("");
  const [showSubrecetas, setShowSubrecetas] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroCategoria) params.set("categoria_id", filtroCategoria);
    if (buscar) params.set("buscar", buscar);
    if (!showSubrecetas) params.set("es_subreceta", "false");

    Promise.all([
      apiFetch<Receta[]>(`/api/recetas?${params}`),
      apiFetch<Categoria[]>("/api/categorias?tipo=receta"),
    ])
      .then(([r, c]) => {
        setRecetas(r);
        setCategorias(c);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [filtroCategoria, buscar, showSubrecetas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Recetas</h1>
        <Link
          href="/recetas/nuevo"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Nueva Receta
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar receta..."
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
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showSubrecetas}
            onChange={(e) => setShowSubrecetas(e.target.checked)}
          />
          Mostrar sub-recetas
        </label>
      </div>

      {/* Recipe cards */}
      {loading ? (
        <p className="text-slate-500 text-center py-10">Cargando...</p>
      ) : recetas.length === 0 ? (
        <p className="text-slate-500 text-center py-10">No hay recetas. Crea una para empezar.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recetas.map((r) => (
            <Link
              key={r.id}
              href={`/recetas/${r.id}`}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{r.nombre}</h3>
                {r.precio_venta && r.coste_por_porcion > 0 ? (
                  <span className={`text-sm font-mono font-medium ${
                    r.precio_venta / r.coste_por_porcion >= 8 ? "text-green-600" :
                    r.precio_venta / r.coste_por_porcion >= 5 ? "text-orange-500" :
                    "text-red-600"
                  }`}>
                    x{(r.precio_venta / r.coste_por_porcion).toFixed(1)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p>Categoría: {r.categoria_nombre}</p>
                <p>Coste/{r.unidad_rendimiento || "ración"}: <span className="font-medium text-slate-700">{r.coste_por_porcion.toFixed(2)} CHF</span></p>
                {r.precio_venta && (
                  <p>Precio venta: <span className="font-medium text-slate-700">{r.precio_venta.toFixed(2)} CHF</span></p>
                )}
                <p>Porciones/lote: {r.porciones_por_lote}</p>
              </div>
              {r.es_subreceta && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">
                  Sub-receta
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
