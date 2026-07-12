"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Ingrediente, HistorialPrecio, Receta } from "@/lib/types";
import Link from "next/link";

interface PrecioProveedor {
  proveedor: string;
  precio: number;
  cantidad: number;
  unidad: string;
  precio_por_unidad: number;
}

interface ComparacionProveedores {
  ingrediente: { id: number; nombre: string; precio_actual: number };
  precios: PrecioProveedor[];
}

export default function IngredienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [ingrediente, setIngrediente] = useState<Ingrediente | null>(null);
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [preciosProveedores, setPreciosProveedores] = useState<PrecioProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<Ingrediente>(`/api/ingredientes/${id}`),
      apiFetch<HistorialPrecio[]>(`/api/ingredientes/${id}/historial`),
      apiFetch<Receta[]>(`/api/ingredientes/${id}/recetas`),
      apiFetch<ComparacionProveedores>(`/api/proveedores/comparar/${id}`).catch(() => ({ ingrediente: { id: 0, nombre: "", precio_actual: 0 }, precios: [] })),
    ])
      .then(([ing, hist, rec, comp]) => {
        setIngrediente(ing);
        setHistorial(hist);
        setRecetas(rec);
        setPreciosProveedores(comp.precios);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este ingrediente?")) return;
    try {
      await apiFetch(`/api/ingredientes/${id}`, { method: "DELETE" });
      router.push("/ingredientes");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return "—";
    try {
      return new Date(fecha).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return fecha;
    }
  };

  if (loading) return <p className="text-[#6B5E52] py-10 text-center">Cargando...</p>;
  if (notFound || !ingrediente) return <p className="text-red-500 py-10 text-center">Ingrediente no encontrado</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/ingredientes" className="text-sm text-[#8B1A2B] hover:underline">
            &larr; Ingredientes
          </Link>
          <h1 className="text-2xl font-bold mt-1">{ingrediente.nombre}</h1>
        </div>
        <button
          onClick={handleDelete}
          className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200"
        >
          Eliminar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Precio compra</p>
          <p className="text-xl font-bold">
            {ingrediente.precio_compra.toFixed(2)} CHF/{ingrediente.unidad_compra}
          </p>
        </div>
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Coste/unidad uso</p>
          <p className="text-xl font-bold">
            {ingrediente.coste_por_unidad_uso.toFixed(4)} CHF/{ingrediente.unidad_uso}
          </p>
        </div>
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Merma</p>
          <p className="text-xl font-bold">{ingrediente.merma_porcentaje}%</p>
        </div>
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Recetas</p>
          <p className="text-xl font-bold">{ingrediente.num_recetas}</p>
        </div>
      </div>

      {/* Info Row */}
      <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-[#6B5E52]">
          <span>
            Categoria: <strong className="text-[#1A1A1A]">{ingrediente.categoria_nombre}</strong>
          </span>
          <span>
            Proveedor: <strong className="text-[#1A1A1A]">{ingrediente.proveedor || "—"}</strong>
          </span>
          <span>
            Unidad compra → uso:{" "}
            <strong className="text-[#1A1A1A]">
              {ingrediente.unidad_compra} → {ingrediente.unidad_uso}
            </strong>
          </span>
          <span>
            Ultima actualizacion:{" "}
            <strong className="text-[#1A1A1A]">{formatFecha(ingrediente.fecha_actualizacion)}</strong>
          </span>
        </div>
      </div>

      {/* Precios por Proveedor */}
      <div className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden">
        <h2 className="text-lg font-semibold px-4 pt-4 pb-2">Precios por Proveedor</h2>
        {preciosProveedores.length === 0 ? (
          <p className="text-sm text-[#6B5E52]/70 px-4 pb-4">Sin precios de proveedores registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F0E8] text-left text-[#6B5E52] border-b border-[#E8DFD3]">
                <th className="px-4 py-2 font-medium">Proveedor</th>
                <th className="px-4 py-2 font-medium text-right">Precio</th>
                <th className="px-4 py-2 font-medium text-right">Unidad</th>
                <th className="px-4 py-2 font-medium text-right">CHF/unidad</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const minPrecio = Math.min(...preciosProveedores.map((p) => p.precio_por_unidad));
                return preciosProveedores.map((p) => {
                  const isCheapest = preciosProveedores.length > 1 && p.precio_por_unidad === minPrecio;
                  return (
                    <tr key={p.proveedor} className="border-b border-[#E8DFD3]/50">
                      <td className={`px-4 py-2 ${isCheapest ? "text-green-600 font-medium" : ""}`}>
                        {p.proveedor}
                      </td>
                      <td className={`px-4 py-2 text-right ${isCheapest ? "text-green-600 font-medium" : ""}`}>
                        {p.precio.toFixed(2)} CHF
                      </td>
                      <td className={`px-4 py-2 text-right ${isCheapest ? "text-green-600 font-medium" : "text-[#6B5E52]"}`}>
                        {p.cantidad} {p.unidad}
                      </td>
                      <td className={`px-4 py-2 text-right ${isCheapest ? "text-green-600 font-medium" : ""}`}>
                        {p.precio_por_unidad.toFixed(2)}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        )}
      </div>

      {/* Historial de Precios */}
      <div className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden">
        <h2 className="text-lg font-semibold px-4 pt-4 pb-2">Historial de Precios</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-[#6B5E52]/70 px-4 pb-4">Sin cambios de precio registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F0E8] text-left text-[#6B5E52] border-b border-[#E8DFD3]">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium text-right">Precio Anterior</th>
                <th className="px-4 py-2 font-medium text-right">Precio Nuevo</th>
                <th className="px-4 py-2 font-medium text-right">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h) => {
                const cambio =
                  h.precio_anterior > 0
                    ? ((h.precio_nuevo - h.precio_anterior) / h.precio_anterior) * 100
                    : 0;
                const isIncrease = cambio > 0;
                const isDecrease = cambio < 0;
                return (
                  <tr key={h.id} className="border-b border-[#E8DFD3]/50">
                    <td className="px-4 py-2">{formatFecha(h.fecha_cambio)}</td>
                    <td className="px-4 py-2 text-right">{h.precio_anterior.toFixed(2)} CHF</td>
                    <td className="px-4 py-2 text-right">{h.precio_nuevo.toFixed(2)} CHF</td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={
                          isIncrease
                            ? "text-red-600"
                            : isDecrease
                              ? "text-green-600"
                              : "text-[#6B5E52]"
                        }
                      >
                        {cambio > 0 ? "+" : ""}
                        {cambio.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recetas que lo usan */}
      <div className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden">
        <h2 className="text-lg font-semibold px-4 pt-4 pb-2">Recetas que lo usan</h2>
        {recetas.length === 0 ? (
          <p className="text-sm text-[#6B5E52]/70 px-4 pb-4">
            Este ingrediente no se usa en ninguna receta
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F0E8] text-left text-[#6B5E52] border-b border-[#E8DFD3]">
                <th className="px-4 py-2 font-medium">Receta</th>
                <th className="px-4 py-2 font-medium">Categoria</th>
                <th className="px-4 py-2 font-medium text-right">Margen</th>
              </tr>
            </thead>
            <tbody>
              {recetas.map((r) => (
                <tr key={r.id} className="border-b border-[#E8DFD3]/50">
                  <td className="px-4 py-2">
                    <Link href={`/recetas/${r.id}`} className="text-[#8B1A2B] hover:underline">
                      {r.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-[#6B5E52]">{r.categoria_nombre}</td>
                  <td className="px-4 py-2 text-right">
                    {r.margen_real != null ? `${r.margen_real.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
