"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { Ingrediente } from "@/lib/types";

interface LineaPedido {
  id: number;
  ingrediente_id: number;
  ingrediente_nombre: string;
  cantidad_pedida: number;
  unidad: string;
  cantidad_recibida: number | null;
  precio_unitario: number | null;
  precio_eur: number | null;
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
  const [editingLinea, setEditingLinea] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    cantidad_pedida: string;
    cantidad_recibida: string;
    precio_unitario: string;
  }>({ cantidad_pedida: "", cantidad_recibida: "", precio_unitario: "" });
  const [editingNotas, setEditingNotas] = useState(false);
  const [notasValue, setNotasValue] = useState("");

  // Add lines state
  const [showAgregar, setShowAgregar] = useState(false);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [nuevasLineas, setNuevasLineas] = useState<Record<number, string>>({});
  const [agregando, setAgregando] = useState(false);

  const fetchPedido = () => {
    apiFetch<PedidoDetail>(`/api/pedidos/${params.id}`)
      .then(setPedido)
      .catch(() => toast("Pedido no encontrado", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPedido();
  }, [params.id]);

  const handleEnviar = async () => {
    try {
      await apiFetch(`/api/pedidos/${params.id}/enviar`, { method: "POST" });
      toast("Pedido enviado", "success");
      fetchPedido();
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

  const handleEditLinea = (l: LineaPedido) => {
    setEditingLinea(l.id);
    setEditValues({
      cantidad_pedida: String(l.cantidad_pedida),
      cantidad_recibida: l.cantidad_recibida != null ? String(l.cantidad_recibida) : "",
      precio_unitario: l.precio_unitario != null ? String(l.precio_unitario) : "",
    });
  };

  const handleSaveLinea = async () => {
    if (editingLinea === null) return;
    const body: Record<string, number> = {};
    const qty = parseFloat(editValues.cantidad_pedida);
    if (!isNaN(qty)) body.cantidad_pedida = qty;
    const recibida = parseFloat(editValues.cantidad_recibida);
    if (!isNaN(recibida)) body.cantidad_recibida = recibida;
    const precio = parseFloat(editValues.precio_unitario);
    if (!isNaN(precio)) body.precio_unitario = precio;

    try {
      await apiFetch(`/api/pedidos/${params.id}/lineas/${editingLinea}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setEditingLinea(null);
      toast("Linea actualizada", "success");
      fetchPedido();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  };

  const handleDeleteLinea = async (lineaId: number, nombre: string) => {
    if (!confirm(`Eliminar "${nombre}" del pedido?`)) return;
    try {
      await apiFetch(`/api/pedidos/${params.id}/lineas/${lineaId}`, {
        method: "DELETE",
      });
      toast("Linea eliminada", "success");
      fetchPedido();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  };

  const handleSaveNotas = async () => {
    try {
      await apiFetch(`/api/pedidos/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({ notas: notasValue || null }),
      });
      setEditingNotas(false);
      toast("Notas actualizadas", "success");
      fetchPedido();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  };

  const openAgregar = () => {
    if (ingredientes.length === 0) {
      apiFetch<Ingrediente[]>("/api/ingredientes").then(setIngredientes);
    }
    setShowAgregar(true);
    setNuevasLineas({});
    setBusqueda("");
  };

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const ingredientesFiltrados = ingredientes
    .filter((i) => i.activo !== false && !i.excluir_pedidos)
    .filter((i) => {
      if (!pedido) return true;
      return !pedido.lineas.some((l) => l.ingrediente_id === i.id);
    })
    .filter((i) => !busqueda || normalize(i.nombre).includes(normalize(busqueda)));

  const nuevasCount = Object.values(nuevasLineas).filter((v) => v && parseFloat(v) > 0).length;

  const handleAgregarLineas = async () => {
    if (!pedido) return;
    const items = Object.entries(nuevasLineas)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([idStr, v]) => {
        const ing = ingredientes.find((i) => i.id === Number(idStr))!;
        return {
          ingrediente_id: ing.id,
          cantidad_pedida: parseFloat(v),
          unidad: ing.unidad_compra,
        };
      });

    if (items.length === 0) return;

    setAgregando(true);
    try {
      for (const item of items) {
        await apiFetch(`/api/pedidos/${params.id}/lineas`, {
          method: "POST",
          body: JSON.stringify(item),
        });
      }
      toast(`${items.length} linea${items.length > 1 ? "s" : ""} agregada${items.length > 1 ? "s" : ""}`, "success");
      setShowAgregar(false);
      fetchPedido();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setAgregando(false);
    }
  };

  if (loading) return <p className="text-[#6B5E52] py-10 text-center">Cargando...</p>;
  if (!pedido) return <p className="text-[#6B5E52] py-10 text-center">Pedido no encontrado</p>;

  const editable = pedido.estado !== "recibido";

  const estadoColor = (estado: string) => {
    switch (estado) {
      case "borrador": return "bg-yellow-100 text-yellow-800";
      case "enviado": return "bg-blue-100 text-blue-800";
      case "recibido": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const totalEstimado = pedido.lineas.reduce((sum, l) => {
    const qty = l.cantidad_recibida ?? l.cantidad_pedida;
    return sum + qty * (l.precio_unitario || 0);
  }, 0);
  const totalEur = pedido.lineas.reduce((sum, l) => {
    if (!l.precio_eur) return sum;
    const qty = l.cantidad_recibida ?? l.cantidad_pedida;
    return sum + qty * l.precio_eur;
  }, 0);

  return (
    <div className="space-y-6">
      <Link href="/pedidos" className="text-sm text-[#8B1A2B] hover:underline">
        &larr; Pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{pedido.proveedor}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${estadoColor(pedido.estado)}`}>
              {pedido.estado}
            </span>
            <span className="text-sm text-[#6B5E52]">Creado: {pedido.fecha}</span>
            {pedido.fecha_recepcion && (
              <span className="text-sm text-green-700">
                Recibido: {pedido.fecha_recepcion}
              </span>
            )}
            {totalEstimado > 0 && (
              <span className="text-sm font-medium">
                Total: {totalEstimado.toFixed(2)} CHF{totalEur > 0 ? ` (${totalEur.toFixed(2)}€)` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {pedido.estado === "borrador" && (
            <>
              <button
                onClick={handleEnviar}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Marcar como Enviado
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
              Recibir Pedido
            </Link>
          )}
          {editable && !showAgregar && (
            <button
              onClick={openAgregar}
              className="border border-[#8B1A2B] text-[#8B1A2B] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#F5F0E8] transition-colors"
            >
              + Agregar lineas
            </button>
          )}
        </div>
      </div>

      {/* Add lines form */}
      {showAgregar && (
        <div className="bg-white border border-[#8B1A2B]/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#8B1A2B]">
              Agregar ingredientes — {nuevasCount} seleccionados
            </h3>
            <button
              onClick={() => setShowAgregar(false)}
              className="text-sm text-[#6B5E52] hover:text-[#8B1A2B]"
            >
              Cancelar
            </button>
          </div>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar ingrediente..."
            className="w-full border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {ingredientesFiltrados.slice(0, 50).map((ing) => (
              <div
                key={ing.id}
                className={`flex items-center gap-2 rounded px-3 py-1.5 ${
                  nuevasLineas[ing.id] && parseFloat(nuevasLineas[ing.id]) > 0
                    ? "bg-[#F5F0E8] border border-[#8B1A2B]/20"
                    : "hover:bg-[#F5F0E8]/50"
                }`}
              >
                <span className="flex-1 text-sm truncate">{ing.nombre}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={nuevasLineas[ing.id] || ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(",", ".");
                    if (v === "" || /^\d*\.?\d*$/.test(v))
                      setNuevasLineas((prev) => ({ ...prev, [ing.id]: v }));
                  }}
                  className="w-16 border border-[#D4C4A8] rounded px-2 py-0.5 text-sm text-right"
                />
                <span className="text-xs text-[#6B5E52] w-12">{ing.unidad_compra}</span>
              </div>
            ))}
            {ingredientesFiltrados.length === 0 && (
              <p className="text-sm text-[#6B5E52] text-center py-4">No se encontraron ingredientes</p>
            )}
          </div>
          {nuevasCount > 0 && (
            <button
              onClick={handleAgregarLineas}
              disabled={agregando}
              className="w-full bg-[#8B1A2B] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#6D1422] transition-colors disabled:opacity-50"
            >
              {agregando ? "Agregando..." : `Agregar ${nuevasCount} linea${nuevasCount > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}

      <div className="bg-white border border-[#E8DFD3] rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="bg-[#F5F0E8] border-b border-[#E8DFD3] text-left text-[#6B5E52]">
              <th className="px-4 py-2 font-medium">Ingrediente</th>
              <th className="px-4 py-2 font-medium text-right">Pedido</th>
              {pedido.estado === "recibido" && (
                <th className="px-4 py-2 font-medium text-right">Recibido</th>
              )}
              <th className="px-4 py-2 font-medium text-right">Unidad</th>
              <th className="px-4 py-2 font-medium text-right">Precio ud.</th>
              {pedido.lineas.some((l: LineaPedido) => l.precio_eur) && (
                <th className="px-4 py-2 font-medium text-right">EUR origen</th>
              )}
              <th className="px-4 py-2 font-medium text-right w-24"></th>
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
                <td className="px-4 py-2 text-right">
                  {editingLinea === l.id ? (
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editValues.cantidad_pedida}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, cantidad_pedida: e.target.value }))
                      }
                      className="w-20 border border-[#8B1A2B] rounded px-2 py-0.5 text-sm text-right"
                    />
                  ) : (
                    l.cantidad_pedida
                  )}
                </td>
                {pedido.estado === "recibido" && (
                  <td className="px-4 py-2 text-right">
                    {editingLinea === l.id ? (
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={editValues.cantidad_recibida}
                        onChange={(e) =>
                          setEditValues((prev) => ({
                            ...prev,
                            cantidad_recibida: e.target.value,
                          }))
                        }
                        className="w-20 border border-[#8B1A2B] rounded px-2 py-0.5 text-sm text-right"
                      />
                    ) : (
                      l.cantidad_recibida ?? "—"
                    )}
                  </td>
                )}
                <td className="px-4 py-2 text-right text-[#6B5E52]">{l.unidad}</td>
                <td className="px-4 py-2 text-right text-[#6B5E52]">
                  {editingLinea === l.id ? (
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editValues.precio_unitario}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          precio_unitario: e.target.value,
                        }))
                      }
                      className="w-20 border border-[#8B1A2B] rounded px-2 py-0.5 text-sm text-right"
                    />
                  ) : l.precio_unitario != null ? (
                    l.precio_unitario.toFixed(2)
                  ) : (
                    "—"
                  )}
                </td>
                {pedido.lineas.some((ll: LineaPedido) => ll.precio_eur) && (
                  <td className="px-4 py-2 text-right text-[#6B5E52]">
                    {l.precio_eur ? `${l.precio_eur.toFixed(2)}€` : "—"}
                  </td>
                )}
                <td className="px-4 py-2 text-right">
                  {editingLinea === l.id ? (
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={handleSaveLinea}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingLinea(null)}
                        className="text-xs text-[#6B5E52] hover:text-[#8B1A2B]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEditLinea(l)}
                        className="text-xs text-[#6B5E52] hover:text-[#8B1A2B]"
                        title="Editar linea"
                      >
                        Editar
                      </button>
                      {editable && (
                        <button
                          onClick={() => handleDeleteLinea(l.id, l.ingrediente_nombre)}
                          className="text-xs text-red-400 hover:text-red-600"
                          title="Eliminar linea"
                        >
                          X
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notas section */}
      <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[#6B5E52] font-medium">Notas</p>
          {!editingNotas && (
            <button
              onClick={() => {
                setEditingNotas(true);
                setNotasValue(pedido.notas || "");
              }}
              className="text-xs text-[#6B5E52] hover:text-[#8B1A2B]"
            >
              Editar
            </button>
          )}
        </div>
        {editingNotas ? (
          <div className="space-y-2">
            <textarea
              value={notasValue}
              onChange={(e) => setNotasValue(e.target.value)}
              className="w-full border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm"
              rows={3}
              placeholder="Notas del pedido..."
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleSaveNotas}
                className="bg-[#8B1A2B] text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-[#6B1420]"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditingNotas(false)}
                className="text-xs text-[#6B5E52] hover:text-[#8B1A2B] px-3 py-1.5"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#6B5E52]">
            {pedido.notas || "Sin notas"}
          </p>
        )}
      </div>
    </div>
  );
}
