"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { MENU, getMultiColor } from "@/lib/menu-data";
import type { Receta } from "@/lib/types";
import Link from "next/link";

export default function MenuPage() {
  const [recipeMap, setRecipeMap] = useState<Record<string, { coste: number; id: number; pvp: number | null }>>({});
  const [ingredientMap, setIngredientMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Receta[]>("/api/recetas"),
      apiFetch<any[]>("/api/ingredientes"),
    ])
      .then(([recetas, ingredientes]) => {
        const rMap: Record<string, { coste: number; id: number; pvp: number | null }> = {};
        for (const r of recetas) {
          rMap[r.nombre] = { coste: r.coste_por_porcion, id: r.id, pvp: r.precio_venta };
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
    return <p className="text-[#6B5E52] py-10 text-center">Cargando menú...</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Menú BRÜ</h1>

      {MENU.map((section) => {
        const isWine = section.title === "WINE";
        const isDual = section.title === "COFFEE" || section.title === "NOT COFFEE";
        const hasDualColumns = isWine || isDual;

        const dualLabels = isWine
          ? { a: "Copa", b: "Botella", pvpA: "PVP Copa", pvpB: "PVP Bot.", xA: "x Copa", xB: "x Bot." }
          : { a: "Normal", b: "Iced", pvpA: "PVP", pvpB: "PVP Iced", xA: "x", xB: "x Iced" };

        return (
        <section key={section.title}>
          <h2 className="text-lg font-bold bg-[#8B1A2B] text-white px-4 py-2 rounded-t-lg">
            {section.title}
          </h2>
          <div className="bg-white border border-[#E8DFD3] rounded-b-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5F0E8] text-left text-[#6B5E52] border-b border-[#E8DFD3]">
                  <th className="px-4 py-2 font-medium">Item</th>
                  {hasDualColumns ? (
                    <>
                      <th className="px-4 py-2 font-medium text-right w-20">{dualLabels.a}</th>
                      <th className="px-4 py-2 font-medium text-right w-20">{dualLabels.b}</th>
                      <th className="px-4 py-2 font-medium text-right w-20">{dualLabels.pvpA}</th>
                      <th className="px-4 py-2 font-medium text-right w-20">{dualLabels.pvpB}</th>
                      <th className="px-4 py-2 font-medium text-right w-20">{dualLabels.xA}</th>
                      <th className="px-4 py-2 font-medium text-right w-20">{dualLabels.xB}</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-2 font-medium text-right w-20">Coste</th>
                      <th className="px-4 py-2 font-medium text-right w-20">PVP</th>
                      <th className="px-4 py-2 font-medium text-right w-20">x</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, i) => {
                  const recipe = item.recipeName ? recipeMap[item.recipeName] : undefined;
                  const ingCoste = item.ingredientName ? ingredientMap[item.ingredientName] : undefined;
                  const coste = recipe?.coste ?? ingCoste;
                  const recipeId = recipe?.id;
                  const pvp = recipe?.pvp ?? item.pvp;
                  const multi = coste !== undefined && pvp && coste > 0 ? pvp / coste : null;

                  const multiColor = (m: number | null) => getMultiColor(m, section.title);

                  if (hasDualColumns) {
                    const secondRecipeName = isWine ? item.recipeNameBottle : item.recipeNameIced;
                    const secondPvpHardcoded = isWine ? item.pvpBottle : item.pvpIced;
                    const secondRecipe = secondRecipeName ? recipeMap[secondRecipeName] : undefined;
                    const secondPvp = secondRecipe?.pvp ?? secondPvpHardcoded;
                    const costeSecond = secondRecipe?.coste;
                    const multiSecond = costeSecond !== undefined && secondPvp && costeSecond > 0 ? secondPvp / costeSecond : null;

                    return (
                      <tr key={i} className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]">
                        <td className="px-4 py-1.5">
                          {recipeId ? (
                            <Link href={`/recetas/${recipeId}`} className="text-[#8B1A2B] hover:underline">{item.name}</Link>
                          ) : secondRecipe?.id ? (
                            <Link href={`/recetas/${secondRecipe.id}`} className="text-[#8B1A2B] hover:underline">{item.name}</Link>
                          ) : item.name}
                          {!isWine && recipeId && secondRecipe?.id && (
                            <>
                              <span className="text-[#6B5E52]/50"> / </span>
                              <Link href={`/recetas/${secondRecipe.id}`} className="text-[#8B1A2B] hover:underline">{secondRecipeName}</Link>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-right text-sm">{coste !== undefined ? coste.toFixed(2) : "—"}</td>
                        <td className="px-4 py-1.5 text-right text-sm">{costeSecond !== undefined ? costeSecond.toFixed(2) : "—"}</td>
                        <td className="px-4 py-1.5 text-right text-sm">{pvp ? pvp.toFixed(1) : "—"}</td>
                        <td className="px-4 py-1.5 text-right text-sm">{secondPvp ? secondPvp.toFixed(1) : "—"}</td>
                        <td className={`px-4 py-1.5 text-right text-sm ${multiColor(multi)}`}>{multi !== null ? `x${multi.toFixed(1)}` : "—"}</td>
                        <td className={`px-4 py-1.5 text-right text-sm ${multiColor(multiSecond)}`}>{multiSecond !== null ? `x${multiSecond.toFixed(1)}` : "—"}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={i}
                      className="border-b border-[#E8DFD3]/50 hover:bg-[#F5F0E8]"
                    >
                      <td className="px-4 py-1.5">
                        {recipeId ? (
                          <Link href={`/recetas/${recipeId}`} className="text-[#8B1A2B] hover:underline">
                            {item.name}
                          </Link>
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-right text-sm">
                        {coste !== undefined ? coste.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-1.5 text-right text-sm">
                        {pvp ? pvp.toFixed(2) : "—"}
                      </td>
                      <td className={`px-4 py-1.5 text-right text-sm ${multiColor(multi)}`}>
                        {multi !== null ? `x${multi.toFixed(1)}` : "—"}
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
