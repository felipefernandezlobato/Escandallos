"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Receta } from "@/lib/types";
import Link from "next/link";

interface MenuItem {
  name: string;
  pvp: number | null;
  recipeName?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const MENU: MenuSection[] = [
  {
    title: "COFFEE",
    items: [
      { name: "Espresso", pvp: 2.9, recipeName: "Espresso" },
      { name: "Doppio", pvp: 3.9, recipeName: "Espresso" },
      { name: "Americano", pvp: 4.9, recipeName: "Americano" },
      { name: "Batch Brü", pvp: 3.9 },
      { name: "Pour-over", pvp: 7.9 },
      { name: "Cortado", pvp: 4.9, recipeName: "Cortado" },
      { name: "Latte", pvp: 5.9, recipeName: "Latte" },
      { name: "Cappuccino", pvp: 5.9, recipeName: "Cappuccino" },
      { name: "Flat White", pvp: 5.9, recipeName: "Flat White" },
      { name: "Espresso / Americano Freddo", pvp: 4.9, recipeName: "Espresso Freddo" },
      { name: "Latte Freddo", pvp: 6.9, recipeName: "Latte Freddo" },
      { name: "Cold Brü", pvp: 4.9 },
      { name: "Montblanc", pvp: 7.9, recipeName: "Mont Blanc" },
      { name: "Espresso Tonic", pvp: 7.9, recipeName: "Espresso Tonic" },
      { name: "Sunset at Brü", pvp: 7.9, recipeName: "Sunset at Brü" },
    ],
  },
  {
    title: "NOT COFFEE",
    items: [
      { name: "Tea", pvp: 4.9 },
      { name: "Matcha Tea", pvp: 4.9, recipeName: "Matcha Tea" },
      { name: "Matcha Latte", pvp: 5.9, recipeName: "Matcha Latte" },
      { name: "Hojicha Latte", pvp: 5.9, recipeName: "Hojicha Latte" },
      { name: "Strawberry Matcha Latte", pvp: 6.9 },
      { name: "Chai Latte", pvp: 5.9, recipeName: "Chai Latte" },
      { name: "Hot / Iced Chocolate", pvp: 5.9, recipeName: "Hot Chocolate" },
      { name: "Fresh Orange Juice", pvp: 6.9 },
    ],
  },
  {
    title: "SWEET",
    items: [
      { name: "Croissant", pvp: 4.9 },
      { name: "Croissant Pistachio", pvp: 6.9, recipeName: "Croissant Pistaccio" },
      { name: "Croissant Choco", pvp: 6.9, recipeName: "Croissant Choco" },
      { name: "Croissant Praline", pvp: 6.9, recipeName: "Croissant Praline" },
      { name: "Cookies", pvp: 3.9, recipeName: "Cookies" },
      { name: "Carrot Cake", pvp: 4.9, recipeName: "Carrot Cake" },
      { name: "Brownie", pvp: 5.9, recipeName: "Brownie" },
      { name: "Lemon Cake", pvp: 4.9, recipeName: "Lemon Cake" },
      { name: "Banana Bread", pvp: 4.9, recipeName: "Banana Bread" },
      { name: "Cinnamon Rolls", pvp: 6.9, recipeName: "Cinnamon Rolls" },
      { name: "Cheesecake", pvp: 8.9, recipeName: "Tarta de queso vasca" },
      { name: "Matcha Cheesecake", pvp: 8.9, recipeName: "Matcha Cheesecake" },
      { name: "Coulant / Lava Cake", pvp: 9.0, recipeName: "Coulant / Lava Cake" },
      { name: "Pancakes Sweet", pvp: 15.9, recipeName: "Pancakes Sweet" },
      { name: "French Toast", pvp: 13.9, recipeName: "French Toast" },
    ],
  },
  {
    title: "BOWLS",
    items: [
      { name: "Chia Bowl", pvp: 9.9, recipeName: "Chia Bowl" },
      { name: "Yoghurt Bowl", pvp: 10.9, recipeName: "Yogurt Bowl" },
      { name: "Overnight Oats Bowl", pvp: 11.9, recipeName: "Oat Bowl" },
    ],
  },
  {
    title: "TOASTS",
    items: [
      { name: "Avo Toast", pvp: 15.9, recipeName: "Avo Toast" },
      { name: "Brü Toast", pvp: 16.9, recipeName: "Brü Toast" },
      { name: "Cherry Tomato Toast", pvp: 17.9, recipeName: "Cherry Toast" },
      { name: "Salmon Toast", pvp: 19.9, recipeName: "Salmon Toast" },
      { name: "Benedict Toast", pvp: 21.9, recipeName: "Benedict Toast" },
      { name: "Pancakes Savory", pvp: 22.9, recipeName: "Pancakes Savory" },
      { name: "Royal Toast", pvp: 23.9, recipeName: "Royal Toast" },
    ],
  },
  {
    title: "SANDWICHES",
    items: [
      { name: "Mixto Croissant", pvp: 19.9, recipeName: "Croissant Mixto" },
      { name: "Mushroom Sandwich", pvp: 17.9, recipeName: "Setas Sandwich" },
      { name: "Mixto Sandwich", pvp: 16.9, recipeName: "Mixto Sandwich" },
      { name: "Veggie Sandwich", pvp: 15.9, recipeName: "Veggie Sandwich" },
      { name: "Sandwich de Pollo", pvp: 7.9, recipeName: "Sandwich Pollo" },
      { name: "Sandwich Atún", pvp: 7.9, recipeName: "Sandwich Tuna" },
      { name: "Bagel Salmon", pvp: 12.9, recipeName: "Bagel Salmon" },
      { name: "Bagel Ham & Cheese", pvp: 11.9, recipeName: "Bagel Ham & Cheese" },
    ],
  },
  {
    title: "LUNCH",
    items: [
      { name: "Bao Vegan", pvp: 7.9, recipeName: "Bao Vegan" },
      { name: "Bao Pork Belly", pvp: 8.9, recipeName: "Bao Pork Belly" },
      { name: "Bao Carrillera", pvp: 9.9, recipeName: "Bao Carrillera" },
      { name: "Parmiggiana", pvp: 14.9, recipeName: "Parmiggiana" },
      { name: "Lasagna", pvp: 15.9, recipeName: "Lasagna" },
      { name: "Ensalada César", pvp: 16.9, recipeName: "César Salad" },
      { name: "Ensalada Burrata", pvp: 17.9, recipeName: "Burrata Salad" },
      { name: "Ensalada Nórdica", pvp: 18.9, recipeName: "Nordica Salad" },
      { name: "Secreto", pvp: 19.9, recipeName: "Secreto" },
      { name: "Pinsa Veggie", pvp: 23.9, recipeName: "Pinsa Veggie" },
      { name: "Pinsa Fleisch", pvp: 24.9, recipeName: "Pinsa Fleisch" },
    ],
  },
  {
    title: "SNACKS",
    items: [
      { name: "Chips", pvp: 4.0, recipeName: "Chips" },
      { name: "Olives", pvp: 5.0, recipeName: "Olives" },
      { name: "Bravas", pvp: 9.9, recipeName: "Bravas" },
      { name: "Hummus", pvp: 9.9, recipeName: "Hummus (plato)" },
      { name: "Guacamole", pvp: 11.9, recipeName: "Guacamole (plato)" },
      { name: "Tortilla", pvp: 11.9, recipeName: "Tortilla" },
      { name: "Croquetas x4", pvp: 11.9, recipeName: "Croquetas Ración" },
      { name: "Croqueta Wednesday (promo)", pvp: 1.0, recipeName: "Croqueta Wednesday" },
      { name: "Cheese Platter", pvp: 32.0, recipeName: "Cheese Platter" },
      { name: "Charcuterie Platter", pvp: 36.0, recipeName: "Charcuterie Platter" },
      { name: "Mixed Platter", pvp: 34.0, recipeName: "Mix Platter" },
    ],
  },
  {
    title: "COCKTAILS",
    items: [
      { name: "Aperol Spritz", pvp: 13.9, recipeName: "Aperol Spritz" },
      { name: "Espresso Martini", pvp: 15.9, recipeName: "Espresso Martini" },
      { name: "Hugo Brut", pvp: 16.9, recipeName: "Hugo Brut" },
      { name: "Kyiv Mule", pvp: 14.9, recipeName: "Moscow Mule" },
      { name: "Pornstar Martini", pvp: 15.9, recipeName: "Pornstar Martini" },
      { name: "Margarita", pvp: 16.9, recipeName: "Margarita" },
      { name: "Hugo Free", pvp: 12.9, recipeName: "Hugo Free" },
      { name: "Cucumber Cooler", pvp: 11.9, recipeName: "Cucumber Cooler" },
    ],
  },
];

export default function Dashboard() {
  const [recipeMap, setRecipeMap] = useState<Record<string, { coste: number; id: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Receta[]>("/api/recetas")
      .then((recetas) => {
        const map: Record<string, { coste: number; id: number }> = {};
        for (const r of recetas) {
          map[r.nombre] = { coste: r.coste_por_porcion, id: r.id };
        }
        setRecipeMap(map);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-slate-500 py-10 text-center">Cargando...</p>;
  }

  // Compute summary stats
  let totalItems = 0;
  let withCost = 0;
  let lowMulti = 0;
  const alerts: { name: string; multi: number; section: string }[] = [];

  for (const section of MENU) {
    for (const item of section.items) {
      totalItems++;
      const coste = item.recipeName ? recipeMap[item.recipeName]?.coste : undefined;
      if (coste !== undefined) {
        withCost++;
        if (item.pvp && coste > 0) {
          const m = item.pvp / coste;
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
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">Items en menú</p>
          <p className="text-2xl font-bold">{totalItems}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">Con escandallo</p>
          <p className="text-2xl font-bold">{withCost}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">Sin escandallo</p>
          <p className="text-2xl font-bold text-slate-400">{totalItems - withCost}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">Multi &lt; x5</p>
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
            const recipe = item.recipeName ? recipeMap[item.recipeName] : undefined;
            const coste = recipe?.coste;
            const recipeId = recipe?.id;
            const pvp = item.pvp;
            const margen =
              coste !== undefined && pvp
                ? ((pvp - coste) / pvp) * 100
                : null;
            const multi = coste && pvp && coste > 0 ? pvp / coste : null;
            return { ...item, coste, recipeId, margen, multi };
          })
          .filter((item) => item.coste !== undefined || item.pvp);

        if (sectionItems.length === 0) return null;

        return (
          <section key={section.title}>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">
              {section.title}
            </h2>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-400 border-b border-slate-200 text-xs">
                    <th className="px-3 py-1.5 font-medium">Item</th>
                    <th className="px-3 py-1.5 font-medium text-right">Coste</th>
                    <th className="px-3 py-1.5 font-medium text-right">PVP</th>
                    <th className="px-3 py-1.5 font-medium text-right">x</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionItems.map((item, i) => {
                    let multiColor = "text-slate-300";
                    if (item.multi !== null) {
                      if (item.multi >= 8) multiColor = "text-green-600 font-medium";
                      else if (item.multi >= 5) multiColor = "text-green-500";
                      else if (item.multi >= 3) multiColor = "text-yellow-600";
                      else multiColor = "text-red-600 font-medium";
                    }
                    return (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-1">
                          {item.recipeId ? (
                            <Link href={`/recetas/${item.recipeId}`} className="text-blue-600 hover:underline">
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
