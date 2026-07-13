"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Pedido } from "@/lib/types";

type Tab = "historial" | "pivot";

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
  const [tab, setTab] = useState<Tab>("historial");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pivot, setPivot] = useState<PivotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    apiFetch<Pedido[]>("/api/pedidos")
      .then(setPedidos)
      .finally(() => setLoading(false));
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
            onClick={() => setTab("historial")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "historial"
                ? "bg-[#8B1A2B] text-white"
                : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
            }`}
          >
            Historial
          </button>
          <button
            onClick={() => {
              setTab("pivot");
              if (!pivot) apiFetch<PivotData>("/api/pedidos/pivot").then(setPivot);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "pivot"
                ? "bg-[#8B1A2B] text-white"
                : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
            }`}
          >
            Pivot
          </button>
        </div>
      </div>

      <p className="text-sm text-[#6B5E52]">
        Para crear un nuevo pedido, registra el stock actual en{" "}
        <Link href="/inventario" className="text-[#8B1A2B] hover:underline font-medium">
          Inventario
        </Link>.
      </p>

      {loading ? (
        <p className="text-[#6B5E52] text-center py-10">Cargando...</p>
      ) : tab === "historial" ? (
        <div className="space-y-3">
          {pedidos.length === 0 ? (
            <p className="text-[#6B5E52] text-center py-10">No hay pedidos.</p>
          ) : (
            pedidos.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-[#E8DFD3] rounded-lg px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.proveedor}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${estadoColor(p.estado)}`}
                    >
                      {p.estado}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B5E52] mt-0.5">
                    {p.fecha} — {p.num_lineas} items
                  </p>
                </div>
                <div className="flex gap-2">
                  {p.estado === "borrador" && (
                    <>
                      <button
                        onClick={() => handleEnviar(p.id)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Enviar
                      </button>
                      <button
                        onClick={() => handleEliminar(p.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                  {p.estado === "enviado" && (
                    <Link
                      href={`/pedidos/${p.id}/recibir`}
                      className="text-xs text-green-600 hover:text-green-800"
                    >
                      Recibir
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
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
                    <th className="pb-2 pr-4 font-medium sticky left-0 bg-[#F5F0E8] z-10">
                      Ingrediente
                    </th>
                    <th className="pb-2 px-2 font-medium">Ud</th>
                    {pivot.fechas.map((f) => (
                      <th
                        key={f}
                        className="pb-2 px-2 font-medium text-center whitespace-nowrap"
                      >
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pivot.ingredientes.map((ing) => (
                    <tr
                      key={ing.ingrediente_id}
                      className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]"
                    >
                      <td className="py-1.5 pr-4 sticky left-0 bg-[#F5F0E8] z-10 font-medium">
                        <Link
                          href={`/ingredientes/${ing.ingrediente_id}`}
                          className="text-[#8B1A2B] hover:underline"
                        >
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
