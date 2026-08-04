"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { Ingrediente, Categoria, RecomendacionItem } from "@/lib/types";

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

const STORAGE_KEY = "bru_inventario_draft";
const REC_DRAFT_KEY = "bru_rec_draft";

function saveDraftCantidades(cantidades: Record<number, string>) {
  localStorage.setItem(REC_DRAFT_KEY, JSON.stringify({ ts: Date.now(), cantidades }));
}

function loadDraftCantidades(): Record<number, string> | null {
  const raw = localStorage.getItem(REC_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed.ts || 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(REC_DRAFT_KEY);
      return null;
    }
    return parsed.cantidades;
  } catch {
    localStorage.removeItem(REC_DRAFT_KEY);
    return null;
  }
}

function saveDraft(stock: Record<number, StockEntry>) {
  const filled: Record<number, StockEntry> = {};
  for (const [id, entry] of Object.entries(stock)) {
    if (entry.cantidad !== "" && parseFloat(entry.cantidad) >= 0) {
      filled[Number(id)] = entry;
    }
  }
  if (Object.keys(filled).length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), data: filled }));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadDraft(): Record<number, StockEntry> | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const ageMs = Date.now() - (parsed.ts || 0);
    if (ageMs > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export default function InventarioPage() {
  return (
    <Suspense fallback={<p className="text-[#6B5E52] text-center py-10">Cargando...</p>}>
      <InventarioContent />
    </Suspense>
  );
}

function InventarioContent() {
  const toast = useToast();
  const searchParams = useSearchParams();

  // Read URL params only on initial mount for deep linking
  const [tab, setTabState] = useState<"registrar" | "historial" | "analisis">(
    (searchParams.get("tab") as "registrar" | "historial" | "analisis") || "registrar"
  );
  const [selectedSemana, setSelectedSemana] = useState(searchParams.get("semana") || "");

  // Sync URL without triggering navigation (no re-render, no Suspense)
  const syncUrl = useCallback((params: Record<string, string>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    window.history.replaceState(null, "", `/inventario${qs ? `?${qs}` : ""}`);
  }, []);

  const setTab = useCallback((newTab: "registrar" | "historial" | "analisis") => {
    setTabState(newTab);
    syncUrl({ tab: newTab });
  }, [syncUrl]);

  const setHistorialFecha = useCallback((semana: string) => {
    setSelectedSemana(semana);
    syncUrl({ tab: "historial", ...(semana ? { semana } : {}) });
  }, [syncUrl]);

  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [stock, setStock] = useState<Record<number, StockEntry>>({});
  const [buscar, setBuscar] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fechas, setFechas] = useState<string[]>([]);
  const [semanas, setSemanas] = useState<string[]>([]);
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
  const [idsConRegistros, setIdsConRegistros] = useState<number[]>([]);
  const [vista, setVistaState] = useState<"cocina" | "cafe" | "bar">(
    (searchParams.get("seccion") as "cocina" | "cafe" | "bar") || "cocina"
  );
  const setVista = useCallback((v: "cocina" | "cafe" | "bar") => {
    setVistaState(v);
    const sp = new URLSearchParams(window.location.search);
    sp.set("seccion", v);
    window.history.replaceState(null, "", `/inventario?${sp.toString()}`);
  }, []);
  const [ultimoConteo, setUltimoConteo] = useState<Record<string, { fecha: string; unidad: string }>>({});
  const [recomendaciones, setRecomendaciones] = useState<RecomendacionItem[]>([]);
  const [showRecomendaciones, setShowRecomendaciones] = useState(
    searchParams.get("view") === "recomendaciones"
  );
  const [hasRecomendaciones, setHasRecomendaciones] = useState(false);
  const [cantidadesPedido, setCantidadesPedido] = useState<Record<number, string>>({});
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [registrosHoy, setRegistrosHoy] = useState<Array<{
    id: number;
    ingrediente_id: number;
    ingrediente_nombre: string;
    cantidad: number;
    unidad: string;
    notas: string | null;
  }>>([]);
  const [editingRegistro, setEditingRegistro] = useState<number | null>(null);
  const [editCantidad, setEditCantidad] = useState("");
  const [ubicacionCafe, setUbicacionCafe] = useState<"BRU1" | "BRU2">("BRU1");
  const [showGestionarCafes, setShowGestionarCafes] = useState(false);
  const [newCoffeeName, setNewCoffeeName] = useState("");
  const [newCoffeeParent, setNewCoffeeParent] = useState<number | null>(null);
  const [savingCoffeeToggle, setSavingCoffeeToggle] = useState<number | null>(null);
  const [cafeAnalisisData, setCafeAnalisisData] = useState<Array<{
    id: number; nombre: string;
    consumo_medio: number; unidad: string; tendencia: string;
    safety_stock: number | null; par_level: number | null;
    cycle_weeks: number | null; lead_weeks: number | null;
    stock: number;
  }>>([]);
  const [cafeAnalisisLoading, setCafeAnalisisLoading] = useState(false);

  const fetchRegistrosHoy = () => {
    const hoy = new Date().toISOString().slice(0, 10);
    apiFetch<{ snapshot: InventarioSnapshot | null }>(`/api/inventario?fecha=${hoy}`)
      .then((data) => {
        setRegistrosHoy(data.snapshot?.registros || []);
      });
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<Ingrediente[]>("/api/ingredientes"),
      apiFetch<Categoria[]>("/api/categorias?tipo=ingrediente"),
      apiFetch<{ fechas: string[]; semanas: string[]; snapshot: InventarioSnapshot | null }>("/api/inventario"),
      apiFetch<Record<string, { fecha: string; unidad: string }>>("/api/inventario/ultimo-conteo"),
      apiFetch<number[]>("/api/inventario/con-registros"),
    ])
      .then(([ings, cats, inv, conteo, conReg]) => {
        setIdsConRegistros(conReg);
        fetchRegistrosHoy();
        setUltimoConteo(conteo);
        setIngredientes(ings);
        setCategorias(cats);
        setFechas(inv.fechas || []);
        setSemanas(inv.semanas || []);

        const initial: Record<number, StockEntry> = {};
        for (const ing of ings) {
          const lastUnit = conteo[String(ing.id)]?.unidad;
          initial[ing.id] = {
            ingrediente_id: ing.id,
            cantidad: "",
            unidad: lastUnit || ing.unidad_compra,
          };
        }

        const draft = loadDraft();
        if (draft) {
          let restoredCount = 0;
          for (const [id, entry] of Object.entries(draft)) {
            const numId = Number(id);
            if (initial[numId]) {
              initial[numId] = { ...initial[numId], cantidad: entry.cantidad, unidad: entry.unidad };
              restoredCount++;
            }
          }
          if (restoredCount > 0) {
            toast(`${restoredCount} valores restaurados del borrador anterior.`, "success");
          }
        }

        setStock(initial);
        setTimeout(() => setDraftReady(true), 0);

        // Always fetch today's registros to build complete recommendations
        const hoy = new Date().toISOString().slice(0, 10);
        apiFetch<{ snapshot: InventarioSnapshot | null }>(`/api/inventario?fecha=${hoy}`)
          .then((data) => {
            const regs = data.snapshot?.registros || [];
            if (regs.length === 0) return;
            const ids = regs.map((r) => r.ingrediente_id);
            // Also include parent IDs so aggregated coffee recommendations appear
            const childIngIds = new Set(ids);
            for (const ing of ings) {
              if (ing.grupo_ingrediente_id && childIngIds.has(ing.id)) {
                ids.push(ing.grupo_ingrediente_id);
              }
            }
            const uniqueIds = Array.from(new Set(ids));
            apiFetch<{ items: RecomendacionItem[] }>(
              `/api/inventario/recomendacion?ingrediente_ids=${uniqueIds.join(",")}`
            ).then((rec) => {
              const draft = loadDraftCantidades();
              const cantidades: Record<number, string> = {};
              for (const item of rec.items) {
                cantidades[item.ingrediente_id] = draft?.[item.ingrediente_id] ?? String(item.cantidad_sugerida);
              }
              setRecomendaciones(rec.items);
              setCantidadesPedido(cantidades);
              setHasRecomendaciones(true);
            });
          });
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-load café analysis when entering Cafe tab or after saving inventory
  useEffect(() => {
    if (vista !== "cafe" || loading || ingredientes.length === 0) return;
    setCafeAnalisisLoading(true);
    apiFetch<Array<{
      id: number; nombre: string; consumo_medio: number; unidad: string;
      tendencia: string; safety_stock: number | null; par_level: number | null;
      stock: number; ubicaciones?: Record<string, { cantidad: number }> | null;
    }>>("/api/inventario/cafe-resumen")
      .then((items) => {
        const data: typeof cafeAnalisisData = [];
        for (const r of items) {
          if (r.consumo_medio > 0 || r.stock > 0) {
            data.push({
              id: r.id, nombre: r.nombre,
              consumo_medio: r.consumo_medio, unidad: r.unidad, tendencia: r.tendencia,
              safety_stock: r.safety_stock, par_level: r.par_level,
              cycle_weeks: null, lead_weeks: null,
              stock: r.stock,
            });
          }
        }
        setCafeAnalisisData(data);
      })
      .catch(() => {})
      .finally(() => setCafeAnalisisLoading(false));
  }, [vista, loading, ingredientes.length, lastSaved]);

  // Save draft to localStorage whenever stock changes (skip during initial load)
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    if (draftReady) {
      saveDraft(stock);
    }
  }, [stock, draftReady]);

  useEffect(() => {
    if (showRecomendaciones && recomendaciones.length > 0) {
      saveDraftCantidades(cantidadesPedido);
    }
  }, [cantidadesPedido, showRecomendaciones, recomendaciones]);

  // Warn on page unload if there are unsaved entries
  useEffect(() => {
    const filledEntries = Object.values(stock).filter(
      (s) => s.cantidad !== "" && parseFloat(s.cantidad) >= 0
    );
    if (filledEntries.length === 0) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [stock]);

  const handleEditRegistro = async (registroId: number) => {
    const qty = parseFloat(editCantidad);
    if (isNaN(qty) || qty < 0) {
      toast("Cantidad invalida", "error");
      return;
    }
    try {
      await apiFetch(`/api/inventario/${registroId}`, {
        method: "PUT",
        body: JSON.stringify({ cantidad: qty }),
      });
      setEditingRegistro(null);
      setEditCantidad("");
      fetchRegistrosHoy();
      if (activeSemana) {
        apiFetch<{ snapshot: InventarioSnapshot | null }>(`/api/inventario?semana=${activeSemana}`).then((data) => setHistorial(data.snapshot));
      }
      const conteo = await apiFetch<Record<string, { fecha: string; unidad: string }>>("/api/inventario/ultimo-conteo");
      setUltimoConteo(conteo);
      toast("Registro actualizado", "success");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  };

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

  const activeSemana = selectedSemana;
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  useEffect(() => {
    if (activeSemana) {
      setLoadingHistorial(true);
      apiFetch<{ snapshot: InventarioSnapshot | null }>(
        `/api/inventario?semana=${activeSemana}`
      ).then((data) => {
        setHistorial(data.snapshot);
      }).finally(() => setLoadingHistorial(false));
    } else {
      setHistorial(null);
    }
  }, [activeSemana]);

  const fetchPivot = () => {
    apiFetch<typeof pivot>("/api/inventario/pivot").then(setPivot);
  };

  useEffect(() => {
    if (tab === "historial" && !pivot) {
      fetchPivot();
    }
  }, [tab]);

  const ingredientesFiltrados = ingredientes.filter((ing) => {
    if (ing.excluir_pedidos) return false;
    if (filtroCategoria && String(ing.categoria_id) !== filtroCategoria) return false;
    if (buscar && !ing.nombre.toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  });

  const cocinaCategories = categorias.filter((c) => c.seccion === "cocina").sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const cafeCategories = categorias.filter((c) => c.seccion === "cafe").sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const barCategories = categorias.filter((c) => c.seccion === "bar").sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  const SIBARIST_FAMILIES = ["Cone", "Hybrid", "Flat 2", "Flat", "Wave", "Disc", "Batch Brew", "Origami", "Espresso", "Booster", "Halo", "Dripper"];
  const getSibaristFamily = (name: string): string => {
    const n = name.replace("Sibarist ", "");
    return SIBARIST_FAMILIES.find((f) => n.startsWith(f)) || "Otros";
  };

  const matchesVista = (ingredienteId: number, ingredienteNombre: string): boolean => {
    if (ingredienteNombre.toLowerCase().includes("sibarist")) return vista === "cafe";
    const fullIng = ingredientes.find((i) => i.id === ingredienteId);
    if (!fullIng) return false;
    const cat = categorias.find((c) => c.id === fullIng.categoria_id);
    if (!cat) return false;
    return cat.seccion === vista;
  };

  // Get parent ingredient IDs (groups) for cafe section
  const parentIds = new Set(
    ingredientes
      .filter((i) => i.grupo_ingrediente_id != null)
      .map((i) => i.grupo_ingrediente_id!)
  );

  // Get children grouped by parent
  const cafeGrouped = ingredientes.filter(
    (i) => i.grupo_ingrediente_id != null && i.activo !== false
  );
  const cafeGroupedIds = new Set(cafeGrouped.map((i) => i.id));

  // Group children by parent
  const childrenByParent: Record<number, Ingrediente[]> = {};
  for (const ing of ingredientes.filter((i) => i.grupo_ingrediente_id != null)) {
    const pid = ing.grupo_ingrediente_id!;
    if (!childrenByParent[pid]) childrenByParent[pid] = [];
    childrenByParent[pid].push(ing);
  }

  const porCategoria: Array<{ id: number; nombre: string; items: Ingrediente[]; sibaristFamilies?: Array<{ family: string; items: Ingrediente[] }> }> = (() => {
    if (filtroCategoria) {
      return categorias
        .filter((c) => c.tipo === "ingrediente")
        .map((c) => ({ ...c, items: ingredientesFiltrados.filter((i) => i.categoria_id === c.id) }))
        .filter((g) => g.items.length > 0);
    }

    if (vista === "cafe") {
      // Non-grouped cafe items (no grupo_ingrediente_id, not a parent)
      const nonGrouped = ingredientesFiltrados.filter(
        (i) => !i.grupo_ingrediente_id && !parentIds.has(i.id) && i.activo !== false
      );
      // Organize Té+ items into thematic sections
      const teItems = nonGrouped.filter((i) => {
        const cat = cafeCategories.find((c) => c.id === i.categoria_id);
        return cat && cat.nombre.toLowerCase().includes("té");
      });
      const teSections: Array<{ title: string; keywords: string[]; items: Ingrediente[] }> = [
        { title: "Matcha", keywords: ["matcha", "hojicha"], items: [] },
        { title: "Chocolate", keywords: ["chocolate", "garcoa"], items: [] },
        { title: "Chai & Té", keywords: ["chai", "prana", "tea", "te ", "del mar"], items: [] },
      ];
      for (const item of teItems) {
        const n = item.nombre.toLowerCase();
        const section = teSections.find((s) => s.keywords.some((kw) => n.includes(kw)));
        if (section) section.items.push(item);
        else teSections[2].items.push(item);
      }
      const teGroupIds = new Set(teItems.map((i) => i.id));

      const groups: Array<{ id: number; nombre: string; items: Ingrediente[]; sibaristFamilies?: Array<{ family: string; items: Ingrediente[] }> }> = cafeCategories
        .map((c) => ({ ...c, items: nonGrouped.filter((i) => i.categoria_id === c.id && !teGroupIds.has(i.id)) }))
        .filter((g) => g.items.length > 0);

      // Add Té sections as separate groups
      for (const ts of teSections) {
        if (ts.items.length > 0) {
          groups.push({ id: -100 - teSections.indexOf(ts), nombre: ts.title, items: ts.items });
        }
      }

      const sibaristItems = nonGrouped.filter((i) => i.nombre.toLowerCase().includes("sibarist"));
      if (sibaristItems.length > 0) {
        // Remove sibarist items from their original category groups
        for (const g of groups) {
          g.items = g.items.filter((i) => !i.nombre.toLowerCase().includes("sibarist"));
        }
        // Remove empty groups after removing sibarist items
        const filteredGroups = groups.filter((g) => g.items.length > 0);
        groups.length = 0;
        groups.push(...filteredGroups);

        const familyMap: Record<string, Ingrediente[]> = {};
        for (const item of sibaristItems) {
          const family = getSibaristFamily(item.nombre);
          if (!familyMap[family]) familyMap[family] = [];
          familyMap[family].push(item);
        }
        const sibaristFamilies = SIBARIST_FAMILIES
          .filter((f) => familyMap[f]?.length > 0)
          .map((f) => ({ family: f, items: familyMap[f] }));
        const otrosFamily = familyMap["Otros"];
        if (otrosFamily?.length > 0) {
          sibaristFamilies.push({ family: "Otros", items: otrosFamily });
        }
        groups.push({ id: -1, nombre: "Sibarist", items: sibaristItems, sibaristFamilies });
      }
      return groups;
    }

    if (vista === "bar") {
      return barCategories
        .map((c) => ({ ...c, items: ingredientesFiltrados.filter((i) => i.categoria_id === c.id) }))
        .filter((g) => g.items.length > 0);
    }

    return cocinaCategories
      .map((c) => ({ ...c, items: ingredientesFiltrados.filter((i) => i.categoria_id === c.id) }))
      .filter((g) => g.items.length > 0);
  })();

  const handleSave = async () => {
    setSaving(true);
    const registros = Object.values(stock)
      .filter((s) => s.cantidad !== "" && parseFloat(s.cantidad) >= 0)
      .map((s) => ({
        ingrediente_id: s.ingrediente_id,
        cantidad: parseFloat(s.cantidad),
        unidad: s.unidad,
        ...(cafeGroupedIds.has(s.ingrediente_id) ? { ubicacion: ubicacionCafe } : {}),
      }));

    if (registros.length === 0) {
      toast("No hay datos para guardar. Introduce al menos una cantidad.", "error");
      setSaving(false);
      return;
    }

    try {
      await apiFetch("/api/inventario", {
        method: "POST",
        body: JSON.stringify({ registros }),
      });
      localStorage.removeItem(STORAGE_KEY);
      setLastSaved(new Date().toLocaleTimeString("es"));
      const inv = await apiFetch<{ fechas: string[] }>("/api/inventario");
      setFechas(inv.fechas || []);
      const conteo = await apiFetch<Record<string, { fecha: string; unidad: string }>>("/api/inventario/ultimo-conteo");
      setUltimoConteo(conteo);
      fetchRegistrosHoy();

      // Fetch ALL of today's registros to include everything, not just this batch
      const hoy = new Date().toISOString().slice(0, 10);
      const todayData = await apiFetch<{ snapshot: InventarioSnapshot | null }>(`/api/inventario?fecha=${hoy}`);
      const todayIds = (todayData.snapshot?.registros || []).map((r) => r.ingrediente_id);
      const rec = await apiFetch<{ items: RecomendacionItem[] }>(
        `/api/inventario/recomendacion?ingrediente_ids=${todayIds.join(",")}`
      );
      setRecomendaciones(rec.items);
      const draft = loadDraftCantidades();
      const initial: Record<number, string> = {};
      for (const item of rec.items) {
        initial[item.ingrediente_id] = draft?.[item.ingrediente_id] ?? String(item.cantidad_sugerida);
      }
      setCantidadesPedido(initial);
      saveDraftCantidades(initial);
      setHasRecomendaciones(true);
      setShowRecomendaciones(true);
    } catch (err) {
      toast("Error al guardar: " + (err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    const cleared: Record<number, StockEntry> = {};
    for (const ing of ingredientes) {
      const lastUnit = ultimoConteo[String(ing.id)]?.unidad;
      cleared[ing.id] = {
        ingrediente_id: ing.id,
        cantidad: "",
        unidad: lastUnit || ing.unidad_compra,
      };
    }
    setStock(cleared);
    localStorage.removeItem(STORAGE_KEY);
  };

  const filledCount = Object.values(stock).filter(
    (s) => s.cantidad !== "" && parseFloat(s.cantidad) >= 0
  ).length;

  const formatUltimoConteo = (ingId: number): string => {
    const entry = ultimoConteo[String(ingId)];
    if (!entry) return "—";
    const fecha = entry.fecha;
    const diff = Math.floor(
      (Date.now() - new Date(fecha + "T00:00:00").getTime()) / 86400000
    );
    if (diff === 0) return "hoy";
    if (diff === 1) return "ayer";
    if (diff < 7) return `hace ${diff}d`;
    const weeks = Math.floor(diff / 7);
    return weeks === 1 ? "hace 1 sem" : `hace ${weeks} sem`;
  };

  const handleCrearPedido = async (proveedor: string) => {
    const items = recomendaciones.filter((r) => r.proveedor === proveedor);
    const lineas = items
      .filter((item) => {
        const qty = parseFloat(cantidadesPedido[item.ingrediente_id] || "0");
        return qty > 0;
      })
      .map((item) => ({
        ingrediente_id: item.ingrediente_id,
        cantidad_pedida: parseFloat(cantidadesPedido[item.ingrediente_id] || "0"),
        unidad: item.unidad,
      }));

    if (lineas.length === 0) {
      toast("No hay items con cantidad > 0 para este proveedor.", "error");
      return;
    }

    setCreatingOrder(true);
    try {

      await apiFetch("/api/pedidos", {
        method: "POST",
        body: JSON.stringify({ proveedor, lineas }),
      });
      toast(`Pedido para ${proveedor} creado como borrador.`);
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleDeleteRegistro = async (registroId: number) => {
    try {
      await apiFetch(`/api/inventario/${registroId}`, { method: "DELETE" });
      fetchRegistrosHoy();
      if (activeSemana) {
        apiFetch<{ snapshot: InventarioSnapshot | null }>(`/api/inventario?semana=${activeSemana}`).then((data) => setHistorial(data.snapshot));
      }
      const conteo = await apiFetch<Record<string, { fecha: string; unidad: string }>>("/api/inventario/ultimo-conteo");
      setUltimoConteo(conteo);
      toast("Registro eliminado", "success");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  };

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
          {!showRecomendaciones && (<>
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
            <button
              onClick={() => setVista("bar")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                vista === "bar"
                  ? "bg-[#8B1A2B] text-white"
                  : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
              }`}
            >
              Bar
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
              {filledCount} / {ingredientesFiltrados.length}
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

          {/* Cafe grouped coffees section */}
          {vista === "cafe" && !loading && Object.keys(childrenByParent).length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#6B5E52]">Ubicacion:</span>
                  <div className="flex rounded-lg overflow-hidden border border-[#D4C4A8]">
                    <button
                      onClick={() => setUbicacionCafe("BRU1")}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                        ubicacionCafe === "BRU1"
                          ? "bg-[#8B1A2B] text-white"
                          : "bg-white text-[#6B5E52] hover:bg-[#F5F0E8]"
                      }`}
                    >
                      BRU1
                    </button>
                    <button
                      onClick={() => setUbicacionCafe("BRU2")}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-[#D4C4A8] ${
                        ubicacionCafe === "BRU2"
                          ? "bg-[#8B1A2B] text-white"
                          : "bg-white text-[#6B5E52] hover:bg-[#F5F0E8]"
                      }`}
                    >
                      BRU2
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowGestionarCafes(true)}
                  className="px-3 py-1.5 text-sm font-medium bg-white border border-[#D4C4A8] text-[#6B5E52] rounded-lg hover:bg-[#F5F0E8] transition-colors"
                >
                  Gestionar Cafes
                </button>
              </div>

              {/* Cafe Analysis Panel */}
              {cafeAnalisisData.length > 0 && (
                <div className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3]">
                    <h3 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider">
                      Resumen Cafe — Pedidos
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E8DFD3] text-[#6B5E52]">
                          <th className="text-left px-3 py-2 font-medium">Grupo</th>
                          <th className="text-right px-3 py-2 font-medium">Stock</th>
                          <th className="text-right px-3 py-2 font-medium">Consumo</th>
                          <th className="text-right px-3 py-2 font-medium">Stk Deseado</th>
                          <th className="text-right px-3 py-2 font-medium">Pedir</th>
                          <th className="text-right px-3 py-2 font-medium">Tendencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const displayNames: Record<string, string> = {};
                          const sortOrder: Record<string, number> = {};
                          for (const d of cafeAnalisisData) {
                            const n = d.nombre.toLowerCase();
                            if (n.includes("grano") && n.includes("marr")) { displayNames[d.id] = "1kg MARRÓN"; sortOrder[d.id] = 1; }
                            else if (n.includes("grano") && n.includes("rojo")) { displayNames[d.id] = "1kg ROJO"; sortOrder[d.id] = 2; }
                            else if (n.includes("200") && n.includes("marr")) { displayNames[d.id] = "200g MARRÓN"; sortOrder[d.id] = 3; }
                            else if (n.includes("200") && n.includes("rojo")) { displayNames[d.id] = "200g ROJO"; sortOrder[d.id] = 4; }
                            else if (n.includes("200") && n.includes("black")) { displayNames[d.id] = "200g BLACK"; sortOrder[d.id] = 5; }
                            else if (n.includes("gold") || n.includes("130")) { displayNames[d.id] = "130g GOLD"; sortOrder[d.id] = 6; }
                            else if (n.includes("cápsula") || n.includes("capsula")) { displayNames[d.id] = "Cápsulas"; sortOrder[d.id] = 7; }
                            else if (n.includes("frozen bru1") || n.includes("tubos frozen bru1")) { displayNames[d.id] = "Frozen BRU1"; sortOrder[d.id] = 8; }
                            else if (n.includes("frozen bru2") || n.includes("tubos frozen bru2")) { displayNames[d.id] = "Frozen BRU2"; sortOrder[d.id] = 9; }
                            else if (n.includes("frozen") || n.includes("tubo")) { displayNames[d.id] = d.nombre; sortOrder[d.id] = 10; }
                            else { displayNames[d.id] = d.nombre; sortOrder[d.id] = 99; }
                          }
                          return cafeAnalisisData
                          .sort((a, b) => (sortOrder[a.id] || 99) - (sortOrder[b.id] || 99))
                          .map((d) => {
                            const isFrozen = (displayNames[d.id] || d.nombre).toLowerCase().includes("frozen");
                            const consumoDisplay = isFrozen ? d.consumo_medio : d.consumo_medio * 4.33;
                            const periodoLabel = isFrozen ? "/sem" : "/mes";
                            const pedir = d.par_level ? Math.max(0, d.par_level - d.stock) : 0;
                            return (
                              <tr key={d.id} className="border-b border-[#E8DFD3] hover:bg-[#F5F0E8]/50">
                                <td className="px-3 py-2">
                                  <Link href={`/ingredientes/${d.id > 100000 ? Math.floor(d.id / 1000) : d.id}`} className="text-[#8B1A2B] hover:underline font-medium">
                                    {displayNames[d.id] || d.nombre}
                                  </Link>
                                </td>
                                <td className="text-right px-3 py-2 font-medium">
                                  {d.stock > 0 ? d.stock.toFixed(1) : "—"} {d.unidad}
                                </td>
                                <td className="text-right px-3 py-2">
                                  {consumoDisplay > 0 ? consumoDisplay.toFixed(1) : "—"} {d.unidad}{periodoLabel}
                                </td>
                                <td className="text-right px-3 py-2">
                                  {d.par_level ? d.par_level.toFixed(1) : "—"} {d.unidad}
                                </td>
                                <td className={`text-right px-3 py-2 font-bold ${pedir > 0 ? "text-[#8B1A2B]" : "text-green-600"}`}>
                                  {pedir > 0 ? pedir.toFixed(1) : "0"}
                                </td>
                                <td className={`text-right px-3 py-2 ${
                                  d.tendencia === "subiendo" ? "text-red-600" : d.tendencia === "bajando" ? "text-green-600" : "text-[#6B5E52]"
                                }`}>
                                  {d.tendencia === "subiendo" ? "↑" : d.tendencia === "bajando" ? "↓" : "→"}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(() => {
                const allParents = Array.from(parentIds)
                  .map((pid) => ingredientes.find((i) => i.id === pid))
                  .filter(Boolean) as Ingrediente[];

                const cafeSections: { title: string; keywords: string[] }[] = [
                  { title: "CAFÉS DE KILO", keywords: ["kilo", "grano"] },
                  { title: "CAFÉS DE 200G", keywords: ["200g"] },
                  { title: "CAFÉS DE 130G / COMPETITION", keywords: ["130g", "gold"] },
                  { title: "CÁPSULAS", keywords: ["cápsula", "capsula"] },
                  { title: "FROZEN TUBES", keywords: ["frozen", "tubo"] },
                ];

                const assigned = new Set<number>();

                const renderItem = (ing: Ingrediente) => (
                  <div key={ing.id} className="flex items-center gap-2 bg-white border border-[#E8DFD3] rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <Link href={`/ingredientes/${ing.id}`} className="text-sm truncate block text-[#8B1A2B] hover:underline" title={ing.nombre}>
                        {ing.nombre}
                      </Link>
                      <span className="text-[10px] text-[#6B5E52]/60">
                        {formatUltimoConteo(ing.id)}
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={stock[ing.id]?.cantidad ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(",", ".");
                        if (v === "" || /^\d*\.?\d*$/.test(v))
                          setStock((prev) => ({
                            ...prev,
                            [ing.id]: {
                              ...prev[ing.id],
                              cantidad: v,
                            },
                          }));
                      }}
                      className="w-20 border border-[#D4C4A8] rounded px-2 py-1 text-sm text-right"
                    />
                    <span className="text-xs text-[#6B5E52] w-8">
                      {stock[ing.id]?.unidad || ing.unidad_compra}
                    </span>
                  </div>
                );

                return (
                  <>
                    {cafeSections.map((section) => {
                      const sectionParents = allParents.filter((p) => {
                        if (assigned.has(p.id)) return false;
                        const n = p.nombre.toLowerCase();
                        return section.keywords.some((kw) => n.includes(kw));
                      });
                      sectionParents.forEach((p) => assigned.add(p.id));
                      const colorOrder = ["marrón", "marron", "rojo", "black", "negro", "gold", "oro", "dorado"];
                      const parentsWithChildren = sectionParents
                        .sort((a, b) => {
                          const na = a.nombre.toLowerCase();
                          const nb = b.nombre.toLowerCase();
                          const ia = colorOrder.findIndex((c) => na.includes(c));
                          const ib = colorOrder.findIndex((c) => nb.includes(c));
                          if (ia !== -1 && ib !== -1) return ia - ib;
                          if (ia !== -1) return -1;
                          if (ib !== -1) return 1;
                          return na.localeCompare(nb, "es");
                        })
                        .filter((p) => (childrenByParent[p.id] || []).some((c) => c.activo !== false));
                      if (parentsWithChildren.length === 0) return null;
                      return (
                        <div key={section.title}>
                          <h2 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider mb-2 border-b border-[#E8DFD3] pb-1">
                            {section.title}
                          </h2>
                          {parentsWithChildren.map((parent, pi) => {
                            const children = (childrenByParent[parent.id] || []).filter(
                              (c) => c.activo !== false
                            );
                            return (
                              <div key={parent.id}>
                                {pi > 0 && <div className="border-t border-[#D4C4A8] my-2" />}
                                <p className="text-xs text-[#6B5E52]/70 font-medium mb-1 mt-1">{parent.nombre}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {children.map(renderItem)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          )}

          {loading ? (
            <p className="text-[#6B5E52] text-center py-10">Cargando...</p>
          ) : (
            <div className="space-y-6">
              {porCategoria.map((grupo) => (
                <div key={grupo.id}>
                  <h2 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider mb-2 border-b border-[#E8DFD3] pb-1">
                    {grupo.nombre}
                  </h2>
                  {grupo.sibaristFamilies ? (
                    <div>
                      {grupo.sibaristFamilies.map((fam, fi) => (
                        <div key={fam.family}>
                          {fi > 0 && <div className="border-t border-[#D4C4A8] my-2" />}
                          <p className="text-xs text-[#6B5E52]/70 font-medium mb-1 mt-1">{fam.family}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {fam.items.map((ing) => (
                              <div
                                key={ing.id}
                                className="flex items-center gap-2 bg-white border border-[#E8DFD3] rounded-lg px-3 py-2"
                              >
                                <div className="flex-1 min-w-0">
                                  <Link href={`/ingredientes/${ing.id}`} className="text-sm truncate block text-[#8B1A2B] hover:underline" title={ing.nombre}>
                                    {ing.nombre}
                                  </Link>
                                  <span className="text-[10px] text-[#6B5E52]/60">
                                    {formatUltimoConteo(ing.id)}
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={stock[ing.id]?.cantidad ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(",", ".");
                                    if (v === "" || /^\d*\.?\d*$/.test(v))
                                      setStock((prev) => ({
                                        ...prev,
                                        [ing.id]: {
                                          ...prev[ing.id],
                                          cantidad: v,
                                        },
                                      }));
                                  }}
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
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {grupo.items.map((ing) => (
                        <div
                          key={ing.id}
                          className="flex items-center gap-2 bg-white border border-[#E8DFD3] rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <Link href={`/ingredientes/${ing.id}`} className="text-sm truncate block text-[#8B1A2B] hover:underline" title={ing.nombre}>
                              {ing.nombre}
                            </Link>
                            <span className="text-[10px] text-[#6B5E52]/60">
                              {formatUltimoConteo(ing.id)}
                            </span>
                          </div>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={stock[ing.id]?.cantidad ?? ""}
                            onChange={(e) => {
                              const v = e.target.value.replace(",", ".");
                              if (v === "" || /^\d*\.?\d*$/.test(v))
                                setStock((prev) => ({
                                  ...prev,
                                  [ing.id]: {
                                    ...prev[ing.id],
                                    cantidad: v,
                                  },
                                }));
                            }}
                            className="w-20 border border-[#D4C4A8] rounded px-2 py-1 text-sm text-right"
                          />
                          <span className="text-xs text-[#6B5E52] w-8">
                            {stock[ing.id]?.unidad || ing.unidad_uso}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </>)}

          {!showRecomendaciones && registrosHoy.length > 0 && (() => {
            const vistaRegistros = registrosHoy.filter((r) => matchesVista(r.ingrediente_id, r.ingrediente_nombre));
            if (vistaRegistros.length === 0) return null;
            const grouped: Record<string, typeof registrosHoy> = {};
            for (const r of vistaRegistros) {
              const ing = ingredientes.find((i) => i.id === r.ingrediente_id);
              const catId = ing?.categoria_id;
              const cat = categorias.find((c) => c.id === catId);
              const catName = cat?.nombre || "Otros";
              if (!grouped[catName]) grouped[catName] = [];
              grouped[catName].push(r);
            }
            return (
              <div className="mt-6 bg-white border border-[#E8DFD3] rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3] flex items-center justify-between">
                  <h3 className="font-semibold text-[#8B1A2B]">
                    Registrado hoy ({vistaRegistros.length} items)
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                      <th className="px-4 py-2 font-medium">Ingrediente</th>
                      <th className="px-4 py-2 font-medium text-right">Cantidad</th>
                      <th className="px-4 py-2 font-medium text-right">Unidad</th>
                      <th className="px-4 py-2 font-medium text-right w-20"></th>
                    </tr>
                  </thead>
                    {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, "es")).map(([catName, items]) => (
                      <tbody key={catName}>
                        <tr className="bg-[#F5F0E8]/50">
                          <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold text-[#8B1A2B] uppercase tracking-wider">
                            {catName}
                          </td>
                        </tr>
                        {items.map((r) => (
                          <tr key={r.id} className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]">
                            <td className="px-4 py-2">
                              <Link href={`/ingredientes/${r.ingrediente_id}`} className="text-[#8B1A2B] hover:underline">
                                {r.ingrediente_nombre}
                              </Link>
                              {r.notas && <span className="text-[10px] text-[#6B5E52]/60 ml-2">({r.notas})</span>}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {editingRegistro === r.id ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={editCantidad}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(",", ".");
                                    if (v === "" || /^\d*\.?\d*$/.test(v)) setEditCantidad(v);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleEditRegistro(r.id);
                                    if (e.key === "Escape") { setEditingRegistro(null); setEditCantidad(""); }
                                  }}
                                  className="w-20 border border-[#8B1A2B] rounded px-2 py-0.5 text-sm text-right"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:text-[#8B1A2B]"
                                  onClick={() => { setEditingRegistro(r.id); setEditCantidad(String(r.cantidad)); }}
                                  title="Click para editar"
                                >
                                  {r.cantidad}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right text-[#6B5E52]">{r.unidad}</td>
                            <td className="px-4 py-2 text-right">
                              {editingRegistro === r.id ? (
                                <div className="flex gap-1 justify-end">
                                  <button
                                    onClick={() => handleEditRegistro(r.id)}
                                    className="text-xs text-green-600 hover:text-green-800"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => { setEditingRegistro(null); setEditCantidad(""); }}
                                    className="text-xs text-[#6B5E52] hover:text-[#8B1A2B]"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleDeleteRegistro(r.id)}
                                  className="text-xs text-red-400 hover:text-red-600"
                                  title="Eliminar"
                                >
                                  Eliminar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                </table>
              </div>
            );
          })()}

          {!showRecomendaciones && (
            <div className="sticky bottom-16 md:bottom-0 bg-[#F5F0E8] border-t border-[#E8DFD3] -mx-6 px-6 py-3 flex items-center justify-between">
              <div className="text-sm text-[#6B5E52]">
                {lastSaved && <span>Guardado a las {lastSaved}</span>}
              </div>
              <div className="flex items-center gap-2">
                {hasRecomendaciones && (
                  <button
                    onClick={() => {
                      setShowRecomendaciones(true);
                    }}
                    className="bg-white border border-[#8B1A2B] text-[#8B1A2B] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#F2E8EA] transition-colors"
                  >
                    Ver recomendaciones
                  </button>
                )}
                {filledCount > 0 && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#8B1A2B] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420] transition-colors disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : `Guardar inventario (${filledCount})`}
                  </button>
                )}
              </div>
            </div>
          )}

          {showRecomendaciones && recomendaciones.length > 0 && (
            <div className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recomendacion de Pedido</h2>
                <button
                  onClick={() => setShowRecomendaciones(false)}
                  className="text-sm text-[#6B5E52] hover:text-[#8B1A2B]"
                >
                  Volver a inventario
                </button>
              </div>
              <div className="flex gap-2 items-center">
                {(["cocina", "cafe", "bar"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVista(v)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      vista === v
                        ? "bg-[#8B1A2B] text-white"
                        : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
                    }`}
                  >
                    {v === "cocina" ? "Cocina" : v === "cafe" ? "Cafe" : "Bar"}
                  </button>
                ))}
              </div>

              {(() => {
                const childIdsWithParent = new Set(
                  ingredientes.filter((i) => i.grupo_ingrediente_id).map((i) => i.id)
                );
                const vistaRecs = recomendaciones
                  .filter((r) => matchesVista(r.ingrediente_id, r.ingrediente_nombre))
                  .filter((r) => !childIdsWithParent.has(r.ingrediente_id));
                const proveedores = Array.from(
                  new Set(vistaRecs.map((r) => r.proveedor))
                ).sort((a, b) => a.localeCompare(b, "es"));

                return proveedores.map((prov) => {
                  const items = vistaRecs.filter(
                    (r) => r.proveedor === prov
                  );
                  const hasPositive = items.some(
                    (i) => parseFloat(cantidadesPedido[i.ingrediente_id] || "0") > 0
                  );
                  return (
                    <div
                      key={prov}
                      className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3]">
                        <h3 className="font-semibold text-[#8B1A2B]">{prov}</h3>
                        {hasPositive && (
                          <button
                            onClick={() => handleCrearPedido(prov)}
                            disabled={creatingOrder}
                            className="bg-[#8B1A2B] text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-[#6B1420] transition-colors disabled:opacity-50"
                          >
                            Crear Pedido
                          </button>
                        )}
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                            <th className="px-4 py-2 font-medium">Ingrediente</th>
                            <th className="px-4 py-2 font-medium text-right">Stock</th>
                            <th className="px-4 py-2 font-medium text-right">
                              Stk Deseado
                            </th>
                            <th className="px-4 py-2 font-medium text-right">Pedir</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr
                              key={item.ingrediente_id}
                              className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]"
                            >
                              <td className="px-4 py-2">
                                <div>
                                  <Link
                                    href={`/ingredientes/${item.ingrediente_id}`}
                                    className="text-[#8B1A2B] hover:underline"
                                  >
                                    {item.ingrediente_nombre}
                                  </Link>
                                  {item.nota && (
                                    <span className="text-[10px] text-[#6B5E52]/60 ml-2">
                                      {item.nota}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                <span
                                  className={
                                    item.dias_stock !== null && item.dias_stock < 2
                                      ? "text-red-600 font-medium"
                                      : ""
                                  }
                                >
                                  {item.stock_actual} {item.unidad}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-[#6B5E52] whitespace-nowrap">
                                {item.par_level > 0
                                  ? `${item.par_level} ${item.unidad}`
                                  : "—"}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    cantidadesPedido[item.ingrediente_id] || ""
                                  }
                                  onChange={(e) => {
                                    const v = e.target.value.replace(",", ".");
                                    if (v === "" || /^\d*\.?\d*$/.test(v))
                                      setCantidadesPedido((prev) => ({
                                        ...prev,
                                        [item.ingrediente_id]: v,
                                      }));
                                  }}
                                  className={`w-20 border rounded px-2 py-1 text-sm text-right ${
                                    item.cantidad_sugerida === 0
                                      ? "border-green-300 bg-green-50"
                                      : "border-[#D4C4A8]"
                                  }`}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </>
      )}

      {tab === "historial" && (
        <div className="space-y-4">
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
            <button
              onClick={() => setVista("bar")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                vista === "bar"
                  ? "bg-[#8B1A2B] text-white"
                  : "bg-white border border-[#D4C4A8] text-[#6B5E52] hover:bg-[#F5F0E8]"
              }`}
            >
              Bar
            </button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={activeSemana}
              onChange={(e) => {
                if (e.target.value) setHistorialFecha(e.target.value);
              }}
              className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Selecciona una semana...</option>
              {semanas.map((s) => (
                <option key={s} value={s}>Semana {s}</option>
              ))}
            </select>
            {activeSemana && (
              <button
                onClick={() => setHistorialFecha("")}
                className="text-sm text-[#6B5E52] hover:text-[#8B1A2B]"
              >
                ← Ver pivot
              </button>
            )}
          </div>

          {activeSemana && loadingHistorial ? (
            <p className="text-[#6B5E52] text-center py-10">Cargando historial...</p>
          ) : activeSemana && historial ? (
            <div className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-[#F5F0E8] border-b border-[#E8DFD3]">
                <h3 className="font-semibold text-[#8B1A2B]">
                  Semana {activeSemana} ({historial.registros.length} registros)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                      <th className="px-4 py-2 font-medium">Ingrediente</th>
                      <th className="px-4 py-2 font-medium text-right">Cantidad</th>
                      <th className="px-4 py-2 font-medium text-right">Unidad</th>
                      <th className="px-4 py-2 font-medium text-right w-20"></th>
                    </tr>
                  </thead>
                  {(() => {
                    const filteredRegistros = historial.registros.filter((r) => matchesVista(r.ingrediente_id, r.ingrediente_nombre));
                    const byDate: Record<string, typeof historial.registros> = {};
                    for (const r of filteredRegistros) {
                      const d = String(r.fecha_registro);
                      if (!byDate[d]) byDate[d] = [];
                      byDate[d].push(r);
                    }
                    // Sort each date's items by category then alphabetically
                    const getCategory = (ingId: number) => {
                      const ing = ingredientes.find((i) => i.id === ingId);
                      if (!ing) return "";
                      const parent = ing.grupo_ingrediente_id ? ingredientes.find((i) => i.id === ing.grupo_ingrediente_id) : null;
                      if (parent) return parent.nombre;
                      const cat = categorias.find((c) => c.id === ing.categoria_id);
                      return cat?.nombre || "";
                    };
                    for (const d of Object.keys(byDate)) {
                      byDate[d].sort((a, b) => {
                        const catA = getCategory(a.ingrediente_id);
                        const catB = getCategory(b.ingrediente_id);
                        if (catA !== catB) return catA.localeCompare(catB, "es");
                        return a.ingrediente_nombre.localeCompare(b.ingrediente_nombre, "es");
                      });
                    }
                    const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
                    return sortedDates.map((d) => (
                      <tbody key={d}>
                        {sortedDates.length > 1 && (
                          <tr className="bg-[#F5F0E8]/50">
                            <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold text-[#8B1A2B] uppercase tracking-wider">
                              {d}
                            </td>
                          </tr>
                        )}
                        {byDate[d].flatMap((r, idx) => {
                          const cat = getCategory(r.ingrediente_id);
                          const prevCat = idx > 0 ? getCategory(byDate[d][idx - 1].ingrediente_id) : "";
                          const showHeader = cat !== prevCat && cat !== "";
                          const rows = [];
                          if (showHeader) {
                            rows.push(
                              <tr key={`hdr-${r.id}`} className="bg-[#F5F0E8]/70">
                                <td colSpan={4} className="px-4 py-1 text-xs font-medium text-[#6B5E52]/80 uppercase tracking-wider">
                                  {cat}
                                </td>
                              </tr>
                            );
                          }
                          rows.push(
                          <tr key={r.id} className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]">
                            <td className="px-4 py-2">
                              <Link href={`/ingredientes/${r.ingrediente_id}`} className="text-[#8B1A2B] hover:underline">
                                {r.ingrediente_nombre}
                              </Link>
                            </td>
                            <td className="px-4 py-2 text-right">
                              {editingRegistro === r.id ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={editCantidad}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(",", ".");
                                    if (v === "" || /^\d*\.?\d*$/.test(v)) setEditCantidad(v);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleEditRegistro(r.id);
                                    if (e.key === "Escape") { setEditingRegistro(null); setEditCantidad(""); }
                                  }}
                                  className="w-20 border border-[#8B1A2B] rounded px-2 py-0.5 text-sm text-right"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:text-[#8B1A2B]"
                                  onClick={() => { setEditingRegistro(r.id); setEditCantidad(String(r.cantidad)); }}
                                  title="Click para editar"
                                >
                                  {r.cantidad}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right text-[#6B5E52]">{r.unidad}</td>
                            <td className="px-4 py-2 text-right">
                              {editingRegistro === r.id ? (
                                <div className="flex gap-1 justify-end">
                                  <button onClick={() => handleEditRegistro(r.id)} className="text-xs text-green-600 hover:text-green-800">OK</button>
                                  <button onClick={() => { setEditingRegistro(null); setEditCantidad(""); }} className="text-xs text-[#6B5E52]">No</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleDeleteRegistro(r.id)}
                                  className="text-xs text-red-400 hover:text-red-600"
                                >
                                  Eliminar
                                </button>
                              )}
                            </td>
                          </tr>
                          );
                          return rows;
                        })}
                      </tbody>
                    ));
                  })()}
                </table>
              </div>
            </div>
          ) : !activeSemana ? (
            !pivot || pivot.ingredientes.length === 0 ? (
              <p className="text-[#6B5E52] text-center py-10">
                No hay registros de inventario todavia.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                      <th className="pb-2 pr-4 font-medium sticky left-0 bg-[#F5F0E8] z-10 min-w-[260px]">Ingrediente</th>
                      <th className="pb-2 px-2 font-medium whitespace-nowrap">Ud</th>
                      {pivot.fechas.map((f) => (
                        <th key={f} className="pb-2 px-2 font-medium text-center whitespace-nowrap">
                          {f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {(() => {
                    const filtered = pivot.ingredientes.filter((ing) => matchesVista(ing.ingrediente_id, ing.ingrediente_nombre));
                    const getGroup = (ingId: number, ingName: string): { name: string; orden: number } => {
                      if (ingName.toLowerCase().includes("sibarist")) return { name: "Sibarist", orden: 999 };
                      const fullIng = ingredientes.find((i) => i.id === ingId);
                      if (fullIng) {
                        const cat = categorias.find((c) => c.id === fullIng.categoria_id);
                        if (cat) return { name: cat.nombre, orden: cat.orden ?? 0 };
                      }
                      return { name: "Otros", orden: 9999 };
                    };
                    const grouped: Record<string, { orden: number; items: typeof filtered }> = {};
                    for (const ing of filtered) {
                      const g = getGroup(ing.ingrediente_id, ing.ingrediente_nombre);
                      if (!grouped[g.name]) grouped[g.name] = { orden: g.orden, items: [] };
                      grouped[g.name].items.push(ing);
                    }
                    const COLOR_ORDER: Record<number, number> = { 73: 0, 277: 1, 326: 0, 325: 1, 327: 3, 328: 2 };
                    const COLOR_NAMES: Record<number, string> = { 73: "MARRÓN", 277: "ROJO", 326: "MARRÓN", 325: "ROJO", 327: "BLACK", 328: "GOLD" };
                    const coffeeSubOrder = (name: string): number => {
                      const n = name.toLowerCase();
                      if (n.includes("1kg") || n.includes("1 kg")) return 10;
                      if (n.includes("café en grano")) return 15;
                      if (n.includes("200g") || n.includes("200 g")) return 30;
                      if (n.includes("130g") || n.includes("130 g")) return 40;
                      if (n.includes("coffee retail")) return 45;
                      if (n.includes("tubos frozen")) return 50;
                      if (n.startsWith("frozen") || n.includes("frozen")) return 60;
                      if (n.includes("cápsula") || n.includes("capsula")) return 70;
                      return 80;
                    };
                    const coffeeColorOrder = (ingId: number): number => {
                      const fullIng = ingredientes.find((i) => i.id === ingId);
                      if (fullIng && fullIng.grupo_ingrediente_id) {
                        return COLOR_ORDER[fullIng.grupo_ingrediente_id] ?? 5;
                      }
                      return 5;
                    };
                    const coffeeColorName = (ingId: number): string => {
                      const fullIng = ingredientes.find((i) => i.id === ingId);
                      if (fullIng && fullIng.grupo_ingrediente_id) {
                        return COLOR_NAMES[fullIng.grupo_ingrediente_id] ?? "";
                      }
                      return "";
                    };
                    const isCoffeeTotalRow = (name: string): boolean => {
                      const n = name.toLowerCase();
                      return n.includes("café en grano") || n.includes("coffee retail");
                    };
                    const sortItems = (items: typeof filtered, group: string) => {
                      const isCafe = vista === "cafe" && (group === "Café" || group.toLowerCase().includes("café"));
                      return [...items].sort((a, b) => {
                        if (isCafe) {
                          const subDiff = coffeeSubOrder(a.ingrediente_nombre) - coffeeSubOrder(b.ingrediente_nombre);
                          if (subDiff !== 0) return subDiff;
                          const colorDiff = coffeeColorOrder(a.ingrediente_id) - coffeeColorOrder(b.ingrediente_id);
                          if (colorDiff !== 0) return colorDiff;
                        }
                        return a.ingrediente_nombre.localeCompare(b.ingrediente_nombre, "es");
                      });
                    };
                    const sortedEntries = Object.entries(grouped)
                      .sort(([, a], [, b]) => a.orden - b.orden)
                      .map(([name, val]) => [name, sortItems(val.items, name)] as [string, typeof filtered]);
                    const coffeeSubLabel = (name: string, ingId: number): string => {
                      const n = name.toLowerCase();
                      const color = coffeeColorName(ingId);
                      if (n.includes("café en grano")) return n.includes("marrón") ? "= Total MARRÓN" : "= Total ROJO";
                      if (n.includes("1kg") || n.includes("1 kg")) return color ? `1kg · ${color}` : "1kg";
                      if (n.includes("coffee retail")) return "= Total Retail";
                      if (n.includes("200g") || n.includes("200 g")) return color ? `200g · ${color}` : "200g";
                      if (n.includes("130g") || n.includes("130 g")) return "130g · GOLD";
                      if (n.includes("tubos frozen")) return "Tubos Frozen";
                      if (n.startsWith("frozen") || n.includes("frozen")) return "Frozen";
                      if (n.includes("cápsula") || n.includes("capsula")) return "Cápsulas";
                      return "";
                    };
                    return sortedEntries.map(([group, items]) => {
                      const isCafeGroup = vista === "cafe" && (group === "Café" || group.toLowerCase().includes("café"));
                      let lastSubLabel = "";
                      return (
                      <tbody key={group}>
                        {Object.keys(grouped).length > 1 && (
                          <tr className="bg-[#F5F0E8] border-t-2 border-[#D4C4A8]">
                            <td colSpan={pivot.fechas.length + 2} className="pt-3 pb-1.5 pr-4 sticky left-0 bg-[#F5F0E8] z-10 text-xs font-semibold text-[#8B1A2B] uppercase tracking-wider">
                              {group}
                            </td>
                          </tr>
                        )}
                        {items.map((ing) => {
                          const subLabel = isCafeGroup ? coffeeSubLabel(ing.ingrediente_nombre, ing.ingrediente_id) : "";
                          const showSub = isCafeGroup && subLabel && subLabel !== lastSubLabel && !subLabel.startsWith("=");
                          if (subLabel) lastSubLabel = subLabel;
                          const isTotal = isCafeGroup && isCoffeeTotalRow(ing.ingrediente_nombre);
                          return (
                          <React.Fragment key={ing.ingrediente_id}>
                            {showSub && (
                              <tr className="border-t border-[#D4C4A8]">
                                <td colSpan={pivot.fechas.length + 2} className="pt-2 pb-1 pr-4 sticky left-0 bg-[#F5F0E8] z-10 text-[10px] font-semibold text-[#6B5E52] uppercase tracking-widest">
                                  {subLabel}
                                </td>
                              </tr>
                            )}
                            <tr className={isTotal
                              ? "border-t border-[#D4C4A8] bg-[#F0EBE3]"
                              : "border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]"
                            }>
                              <td className={`py-1.5 pr-4 sticky left-0 z-10 ${isTotal ? "bg-[#F0EBE3] font-bold text-[#3D2E22]" : "bg-[#F5F0E8] font-medium"}`}>
                                <Link href={`/ingredientes/${ing.ingrediente_id}`} className={isTotal ? "text-[#3D2E22] hover:underline" : "text-[#8B1A2B] hover:underline"}>
                                  {isTotal ? `= ${ing.ingrediente_nombre}` : ing.ingrediente_nombre}
                                </Link>
                              </td>
                              <td className={`py-1.5 px-2 whitespace-nowrap ${isTotal ? "text-[#3D2E22] font-bold" : "text-[#6B5E52]"}`}>{ing.unidad}</td>
                              {pivot.fechas.map((f) => (
                                <td key={f} className={`py-1.5 px-2 text-center ${isTotal ? "font-bold text-[#3D2E22]" : ""}`}>
                                  {ing.fechas[f] !== undefined ? ing.fechas[f] : ""}
                                </td>
                              ))}
                            </tr>
                          </React.Fragment>
                          );
                        })}
                      </tbody>
                      );
                    })
                  })()}
                </table>
              </div>
            )
          ) : null}
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
                    {(consumoDetalle as Record<string, unknown>).cycle_weeks != null && (
                      <> — Ciclo pedido: {(consumoDetalle as Record<string, unknown>).cycle_weeks === 1 ? "semanal" : `${(consumoDetalle as Record<string, unknown>).cycle_weeks} sem`}</>
                    )}
                    {(consumoDetalle as Record<string, unknown>).lead_weeks != null && (
                      <> — Lead time: {Math.round(((consumoDetalle as Record<string, unknown>).lead_weeks as number) * 7)}d</>
                    )}
                    {consumoDetalle.reorder_point != null && (
                      <> — Seguridad: {consumoDetalle.reorder_point} {consumoDetalle.unidad}</>
                    )}
                    {consumoDetalle.eoq != null && (
                      <> — Deseado: {consumoDetalle.eoq} {consumoDetalle.unidad}</>
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
                    const PAD_R = 100;
                    const PAD_T = 12;
                    const PAD_B = 36;
                    const plotW = W - PAD_L - PAD_R;
                    const plotH = H - PAD_T - PAD_B;
                    const maxVal = Math.max(...data.map((d) => d.cantidad), rop ?? 0, eoq ?? 0);
                    const minVal = 0;
                    const range = maxVal - minVal || 1;
                    const timestamps = data.map((d) => new Date(d.fecha).getTime());
                    const tMin = Math.min(...timestamps);
                    const tMax = Math.max(...timestamps);
                    const tRange = tMax - tMin || 1;
                    const xOf = (i: number) => PAD_L + ((timestamps[i] - tMin) / tRange) * plotW;
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
                              <text x={W - PAD_R + 6} y={yOf(rop) + 4} textAnchor="start"
                                fontSize="11" fill="#dc2626" fontWeight="600">Seguridad: {rop}</text>
                            </>
                          )}
                          {/* Par level line */}
                          {eoq != null && (
                            <>
                              <line x1={PAD_L} y1={yOf(eoq)} x2={W - PAD_R} y2={yOf(eoq)}
                                stroke="#2563eb" strokeWidth="1" strokeDasharray="6,4" />
                              <text x={W - PAD_R + 6} y={yOf(eoq) + 4} textAnchor="start"
                                fontSize="11" fill="#2563eb" fontWeight="600">Deseado: {eoq}</text>
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
              {ingredientes
                .filter((ing) => idsConRegistros.includes(ing.id))
                .map((ing) => (
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
      {/* Modal: Gestionar Cafes */}
      {showGestionarCafes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#F5F0E8] rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8DFD3]">
              <h2 className="text-lg font-semibold text-[#8B1A2B]">Gestionar Cafes</h2>
              <button
                onClick={() => setShowGestionarCafes(false)}
                className="text-[#6B5E52] hover:text-[#8B1A2B] text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {Array.from(parentIds)
                .map((pid) => ingredientes.find((i) => i.id === pid))
                .filter(Boolean)
                .sort((a, b) => a!.nombre.localeCompare(b!.nombre, "es"))
                .map((parent) => {
                  const allChildren = ingredientes.filter(
                    (i) => i.grupo_ingrediente_id === parent!.id
                  );
                  return (
                    <div key={parent!.id}>
                      <h3 className="text-sm font-semibold text-[#8B1A2B] uppercase tracking-wider mb-2">
                        {parent!.nombre}
                      </h3>
                      <div className="space-y-1.5">
                        {allChildren.map((child) => (
                          <div
                            key={child.id}
                            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
                              child.activo !== false
                                ? "bg-white border-[#E8DFD3]"
                                : "bg-[#E8DFD3]/50 border-[#D4C4A8]/50"
                            }`}
                          >
                            <span
                              className={`text-sm ${
                                child.activo !== false ? "text-[#2D2319]" : "text-[#6B5E52]/60 line-through"
                              }`}
                            >
                              {child.nombre}
                            </span>
                            <button
                              disabled={savingCoffeeToggle === child.id}
                              onClick={async () => {
                                setSavingCoffeeToggle(child.id);
                                try {
                                  await apiFetch(`/api/ingredientes/${child.id}/activo`, {
                                    method: "PUT",
                                  });
                                  // Refresh ingredientes
                                  const ings = await apiFetch<Ingrediente[]>("/api/ingredientes");
                                  setIngredientes(ings);
                                  toast(
                                    child.activo !== false ? "Cafe desactivado" : "Cafe activado",
                                    "success"
                                  );
                                } catch (err) {
                                  toast("Error: " + (err as Error).message, "error");
                                } finally {
                                  setSavingCoffeeToggle(null);
                                }
                              }}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                child.activo !== false ? "bg-[#8B1A2B]" : "bg-[#D4C4A8]"
                              } ${savingCoffeeToggle === child.id ? "opacity-50" : ""}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  child.activo !== false ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

              {/* Add new coffee */}
              <div className="border-t border-[#E8DFD3] pt-4">
                <h3 className="text-sm font-semibold text-[#6B5E52] mb-2">Agregar nuevo cafe</h3>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del cafe..."
                    value={newCoffeeName}
                    onChange={(e) => setNewCoffeeName(e.target.value)}
                    className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={newCoffeeParent ?? ""}
                    onChange={(e) => setNewCoffeeParent(e.target.value ? Number(e.target.value) : null)}
                    className="border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecciona grupo padre...</option>
                    {Array.from(parentIds)
                      .map((pid) => ingredientes.find((i) => i.id === pid))
                      .filter(Boolean)
                      .sort((a, b) => a!.nombre.localeCompare(b!.nombre, "es"))
                      .map((p) => (
                        <option key={p!.id} value={p!.id}>
                          {p!.nombre}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={async () => {
                      if (!newCoffeeName.trim() || !newCoffeeParent) {
                        toast("Introduce nombre y selecciona grupo padre", "error");
                        return;
                      }
                      const parent = ingredientes.find((i) => i.id === newCoffeeParent);
                      if (!parent) return;
                      try {
                        await apiFetch("/api/ingredientes", {
                          method: "POST",
                          body: JSON.stringify({
                            nombre: newCoffeeName.trim(),
                            categoria_id: parent.categoria_id,
                            unidad_compra: parent.unidad_compra,
                            cantidad_compra: parent.cantidad_compra,
                            precio_compra: 0,
                            unidad_uso: parent.unidad_uso,
                            merma_porcentaje: parent.merma_porcentaje,
                            grupo_ingrediente_id: newCoffeeParent,
                          }),
                        });
                        const ings = await apiFetch<Ingrediente[]>("/api/ingredientes");
                        setIngredientes(ings);
                        setNewCoffeeName("");
                        setNewCoffeeParent(null);
                        toast("Cafe agregado", "success");
                      } catch (err) {
                        toast("Error: " + (err as Error).message, "error");
                      }
                    }}
                    disabled={!newCoffeeName.trim() || !newCoffeeParent}
                    className="bg-[#8B1A2B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420] transition-colors disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
