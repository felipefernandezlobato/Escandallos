"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { RecomendacionItem, Pedido } from "@/lib/types";

type Tab = "recomendacion" | "historial" | "pivot";

interface RecomendacionResponse {
  fecha: string;
  items: RecomendacionItem[];
}

interface PivotData {
  fechas: string[];
  ingredientes: Array<{
    ingrediente_id: number;
    ingrediente_nombre: string;
    unidad: string;
    fechas: Record<string, number>;
  }>;
}

export default function PedidosPage() {
  const [tab, setTab] = useState<Tab>("recomendacion");
  const [recomendacion, setRecomendacion] = useState<RecomendacionItem[]>([]);
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pivot, setPivot] = useState<PivotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filtroProveedor, setFiltroProveedor] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      apiFetch<RecomendacionResponse>("/api/inventario/recomendacion"),
      apiFetch<Pedido[]>("/api/pedidos"),
    ])
      .then(([rec, ped]) => {
        setRecomendacion(rec.items);
        setPedidos(ped);
        const initial: Record<number, string> = {};
        for (const item of rec.items) {
          initial[item.ingrediente_id] = String(item.cantidad_sugerida);
        }
        setCantidades(initial);
      })
      .finally(() => setLoading(false));
  };

  const proveedores = Array.from(
    new Set(recomendacion.map((r) => r.proveedor))
  ).sort((a, b) => a.localeCompare(b, "es"));

  const itemsFiltrados = filtroProveedor
    ? recomendacion.filter((r) => r.proveedor === filtroProveedor)
    : recomendacion;

  const porProveedor = proveedores.map((prov) => ({
    proveedor: prov,
    items: recomendacion.filter((r) => r.proveedor === prov),
  }));

  const handleCrearPedido = async (proveedor: string) => {
    const items = recomendacion.filter((r) => r.proveedor === proveedor);
    const lineas = items
      .filter((item) => {
        const qty = parseFloat(cantidades[item.ingrediente_id] || "0");
        return qty > 0;
      })
      .map((item) => ({
        ingrediente_id: item.ingrediente_id,
        cantidad_pedida: parseFloat(cantidades[item.ingrediente_id] || "0"),
        unidad: item.unidad,
      }));

    if (lineas.length === 0) {
      alert("No hay items seleccionados para este proveedor.");
      return;
    }

    setCreating(true);
    try {
      await apiFetch("/api/pedidos", {
        method: "POST",
        body: JSON.stringify({ proveedor, lineas }),
      });
      alert(`Pedido para ${proveedor} creado como borrador.`);
      fetchData();
    } catch (err) {
      alert("Error: " + (err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleEnviar = async (id: number) => {
    try {
      await apiFetch(`/api/pedidos/${id}/enviar`, { method: "POST" });
      fetchData();
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm("Eliminar este pedido?")) return;
    try {
      await apiFetch(`/api/pedidos/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  };

  const estadoColor = (estado: string) => {
    switch (estado) {
      case "borrador":
        return "bg-yellow-100 text-yellow-800";
      case "enviado":
        return "bg-blue-100 text-blue-800";
      case "recibido":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("recomendacion")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "recomendacion"
                ? "bg-[#8B1A2B] text-white"
                : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
            }`}
          >
            Nuevo Pedido
          </button>
          <button
            onClick={() => {
              setTab("historial");
              if (!pivot) apiFetch<PivotData>("/api/pedidos/pivot").then(setPivot);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "historial"
                ? "bg-[#8B1A2B] text-white"
                : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
            }`}
          >
            Historial
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[#6B5E52] text-center py-10">Cargando...</p>
      ) : tab === "recomendacion" ? (
        <>
          {recomendacion.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-[#6B5E52]">
                No hay datos de consumo para generar recomendaciones.
              </p>
              <p className="text-sm text-[#6B5E52]/70">
                Registra inventario y pedidos recibidos para que el sistema aprenda tus patrones de consumo.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {porProveedor.map(({ proveedor, items }) => (
                <div
                  key={proveedor}
                  className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3]">
                    <h2 className="font-semibold text-[#8B1A2B]">{proveedor}</h2>
                    <button
                      onClick={() => handleCrearPedido(proveedor)}
                      disabled={creating}
                      className="bg-[#8B1A2B] text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-[#6B1420] transition-colors disabled:opacity-50"
                    >
                      Crear Pedido
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                        <th className="px-4 py-2 font-medium">Ingrediente</th>
                        <th className="px-4 py-2 font-medium text-right">Stock</th>
                        <th className="px-4 py-2 font-medium text-right">Stock Deseado</th>
                        <th className="px-4 py-2 font-medium text-right">Pedir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr
                          key={item.ingrediente_id}
                          className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]"
                        >
                          <td className="px-4 py-2">
                            <Link href={`/ingredientes/${item.ingrediente_id}`} className="text-[#8B1A2B] hover:underline">
                              {item.ingrediente_nombre}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className={
                              item.dias_stock !== null && item.dias_stock < 2
                                ? "text-red-600 font-medium" : ""
                            }>
                              {item.stock_actual} {item.unidad}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-[#6B5E52]">
                            {(item as any).par_level ?? item.consumo_medio_semanal} {item.unidad}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={cantidades[item.ingrediente_id] || ""}
                              onChange={(e) =>
                                setCantidades((prev) => ({
                                  ...prev,
                                  [item.ingrediente_id]: e.target.value,
                                }))
                              }
                              className="w-20 border border-[#D4C4A8] rounded px-2 py-1 text-sm text-right"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {!pivot || pivot.ingredientes.length === 0 ? (
            <p className="text-[#6B5E52] text-center py-10">
              No hay pedidos recibidos todavia.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                    <th className="pb-2 pr-4 font-medium sticky left-0 bg-[#F5F0E8] z-10">Ingrediente</th>
                    <th className="pb-2 px-2 font-medium">Ud</th>
                    {pivot.fechas.map((f) => (
                      <th key={f} className="pb-2 px-2 font-medium text-center whitespace-nowrap">
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pivot.ingredientes.map((ing) => (
                    <tr key={ing.ingrediente_id} className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]">
                      <td className="py-1.5 pr-4 sticky left-0 bg-[#F5F0E8] z-10 font-medium">
                        <Link href={`/ingredientes/${ing.ingrediente_id}`} className="text-[#8B1A2B] hover:underline">
                          {ing.ingrediente_nombre}
                        </Link>
                      </td>
                      <td className="py-1.5 px-2 text-[#6B5E52]">{ing.unidad}</td>
                      {pivot.fechas.map((f) => (
                        <td key={f} className="py-1.5 px-2 text-center">
                          {ing.fechas[f] !== undefined ? ing.fechas[f] : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
