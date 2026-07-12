"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { MENU, getMultiColor } from "@/lib/menu-data";
import type { Receta } from "@/lib/types";
import Link from "next/link";

export default function Dashboard() {
  const [recipeMap, setRecipeMap] = useState<Record<string, { coste: number; id: number }>>({});
  const [ingredientMap, setIngredientMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Receta[]>("/api/recetas"),
      apiFetch<any[]>("/api/ingredientes"),
    ])
      .then(([recetas, ingredientes]) => {
        const rMap: Record<string, { coste: number; id: number }> = {};
        for (const r of recetas) {
          rMap[r.nombre] = { coste: r.coste_por_porcion, id: r.id };
        }
        setRecipeMap(rMap);
        const iMap: Record<string, number> = {};
        for (const i of ingredientes) {
          iMap[i.nombre] = i.precio_compra;
        }
        setIngredientMap(iMap);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-[#6B5E52] py-10 text-center">Cargando...</p>;
  }

  // Compute summary stats
  let totalItems = 0;
  let withCost = 0;
  let lowMulti = 0;
  const alerts: { name: string; multi: number; section: string }[] = [];

  for (const section of MENU) {
    for (const item of section.items) {
      totalItems++;
      const recipeName = item.recipeName || item.recipeNameIced;
      const pvp = item.pvp || item.pvpIced;
      const coste = recipeName ? recipeMap[recipeName]?.coste : (item.ingredientName ? ingredientMap[item.ingredientName] : undefined);
      if (coste !== undefined) {
        withCost++;
        if (pvp && coste > 0) {
          const m = pvp / coste;
          if (m < 5) {
            lowMulti++;
            alerts.push({ name: item.name, multi: m, section: section.title });
          }
        }
      }
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Panel Principal</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Items en menú</p>
          <p className="text-2xl font-bold">{totalItems}</p>
        </div>
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Con escandallo</p>
          <p className="text-2xl font-bold">{withCost}</p>
        </div>
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Sin escandallo</p>
          <p className="text-2xl font-bold text-[#6B5E52]/70">{totalItems - withCost}</p>
        </div>
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4">
          <p className="text-xs text-[#6B5E52]">Multi &lt; x5</p>
          <p className={`text-2xl font-bold ${lowMulti > 0 ? "text-red-600" : "text-green-600"}`}>
            {lowMulti}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Multiplicador bajo (&lt; x5)</h2>
          <div className="space-y-2">
            {alerts
              .sort((a, b) => a.multi - b.multi)
              .map((a, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 text-sm border ${
                    a.multi < 3
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-yellow-50 border-yellow-200 text-yellow-700"
                  }`}
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="text-xs ml-2">({a.section})</span>
                  <span className="float-right font-mono">x{a.multi.toFixed(1)}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Menu summary by section */}
      {MENU.map((section) => {
        const sectionItems = section.items
          .map((item) => {
            const recipeName = item.recipeName || item.recipeNameIced;
            const recipe = recipeName ? recipeMap[recipeName] : undefined;
            const ingCoste = item.ingredientName ? ingredientMap[item.ingredientName] : undefined;
            const coste = recipe?.coste ?? ingCoste;
            const recipeId = recipe?.id;
            const pvp = item.pvp || item.pvpIced;
            const margen =
              coste !== undefined && pvp
                ? ((pvp - coste) / pvp) * 100
                : null;
            const multi = coste && pvp && coste > 0 ? pvp / coste : null;
            return { ...item, coste, recipeId, margen, multi };
          })
          .filter((item) => item.coste !== undefined || item.pvp || item.pvpIced);

        if (sectionItems.length === 0) return null;

        return (
          <section key={section.title}>
            <h2 className="text-sm font-bold text-[#6B5E52] uppercase tracking-wide mb-2">
              {section.title}
            </h2>
            <div className="bg-white border border-[#E8DFD3] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F0E8] text-left text-[#6B5E52]/70 border-b border-[#E8DFD3] text-xs">
                    <th className="px-3 py-1.5 font-medium">Item</th>
                    <th className="px-3 py-1.5 font-medium text-right">Coste</th>
                    <th className="px-3 py-1.5 font-medium text-right">PVP</th>
                    <th className="px-3 py-1.5 font-medium text-right">Margen</th>
                    <th className="px-3 py-1.5 font-medium text-right">x</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionItems.map((item, i) => {
                    const multiColor = item.multi !== null ? getMultiColor(item.multi, section.title) : "text-[#6B5E52]/50";
                    return (
                      <tr key={i} className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]">
                        <td className="px-3 py-1">
                          {item.recipeId ? (
                            <Link href={`/recetas/${item.recipeId}`} className="text-[#8B1A2B] hover:underline">
                              {item.name}
                            </Link>
                          ) : item.name}
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-xs">
                          {item.coste !== undefined ? item.coste.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-1 text-right">
                          {item.pvp ? item.pvp.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-xs">
                          {item.coste !== undefined && item.pvp ? (item.pvp - item.coste).toFixed(2) : "—"}
                        </td>
                        <td className={`px-3 py-1 text-right font-mono ${multiColor}`}>
                          {item.multi !== null ? `x${item.multi.toFixed(1)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
