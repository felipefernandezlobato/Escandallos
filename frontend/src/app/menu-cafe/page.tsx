"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import Link from "next/link";

/* ── Types ── */

interface CafeItem {
  id: number;
  nombre: string;
  proveedor: string;
  color: string | null;
  coste: number;
  precio_eur: number | null;
  pvp: number | null;
  margen: number | null;
  stock: number;
  unidad: string;
  consumo_semanal: number;
  tendencia: string;
  activo: boolean;
}

interface CafeSeccion {
  nombre: string;
  items: CafeItem[];
}

interface CafeResumen {
  total_skus: number;
  skus_activos: number;
  valor_stock: number;
  margen_medio: number;
  sin_pvp: number;
}

interface CafeCatalogo {
  resumen: CafeResumen;
  secciones: CafeSeccion[];
}

interface FrozenTube {
  name: string;
  chf_per_tube: number;
  supplement: number;
  multi_total: number;
  multi_supplement: number;
  doppio_pvp: number;
  doppio_cost: number;
  grams_per_tube: number;
  chf_per_kg?: number;
  origen_id?: number;
  stock_bru1?: number;
  stock_bru2?: number;
  stock_bolsa?: number;
  disponible?: boolean;
}

/* ── Color ordering ── */

const COLOR_ORDER: Record<string, number> = {
  "MARRÓN": 0,
  "MARRON": 0,
  "ROJO": 1,
  "GOLD": 2,
  "BLACK": 3,
};

function colorSortKey(color: string | null): number {
  if (!color) return 99;
  return COLOR_ORDER[color.toUpperCase()] ?? 50;
}

/* ── Color sub-header styling ── */

function colorBgClass(color: string): string {
  const upper = color.toUpperCase();
  if (upper === "MARRÓN" || upper === "MARRON") return "bg-amber-800/10 text-amber-900";
  if (upper === "ROJO") return "bg-red-800/10 text-red-900";
  if (upper === "GOLD") return "bg-yellow-600/10 text-yellow-800";
  if (upper === "BLACK") return "bg-gray-800/10 text-gray-900";
  return "bg-gray-100 text-gray-700";
}

/* ── Tendencia display ── */

function tendenciaDisplay(t: string) {
  if (t === "up" || t === "↑") return { symbol: "↑", cls: "text-green-600" };
  if (t === "down" || t === "↓") return { symbol: "↓", cls: "text-red-600" };
  return { symbol: "→", cls: "text-[#6B5E52]" };
}

/* ── Margin color ── */

function margenColor(m: number | null): string {
  if (m === null) return "text-[#6B5E52]";
  if (m >= 65) return "text-green-600 font-medium";
  if (m >= 50) return "text-orange-500 font-medium";
  return "text-red-600 font-medium";
}

/* ── Supplier filter options ── */

const SUPPLIER_FILTERS = ["Todos", "Dabov", "BD"] as const;
type SupplierFilter = (typeof SUPPLIER_FILTERS)[number];

/* ── Page Component ── */

export default function MenuCafePage() {
  const toast = useToast();
  const [catalogo, setCatalogo] = useState<CafeCatalogo | null>(null);
  const [frozenTubes, setFrozenTubes] = useState<FrozenTube[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>("Todos");

  // Inline PVP editing state
  const [editingPvp, setEditingPvp] = useState<number | null>(null);
  const [editPvpValue, setEditPvpValue] = useState("");

  // Toggling activo state
  const [togglingActivo, setTogglingActivo] = useState<Set<number>>(new Set());
  const [showInactive, setShowInactive] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<CafeCatalogo>("/api/cafe/catalogo"),
      apiFetch<FrozenTube[]>("/api/menu/frozen").catch(() => []),
    ])
      .then(([cat, frozen]) => {
        setCatalogo(cat);
        setFrozenTubes(frozen);
      })
      .catch((err) => {
        toast("Error al cargar catalogo: " + (err as Error).message, "error");
      })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── PVP save ── */

  const handlePvpSave = async (id: number) => {
    const val = parseFloat(editPvpValue.replace(",", "."));
    if (isNaN(val) || val < 0) {
      toast("Precio no valido", "error");
      return;
    }
    try {
      await apiFetch(`/api/cafe/catalogo/${id}/pvp`, {
        method: "PUT",
        body: JSON.stringify({ precio_venta: val }),
      });
      toast("PVP actualizado");
      fetchData();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setEditingPvp(null);
    }
  };

  /* ── Toggle activo ── */

  const handleToggleActivo = async (item: CafeItem) => {
    setTogglingActivo((prev) => new Set(prev).add(item.id));
    try {
      await apiFetch(`/api/ingredientes/${item.id}/activo`, {
        method: "PUT",
        body: JSON.stringify({ activo: !item.activo }),
      });
      fetchData();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setTogglingActivo((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  /* ── Filter items by supplier ── */

  function filterItems(items: CafeItem[]): CafeItem[] {
    return items.filter((i) => {
      if (!showInactive && !i.activo) return false;
      if (supplierFilter !== "Todos" && i.proveedor.toLowerCase() !== supplierFilter.toLowerCase()) return false;
      return true;
    });
  }

  /* ── Group items by color ── */

  function groupByColor(items: CafeItem[]): Array<{ color: string | null; items: CafeItem[] }> {
    const map = new Map<string | null, CafeItem[]>();
    for (const item of items) {
      const key = item.color;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => colorSortKey(a) - colorSortKey(b))
      .map(([color, items]) => ({ color, items }));
  }

  /* ── Render ── */

  if (loading) {
    return <p className="text-[#6B5E52] py-10 text-center">Cargando catalogo cafe...</p>;
  }

  if (!catalogo) {
    return <p className="text-[#6B5E52] py-10 text-center">No se pudo cargar el catalogo.</p>;
  }

  const { resumen, secciones } = catalogo;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Menu Cafe</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              showInactive
                ? "bg-[#8B1A2B] text-white border-[#8B1A2B]"
                : "text-[#6B5E52] border-[#D4C4A8] hover:bg-[#F5F0E8]"
            }`}
          >
            {showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
          </button>
          <div className="flex gap-1 bg-[#F5F0E8] rounded-lg p-1">
            {SUPPLIER_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setSupplierFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  supplierFilter === f
                    ? "bg-[#8B1A2B] text-white"
                    : "text-[#6B5E52] hover:bg-[#E8DFD3]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="SKUs Activos"
          value={`${resumen.skus_activos}/${resumen.total_skus}`}
        />
        <SummaryCard
          label="Valor Stock"
          value={`${resumen.valor_stock.toFixed(0)} CHF`}
        />
        <SummaryCard
          label="Margen Medio"
          value={`${resumen.margen_medio.toFixed(1)}%`}
          valueColor={margenColor(resumen.margen_medio)}
        />
        <SummaryCard
          label="Sin PVP"
          value={String(resumen.sin_pvp)}
          valueColor={resumen.sin_pvp > 0 ? "text-red-600 font-medium" : "text-green-600"}
        />
      </div>

      {/* ── Sections ── */}
      {secciones.map((seccion) => {
        const filtered = filterItems(seccion.items);
        if (filtered.length === 0) return null;
        const groups = groupByColor(filtered);

        return (
          <section key={seccion.nombre}>
            <h2 className="text-lg font-bold bg-[#8B1A2B] text-white px-4 py-2 rounded-t-lg">
              {seccion.nombre}
            </h2>
            <div className="bg-white border border-[#E8DFD3] rounded-b-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-[#F5F0E8] text-left text-[#6B5E52] border-b border-[#E8DFD3]">
                      <th className="px-4 py-2 font-medium">Nombre</th>
                      <th className="px-4 py-2 font-medium">Proveedor</th>
                      <th className="px-4 py-2 font-medium text-right">Coste</th>
                      <th className="px-4 py-2 font-medium text-right">PVP</th>
                      <th className="px-4 py-2 font-medium text-right">Margen %</th>
                      <th className="px-4 py-2 font-medium text-right">Stock</th>
                      <th className="px-4 py-2 font-medium text-right">Consumo/sem</th>
                      <th className="px-4 py-2 font-medium text-center">Tend.</th>
                      <th className="px-4 py-2 font-medium text-center">Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <ColorGroup
                        key={group.color ?? "__null"}
                        color={group.color}
                        items={group.items}
                        editingPvp={editingPvp}
                        editPvpValue={editPvpValue}
                        setEditingPvp={setEditingPvp}
                        setEditPvpValue={setEditPvpValue}
                        handlePvpSave={handlePvpSave}
                        handleToggleActivo={handleToggleActivo}
                        togglingActivo={togglingActivo}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })}

      {/* ── Frozen Tubes ── */}
      {frozenTubes.length > 0 && (
        <section>
          <h2 className="text-lg font-bold bg-[#3D2E22] text-white px-4 py-2 rounded-t-lg">
            Frozen Tubes
          </h2>
          <div className="bg-white border border-[#E8DFD3] rounded-b-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-[#F5F0E8] text-left text-[#6B5E52] border-b border-[#E8DFD3]">
                    <th className="px-4 py-2 font-medium">Cafe</th>
                    <th className="px-4 py-2 font-medium text-right">CHF/tubo</th>
                    <th className="px-4 py-2 font-medium text-right">Suplemento</th>
                    <th className="px-4 py-2 font-medium text-right">Stock BRU1</th>
                    <th className="px-4 py-2 font-medium text-right">Stock BRU2</th>
                    <th className="px-4 py-2 font-medium text-right">Stock Bolsa</th>
                    <th className="px-4 py-2 font-medium text-center">Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {frozenTubes.map((tube) => (
                    <tr
                      key={tube.name}
                      className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]"
                    >
                      <td className="px-4 py-2">
                        {tube.origen_id ? (
                          <Link
                            href={`/ingredientes/${tube.origen_id}`}
                            className="text-[#8B1A2B] hover:underline"
                          >
                            {tube.name}
                          </Link>
                        ) : (
                          tube.name
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">{tube.chf_per_tube.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-bold text-[#8B1A2B]">
                        {tube.supplement > 0 ? `+${tube.supplement}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {tube.stock_bru1 !== undefined ? tube.stock_bru1 : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {tube.stock_bru2 !== undefined ? tube.stock_bru2 : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {tube.stock_bolsa !== undefined ? tube.stock_bolsa : "—"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {tube.disponible !== undefined ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              tube.disponible
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {tube.disponible ? "Si" : "No"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {frozenTubes[0] && (
              <div className="px-4 py-2 bg-[#F5F0E8] text-xs text-[#6B5E52]">
                Base: Doppio {frozenTubes[0].doppio_pvp.toFixed(2)} CHF (coste{" "}
                {frozenTubes[0].doppio_cost.toFixed(2)} CHF) ·{" "}
                {frozenTubes[0].grams_per_tube}g/tubo
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Summary Card ── */

function SummaryCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
      <p className="text-xs text-[#6B5E52] uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueColor || "text-[#1A1A1A]"}`}>
        {value}
      </p>
    </div>
  );
}

/* ── Color Group (sub-header + rows) ── */

function ColorGroup({
  color,
  items,
  editingPvp,
  editPvpValue,
  setEditingPvp,
  setEditPvpValue,
  handlePvpSave,
  handleToggleActivo,
  togglingActivo,
}: {
  color: string | null;
  items: CafeItem[];
  editingPvp: number | null;
  editPvpValue: string;
  setEditingPvp: (id: number | null) => void;
  setEditPvpValue: (v: string) => void;
  handlePvpSave: (id: number) => Promise<void>;
  handleToggleActivo: (item: CafeItem) => Promise<void>;
  togglingActivo: Set<number>;
}) {
  return (
    <>
      {color && (
        <tr>
          <td
            colSpan={9}
            className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${colorBgClass(color)}`}
          >
            {color}
          </td>
        </tr>
      )}
      {items.map((item) => {
        const inactive = !item.activo;
        const rowClass = inactive
          ? "border-b border-[#E8DFD3]/50 text-[#6B5E52]/40"
          : "border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]";
        const tend = tendenciaDisplay(item.tendencia);

        return (
          <tr key={item.id} className={rowClass}>
            {/* Nombre */}
            <td className="px-4 py-1.5">
              <Link
                href={`/ingredientes/${item.id}`}
                className={
                  inactive
                    ? "text-[#6B5E52]/40 hover:underline"
                    : "text-[#8B1A2B] hover:underline"
                }
              >
                {item.nombre}
              </Link>
            </td>

            {/* Proveedor */}
            <td className="px-4 py-1.5 text-xs">{item.proveedor}</td>

            {/* Coste */}
            <td className="px-4 py-1.5 text-right">{item.coste.toFixed(2)}</td>

            {/* PVP — editable */}
            <td className="px-4 py-1.5 text-right">
              {editingPvp === item.id ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={editPvpValue}
                  onChange={(e) => setEditPvpValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePvpSave(item.id);
                    if (e.key === "Escape") setEditingPvp(null);
                  }}
                  onBlur={() => setEditingPvp(null)}
                  className="w-20 border border-[#8B1A2B] rounded px-1 py-0.5 text-sm text-right"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingPvp(item.id);
                    setEditPvpValue(item.pvp !== null ? String(item.pvp) : "");
                  }}
                  className="hover:text-[#8B1A2B] cursor-pointer"
                  title="Click para editar PVP"
                >
                  {item.pvp !== null ? item.pvp.toFixed(2) : "—"}
                </button>
              )}
            </td>

            {/* Margen % */}
            <td className={`px-4 py-1.5 text-right ${margenColor(item.margen)}`}>
              {item.margen !== null ? `${item.margen.toFixed(1)}%` : "—"}
            </td>

            {/* Stock */}
            <td className="px-4 py-1.5 text-right">
              {item.stock} {item.unidad}
            </td>

            {/* Consumo/sem */}
            <td className="px-4 py-1.5 text-right">
              {item.consumo_semanal} {item.unidad}
            </td>

            {/* Tendencia */}
            <td className={`px-4 py-1.5 text-center ${tend.cls}`}>
              {tend.symbol}
            </td>

            {/* Activo toggle */}
            <td className="px-4 py-1.5 text-center">
              <button
                onClick={() => handleToggleActivo(item)}
                disabled={togglingActivo.has(item.id)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  item.activo ? "bg-[#8B1A2B]" : "bg-gray-300"
                } ${togglingActivo.has(item.id) ? "opacity-50" : ""}`}
                title={item.activo ? "Desactivar" : "Activar"}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    item.activo ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}
