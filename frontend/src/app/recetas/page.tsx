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
          className="bg-[#8B1A2B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420] transition-colors"
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
          className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-[#6B5E52]">
          <input
            type="checkbox"
            checked={showSubrecetas}
            onChange={(e) => setShowSubrecetas(e.target.checked)}
          />
          Mostrar sub-recetas
        </label>
      </div>

      {/* Recipe cards grouped by category */}
      {loading ? (
        <p className="text-[#6B5E52] text-center py-10">Cargando...</p>
      ) : recetas.length === 0 ? (
        <p className="text-[#6B5E52] text-center py-10">No hay recetas. Crea una para empezar.</p>
      ) : (
        <div className="space-y-8">
          {(() => {
            const preferredOrder = ["Cafetería", "Postre", "Brunch", "Snack", "Bebida"];
            const allCatNames = categorias.filter(c => recetas.some(r => r.categoria_nombre === c.nombre)).map(c => c.nombre);
            const orderedCats = [...preferredOrder.filter(n => allCatNames.includes(n)), ...allCatNames.filter(n => !preferredOrder.includes(n))];
            return orderedCats.map((nombre) => categorias.find((c) => c.nombre === nombre)).filter((cat): cat is Categoria => cat !== undefined);
          })()
            .map((cat) => (
              <section key={cat.id}>
                <h2 className="text-lg font-bold mb-3">{cat.nombre}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {recetas
                    .filter((r) => r.categoria_nombre === cat.nombre)
                    .map((r) => (
                    <Link
                      key={r.id}
                      href={`/recetas/${r.id}`}
                      className="bg-white border border-[#E8DFD3] rounded-lg p-4 hover:shadow-md transition-shadow"
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
                          <span className="text-xs text-[#6B5E52]/70">—</span>
                        )}
                      </div>
                      <div className="text-xs text-[#6B5E52] space-y-1">
                        <p>Coste/{r.unidad_rendimiento || "ración"}: <span className="font-medium text-[#1A1A1A]">{r.coste_por_porcion.toFixed(2)} CHF</span></p>
                        {r.precio_venta && (
                          <p>Precio venta: <span className="font-medium text-[#1A1A1A]">{r.precio_venta.toFixed(2)} CHF</span></p>
                        )}
                        <p>Porciones/lote: {r.porciones_por_lote}</p>
                      </div>
                      {r.es_subreceta && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded bg-[#F2E8EA] text-[#8B1A2B] text-xs">
                          Sub-receta
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
