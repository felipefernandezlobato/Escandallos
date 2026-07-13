"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { PedidoDetail } from "@/lib/types";

interface RecibirLinea {
  linea_id: number;
  cantidad_recibida: string;
  precio_unitario: string;
}

export default function RecibirPedidoPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [pedido, setPedido] = useState<PedidoDetail | null>(null);
  const [lineas, setLineas] = useState<Record<number, RecibirLinea>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<PedidoDetail>(`/api/pedidos/${id}`)
      .then((p) => {
        setPedido(p);
        const initial: Record<number, RecibirLinea> = {};
        for (const l of p.lineas) {
          initial[l.id] = {
            linea_id: l.id,
            cantidad_recibida: String(l.cantidad_pedida),
            precio_unitario: l.precio_unitario ? String(l.precio_unitario) : "",
          };
        }
        setLineas(initial);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleRecibir = async () => {
    setSaving(true);
    const data = {
      lineas: Object.values(lineas).map((l) => ({
        linea_id: l.linea_id,
        cantidad_recibida: parseFloat(l.cantidad_recibida) || 0,
        precio_unitario: l.precio_unitario ? parseFloat(l.precio_unitario) : null,
      })),
    };
    try {
      const result = await apiFetch<{ ok: boolean; precios_actualizados: number }>(
        `/api/pedidos/${id}/recibir`,
        { method: "POST", body: JSON.stringify(data) }
      );
      toast(
        `Pedido recibido. ${
          result.precios_actualizados > 0
            ? `${result.precios_actualizados} precio(s) actualizado(s).`
            : ""
        }`
      );
      router.push("/pedidos");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-[#6B5E52] text-center py-10">Cargando...</p>;
  }

  if (!pedido) {
    return <p className="text-red-500 text-center py-10">Pedido no encontrado</p>;
  }

  if (pedido.estado === "recibido") {
    return (
      <div className="text-center py-10 space-y-2">
        <p className="text-[#6B5E52]">Este pedido ya fue recibido.</p>
        <button
          onClick={() => router.push("/pedidos")}
          className="text-[#8B1A2B] hover:underline text-sm"
        >
          Volver a pedidos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recibir Pedido</h1>
          <p className="text-sm text-[#6B5E52]">
            {pedido.proveedor} — {pedido.fecha}
          </p>
        </div>
        <button
          onClick={() => router.push("/pedidos")}
          className="text-sm text-[#6B5E52] hover:text-[#8B1A2B]"
        >
          Cancelar
        </button>
      </div>

      <p className="text-sm text-[#6B5E52]">
        Ajusta las cantidades reales recibidas y los precios si han cambiado.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
              <th className="pb-2 font-medium">Ingrediente</th>
              <th className="pb-2 font-medium text-right">Pedido</th>
              <th className="pb-2 font-medium text-right">Recibido</th>
              <th className="pb-2 font-medium text-right">Precio unit.</th>
            </tr>
          </thead>
          <tbody>
            {pedido.lineas.map((l) => (
              <tr key={l.id} className="border-b border-[#E8DFD3]/50">
                <td className="py-2">{l.ingrediente_nombre}</td>
                <td className="py-2 text-right text-[#6B5E52]">
                  {l.cantidad_pedida} {l.unidad}
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={lineas[l.id]?.cantidad_recibida ?? ""}
                    onChange={(e) =>
                      setLineas((prev) => ({
                        ...prev,
                        [l.id]: { ...prev[l.id], cantidad_recibida: e.target.value },
                      }))
                    }
                    className="w-20 border border-[#D4C4A8] rounded px-2 py-1 text-sm text-right"
                  />
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="—"
                    value={lineas[l.id]?.precio_unitario ?? ""}
                    onChange={(e) =>
                      setLineas((prev) => ({
                        ...prev,
                        [l.id]: { ...prev[l.id], precio_unitario: e.target.value },
                      }))
                    }
                    className="w-24 border border-[#D4C4A8] rounded px-2 py-1 text-sm text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleRecibir}
          disabled={saving}
          className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Procesando..." : "Confirmar Recepcion"}
        </button>
      </div>
    </div>
  );
}
