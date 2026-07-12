"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { MENU, getMultiColor } from "@/lib/menu-data";
import type { Receta } from "@/lib/types";
import Link from "next/link";

export default function MenuPage() {
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
    return <p className="text-slate-500 py-10 text-center">Cargando menú...</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Menú BRÜ</h1>

      {MENU.map((section) => {
        const isWine = section.title === "WINE";

        return (
        <section key={section.title}>
          <h2 className="text-lg font-bold bg-slate-800 text-white px-4 py-2 rounded-t-lg">
            {section.title}
          </h2>
          <div className="bg-white border border-slate-200 rounded-b-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2 font-medium">Item</th>
                  {isWine ? (
                    <>
                      <th className="px-4 py-2 font-medium text-right w-16">Copa</th>
                      <th className="px-4 py-2 font-medium text-right w-16">Botella</th>
                      <th className="px-4 py-2 font-medium text-right w-16">PVP Copa</th>
                      <th className="px-4 py-2 font-medium text-right w-16">PVP Bot.</th>
                      <th className="px-4 py-2 font-medium text-right w-14">x Copa</th>
                      <th className="px-4 py-2 font-medium text-right w-14">x Bot.</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-2 font-medium text-right w-24">Coste</th>
                      <th className="px-4 py-2 font-medium text-right w-24">PVP</th>
                      <th className="px-4 py-2 font-medium text-right w-24">Margen</th>
                      <th className="px-4 py-2 font-medium text-right w-16">x</th>
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
                  const pvp = item.pvp;
                  const multi = coste !== undefined && pvp && coste > 0 ? pvp / coste : null;

                  const multiColor = (m: number | null) => getMultiColor(m, section.title);

                  if (isWine) {
                    const bottleRecipe = item.recipeNameBottle ? recipeMap[item.recipeNameBottle] : undefined;
                    const costeBottle = bottleRecipe?.coste;
                    const pvpBottle = item.pvpBottle;
                    const multiBottle = costeBottle !== undefined && pvpBottle && costeBottle > 0 ? pvpBottle / costeBottle : null;

                    return (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-1.5">
                          {recipeId ? (
                            <Link href={`/recetas/${recipeId}`} className="text-blue-600 hover:underline">{item.name}</Link>
                          ) : item.name}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-xs">{coste !== undefined ? coste.toFixed(2) : "—"}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-xs">{costeBottle !== undefined ? costeBottle.toFixed(2) : "—"}</td>
                        <td className="px-4 py-1.5 text-right">{pvp ? pvp.toFixed(1) : "—"}</td>
                        <td className="px-4 py-1.5 text-right">{pvpBottle ? pvpBottle.toFixed(1) : "—"}</td>
                        <td className={`px-4 py-1.5 text-right font-mono ${multiColor(multi)}`}>{multi !== null ? `x${multi.toFixed(1)}` : "—"}</td>
                        <td className={`px-4 py-1.5 text-right font-mono ${multiColor(multiBottle)}`}>{multiBottle !== null ? `x${multiBottle.toFixed(1)}` : "—"}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={i}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-1.5">
                        {recipeId ? (
                          <Link href={`/recetas/${recipeId}`} className="text-blue-600 hover:underline">
                            {item.name}
                          </Link>
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-xs">
                        {coste !== undefined ? coste.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        {pvp ? pvp.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-xs">
                        {coste !== undefined && pvp ? (pvp - coste).toFixed(2) : "—"}
                      </td>
                      <td className={`px-4 py-1.5 text-right font-mono ${multiColor(multi)}`}>
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
