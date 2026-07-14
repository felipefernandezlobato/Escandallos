"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { Pedido } from "@/lib/types";

type Tab = "activos" | "historial" | "pivot";
type FiltroEstado = "todos" | "borrador" | "enviado" | "recibido";

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
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("activos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
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
      toast("Pedido marcado como enviado", "success");
      fetchData();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm("Eliminar este pedido?")) return;
    try {
      await apiFetch(`/api/pedidos/${id}`, { method: "DELETE" });
      toast("Pedido eliminado", "success");
      fetchData();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
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

  const activePedidos = pedidos.filter(
    (p) => p.estado === "borrador" || p.estado === "enviado"
  );
  const historialPedidos =
    filtroEstado === "todos"
      ? pedidos
      : pedidos.filter((p) => p.estado === filtroEstado);

  const counts = {
    borrador: pedidos.filter((p) => p.estado === "borrador").length,
    enviado: pedidos.filter((p) => p.estado === "enviado").length,
    recibido: pedidos.filter((p) => p.estado === "recibido").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("activos")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "activos"
                ? "bg-[#8B1A2B] text-white"
                : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
            }`}
          >
            Activos
            {activePedidos.length > 0 && (
              <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                {activePedidos.length}
              </span>
            )}
          </button>
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
        <Link
          href="/inventario"
          className="text-[#8B1A2B] hover:underline font-medium"
        >
          Inventario
        </Link>
        .
      </p>

      {loading ? (
        <p className="text-[#6B5E52] text-center py-10">Cargando...</p>
      ) : tab === "activos" ? (
        <div className="space-y-4">
          {activePedidos.length === 0 ? (
            <p className="text-[#6B5E52] text-center py-10">
              No hay pedidos activos.
            </p>
          ) : (
            <>
              {/* Borradores */}
              {counts.borrador > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-yellow-700 uppercase tracking-wider mb-2">
                    Borradores ({counts.borrador})
                  </h2>
                  <div className="space-y-2">
                    {activePedidos
                      .filter((p) => p.estado === "borrador")
                      .map((p) => (
                        <div
                          key={p.id}
                          className="bg-white border border-yellow-200 rounded-lg px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/pedidos/${p.id}`}
                                  className="font-medium text-[#8B1A2B] hover:underline"
                                >
                                  {p.proveedor}
                                </Link>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                                  borrador
                                </span>
                              </div>
                              <p className="text-xs text-[#6B5E52] mt-0.5">
                                {p.fecha} — {p.num_lineas} items
                                {p.total_estimado > 0 && (
                                  <span className="ml-2">
                                    ~{p.total_estimado.toFixed(2)} CHF
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEnviar(p.id)}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                              >
                                Enviar
                              </button>
                              <Link
                                href={`/pedidos/${p.id}`}
                                className="border border-[#D4C4A8] text-[#6B5E52] px-3 py-1.5 rounded text-xs font-medium hover:bg-[#F5F0E8] transition-colors"
                              >
                                Ver
                              </Link>
                              <button
                                onClick={() => handleEliminar(p.id)}
                                className="text-xs text-red-500 hover:text-red-700 px-2"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Enviados */}
              {counts.enviado > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-2">
                    Enviados — Pendientes de recibir ({counts.enviado})
                  </h2>
                  <div className="space-y-2">
                    {activePedidos
                      .filter((p) => p.estado === "enviado")
                      .map((p) => (
                        <div
                          key={p.id}
                          className="bg-white border border-blue-200 rounded-lg px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/pedidos/${p.id}`}
                                  className="font-medium text-[#8B1A2B] hover:underline"
                                >
                                  {p.proveedor}
                                </Link>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                  enviado
                                </span>
                              </div>
                              <p className="text-xs text-[#6B5E52] mt-0.5">
                                {p.fecha} — {p.num_lineas} items
                                {p.total_estimado > 0 && (
                                  <span className="ml-2">
                                    ~{p.total_estimado.toFixed(2)} CHF
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Link
                                href={`/pedidos/${p.id}/recibir`}
                                className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-700 transition-colors"
                              >
                                Recibir
                              </Link>
                              <Link
                                href={`/pedidos/${p.id}`}
                                className="border border-[#D4C4A8] text-[#6B5E52] px-3 py-1.5 rounded text-xs font-medium hover:bg-[#F5F0E8] transition-colors"
                              >
                                Ver
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : tab === "historial" ? (
        <div className="space-y-4">
          {/* Estado filter chips */}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { key: "todos", label: "Todos", count: pedidos.length },
                { key: "borrador", label: "Borradores", count: counts.borrador },
                { key: "enviado", label: "Enviados", count: counts.enviado },
                { key: "recibido", label: "Recibidos", count: counts.recibido },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltroEstado(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filtroEstado === f.key
                    ? "bg-[#8B1A2B] text-white"
                    : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {historialPedidos.length === 0 ? (
            <p className="text-[#6B5E52] text-center py-10">No hay pedidos.</p>
          ) : (
            <div className="space-y-2">
              {historialPedidos.map((p) => (
                <div
                  key={p.id}
                  className={`bg-white border rounded-lg px-4 py-3 ${
                    p.estado === "borrador"
                      ? "border-yellow-200"
                      : p.estado === "enviado"
                      ? "border-blue-200"
                      : "border-[#E8DFD3]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/pedidos/${p.id}`}
                          className="font-medium text-[#8B1A2B] hover:underline"
                        >
                          {p.proveedor}
                        </Link>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${estadoColor(p.estado)}`}
                        >
                          {p.estado}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B5E52] mt-0.5">
                        {p.fecha} — {p.num_lineas} items
                        {p.total_estimado > 0 && (
                          <span className="ml-2">~{p.total_estimado.toFixed(2)} CHF</span>
                        )}
                        {p.fecha_recepcion && (
                          <span className="ml-2 text-green-700">Recibido: {p.fecha_recepcion}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center flex-shrink-0">
                      <Link
                        href={`/pedidos/${p.id}`}
                        className="text-xs text-[#8B1A2B] hover:underline"
                      >
                        Ver
                      </Link>
                      {p.estado === "borrador" && (
                        <button
                          onClick={() => handleEnviar(p.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Enviar
                        </button>
                      )}
                      {p.estado === "enviado" && (
                        <Link
                          href={`/pedidos/${p.id}/recibir`}
                          className="text-xs text-green-600 hover:text-green-800"
                        >
                          Recibir
                        </Link>
                      )}
                      {p.estado !== "recibido" && (
                        <button
                          onClick={() => handleEliminar(p.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                    <th className="pb-2 px-2 font-medium whitespace-nowrap">
                      Ud
                    </th>
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
                      <td className="py-1.5 px-2 text-[#6B5E52] whitespace-nowrap">
                        {ing.unidad}
                      </td>
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
