"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type {
  Ingrediente,
  MermaRegistro,
  MotivoMerma,
  Receta,
} from "@/lib/types";
import { MOTIVOS_MERMA } from "@/lib/types";

const UNIDADES = ["kg", "g", "litro", "ml", "cl", "unidad"];

const MOTIVO_LABELS: Record<string, string> = {
  caducado: "Caducado",
  roto: "Roto",
  error_cocina: "Error cocina",
  error_sala: "Error sala",
  otro: "Otro",
};

type Tab = "registrar" | "analisis";
type TipoItem = "ingrediente" | "receta" | "otro";
type Periodo = "dia" | "semana" | "mes";

interface BatchItem {
  key: number;
  tipo: TipoItem;
  ingrediente_id: number | null;
  receta_id: number | null;
  nombre: string;
  cantidad: string;
  unidad: string;
  motivo: MotivoMerma;
  notas: string;
}

interface SearchResult {
  tipo: TipoItem;
  id: number;
  nombre: string;
  unidad: string;
}

function MermasContent() {
  const toast = useToast();
  const searchParams = useSearchParams();

  const [tab, setTabState] = useState<Tab>(
    (searchParams.get("tab") as Tab) || "registrar"
  );
  const [loading, setLoading] = useState(true);

  // Data
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [registros, setRegistros] = useState<MermaRegistro[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // Batch header
  const [batchFecha, setBatchFecha] = useState(new Date().toISOString().slice(0, 10));
  const [batchUbicacion, setBatchUbicacion] = useState("");

  // Unified search
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Batch list
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);

  // Analytics — client-side filtering
  const [allAnalisisRecords, setAllAnalisisRecords] = useState<MermaRegistro[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [activePreset, setActivePreset] = useState<string>("mes");
  const [filterTiempo, setFilterTiempo] = useState<string | null>(null);
  const [filterCategoria, setFilterCategoria] = useState<string | null>(null);
  const [filterMotivo, setFilterMotivo] = useState<string | null>(null);
  const [showAllTopItems, setShowAllTopItems] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [recordsLimit, setRecordsLimit] = useState(50);
  const [sortCol, setSortCol] = useState<string>("fecha");
  const [sortAsc, setSortAsc] = useState(false);

  // URL sync
  const syncUrl = (t: Tab) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.toString());
  };

  const setTab = (t: Tab) => {
    setTabState(t);
    syncUrl(t);
  };

  // Fetch reference data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<Ingrediente[]>("/api/ingredientes"),
      apiFetch<Receta[]>("/api/recetas"),
    ])
      .then(([ings, recs]) => {
        setIngredientes(ings.filter((i) => i.activo !== false));
        setRecetas(recs);
      })
      .finally(() => setLoading(false));
    fetchRegistros();
  }, []);

  // Fetch analytics records when tab switches or date range changes
  useEffect(() => {
    if (tab === "analisis") fetchAnalisisRecords();
  }, [tab, fechaDesde, fechaHasta]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchRegistros = async () => {
    try {
      const res = await apiFetch<{ total: number; registros: MermaRegistro[] }>(
        "/api/mermas?limit=50"
      );
      setRegistros(res.registros);
      setTotalRegistros(res.total);
    } catch {
      // silent
    }
  };

  const fetchAnalisisRecords = async () => {
    setLoadingAnalisis(true);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      params.set("limit", "2000");
      const res = await apiFetch<{ total: number; registros: MermaRegistro[] }>(
        `/api/mermas?${params}`
      );
      setAllAnalisisRecords(res.registros);
      setFilterTiempo(null);
      setFilterCategoria(null);
      setFilterMotivo(null);
      setRecordsLimit(50);
    } catch {
      // silent
    } finally {
      setLoadingAnalisis(false);
    }
  };

  // ── Search ──

  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const searchResults = useMemo((): SearchResult[] => {
    const q = searchQuery.trim();
    if (q.length === 0) return [];
    const nq = normalize(q);

    const ingResults: SearchResult[] = ingredientes
      .filter((i) => normalize(i.nombre).includes(nq))
      .map((i) => ({
        tipo: "ingrediente" as TipoItem,
        id: i.id,
        nombre: i.nombre,
        unidad: i.unidad_uso || "unidad",
      }));

    const recResults: SearchResult[] = recetas
      .filter((r) => normalize(r.nombre).includes(nq))
      .map((r) => ({
        tipo: "receta" as TipoItem,
        id: r.id,
        nombre: r.nombre,
        unidad: "unidad",
      }));

    return [...ingResults, ...recResults].slice(0, 15);
  }, [searchQuery, ingredientes, recetas]);

  // ── Batch operations ──

  const addToBatch = (result: SearchResult) => {
    const item: BatchItem = {
      key: nextKey,
      tipo: result.tipo,
      ingrediente_id: result.tipo === "ingrediente" ? result.id : null,
      receta_id: result.tipo === "receta" ? result.id : null,
      nombre: result.nombre,
      cantidad: "1",
      unidad: result.unidad,
      motivo: "caducado",
      notas: "",
    };
    setNextKey((k) => k + 1);
    setBatchItems((prev) => [...prev, item]);
    setSearchQuery("");
    setShowDropdown(false);
    setHighlightIndex(-1);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const addFreeText = () => {
    const name = searchQuery.trim();
    if (!name) return;
    const item: BatchItem = {
      key: nextKey,
      tipo: "otro",
      ingrediente_id: null,
      receta_id: null,
      nombre: name,
      cantidad: "1",
      unidad: "unidad",
      motivo: "caducado",
      notas: "",
    };
    setNextKey((k) => k + 1);
    setBatchItems((prev) => [...prev, item]);
    setSearchQuery("");
    setShowDropdown(false);
    setHighlightIndex(-1);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const removeFromBatch = (key: number) => {
    setBatchItems((prev) => prev.filter((item) => item.key !== key));
  };

  const updateBatchItem = (key: number, field: keyof BatchItem, value: string) => {
    setBatchItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      )
    );
  };

  // ── Save all ──

  const handleSaveAll = async () => {
    if (batchItems.length === 0) {
      toast("Agrega al menos un item", "error");
      return;
    }

    for (const item of batchItems) {
      const cantidad = parseFloat(item.cantidad.replace(",", "."));
      if (isNaN(cantidad) || cantidad <= 0) {
        toast(`"${item.nombre}": cantidad debe ser mayor a 0`, "error");
        return;
      }
      if (item.motivo === "otro" && !item.notas.trim()) {
        toast(`"${item.nombre}": notas obligatorias cuando motivo es Otro`, "error");
        return;
      }
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of batchItems) {
      const cantidad = parseFloat(item.cantidad.replace(",", "."));
      const body: Record<string, unknown> = {
        cantidad,
        unidad: item.unidad,
        motivo: item.motivo,
        notas: item.notas || null,
        ubicacion: batchUbicacion || null,
        fecha: batchFecha,
      };

      if (item.tipo === "ingrediente") body.ingrediente_id = item.ingrediente_id;
      else if (item.tipo === "receta") body.receta_id = item.receta_id;
      else body.nombre_libre = item.nombre;

      try {
        await apiFetch("/api/mermas", {
          method: "POST",
          body: JSON.stringify(body),
        });
        successCount++;
      } catch (err) {
        errorCount++;
        toast(`Error en "${item.nombre}": ${(err as Error).message}`, "error");
      }
    }

    if (successCount > 0) {
      toast(`${successCount} merma${successCount > 1 ? "s" : ""} registrada${successCount > 1 ? "s" : ""}`);
      setBatchItems([]);
      fetchRegistros();
    }
    if (errorCount > 0 && successCount > 0) {
      toast(`${errorCount} error${errorCount > 1 ? "es" : ""} al guardar`, "error");
    }

    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este registro de merma?")) return;
    try {
      await apiFetch(`/api/mermas/${id}`, { method: "DELETE" });
      toast("Registro eliminado");
      fetchRegistros();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  };

  // ── Search keyboard navigation ──

  const totalDropdownItems = searchResults.length + (searchQuery.trim() ? 1 : 0);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, totalDropdownItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < searchResults.length) {
        addToBatch(searchResults[highlightIndex]);
      } else if (highlightIndex === searchResults.length && searchQuery.trim()) {
        addFreeText();
      } else if (searchResults.length === 1) {
        addToBatch(searchResults[0]);
      } else if (searchResults.length === 0 && searchQuery.trim()) {
        addFreeText();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // ── Analytics computations (unchanged) ──

  const applyPreset = (preset: string) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const dow = today.getDay() === 0 ? 7 : today.getDay();
    let desde = "";
    let hasta = today.toISOString().slice(0, 10);

    if (preset === "semana") {
      const mon = new Date(today);
      mon.setDate(d - dow + 1);
      desde = mon.toISOString().slice(0, 10);
    } else if (preset === "mes") {
      desde = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    } else if (preset === "ultimo_mes") {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      desde = `${py}-${String(pm + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      hasta = `${py}-${String(pm + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    } else if (preset === "trimestre") {
      const three = new Date(today);
      three.setMonth(m - 3);
      desde = three.toISOString().slice(0, 10);
    } else if (preset === "todo") {
      desde = "2020-01-01";
    }

    setActivePreset(preset);
    setFechaDesde(desde);
    setFechaHasta(hasta);
  };

  const getItemName = (r: MermaRegistro) =>
    r.ingrediente_nombre || r.receta_nombre || r.nombre_libre || "?";

  const getItemCategory = (r: MermaRegistro) => r.categoria_nombre || "Otro";

  const getTimeKey = (fecha: string) => {
    const d = new Date(fecha);
    if (periodo === "dia") return fecha;
    if (periodo === "semana") {
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
      const week = Math.ceil((days + jan1.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const filteredRecords = allAnalisisRecords.filter((r) => {
    if (filterTiempo && getTimeKey(r.fecha) !== filterTiempo) return false;
    if (filterCategoria && getItemCategory(r) !== filterCategoria) return false;
    if (filterMotivo && r.motivo !== filterMotivo) return false;
    return true;
  });

  const hasFilters = filterTiempo || filterCategoria || filterMotivo;

  const totalEventos = filteredRecords.length;
  const totalCoste = filteredRecords.reduce((s, r) => s + r.coste_total, 0);

  const timeChartRecords = allAnalisisRecords.filter((r) => {
    if (filterCategoria && getItemCategory(r) !== filterCategoria) return false;
    if (filterMotivo && r.motivo !== filterMotivo) return false;
    return true;
  });
  const timeMap = new Map<string, { eventos: number; coste: number }>();
  timeChartRecords.forEach((r) => {
    const key = getTimeKey(r.fecha);
    const cur = timeMap.get(key) || { eventos: 0, coste: 0 };
    cur.eventos++;
    cur.coste += r.coste_total;
    timeMap.set(key, cur);
  });
  const porTiempo = Array.from(timeMap.entries())
    .map(([k, v]) => ({ periodo: k, ...v }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));

  const catChartRecords = allAnalisisRecords.filter((r) => {
    if (filterTiempo && getTimeKey(r.fecha) !== filterTiempo) return false;
    if (filterMotivo && r.motivo !== filterMotivo) return false;
    return true;
  });
  const catMap = new Map<string, { eventos: number; coste: number }>();
  catChartRecords.forEach((r) => {
    const cat = getItemCategory(r);
    const cur = catMap.get(cat) || { eventos: 0, coste: 0 };
    cur.eventos++;
    cur.coste += r.coste_total;
    catMap.set(cat, cur);
  });
  const porCategoria = Array.from(catMap.entries())
    .map(([k, v]) => ({ categoria: k, ...v }))
    .sort((a, b) => b.coste - a.coste);

  const motChartRecords = allAnalisisRecords.filter((r) => {
    if (filterTiempo && getTimeKey(r.fecha) !== filterTiempo) return false;
    if (filterCategoria && getItemCategory(r) !== filterCategoria) return false;
    return true;
  });
  const motMap = new Map<string, { eventos: number; coste: number }>();
  motChartRecords.forEach((r) => {
    const cur = motMap.get(r.motivo) || { eventos: 0, coste: 0 };
    cur.eventos++;
    cur.coste += r.coste_total;
    motMap.set(r.motivo, cur);
  });
  const porMotivo = Array.from(motMap.entries())
    .map(([k, v]) => ({ motivo: k, ...v }))
    .sort((a, b) => b.coste - a.coste);

  const itemMap = new Map<string, { eventos: number; cantidad: number; unidad: string; coste: number }>();
  filteredRecords.forEach((r) => {
    const name = getItemName(r);
    const cur = itemMap.get(name) || { eventos: 0, cantidad: 0, unidad: r.unidad, coste: 0 };
    cur.eventos++;
    cur.cantidad += r.cantidad;
    cur.coste += r.coste_total;
    itemMap.set(name, cur);
  });
  const topItems = Array.from(itemMap.entries())
    .map(([k, v]) => ({ nombre: k, ...v }))
    .sort((a, b) => b.coste - a.coste);

  const sortedRecords = [...filteredRecords].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "fecha") cmp = a.fecha.localeCompare(b.fecha);
    else if (sortCol === "item") cmp = getItemName(a).localeCompare(getItemName(b));
    else if (sortCol === "cantidad") cmp = a.cantidad - b.cantidad;
    else if (sortCol === "coste") cmp = a.coste_total - b.coste_total;
    else if (sortCol === "motivo") cmp = a.motivo.localeCompare(b.motivo);
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(col !== "fecha"); }
  };

  const sortIcon = (col: string) =>
    sortCol === col ? (sortAsc ? " ↑" : " ↓") : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#6B5E52]">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#8B1A2B]" style={{ fontFamily: "var(--font-heading)" }}>
          Mermas
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["registrar", "analisis"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-[#8B1A2B] text-white"
                : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
            }`}
          >
            {t === "registrar" ? "Registrar" : "Analisis"}
          </button>
        ))}
      </div>

      {/* ===== TAB: REGISTRAR ===== */}
      {tab === "registrar" && (
        <div className="space-y-6">
          {/* Batch header: fecha + ubicacion */}
          <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#6B5E52] mb-1">Fecha</label>
                <input
                  type="date"
                  value={batchFecha}
                  onChange={(e) => setBatchFecha(e.target.value)}
                  className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B5E52] mb-1">Ubicacion</label>
                <select
                  value={batchUbicacion}
                  onChange={(e) => setBatchUbicacion(e.target.value)}
                  className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                >
                  <option value="">--</option>
                  <option value="BRU1">BRU1</option>
                  <option value="BRU2">BRU2</option>
                </select>
              </div>
            </div>
          </div>

          {/* Search + batch card */}
          <div className="bg-white border border-[#E8DFD3] rounded-lg">
            <div className="px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3]">
              <h2 className="font-semibold text-[#8B1A2B]">Registrar Mermas</h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Unified search input */}
              <div className="relative">
                <label className="block text-xs text-[#6B5E52] mb-1">
                  Buscar ingrediente o receta
                </label>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Escribe para buscar..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                    setHighlightIndex(-1);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) setShowDropdown(true);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                />

                {/* Dropdown */}
                {showDropdown && searchQuery.trim().length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D4C4A8] rounded-lg shadow-lg max-h-60 overflow-y-auto"
                  >
                    {searchResults.length === 0 && (
                      <div className="px-3 py-2 text-sm text-[#6B5E52]">
                        Sin resultados
                      </div>
                    )}
                    {searchResults.map((result, idx) => (
                      <button
                        key={`${result.tipo}-${result.id}`}
                        type="button"
                        onClick={() => addToBatch(result)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F5F0E8] ${
                          highlightIndex === idx ? "bg-[#F5F0E8]" : ""
                        }`}
                      >
                        {result.nombre}
                        <span className="ml-2 text-xs text-[#6B5E52]">
                          ({result.tipo === "ingrediente" ? "Ingrediente" : "Receta"})
                        </span>
                      </button>
                    ))}
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onClick={addFreeText}
                        className={`w-full text-left px-3 py-2 text-sm border-t border-[#E8DFD3] hover:bg-[#F5F0E8] text-[#6B5E52] ${
                          highlightIndex === searchResults.length ? "bg-[#F5F0E8]" : ""
                        }`}
                      >
                        Agregar como otro: &quot;{searchQuery.trim()}&quot;
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Batch list */}
              {batchItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-[#6B5E52] font-medium">
                    {batchItems.length} item{batchItems.length > 1 ? "s" : ""} en lote
                  </div>
                  {batchItems.map((item) => (
                    <div
                      key={item.key}
                      className="border border-[#E8DFD3] rounded-lg p-3 space-y-2"
                    >
                      {/* Name + remove */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#3D2E22]">
                          {item.nombre}
                          <span className="ml-1 text-xs text-[#6B5E52]">
                            ({item.tipo === "ingrediente"
                              ? "Ingrediente"
                              : item.tipo === "receta"
                              ? "Receta"
                              : "Otro"})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromBatch(item.key)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Quitar
                        </button>
                      </div>
                      {/* Cantidad, Unidad, Motivo */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#6B5E52]">Cantidad</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.cantidad}
                            onChange={(e) =>
                              updateBatchItem(item.key, "cantidad", e.target.value.replace(",", "."))
                            }
                            className="border border-[#D4C4A8] rounded px-2 py-1.5 text-sm w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#6B5E52]">Unidad</label>
                          <select
                            value={item.unidad}
                            onChange={(e) => updateBatchItem(item.key, "unidad", e.target.value)}
                            className="border border-[#D4C4A8] rounded px-2 py-1.5 text-sm w-full"
                          >
                            {UNIDADES.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#6B5E52]">Motivo</label>
                          <select
                            value={item.motivo}
                            onChange={(e) =>
                              updateBatchItem(item.key, "motivo", e.target.value)
                            }
                            className="border border-[#D4C4A8] rounded px-2 py-1.5 text-sm w-full"
                          >
                            {MOTIVOS_MERMA.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {/* Notas */}
                      <div>
                        <label className="block text-[10px] text-[#6B5E52]">
                          Notas{item.motivo === "otro" ? " (obligatorio)" : ""}
                        </label>
                        <input
                          type="text"
                          placeholder="Detalles..."
                          value={item.notas}
                          onChange={(e) => updateBatchItem(item.key, "notas", e.target.value)}
                          className="border border-[#D4C4A8] rounded px-2 py-1.5 text-sm w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Save all */}
              {batchItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="w-full bg-[#8B1A2B] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#6B1420] transition-colors disabled:opacity-50"
                >
                  {saving
                    ? "Guardando..."
                    : `Guardar todo (${batchItems.length})`}
                </button>
              )}
            </div>
          </div>

          {/* Recent entries table */}
          <div className="bg-white border border-[#E8DFD3] rounded-lg">
            <div className="px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3] flex items-center justify-between">
              <h2 className="font-semibold text-[#8B1A2B]">
                Registros recientes ({totalRegistros})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium">Cantidad</th>
                    <th className="px-4 py-2 font-medium">Motivo</th>
                    <th className="px-4 py-2 font-medium">Ubicacion</th>
                    <th className="px-4 py-2 font-medium text-right">Coste</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {registros.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#6B5E52]">
                        No hay registros de mermas
                      </td>
                    </tr>
                  ) : (
                    registros.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]"
                      >
                        <td className="px-4 py-2 whitespace-nowrap">{r.fecha}</td>
                        <td className="px-4 py-2">
                          {r.ingrediente_nombre || r.receta_nombre || r.nombre_libre}
                          {r.categoria_nombre && (
                            <span className="text-xs text-[#6B5E52] ml-1">
                              ({r.categoria_nombre})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {r.cantidad} {r.unidad}
                        </td>
                        <td className="px-4 py-2">
                          {MOTIVO_LABELS[r.motivo] || r.motivo}
                          {r.notas && (
                            <span className="text-xs text-[#6B5E52] ml-1" title={r.notas}>
                              *
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">{r.ubicacion || "-"}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {r.coste_total > 0
                            ? `${r.coste_total.toFixed(2)} CHF`
                            : "-"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: ANALISIS ===== */}
      {tab === "analisis" && (
        <div className="space-y-6">
          {/* Date range presets + custom */}
          <div className="bg-white border border-[#E8DFD3] rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "semana", label: "Esta semana" },
                { key: "mes", label: "Este mes" },
                { key: "ultimo_mes", label: "Ultimo mes" },
                { key: "trimestre", label: "Ultimo trimestre" },
                { key: "todo", label: "Todo" },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    activePreset === p.key
                      ? "bg-[#8B1A2B] text-white"
                      : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs text-[#6B5E52]">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => { setFechaDesde(e.target.value); setActivePreset(""); }}
                className="border border-[#D4C4A8] rounded px-3 py-1.5 text-sm"
              />
              <label className="text-xs text-[#6B5E52]">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => { setFechaHasta(e.target.value); setActivePreset(""); }}
                className="border border-[#D4C4A8] rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Period grouping toggle */}
          <div className="flex gap-2">
            {(["dia", "semana", "mes"] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  periodo === p
                    ? "bg-[#8B1A2B] text-white"
                    : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
                }`}
              >
                {p === "dia" ? "Dia" : p === "semana" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>

          {/* Active filter chips */}
          {hasFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#6B5E52]">Filtros:</span>
              {filterTiempo && (
                <button
                  onClick={() => setFilterTiempo(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#8B1A2B]/10 text-[#8B1A2B] rounded text-xs"
                >
                  {periodo === "dia" ? "Dia" : periodo === "semana" ? "Semana" : "Mes"}: {filterTiempo.replace(/^\d{4}-/, "")}
                  <span className="ml-1">&#10005;</span>
                </button>
              )}
              {filterCategoria && (
                <button
                  onClick={() => setFilterCategoria(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#8B1A2B]/10 text-[#8B1A2B] rounded text-xs"
                >
                  Categoria: {filterCategoria}
                  <span className="ml-1">&#10005;</span>
                </button>
              )}
              {filterMotivo && (
                <button
                  onClick={() => setFilterMotivo(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#8B1A2B]/10 text-[#8B1A2B] rounded text-xs"
                >
                  Motivo: {MOTIVO_LABELS[filterMotivo] || filterMotivo}
                  <span className="ml-1">&#10005;</span>
                </button>
              )}
              <button
                onClick={() => { setFilterTiempo(null); setFilterCategoria(null); setFilterMotivo(null); }}
                className="text-xs text-[#6B5E52] hover:text-[#8B1A2B] underline"
              >
                Limpiar todos
              </button>
            </div>
          )}

          {loadingAnalisis ? (
            <div className="text-[#6B5E52] py-10 text-center">Cargando analisis...</div>
          ) : allAnalisisRecords.length === 0 ? (
            <div className="text-[#6B5E52] py-10 text-center">Sin datos en este periodo</div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
                  <p className="text-xs uppercase text-[#6B5E52] mb-1">Total Mermas</p>
                  <p className="text-2xl font-bold text-[#8B1A2B]">{totalEventos}</p>
                  <p className="text-xs text-[#6B5E52]">eventos</p>
                </div>
                <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
                  <p className="text-xs uppercase text-[#6B5E52] mb-1">Coste Total</p>
                  <p className="text-2xl font-bold text-[#8B1A2B]">{totalCoste.toFixed(2)}</p>
                  <p className="text-xs text-[#6B5E52]">CHF</p>
                </div>
                <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
                  <p className="text-xs uppercase text-[#6B5E52] mb-1">Total Registros</p>
                  <p className="text-2xl font-bold text-[#8B1A2B]">{allAnalisisRecords.length}</p>
                  <p className="text-xs text-[#6B5E52]">en periodo{hasFilters ? ` (${filteredRecords.length} filtrados)` : ""}</p>
                </div>
              </div>

              {/* Waste over time bar chart — clickable */}
              {porTiempo.length > 0 && (
                <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider mb-3">
                    Mermas por {periodo === "dia" ? "dia" : periodo === "semana" ? "semana" : "mes"}
                  </h3>
                  <div>
                    <div className="flex items-end gap-1" style={{ height: 160 }}>
                      {(() => {
                        const maxCoste = Math.max(...porTiempo.map((d) => d.coste), 1);
                        return porTiempo.map((d, i) => {
                          const barH = Math.max((d.coste / maxCoste) * 140, 4);
                          const isActive = filterTiempo === d.periodo;
                          return (
                            <div
                              key={i}
                              className="flex-1 flex flex-col items-center justify-end cursor-pointer"
                              title={`${d.periodo}: ${d.coste.toFixed(2)} CHF (${d.eventos} eventos)`}
                              onClick={() => setFilterTiempo(isActive ? null : d.periodo)}
                            >
                              <span className="text-[8px] text-[#6B5E52] mb-0.5 leading-none">
                                {d.coste.toFixed(0)}
                              </span>
                              <div
                                className={`w-full rounded-t transition-opacity ${isActive ? "bg-[#8B1A2B]" : "bg-[#8B1A2B]"}`}
                                style={{ height: barH, opacity: isActive ? 1 : filterTiempo ? 0.3 : 0.7 }}
                              />
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div className="flex gap-1 text-[8px] text-[#6B5E52] mt-1">
                      {porTiempo.map((d, i) => (
                        <div key={i} className="flex-1 text-center truncate">
                          {d.periodo.replace(/^\d{4}-/, "")}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* By category — clickable horizontal bars */}
              {porCategoria.length > 0 && (
                <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider mb-3">
                    Por Categoria
                  </h3>
                  <div className="space-y-2">
                    {(() => {
                      const maxCoste = Math.max(...porCategoria.map((c) => c.coste), 1);
                      return porCategoria.map((c, i) => {
                        const isActive = filterCategoria === c.categoria;
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => setFilterCategoria(isActive ? null : c.categoria)}
                            style={{ opacity: isActive ? 1 : filterCategoria ? 0.4 : 1 }}
                          >
                            <span className="text-sm text-[#6B5E52] w-24 text-right truncate">
                              {c.categoria}
                            </span>
                            <div className="flex-1 bg-[#F5F0E8] rounded h-5 overflow-hidden">
                              <div
                                className="bg-[#8B1A2B] h-full rounded"
                                style={{
                                  width: `${Math.max((c.coste / maxCoste) * 100, 2)}%`,
                                  opacity: isActive ? 1 : 0.7,
                                }}
                              />
                            </div>
                            <span className="text-xs text-[#6B5E52] w-20 text-right">
                              {c.coste.toFixed(2)} CHF
                            </span>
                            <span className="text-xs text-[#6B5E52] w-8 text-right">
                              ({c.eventos})
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* By motivo — clickable */}
              {porMotivo.length > 0 && (
                <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider mb-3">
                    Por Motivo
                  </h3>
                  <div className="space-y-2">
                    {(() => {
                      const maxCoste = Math.max(...porMotivo.map((m) => m.coste), 1);
                      return porMotivo.map((m, i) => {
                        const isActive = filterMotivo === m.motivo;
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => setFilterMotivo(isActive ? null : m.motivo)}
                            style={{ opacity: isActive ? 1 : filterMotivo ? 0.4 : 1 }}
                          >
                            <span className="text-sm text-[#6B5E52] w-24 text-right truncate">
                              {MOTIVO_LABELS[m.motivo] || m.motivo}
                            </span>
                            <div className="flex-1 bg-[#F5F0E8] rounded h-5 overflow-hidden">
                              <div
                                className="bg-[#8B1A2B] h-full rounded"
                                style={{
                                  width: `${Math.max((m.coste / maxCoste) * 100, 2)}%`,
                                  opacity: isActive ? 1 : 0.7,
                                }}
                              />
                            </div>
                            <span className="text-xs text-[#6B5E52] w-20 text-right">
                              {m.coste.toFixed(2)} CHF
                            </span>
                            <span className="text-xs text-[#6B5E52] w-8 text-right">
                              ({m.eventos})
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Top items — expandable */}
              {topItems.length > 0 && (
                <div className="bg-white border border-[#E8DFD3] rounded-lg">
                  <div className="px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3] flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider">
                      Items con mas Merma ({topItems.length})
                    </h3>
                    {topItems.length > 10 && (
                      <button
                        onClick={() => setShowAllTopItems(!showAllTopItems)}
                        className="text-xs text-[#6B5E52] hover:text-[#8B1A2B] underline"
                      >
                        {showAllTopItems ? "Ver menos" : "Ver todos"}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                          <th className="px-4 py-2 font-medium w-8">#</th>
                          <th className="px-4 py-2 font-medium">Nombre</th>
                          <th className="px-4 py-2 font-medium text-right">Eventos</th>
                          <th className="px-4 py-2 font-medium text-right">Cantidad</th>
                          <th className="px-4 py-2 font-medium text-right">Coste Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showAllTopItems ? topItems : topItems.slice(0, 10)).map((item, i) => (
                          <tr
                            key={i}
                            className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]"
                          >
                            <td className="px-4 py-2 text-[#6B5E52]">{i + 1}</td>
                            <td className="px-4 py-2">{item.nombre}</td>
                            <td className="px-4 py-2 text-right">{item.eventos}</td>
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              {item.cantidad.toFixed(2)} {item.unidad}
                            </td>
                            <td className="px-4 py-2 text-right whitespace-nowrap font-medium">
                              {item.coste.toFixed(2)} CHF
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Full records list */}
              <div className="bg-white border border-[#E8DFD3] rounded-lg">
                <div className="px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider">
                    Todos los registros ({filteredRecords.length})
                  </h3>
                  {!showAllRecords && filteredRecords.length > 0 && (
                    <button
                      onClick={() => setShowAllRecords(true)}
                      className="text-xs text-[#6B5E52] hover:text-[#8B1A2B] underline"
                    >
                      Expandir
                    </button>
                  )}
                  {showAllRecords && (
                    <button
                      onClick={() => { setShowAllRecords(false); setRecordsLimit(50); }}
                      className="text-xs text-[#6B5E52] hover:text-[#8B1A2B] underline"
                    >
                      Colapsar
                    </button>
                  )}
                </div>
                {showAllRecords && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                          <th className="px-4 py-2 font-medium cursor-pointer hover:text-[#8B1A2B]" onClick={() => toggleSort("fecha")}>
                            Fecha{sortIcon("fecha")}
                          </th>
                          <th className="px-4 py-2 font-medium cursor-pointer hover:text-[#8B1A2B]" onClick={() => toggleSort("item")}>
                            Item{sortIcon("item")}
                          </th>
                          <th className="px-4 py-2 font-medium cursor-pointer hover:text-[#8B1A2B]" onClick={() => toggleSort("cantidad")}>
                            Cantidad{sortIcon("cantidad")}
                          </th>
                          <th className="px-4 py-2 font-medium cursor-pointer hover:text-[#8B1A2B]" onClick={() => toggleSort("motivo")}>
                            Motivo{sortIcon("motivo")}
                          </th>
                          <th className="px-4 py-2 font-medium">Ubicacion</th>
                          <th className="px-4 py-2 font-medium text-right cursor-pointer hover:text-[#8B1A2B]" onClick={() => toggleSort("coste")}>
                            Coste{sortIcon("coste")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRecords.slice(0, recordsLimit).map((r) => (
                          <tr key={r.id} className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]">
                            <td className="px-4 py-2 whitespace-nowrap">{r.fecha}</td>
                            <td className="px-4 py-2">
                              {getItemName(r)}
                              {r.categoria_nombre && (
                                <span className="text-xs text-[#6B5E52] ml-1">({r.categoria_nombre})</span>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">{r.cantidad} {r.unidad}</td>
                            <td className="px-4 py-2">{MOTIVO_LABELS[r.motivo] || r.motivo}</td>
                            <td className="px-4 py-2">{r.ubicacion || "-"}</td>
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              {r.coste_total > 0 ? `${r.coste_total.toFixed(2)} CHF` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {recordsLimit < sortedRecords.length && (
                      <div className="px-4 py-3 text-center">
                        <button
                          onClick={() => setRecordsLimit((l) => l + 50)}
                          className="text-sm text-[#6B5E52] hover:text-[#8B1A2B] underline"
                        >
                          Ver mas ({sortedRecords.length - recordsLimit} restantes)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function MermasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="text-[#6B5E52]">Cargando...</div>
        </div>
      }
    >
      <MermasContent />
    </Suspense>
  );
}
