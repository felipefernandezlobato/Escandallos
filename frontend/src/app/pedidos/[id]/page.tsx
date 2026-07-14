"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface LineaPedido {
  id: number;
  ingrediente_id: number;
  ingrediente_nombre: string;
  cantidad_pedida: number;
  unidad: string;
  cantidad_recibida: number | null;
  precio_unitario: number | null;
}

interface PedidoDetail {
  id: number;
  fecha: string;
  proveedor: string;
  estado: string;
  notas: string | null;
  fecha_recepcion: string | null;
  lineas: LineaPedido[];
}

export default function PedidoDetailPage() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [pedido, setPedido] = useState<PedidoDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PedidoDetail>(`/api/pedidos/${params.id}`)
      .then(setPedido)
      .catch(() => toast("Pedido no encontrado", "error"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleEnviar = async () => {
    try {
      await apiFetch(`/api/pedidos/${params.id}/enviar`, { method: "POST" });
      toast("Pedido enviado", "success");
      apiFetch<PedidoDetail>(`/api/pedidos/${params.id}`).then(setPedido);
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  };

  const handleEliminar = async () => {
    if (!confirm("Eliminar este pedido?")) return;
    try {
      await apiFetch(`/api/pedidos/${params.id}`, { method: "DELETE" });
      toast("Pedido eliminado", "success");
      router.push("/pedidos");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  };

  if (loading) return <p className="text-[#6B5E52] py-10 text-center">Cargando...</p>;
  if (!pedido) return <p className="text-[#6B5E52] py-10 text-center">Pedido no encontrado</p>;

  const estadoColor = (estado: string) => {
    switch (estado) {
      case "borrador": return "bg-yellow-100 text-yellow-800";
      case "enviado": return "bg-blue-100 text-blue-800";
      case "recibido": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/pedidos" className="text-sm text-[#8B1A2B] hover:underline">
        ← Pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{pedido.proveedor}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${estadoColor(pedido.estado)}`}>
              {pedido.estado}
            </span>
            <span className="text-sm text-[#6B5E52]">{pedido.fecha}</span>
            {pedido.fecha_recepcion && (
              <span className="text-sm text-[#6B5E52]">
                Recibido: {pedido.fecha_recepcion}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {pedido.estado === "borrador" && (
            <>
              <button
                onClick={handleEnviar}
                className="bg-[#8B1A2B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420] transition-colors"
              >
                Enviar
              </button>
              <button
                onClick={handleEliminar}
                className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Eliminar
              </button>
            </>
          )}
          {pedido.estado === "enviado" && (
            <Link
              href={`/pedidos/${pedido.id}/recibir`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Recibir
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5F0E8] border-b border-[#E8DFD3] text-left text-[#6B5E52]">
              <th className="px-4 py-2 font-medium">Ingrediente</th>
              <th className="px-4 py-2 font-medium text-right">Pedido</th>
              {pedido.estado === "recibido" && (
                <th className="px-4 py-2 font-medium text-right">Recibido</th>
              )}
              <th className="px-4 py-2 font-medium text-right">Unidad</th>
            </tr>
          </thead>
          <tbody>
            {pedido.lineas.map((l) => (
              <tr key={l.id} className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]">
                <td className="px-4 py-2">
                  <Link
                    href={`/ingredientes/${l.ingrediente_id}`}
                    className="text-[#8B1A2B] hover:underline"
                  >
                    {l.ingrediente_nombre}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right">{l.cantidad_pedida}</td>
                {pedido.estado === "recibido" && (
                  <td className="px-4 py-2 text-right">
                    {l.cantidad_recibida ?? "—"}
                  </td>
                )}
                <td className="px-4 py-2 text-right text-[#6B5E52]">{l.unidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pedido.notas && (
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52] mb-1">Notas</p>
          <p className="text-sm">{pedido.notas}</p>
        </div>
      )}
    </div>
  );
}
