"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { MargenBadge } from "@/components/MargenBadge";
import type { Alerta, RankingItem } from "@/lib/types";
import Link from "next/link";

export default function Dashboard() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Alerta[]>("/api/dashboard/alertas"),
      apiFetch<RankingItem[]>("/api/dashboard/rankings"),
    ])
      .then(([a, r]) => {
        setAlertas(a);
        setRankings(r);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-slate-500 py-10 text-center">Cargando...</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Panel Principal</h1>

      {/* Alertas */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Alertas</h2>
        {alertas.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
            Todo en orden — no hay alertas activas.
          </div>
        ) : (
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 text-sm border ${
                  a.tipo === "margen_bajo"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : a.tipo === "sin_precio"
                    ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}
              >
                {a.mensaje}
                {a.receta_id && (
                  <Link href={`/recetas/${a.receta_id}`} className="ml-2 underline">
                    Ver receta
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rankings */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Rankings de Rentabilidad</h2>
        {rankings.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay recetas aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 font-medium">Receta</th>
                  <th className="pb-2 font-medium">Categoría</th>
                  <th className="pb-2 font-medium text-right">Coste/ración</th>
                  <th className="pb-2 font-medium text-right">P. Venta</th>
                  <th className="pb-2 font-medium text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2">
                      <Link href={`/recetas/${r.id}`} className="text-blue-600 hover:underline">
                        {r.nombre}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-500">{r.categoria}</td>
                    <td className="py-2 text-right">{r.coste_por_porcion.toFixed(2)} CHF</td>
                    <td className="py-2 text-right">
                      {r.precio_venta ? `${r.precio_venta.toFixed(2)} CHF` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <MargenBadge margen={r.margen} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
