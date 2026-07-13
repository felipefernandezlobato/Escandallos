"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Ingrediente, Categoria } from "@/lib/types";

interface StockEntry {
  ingrediente_id: number;
  cantidad: string;
  unidad: string;
}

interface InventarioSnapshot {
  fecha: string;
  registros: Array<{
    id: number;
    ingrediente_id: number;
    cantidad: number;
    unidad: string;
    fecha_registro: string;
    notas: string | null;
    ingrediente_nombre: string;
  }>;
  total_items: number;
}

export default function InventarioPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [stock, setStock] = useState<Record<number, StockEntry>>({});
  const [buscar, setBuscar] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"registrar" | "historial" | "analisis">("registrar");
  const [fechas, setFechas] = useState<string[]>([]);
  const [historialFecha, setHistorialFecha] = useState("");
  const [historial, setHistorial] = useState<InventarioSnapshot | null>(null);
  const [pivot, setPivot] = useState<{
    fechas: string[];
    ingredientes: Array<{
      ingrediente_id: number;
      ingrediente_nombre: string;
      unidad: string;
      fechas: Record<string, number>;
    }>;
  } | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<Array<{
    ingrediente_id: number;
    ingrediente_nombre: string;
    stock_actual: number;
    unidad: string;
    dias_stock: number;
    consumo_diario: number;
  }>>([]);
  const [costeSemanal, setCosteSemanal] = useState<Array<{
    semana: string;
    proveedores: Record<string, number>;
    total: number;
  }>>([]);
  const [consumoDetalle, setConsumoDetalle] = useState<{
    ingrediente_id: number;
    ingrediente_nombre: string;
    consumo_medio: number;
    unidad: string;
    tendencia: string;
    reorder_point?: number | null;
    eoq?: number | null;
    historial: Array<{ semana: string; cantidad: number; unidad: string }>;
    stock_historial?: Array<{ fecha: string; cantidad: number; unidad: string }>;
  } | null>(null);
  const [selectedIngId, setSelectedIngId] = useState<number | null>(null);
  const [vista, setVista] = useState<"cocina" | "cafe">("cocina");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<Ingrediente[]>("/api/ingredientes"),
      apiFetch<Categoria[]>("/api/categorias?tipo=ingrediente"),
      apiFetch<{ fechas: string[]; snapshot: InventarioSnapshot | null }>("/api/inventario"),
    ])
      .then(([ings, cats, inv]) => {
        setIngredientes(ings);
        setCategorias(cats);
        setFechas(inv.fechas || []);

        const initial: Record<number, StockEntry> = {};
        for (const ing of ings) {
          initial[ing.id] = {
            ingrediente_id: ing.id,
            cantidad: "",
            unidad: ing.unidad_uso,
          };
        }
        // Start empty — user fills in current stock from scratch
        setStock(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchAnalisis = () => {
    Promise.all([
      apiFetch<typeof alertas>("/api/inventario/alertas-stock"),
      apiFetch<typeof costeSemanal>("/api/inventario/coste-semanal?semanas=12"),
    ]).then(([a, c]) => {
      setAlertas(a);
      setCosteSemanal(c);
    });
  };

  const fetchConsumo = (ingId: number) => {
    setSelectedIngId(ingId);
    apiFetch<typeof consumoDetalle>(`/api/inventario/consumo/${ingId}`).then(
      setConsumoDetalle
    );
  };

  const fetchHistorial = (fecha: string) => {
    setHistorialFecha(fecha);
    apiFetch<{ fechas: string[]; snapshot: InventarioSnapshot | null }>(
      `/api/inventario?fecha=${fecha}`
    ).then((data) => {
      setHistorial(data.snapshot);
    });
  };

  const fetchPivot = () => {
    apiFetch<typeof pivot>("/api/inventario/pivot").then(setPivot);
  };

  const ingredientesFiltrados = ingredientes.filter((ing) => {
    if (filtroCategoria && String(ing.categoria_id) !== filtroCategoria) return false;
    if (buscar && !ing.nombre.toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  });

  const COCINA_CATS = ["carne", "especias", "fruta", "huevos", "lácteo", "otros", "panadería", "seco", "verdura"];

  const porCategoria = categorias
    .filter((c) => {
      if (c.tipo !== "ingrediente") return false;
      if (filtroCategoria) return true;
      const isCocina = COCINA_CATS.includes(c.nombre.toLowerCase());
      return vista === "cocina" ? isCocina : !isCocina;
    })
    .map((c) => ({
      ...c,
      items: ingredientesFiltrados.filter((i) => i.categoria_id === c.id),
    }))
    .filter((g) => g.items.length > 0);

  const handleSave = async () => {
    setSaving(true);
    const registros = Object.values(stock)
      .filter((s) => s.cantidad !== "" && parseFloat(s.cantidad) >= 0)
      .map((s) => ({
        ingrediente_id: s.ingrediente_id,
        cantidad: parseFloat(s.cantidad),
        unidad: s.unidad,
      }));

    if (registros.length === 0) {
      alert("No hay datos para guardar. Introduce al menos una cantidad.");
      setSaving(false);
      return;
    }

    try {
      await apiFetch("/api/inventario", {
        method: "POST",
        body: JSON.stringify({ registros }),
      });
      setLastSaved(new Date().toLocaleTimeString("es"));
      const inv = await apiFetch<{ fechas: string[] }>("/api/inventario");
      setFechas(inv.fechas || []);
    } catch (err) {
      alert("Error al guardar: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    const cleared: Record<number, StockEntry> = {};
    for (const ing of ingredientes) {
      cleared[ing.id] = {
        ingrediente_id: ing.id,
        cantidad: "",
        unidad: ing.unidad_uso,
      };
    }
    setStock(cleared);
  };

  const filledCount = Object.values(stock).filter(
    (s) => s.cantidad !== "" && parseFloat(s.cantidad) >= 0
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("registrar")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "registrar"
                ? "bg-[#8B1A2B] text-white"
                : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
            }`}
          >
            Registrar Stock
          </button>
          <button
            onClick={() => {
              setTab("historial");
              fetchPivot();
            }}
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
              setTab("analisis");
              fetchAnalisis();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "analisis"
                ? "bg-[#8B1A2B] text-white"
                : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
            }`}
          >
            Analisis
          </button>
        </div>
      </div>

      {tab === "registrar" && (
        <>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setVista("cocina")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                vista === "cocina"
                  ? "bg-[#8B1A2B] text-white"
                  : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
              }`}
            >
              Cocina
            </button>
            <button
              onClick={() => setVista("cafe")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                vista === "cafe"
                  ? "bg-[#8B1A2B] text-white"
                  : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
              }`}
            >
              Cafe
            </button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Buscar ingrediente..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
            />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas las categorias</option>
              {categorias
                .filter((c) => c.tipo === "ingrediente")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </select>
            <span className="text-sm text-[#6B5E52]">
              {filledCount} / {ingredientes.length}
            </span>
            {filledCount > 0 && (
              <button
                onClick={handleClear}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Vaciar todo
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-[#6B5E52] text-center py-10">Cargando...</p>
          ) : (
            <div className="space-y-6">
              {porCategoria.map((grupo) => (
                <div key={grupo.id}>
                  <h2 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider mb-2 border-b border-[#E8DFD3] pb-1">
                    {grupo.nombre}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {grupo.items.map((ing) => (
                      <div
                        key={ing.id}
                        className="flex items-center gap-2 bg-white border border-[#E8DFD3] rounded-lg px-3 py-2"
                      >
                        <Link href={`/ingredientes/${ing.id}`} className="flex-1 text-sm truncate text-[#8B1A2B] hover:underline" title={ing.nombre}>
                          {ing.nombre}
                        </Link>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={stock[ing.id]?.cantidad ?? ""}
                          onChange={(e) =>
                            setStock((prev) => ({
                              ...prev,
                              [ing.id]: {
                                ...prev[ing.id],
                                cantidad: e.target.value,
                              },
                            }))
                          }
                          className="w-20 border border-[#D4C4A8] rounded px-2 py-1 text-sm text-right"
                        />
                        <span className="text-xs text-[#6B5E52] w-8">
                          {stock[ing.id]?.unidad || ing.unidad_uso}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="sticky bottom-16 md:bottom-0 bg-[#F5F0E8] border-t border-[#E8DFD3] -mx-6 px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-[#6B5E52]">
              {lastSaved && <span>Guardado a las {lastSaved}</span>}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || filledCount === 0}
              className="bg-[#8B1A2B] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : `Guardar Inventario (${filledCount})`}
            </button>
          </div>
        </>
      )}

      {tab === "historial" && (
        <div className="space-y-4">
          {!pivot || pivot.ingredientes.length === 0 ? (
            <p className="text-[#6B5E52] text-center py-10">
              No hay registros de inventario todavia.
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

      {tab === "analisis" && (
        <div className="space-y-8">
          {/* Alertas de stock bajo */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Alertas de Stock Bajo</h2>
            {alertas.length === 0 ? (
              <p className="text-[#6B5E52] text-sm">No hay alertas de stock bajo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                      <th className="pb-2 font-medium">Ingrediente</th>
                      <th className="pb-2 font-medium text-right">Stock</th>
                      <th className="pb-2 font-medium text-right">Dias</th>
                      <th className="pb-2 font-medium text-right">Consumo/dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.map((a) => (
                      <tr key={a.ingrediente_id} className="border-b border-[#E8DFD3]/50">
                        <td className="py-2">
                          <button
                            onClick={() => fetchConsumo(a.ingrediente_id)}
                            className="text-[#8B1A2B] hover:underline"
                          >
                            {a.ingrediente_nombre}
                          </button>
                        </td>
                        <td className="py-2 text-right text-red-600 font-medium">
                          {a.stock_actual} {a.unidad}
                        </td>
                        <td className="py-2 text-right text-red-600 font-medium">
                          {a.dias_stock}d
                        </td>
                        <td className="py-2 text-right text-[#6B5E52]">
                          {a.consumo_diario} {a.unidad}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Consumo detalle de ingrediente seleccionado */}
          {consumoDetalle && (
            <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{consumoDetalle.ingrediente_nombre}</h3>
                  <p className="text-sm text-[#6B5E52]">
                    Media: {consumoDetalle.consumo_medio} {consumoDetalle.unidad}/semana
                    {" — "}
                    Tendencia:{" "}
                    <span
                      className={
                        consumoDetalle.tendencia === "subiendo"
                          ? "text-red-600"
                          : consumoDetalle.tendencia === "bajando"
                          ? "text-green-600"
                          : "text-[#6B5E52]"
                      }
                    >
                      {consumoDetalle.tendencia === "subiendo"
                        ? "↑ Subiendo"
                        : consumoDetalle.tendencia === "bajando"
                        ? "↓ Bajando"
                        : "→ Estable"}
                    </span>
                    {consumoDetalle.reorder_point != null && (
                      <> — Stock de Seguridad: {consumoDetalle.reorder_point} {consumoDetalle.unidad}</>
                    )}
                    {consumoDetalle.eoq != null && (
                      <> — Stock Deseado: {consumoDetalle.eoq} {consumoDetalle.unidad}</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setConsumoDetalle(null)}
                  className="text-sm text-[#6B5E52] hover:text-[#8B1A2B]"
                >
                  Cerrar
                </button>
              </div>

              {/* Stock control chart — sawtooth line */}
              {consumoDetalle.stock_historial && consumoDetalle.stock_historial.length > 0 ? (
                <div className="mb-5">
                  <p className="text-xs font-medium text-[#6B5E52] uppercase tracking-wide mb-2">
                    Control de Stock
                  </p>
                  {(() => {
                    const data = consumoDetalle.stock_historial!;
                    const rop = consumoDetalle.reorder_point;
                    const eoq = consumoDetalle.eoq;
                    const W = 600;
                    const H = 200;
                    const PAD_L = 48;
                    const PAD_R = 12;
                    const PAD_T = 12;
                    const PAD_B = 36;
                    const plotW = W - PAD_L - PAD_R;
                    const plotH = H - PAD_T - PAD_B;
                    const maxVal = Math.max(...data.map((d) => d.cantidad), rop ?? 0, eoq ?? 0);
                    const minVal = 0;
                    const range = maxVal - minVal || 1;
                    const xOf = (i: number) => PAD_L + (i / Math.max(data.length - 1, 1)) * plotW;
                    const yOf = (v: number) => PAD_T + plotH - ((v - minVal) / range) * plotH;
                    const points = data.map((d, i) => `${xOf(i)},${yOf(d.cantidad)}`).join(" ");
                    // Y-axis ticks: 4 steps
                    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
                      val: minVal + r * range,
                      y: PAD_T + plotH - r * plotH,
                    }));
                    return (
                      <div className="w-full overflow-x-auto">
                        <svg
                          viewBox={`0 0 ${W} ${H}`}
                          className="w-full"
                          style={{ minWidth: 280, height: 200 }}
                          aria-label="Gráfico de control de stock"
                        >
                          {/* Grid lines */}
                          {yTicks.map((t, i) => (
                            <line
                              key={i}
                              x1={PAD_L}
                              y1={t.y}
                              x2={W - PAD_R}
                              y2={t.y}
                              stroke="#E8DFD3"
                              strokeWidth="1"
                            />
                          ))}
                          {/* Y-axis labels */}
                          {yTicks.map((t, i) => (
                            <text
                              key={i}
                              x={PAD_L - 6}
                              y={t.y + 4}
                              textAnchor="end"
                              fontSize="10"
                              fill="#6B5E52"
                            >
                              {t.val % 1 === 0 ? t.val.toFixed(0) : t.val.toFixed(1)}
                            </text>
                          ))}
                          {/* X-axis date labels — show first, middle, last */}
                          {data.length >= 2 &&
                            [0, Math.floor((data.length - 1) / 2), data.length - 1]
                              .filter((v, idx, arr) => arr.indexOf(v) === idx)
                              .map((i) => (
                                <text
                                  key={i}
                                  x={xOf(i)}
                                  y={H - 6}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#6B5E52"
                                >
                                  {data[i].fecha}
                                </text>
                              ))}
                          {/* Axes */}
                          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH} stroke="#D4C4A8" strokeWidth="1" />
                          <line x1={PAD_L} y1={PAD_T + plotH} x2={W - PAD_R} y2={PAD_T + plotH} stroke="#D4C4A8" strokeWidth="1" />
                          {/* Safety stock line */}
                          {rop != null && (
                            <>
                              <line x1={PAD_L} y1={yOf(rop)} x2={W - PAD_R} y2={yOf(rop)}
                                stroke="#dc2626" strokeWidth="1" strokeDasharray="6,4" />
                              <text x={W - PAD_R - 2} y={yOf(rop) - 4} textAnchor="end"
                                fontSize="9" fill="#dc2626" fontWeight="600">Stk Seguridad</text>
                            </>
                          )}
                          {/* Par level line */}
                          {eoq != null && (
                            <>
                              <line x1={PAD_L} y1={yOf(eoq)} x2={W - PAD_R} y2={yOf(eoq)}
                                stroke="#2563eb" strokeWidth="1" strokeDasharray="6,4" />
                              <text x={W - PAD_R - 2} y={yOf(eoq) - 4} textAnchor="end"
                                fontSize="9" fill="#2563eb" fontWeight="600">Stk Deseado</text>
                            </>
                          )}
                          {/* Line */}
                          <polyline
                            points={points}
                            fill="none"
                            stroke="#8B1A2B"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                          {/* Dots with tooltips */}
                          {data.map((d, i) => (
                            <circle
                              key={i}
                              cx={xOf(i)}
                              cy={yOf(d.cantidad)}
                              r={4}
                              fill="#8B1A2B"
                              stroke="white"
                              strokeWidth="1.5"
                            >
                              <title>{`${d.fecha}: ${d.cantidad} ${d.unidad}`}</title>
                            </circle>
                          ))}
                        </svg>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-[#6B5E52] mb-5">Sin registros de inventario.</p>
              )}

              {/* Consumption bar chart (secondary) */}
              {consumoDetalle.historial.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#6B5E52] uppercase tracking-wide mb-2">
                    Consumo Semanal
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-end gap-1" style={{ height: 80 }}>
                      {(() => {
                        const max = Math.max(
                          ...consumoDetalle.historial.map((x) => x.cantidad)
                        );
                        return consumoDetalle.historial.map((h, i) => {
                          const barH = max > 0 ? Math.max((h.cantidad / max) * 66, 4) : 4;
                          return (
                            <div
                              key={i}
                              className="flex-1 flex flex-col items-center justify-end"
                              title={`${h.semana}: ${h.cantidad} ${h.unidad}`}
                            >
                              <span className="text-[8px] text-[#6B5E52] mb-0.5 leading-none">
                                {h.cantidad}
                              </span>
                              <div
                                className="w-full bg-[#8B1A2B] opacity-60 rounded-t"
                                style={{ height: barH }}
                              />
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div className="flex gap-1 text-[8px] text-[#6B5E52]">
                      {consumoDetalle.historial.map((h, i) => (
                        <div key={i} className="flex-1 text-center truncate">
                          {h.semana.replace(/^\d{4}-/, "")}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selector para ver consumo de cualquier ingrediente */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Consumo por Ingrediente</h2>
            <select
              value={selectedIngId ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                if (!isNaN(id)) fetchConsumo(id);
              }}
              className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm w-full max-w-md"
            >
              <option value="">Selecciona un ingrediente...</option>
              {ingredientes.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Coste semanal por proveedor — solo si hay datos con totales */}
          {costeSemanal.some((c) => c.total > 0) && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Coste Semanal por Proveedor</h2>
            {costeSemanal.length === 0 ? (
              <p className="text-sm text-[#6B5E52]">No hay datos de costes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                      <th className="pb-2 font-medium">Semana</th>
                      {Array.from(
                        new Set(costeSemanal.flatMap((c) => Object.keys(c.proveedores)))
                      )
                        .sort()
                        .map((prov) => (
                          <th key={prov} className="pb-2 font-medium text-right">
                            {prov}
                          </th>
                        ))}
                      <th className="pb-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costeSemanal.map((c) => {
                      const provs = Array.from(
                        new Set(
                          costeSemanal.flatMap((x) => Object.keys(x.proveedores))
                        )
                      ).sort();
                      return (
                        <tr
                          key={c.semana}
                          className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]"
                        >
                          <td className="py-2">{c.semana}</td>
                          {provs.map((prov) => (
                            <td key={prov} className="py-2 text-right text-[#6B5E52]">
                              {c.proveedores[prov]
                                ? c.proveedores[prov].toFixed(2)
                                : "—"}
                            </td>
                          ))}
                          <td className="py-2 text-right font-medium">
                            {c.total > 0 ? `${c.total.toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
