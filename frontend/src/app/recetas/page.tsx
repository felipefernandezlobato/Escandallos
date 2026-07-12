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

      {/* Recipe sections by category */}
      {loading ? (
        <p className="text-slate-500 text-center py-10">Cargando...</p>
      ) : recetas.length === 0 ? (
        <p className="text-slate-500 text-center py-10">No hay recetas. Crea una para empezar.</p>
      ) : (
        <div className="space-y-6">
          {categorias
            .filter((cat) => recetas.some((r) => r.categoria_nombre === cat.nombre))
            .map((cat) => {
              const catRecetas = recetas.filter((r) => r.categoria_nombre === cat.nombre);
              return (
                <section key={cat.id}>
                  <h2 className="text-lg font-bold bg-slate-800 text-white px-4 py-2 rounded-t-lg">
                    {cat.nombre} <span className="text-slate-400 font-normal text-sm">({catRecetas.length})</span>
                  </h2>
                  <div className="bg-white border border-slate-200 rounded-b-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                          <th className="px-4 py-2 font-medium">Receta</th>
                          <th className="px-4 py-2 font-medium text-right w-24">Coste</th>
                          <th className="px-4 py-2 font-medium text-right w-24">PVP</th>
                          <th className="px-4 py-2 font-medium text-right w-20">Margen</th>
                          <th className="px-4 py-2 font-medium text-right w-16">x</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catRecetas.map((r) => {
                          const multi = r.precio_venta && r.coste_por_porcion > 0
                            ? r.precio_venta / r.coste_por_porcion
                            : null;
                          const multiColor = multi === null ? "text-slate-400"
                            : multi >= 8 ? "text-green-600 font-medium"
                            : multi >= 5 ? "text-orange-500"
                            : "text-red-600 font-medium";

                          return (
                            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-1.5">
                                <Link href={`/recetas/${r.id}`} className="text-blue-600 hover:underline">
                                  {r.nombre}
                                </Link>
                                {r.es_subreceta && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">
                                    sub
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-1.5 text-right font-mono text-xs">
                                {r.coste_por_porcion.toFixed(2)}
                              </td>
                              <td className="px-4 py-1.5 text-right">
                                {r.precio_venta ? r.precio_venta.toFixed(2) : "—"}
                              </td>
                              <td className="px-4 py-1.5 text-right font-mono text-xs">
                                {r.precio_venta && r.coste_por_porcion > 0
                                  ? (r.precio_venta - r.coste_por_porcion).toFixed(2)
                                  : "—"}
                              </td>
                              <td className={`px-4 py-1.5 text-right font-mono ${multiColor}`}>
                                {multi !== null ? `x${multi.toFixed(1)}` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
