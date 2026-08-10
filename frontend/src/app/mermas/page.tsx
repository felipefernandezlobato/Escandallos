"use client";

import { Suspense, useEffect, useState } from "react";
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

  // Form
  const [tipoItem, setTipoItem] = useState<TipoItem>("ingrediente");
  const [saving, setSaving] = useState(false);
  const [buscarIng, setBuscarIng] = useState("");
  const [buscarRec, setBuscarRec] = useState("");
  const [form, setForm] = useState({
    ingrediente_id: null as number | null,
    receta_id: null as number | null,
    nombre_libre: "",
    cantidad: "",
    unidad: "unidad",
    motivo: "caducado" as MotivoMerma,
    notas: "",
    ubicacion: "",
    fecha: new Date().toISOString().slice(0, 10),
  });

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

  // Date range presets
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

  // Client-side filtering and aggregation
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

  // Aggregations from filtered records
  const totalEventos = filteredRecords.length;
  const totalCoste = filteredRecords.reduce((s, r) => s + r.coste_total, 0);

  // Time chart — always from allAnalisisRecords (not filtered by time)
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

  // Category chart — from records not filtered by category
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

  // Motivo chart — from records not filtered by motivo
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

  // Top items from filtered records
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

  // Sorted records for the list
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cantidad = parseFloat(form.cantidad.replace(",", "."));
    if (isNaN(cantidad) || cantidad <= 0) {
      toast("Cantidad debe ser mayor a 0", "error");
      return;
    }
    if (tipoItem === "ingrediente" && !form.ingrediente_id) {
      toast("Selecciona un ingrediente", "error");
      return;
    }
    if (tipoItem === "receta" && !form.receta_id) {
      toast("Selecciona una receta", "error");
      return;
    }
    if (tipoItem === "otro" && !form.nombre_libre.trim()) {
      toast("Escribe un nombre", "error");
      return;
    }
    if (form.motivo === "otro" && !form.notas.trim()) {
      toast("Notas obligatorias cuando el motivo es Otro", "error");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        cantidad,
        unidad: form.unidad,
        motivo: form.motivo,
        notas: form.notas || null,
        ubicacion: form.ubicacion || null,
        fecha: form.fecha,
      };
      if (tipoItem === "ingrediente") body.ingrediente_id = form.ingrediente_id;
      else if (tipoItem === "receta") body.receta_id = form.receta_id;
      else body.nombre_libre = form.nombre_libre;

      await apiFetch("/api/mermas", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast("Merma registrada");
      setForm({
        ingrediente_id: null,
        receta_id: null,
        nombre_libre: "",
        cantidad: "",
        unidad: "unidad",
        motivo: "caducado",
        notas: "",
        ubicacion: form.ubicacion,
        fecha: form.fecha,
      });
      setBuscarIng("");
      setBuscarRec("");
      fetchRegistros();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setSaving(false);
    }
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

  // Filter ingredients/recipes for search
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const ingFiltrados = buscarIng
    ? ingredientes.filter((i) => normalize(i.nombre).includes(normalize(buscarIng)))
    : ingredientes;

  const recFiltrados = buscarRec
    ? recetas.filter((r) => normalize(r.nombre).includes(normalize(buscarRec)))
    : recetas;

  // Auto-fill unit when ingredient selected
  const onSelectIngrediente = (id: number) => {
    const ing = ingredientes.find((i) => i.id === id);
    setForm((f) => ({
      ...f,
      ingrediente_id: id,
      unidad: ing?.unidad_uso || "unidad",
    }));
  };

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
          {/* Form */}
          <div className="bg-white border border-[#E8DFD3] rounded-lg">
            <div className="px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3]">
              <h2 className="font-semibold text-[#8B1A2B]">Registrar Merma</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Tipo selector */}
              <div>
                <label className="block text-xs text-[#6B5E52] mb-1">Tipo de item</label>
                <div className="flex gap-2">
                  {(["ingrediente", "receta", "otro"] as TipoItem[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTipoItem(t);
                        setForm((f) => ({
                          ...f,
                          ingrediente_id: null,
                          receta_id: null,
                          nombre_libre: "",
                          unidad: t === "ingrediente" ? "g" : "unidad",
                        }));
                        setBuscarIng("");
                        setBuscarRec("");
                      }}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        tipoItem === t
                          ? "bg-[#8B1A2B] text-white"
                          : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
                      }`}
                    >
                      {t === "ingrediente"
                        ? "Ingrediente"
                        : t === "receta"
                        ? "Receta"
                        : "Otro"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Item selector */}
              {tipoItem === "ingrediente" && (
                <div>
                  <label className="block text-xs text-[#6B5E52] mb-1">Ingrediente</label>
                  <input
                    type="text"
                    placeholder="Buscar ingrediente..."
                    value={buscarIng}
                    onChange={(e) => setBuscarIng(e.target.value)}
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full mb-1"
                  />
                  <select
                    value={form.ingrediente_id ?? ""}
                    onChange={(e) => onSelectIngrediente(parseInt(e.target.value))}
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                    size={Math.min(ingFiltrados.length, 6)}
                  >
                    {ingFiltrados.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.nombre} ({ing.unidad_uso})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {tipoItem === "receta" && (
                <div>
                  <label className="block text-xs text-[#6B5E52] mb-1">Receta</label>
                  <input
                    type="text"
                    placeholder="Buscar receta..."
                    value={buscarRec}
                    onChange={(e) => setBuscarRec(e.target.value)}
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full mb-1"
                  />
                  <select
                    value={form.receta_id ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, receta_id: parseInt(e.target.value) }))
                    }
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                    size={Math.min(recFiltrados.length, 6)}
                  >
                    {recFiltrados.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {tipoItem === "otro" && (
                <div>
                  <label className="block text-xs text-[#6B5E52] mb-1">Nombre</label>
                  <input
                    type="text"
                    placeholder="Ej: Plato roto, vaso..."
                    value={form.nombre_libre}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nombre_libre: e.target.value }))
                    }
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                  />
                </div>
              )}

              {/* Cantidad + Unidad + Motivo row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-[#6B5E52] mb-1">Cantidad</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.cantidad}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        cantidad: e.target.value.replace(",", "."),
                      }))
                    }
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B5E52] mb-1">Unidad</label>
                  <select
                    value={form.unidad}
                    onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))}
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#6B5E52] mb-1">Motivo</label>
                  <select
                    value={form.motivo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, motivo: e.target.value as MotivoMerma }))
                    }
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                  >
                    {MOTIVOS_MERMA.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#6B5E52] mb-1">Ubicacion</label>
                  <select
                    value={form.ubicacion}
                    onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))}
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                  >
                    <option value="">--</option>
                    <option value="BRU1">BRU1</option>
                    <option value="BRU2">BRU2</option>
                  </select>
                </div>
              </div>

              {/* Fecha + Notas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#6B5E52] mb-1">Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B5E52] mb-1">
                    Notas{form.motivo === "otro" ? " (obligatorio)" : ""}
                  </label>
                  <input
                    type="text"
                    placeholder="Detalles adicionales..."
                    value={form.notas}
                    onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                    className="border border-[#D4C4A8] rounded px-3 py-2 text-sm w-full"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="bg-[#8B1A2B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420] transition-colors disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Registrar Merma"}
              </button>
            </form>
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
