"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { Categoria, Ingrediente, Pedido } from "@/lib/types";

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

function mejorProveedor(ing: Ingrediente): string {
  const precios = ing.precios_proveedores;
  if (precios && Object.keys(precios).length > 0) {
    let best = "";
    let bestPrice = Infinity;
    for (const [prov, precio] of Object.entries(precios)) {
      if (precio < bestPrice) {
        bestPrice = precio;
        best = prov;
      }
    }
    if (best) return best;
  }
  return ing.proveedor || "Sin proveedor";
}

export default function PedidosPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("activos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pivot, setPivot] = useState<PivotData | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCrear, setShowCrear] = useState(false);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ultimoConteo, setUltimoConteo] = useState<Record<string, { fecha: string; unidad: string }>>({});
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    apiFetch<Pedido[]>("/api/pedidos")
      .then(setPedidos)
      .finally(() => setLoading(false));
  };

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const unidadPedido = (ing: Ingrediente) => ultimoConteo[String(ing.id)]?.unidad || ing.unidad_compra;

  const openCrear = () => {
    if (ingredientes.length === 0) {
      Promise.all([
        apiFetch<Ingrediente[]>("/api/ingredientes"),
        apiFetch<Categoria[]>("/api/categorias?tipo=ingrediente"),
        apiFetch<Record<string, { fecha: string; unidad: string }>>("/api/inventario/ultimo-conteo"),
      ]).then(([ings, cats, conteo]) => {
        setIngredientes(ings);
        setCategorias(cats);
        setUltimoConteo(conteo);
      });
    }
    setShowCrear(true);
    setCantidades({});
    setBusqueda("");
    setFiltroCategoria("");
  };

  const ingredientesFiltrados = ingredientes
    .filter((i) => !i.excluir_pedidos)
    .filter((i) => !busqueda || normalize(i.nombre).includes(normalize(busqueda)))
    .filter((i) => !filtroCategoria || String(i.categoria_id) === filtroCategoria);

  const porCategoria = categorias
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      items: ingredientesFiltrados.filter((i) => i.categoria_id === c.id),
    }))
    .filter((g) => g.items.length > 0);

  const filledCount = Object.values(cantidades).filter((v) => v && parseFloat(v) > 0).length;

  const handleCrearPedidos = async () => {
    const lineasConCantidad = Object.entries(cantidades)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([idStr, v]) => {
        const ing = ingredientes.find((i) => i.id === Number(idStr))!;
        return {
          ingrediente_id: ing.id,
          cantidad_pedida: parseFloat(v),
          unidad: unidadPedido(ing),
          proveedor: mejorProveedor(ing),
        };
      });

    if (lineasConCantidad.length === 0) {
      toast("Pon cantidad > 0 en al menos un ingrediente", "error");
      return;
    }

    const porProv: Record<string, typeof lineasConCantidad> = {};
    for (const l of lineasConCantidad) {
      porProv[l.proveedor] = porProv[l.proveedor] || [];
      porProv[l.proveedor].push(l);
    }

    setCreando(true);
    try {
      let creados = 0;
      for (const [prov, items] of Object.entries(porProv)) {
        await apiFetch("/api/pedidos", {
          method: "POST",
          body: JSON.stringify({
            proveedor: prov,
            lineas: items.map((l) => ({
              ingrediente_id: l.ingrediente_id,
              cantidad_pedida: l.cantidad_pedida,
              unidad: l.unidad,
            })),
          }),
        });
        creados++;
      }
      toast(`${creados} pedido${creados > 1 ? "s" : ""} creado${creados > 1 ? "s" : ""} como borrador`, "success");
      setShowCrear(false);
      fetchData();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setCreando(false);
    }
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

      {!showCrear && (
        <div className="flex items-center gap-4">
          <button
            onClick={openCrear}
            className="bg-[#8B1A2B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6D1422] transition-colors"
          >
            + Crear Pedido
          </button>
          <p className="text-sm text-[#6B5E52]">
            o registra stock en{" "}
            <Link href="/inventario" className="text-[#8B1A2B] hover:underline font-medium">
              Inventario
            </Link>{" "}
            para pedidos con recomendación.
          </p>
        </div>
      )}

      {showCrear && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#8B1A2B]">Nuevo Pedido — {filledCount} items</h2>
            <div className="flex gap-3">
              {filledCount > 0 && (
                <button onClick={() => setCantidades({})} className="text-sm text-red-500 hover:text-red-700">
                  Vaciar todo
                </button>
              )}
              <button onClick={() => setShowCrear(false)} className="text-sm text-[#6B5E52] hover:text-[#8B1A2B]">
                Cancelar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ingrediente..."
              className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
            />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-6">
            {porCategoria.map((grupo) => (
              <div key={grupo.id}>
                <h3 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider mb-2 border-b border-[#E8DFD3] pb-1">
                  {grupo.nombre}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {grupo.items.map((ing) => (
                    <div
                      key={ing.id}
                      className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${
                        cantidades[ing.id] && parseFloat(cantidades[ing.id]) > 0
                          ? "bg-[#F5F0E8] border-[#8B1A2B]/30"
                          : "bg-white border-[#E8DFD3]"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{ing.nombre}</span>
                        <span className="text-[10px] text-[#6B5E52]/60">{mejorProveedor(ing)}</span>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={cantidades[ing.id] || ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(",", ".");
                          if (v === "" || /^\d*\.?\d*$/.test(v))
                            setCantidades((prev) => ({ ...prev, [ing.id]: v }));
                        }}
                        className="w-20 border border-[#D4C4A8] rounded px-2 py-1 text-sm text-right"
                      />
                      <span className="text-xs text-[#6B5E52] w-10">{unidadPedido(ing)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filledCount > 0 && (
            <div className="sticky bottom-4">
              <button
                onClick={handleCrearPedidos}
                disabled={creando}
                className="w-full bg-[#8B1A2B] text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-[#6D1422] transition-colors disabled:opacity-50 shadow-lg"
              >
                {creando ? "Creando..." : `Crear Pedido (${filledCount} items)`}
              </button>
            </div>
          )}
        </div>
      )}

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
