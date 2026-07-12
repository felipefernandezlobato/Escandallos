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
      { name: "Pain Au Chocolat", pvp: null },
      { name: "Almond Croissant", pvp: null },
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
      { name: "Butter Toast", pvp: null },
      { name: "Tomato Toast", pvp: null },
      { name: "Avo Toast", pvp: 15.9, recipeName: "Avo Toast" },
      { name: "Brü Toast", pvp: 16.9, recipeName: "Brü Toast" },
      { name: "Cherry Tomato Toast", pvp: 17.9, recipeName: "Cherry Toast" },
      { name: "Salmon Toast", pvp: 19.9, recipeName: "Salmon Toast" },
      { name: "Ibérico Toast", pvp: null },
      { name: "Benedict Toast", pvp: 21.9, recipeName: "Benedict Toast" },
      { name: "Pancakes Savory", pvp: 22.9, recipeName: "Pancakes Savory" },
      { name: "Royal Toast", pvp: 23.9, recipeName: "Royal Toast" },
    ],
  },
  {
    title: "SANDWICHES",
    items: [
      { name: "Mixto Croissant", pvp: 19.9, recipeName: "Croissant Mixto" },
      { name: "Cheese Sandwich", pvp: null },
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
      { name: "Tortilla Burger", pvp: 19.9 },
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
      { name: "Salmorejo", pvp: null },
      { name: "Pretzel", pvp: 5.9 },
      { name: "Bravas", pvp: 9.9, recipeName: "Bravas" },
      { name: "Hummus", pvp: 9.9, recipeName: "Hummus (plato)" },
      { name: "Guacamole", pvp: 11.9, recipeName: "Guacamole (plato)" },
      { name: "Tortilla", pvp: 11.9, recipeName: "Tortilla" },
      { name: "Croquetas x4", pvp: 11.9, recipeName: "Croquetas Ración" },
      { name: "Pimientos del Padrón", pvp: null },
      { name: "Punto de Tortilla x3", pvp: 11.9 },
      { name: "Cheese Platter S/L", pvp: 32.0, recipeName: "Cheese Platter" },
      { name: "Charcuterie Platter S/L", pvp: 36.0, recipeName: "Charcuterie Platter" },
      { name: "Mixed Platter S/L", pvp: 34.0, recipeName: "Mix Platter" },
    ],
  },
  {
    title: "DRINKS",
    items: [
      { name: "Water Bottle BWT", pvp: 3.9 },
      { name: "Evian 50cl Glass", pvp: 4.9 },
      { name: "San Pellegrino 50cl", pvp: 4.9 },
      { name: "Evian", pvp: 3.9 },
      { name: "Coca Cola / Zero", pvp: 3.9 },
      { name: "Vivi Kola / Zero", pvp: 4.9 },
      { name: "Vivi Soda Zitrone", pvp: 5.9 },
      { name: "Vivi Soda Apfelschorle", pvp: 5.9 },
      { name: "Vivi Soda Mate", pvp: 5.9 },
      { name: "LemonAID Blutorange", pvp: 5.9 },
      { name: "LemonAID Maracuja", pvp: 5.9 },
      { name: "LemonAID Limette", pvp: 5.9 },
      { name: "LemonAID Ingwer", pvp: 5.9 },
      { name: "ChariTea", pvp: 5.9 },
    ],
  },
  {
    title: "WINE",
    items: [
      { name: "Moscatel de Alejandría", pvp: 4.9 },
      { name: "Garnacha Blanca Nativa", pvp: 4.9 },
      { name: "Chardonnay", pvp: 5.9 },
      { name: "Garnacha Blanca Barrel-Fermented", pvp: 8.9 },
      { name: "Tempranillo Rosé", pvp: 4.9 },
      { name: "Care Nouveau", pvp: 4.9 },
      { name: "Garnacha Finca Bancales", pvp: 7.9 },
      { name: "Brut Cariñena", pvp: 5.9 },
      { name: "Mimosa", pvp: 8.9, recipeName: "Mimosa" },
    ],
  },
  {
    title: "BEER",
    items: [
      { name: "Estrella Galicia 30cl", pvp: 4.5 },
      { name: "Estrella Galicia 50cl", pvp: 7.0 },
      { name: "1906 Reserva 30cl", pvp: 5.5 },
      { name: "1906 Reserva 50cl", pvp: 8.0 },
      { name: "Estrella GlutenFree 33cl", pvp: 5.5 },
      { name: "Estrella 0,0 25cl", pvp: 4.9 },
      { name: "Ueli Weizen 50cl", pvp: 9.0 },
      { name: "Ueli IPA 33cl", pvp: 7.5 },
      { name: "Unser Bier Amber 33cl", pvp: 7.5 },
      { name: "Unser Bier Amber 50cl", pvp: 9.0 },
      { name: "Unser Bier NEIPA 33cl", pvp: 7.5 },
      { name: "Birtel Red Ale 33cl", pvp: 7.5 },
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

export default function MenuPage() {
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
    return <p className="text-slate-500 py-10 text-center">Cargando menú...</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Menú BRÜ</h1>

      {MENU.map((section) => (
        <section key={section.title}>
          <h2 className="text-lg font-bold bg-slate-800 text-white px-4 py-2 rounded-t-lg">
            {section.title}
          </h2>
          <div className="bg-white border border-slate-200 rounded-b-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium text-right w-24">Coste</th>
                  <th className="px-4 py-2 font-medium text-right w-24">PVP</th>
                  <th className="px-4 py-2 font-medium text-right w-16">x</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, i) => {
                  const recipe = item.recipeName ? recipeMap[item.recipeName] : undefined;
                  const coste = recipe?.coste;
                  const recipeId = recipe?.id;
                  const pvp = item.pvp;
                  const multi = coste !== undefined && pvp && coste > 0 ? pvp / coste : null;

                  let multiColor = "text-slate-400";
                  if (multi !== null) {
                    if (multi >= 8) multiColor = "text-green-600 font-medium";
                    else if (multi >= 5) multiColor = "text-green-500";
                    else if (multi >= 3) multiColor = "text-yellow-600";
                    else multiColor = "text-red-600 font-medium";
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
                      <td className={`px-4 py-1.5 text-right font-mono ${multiColor}`}>
                        {multi !== null ? `x${multi.toFixed(1)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
