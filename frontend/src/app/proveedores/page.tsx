"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface PrecioItem {
  proveedor: string;
  precio_por_unidad: number;
  precio: number;
  cantidad: number;
  unidad: string;
  fecha: string;
}

interface ComparacionItem {
  nombre: string;
  ingrediente_id: number;
  precio_actual: number;
  proveedores: PrecioItem[];
}

export default function ProveedoresPage() {
  const [data, setData] = useState<ComparacionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ComparacionItem[]>("/api/proveedores/comparar")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500 py-10 text-center">Cargando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Comparador de Proveedores</h1>
      <p className="text-sm text-slate-500">
        {data.filter(d => d.proveedores.length > 1).length} ingredientes con múltiples proveedores. El más barato tiene borde verde.
      </p>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-2 font-medium">Ingrediente</th>
              <th className="px-4 py-2 font-medium text-right">Precio actual</th>
              <th className="px-4 py-2 font-medium">Proveedores</th>
              <th className="px-4 py-2 font-medium text-right">Mejor precio</th>
              <th className="px-4 py-2 font-medium text-right">Ahorro</th>
            </tr>
          </thead>
          <tbody>
            {data.filter(d => d.proveedores.length > 1).map((item) => {
              const best = item.proveedores[0];
              const worst = item.proveedores[item.proveedores.length - 1];
              const ahorro =
                item.proveedores.length > 1
                  ? ((worst.precio_por_unidad - best.precio_por_unidad) / worst.precio_por_unidad) * 100
                  : null;

              return (
                <tr key={item.ingrediente_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">{item.nombre}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {item.precio_actual.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.proveedores.map((p, i) => {
                        const colors: Record<string, string> = {
                          "Rietschi": "bg-blue-100 text-blue-800",
                          "Denner": "bg-amber-100 text-amber-800",
                          "Prodega": "bg-purple-100 text-purple-800",
                        };
                        const color = colors[p.proveedor] || "bg-slate-100 text-slate-600";
                        const best = i === 0 ? " ring-2 ring-green-400" : "";
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}${best}`}
                          >
                            {p.proveedor}: {p.precio.toFixed(2)}/{p.cantidad}{p.unidad}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-green-600 font-medium">
                    {best.precio_por_unidad.toFixed(3)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {ahorro !== null ? (
                      <span className="text-xs text-green-600">{ahorro.toFixed(0)}%</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
