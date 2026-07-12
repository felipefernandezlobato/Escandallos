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
  categoria: string;
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

  if (loading) return <p className="text-[#6B5E52] py-10 text-center">Cargando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Comparador de Proveedores</h1>
      <p className="text-sm text-[#6B5E52]">
        {data.filter(d => d.proveedores.length > 1).length} ingredientes con múltiples proveedores. El más barato tiene borde verde.
      </p>

      {(() => {
        const multiSupplier = data.filter(d => d.proveedores.length > 1);
        const grouped: Record<string, ComparacionItem[]> = {};
        for (const item of multiSupplier) {
          const cat = item.categoria || "Sin categoría";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        }
        const sortedCats = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "es"));

        return sortedCats.map((cat) => (
          <section key={cat}>
            <h2 className="text-lg font-bold bg-[#8B1A2B] text-white px-4 py-2 rounded-t-lg">{cat}</h2>
            <div className="bg-white border border-[#E8DFD3] rounded-b-lg overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F0E8] text-left text-[#6B5E52] border-b border-[#E8DFD3]">
                    <th className="px-4 py-2 font-medium">Ingrediente</th>
                    <th className="px-4 py-2 font-medium text-right">Precio actual</th>
                    <th className="px-4 py-2 font-medium">Proveedores</th>
                    <th className="px-4 py-2 font-medium text-right">Mejor precio</th>
                    <th className="px-4 py-2 font-medium text-right">Ahorro</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[cat].map((item) => {
                    const cheapest = item.proveedores[0];
                    const worst = item.proveedores[item.proveedores.length - 1];
                    const ahorro = ((worst.precio_por_unidad - cheapest.precio_por_unidad) / worst.precio_por_unidad) * 100;
                    const colors: Record<string, string> = {
                      "Rietschi": "bg-blue-100 text-blue-800",
                      "Denner": "bg-amber-100 text-amber-800",
                      "Prodega": "bg-purple-100 text-purple-800",
                      "Caporaso": "bg-rose-100 text-rose-800",
                      "Pfaff": "bg-emerald-100 text-emerald-800",
                      "Covin": "bg-orange-100 text-orange-800",
                    };

                    return (
                      <tr key={item.ingrediente_id} className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]">
                        <td className="px-4 py-2 font-medium">{item.nombre}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {item.precio_actual.toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {item.proveedores.map((p, i) => {
                              const color = colors[p.proveedor] || "bg-[#F5F0E8] text-[#6B5E52]";
                              const isBest = i === 0 ? " ring-2 ring-green-400" : "";
                              return (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}${isBest}`}
                                >
                                  {p.proveedor}: {p.precio.toFixed(2)}/{p.cantidad}{p.unidad}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-green-600 font-medium">
                          {cheapest.precio_por_unidad.toFixed(3)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-xs text-green-600">{ahorro.toFixed(0)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ));
      })()}
    </div>
  );
}
