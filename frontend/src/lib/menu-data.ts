export interface MenuItem {
  name: string;
  pvp: number | null;
  recipeName?: string;
  ingredientName?: string;
  pvpBottle?: number | null;
  recipeNameBottle?: string;
  pvpIced?: number | null;
  recipeNameIced?: string;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export function getMultiColor(multi: number | null, section: string): string {
  if (multi === null) return "text-slate-400";

  const s = section.toUpperCase();

  if (s === "COFFEE" || s === "NOT COFFEE") {
    if (multi >= 12) return "text-green-600 font-medium";
    if (multi >= 8) return "text-orange-500";
    return "text-red-600 font-medium";
  }

  if (s === "SWEET") {
    if (multi >= 9) return "text-green-600 font-medium";
    if (multi >= 4) return "text-orange-500";
    return "text-red-600 font-medium";
  }

  if (s === "BOWLS" || s === "TOASTS" || s === "SANDWICHES" || s === "LUNCH" || s === "SNACKS") {
    if (multi >= 8) return "text-green-600 font-medium";
    if (multi >= 5) return "text-orange-500";
    return "text-red-600 font-medium";
  }

  if (s === "DRINKS" || s === "WINE" || s === "BEER") {
    if (multi >= 4) return "text-green-600 font-medium";
    if (multi >= 3.5) return "text-orange-500";
    return "text-red-600 font-medium";
  }

  // Default (cocktails, etc.)
  if (multi >= 5) return "text-green-600 font-medium";
  if (multi >= 3.5) return "text-orange-500";
  return "text-red-600 font-medium";
}

export const MENU: MenuSection[] = [
  {
    title: "COFFEE",
    items: [
      { name: "Espresso", pvp: 2.9, recipeName: "Espresso" },
      { name: "Doppio", pvp: 3.9, recipeName: "Doppio", pvpIced: 4.9, recipeNameIced: "Iced Espresso" },
      { name: "Americano", pvp: 4.9, recipeName: "Americano", pvpIced: 5.9, recipeNameIced: "Iced Americano" },
      { name: "Batch Brü", pvp: 3.9, recipeName: "Batch Brü" },
      { name: "Pour-over", pvp: 7.9, recipeName: "Pour-over" },
      { name: "Cortado", pvp: 4.9, recipeName: "Cortado" },
      { name: "Latte", pvp: 5.9, recipeName: "Latte", pvpIced: 6.9, recipeNameIced: "Iced Latte" },
      { name: "Cappuccino", pvp: 5.9, recipeName: "Cappuccino" },
      { name: "Flat White", pvp: 5.9, recipeName: "Flat White" },
      { name: "Cold Brü", pvp: null, pvpIced: 4.9, recipeNameIced: "Cold Brü" },
      { name: "Montblanc", pvp: null, pvpIced: 7.9, recipeNameIced: "Mont Blanc" },
      { name: "Espresso Tonic", pvp: null, pvpIced: 7.9, recipeNameIced: "Espresso Tonic" },
      { name: "Sunset at Brü", pvp: null, pvpIced: 7.9, recipeNameIced: "Sunset at Brü" },
    ],
  },
  {
    title: "NOT COFFEE",
    items: [
      { name: "Tea", pvp: 4.9, recipeName: "Tea" },
      { name: "Matcha Tea", pvp: 4.9, recipeName: "Matcha Tea" },
      { name: "Matcha Latte", pvp: 5.9, recipeName: "Matcha Latte", pvpIced: 6.9, recipeNameIced: "Iced Matcha Latte" },
      { name: "Hojicha Latte", pvp: 5.9, recipeName: "Hojicha Latte", pvpIced: 6.9, recipeNameIced: "Iced Hojicha Latte" },
      { name: "Iced Strawberry Matcha Latte", pvp: null, pvpIced: 6.9, recipeNameIced: "Iced Strawberry Matcha Latte" },
      { name: "Iced Strawberry Hojicha Latte", pvp: null, pvpIced: 7.9, recipeNameIced: "Iced Strawberry Hojicha Latte" },
      { name: "Chai Latte", pvp: 5.9, recipeName: "Chai Latte", pvpIced: 6.9, recipeNameIced: "Iced Chai Latte" },
      { name: "Chocolate", pvp: 5.9, recipeName: "Hot Chocolate", pvpIced: 6.9, recipeNameIced: "Iced Chocolate" },
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
      { name: "Cherry Toast", pvp: 17.9, recipeName: "Cherry Toast" },
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
      { name: "Cheese Platter S/L", pvp: 32.0, recipeName: "Cheese Platter" },
      { name: "Charcuterie Platter S/L", pvp: 36.0, recipeName: "Charcuterie Platter" },
      { name: "Mixed Platter S/L", pvp: 34.0, recipeName: "Mix Platter" },
    ],
  },
  {
    title: "DRINKS",
    items: [
      { name: "BWT Water (sin/con gas)", pvp: 3.9, recipeName: "BWT Water" },
      { name: "Evian 50cl Cristal", pvp: 3.9, ingredientName: "Evian 50cl Cristal" },
      { name: "Evian 50cl PET", pvp: 3.9, ingredientName: "Evian 50cl PET" },
      { name: "San Pellegrino 50cl Cristal", pvp: 3.9, ingredientName: "San Pellegrino 50cl Cristal" },
      { name: "San Pellegrino 50cl PET", pvp: 3.9, ingredientName: "San Pellegrino 50cl PET" },
      { name: "Coca Cola / Zero", pvp: 3.9, ingredientName: "Coca Cola" },
      { name: "Vivi Soda Zitrone", pvp: 5.9, ingredientName: "Vivi Soda Zitrone" },
      { name: "Vivi Soda Apfelschorle", pvp: 5.9, ingredientName: "Vivi Soda Apfelschorle" },
      { name: "Vivi Soda Mate", pvp: 5.9, ingredientName: "Vivi Soda Mate" },
      { name: "LemonAID Blutorange", pvp: 5.9, ingredientName: "LemonAID Blutorange" },
      { name: "LemonAID Maracuja", pvp: 5.9, ingredientName: "LemonAID Maracuja" },
      { name: "LemonAID Limette", pvp: 5.9, ingredientName: "LemonAID Limette" },
      { name: "LemonAID Ingwer", pvp: 5.9, ingredientName: "LemonAID Ingwer" },
      { name: "ChariTea", pvp: 5.9, ingredientName: "ChariTea" },
    ],
  },
  {
    title: "WINE",
    items: [
      { name: "Moscatel de Alejandría", pvp: 4.9, recipeName: "Moscatel de Alejandría Copa", pvpBottle: 19.9, recipeNameBottle: "Moscatel de Alejandría Botella" },
      { name: "Garnacha Blanca Nativa", pvp: 4.9, recipeName: "Garnacha Blanca Nativa Copa", pvpBottle: 19.9, recipeNameBottle: "Garnacha Blanca Nativa Botella" },
      { name: "Chardonnay", pvp: 5.9, recipeName: "Chardonnay Copa", pvpBottle: 24.9, recipeNameBottle: "Chardonnay Botella" },
      { name: "Garnacha Blanca Barrel-Fermented", pvp: 8.9, recipeName: "Garnacha Blanca Barrel Fermented Copa", pvpBottle: 39.9, recipeNameBottle: "Garnacha Blanca Barrel Fermented Botella" },
      { name: "Tempranillo Rosé", pvp: 4.9, recipeName: "Rosado Copa", pvpBottle: 19.9, recipeNameBottle: "Rosado Botella" },
      { name: "Care Nouveau", pvp: 4.9, recipeName: "Nouveau Copa", pvpBottle: 19.9, recipeNameBottle: "Nouveau Botella" },
      { name: "Garnacha Finca Bancales", pvp: 7.9, recipeName: "Finca Bancales Copa", pvpBottle: 34.9, recipeNameBottle: "Finca Bancales Botella" },
      { name: "Brut Cariñena", pvp: 5.9, recipeName: "Brut Cariñena Copa", pvpBottle: 24.9, recipeNameBottle: "Brut Cariñena Botella" },
      { name: "Mimosa", pvp: 8.9, recipeName: "Mimosa" },
    ],
  },
  {
    title: "BEER",
    items: [
      { name: "Estrella Galicia 30cl", pvp: 4.5, recipeName: "Estrella Galicia 30cl" },
      { name: "Estrella Galicia 50cl", pvp: 7.0, recipeName: "Estrella Galicia 50cl" },
      { name: "1906 Reserva 30cl", pvp: 5.5, recipeName: "Estrella 1906 30cl" },
      { name: "1906 Reserva 50cl", pvp: 8.0, recipeName: "Estrella 1906 50cl" },
      { name: "Estrella GlutenFree 33cl", pvp: 5.5, recipeName: "Estrella Sin Gluten 33cl" },
      { name: "Estrella 0,0 25cl", pvp: 4.9, recipeName: "Estrella 0.0 25cl" },
      { name: "Ueli Weizen 50cl", pvp: 9.0, recipeName: "Ueli Weizen 50cl" },
      { name: "Ueli IPA 33cl", pvp: 7.5, recipeName: "Ueli IPA 33cl" },
      { name: "Unser Bier Amber 33cl", pvp: 7.5, recipeName: "Unser Bier Amber 33cl" },
      { name: "Unser Bier Amber 50cl", pvp: 9.0, recipeName: "Unser Bier Amber 50cl" },
      { name: "Unser Bier NEIPA 33cl", pvp: 7.5, recipeName: "Unser Bier NEIPA 33cl" },
      { name: "Birtel Red Ale 33cl", pvp: 7.5, recipeName: "Birtel Red Ale 33cl" },
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
      { name: "Sangría Copa 25cl", pvp: 7.5, recipeName: "Sangría Copa" },
      { name: "Sangría Jarra 1L", pvp: 20.0, recipeName: "Sangría Jarra 1L" },
    ],
  },
];
