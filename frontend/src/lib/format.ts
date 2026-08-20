export function weekKeyToLabel(weekKey: string): string {
  const m = weekKey.match(/^w(\d+)\.(\d+)$/);
  if (!m) return weekKey;
  const week = parseInt(m[1], 10);
  const year = 2000 + parseInt(m[2], 10);

  // ISO week date: find Monday of week 1 (the week containing Jan 4th), then
  // add (week - 1) weeks + 2 days to land on that week's Wednesday.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const wednesday = new Date(week1Monday);
  wednesday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7 + 2);

  const dd = String(wednesday.getUTCDate()).padStart(2, "0");
  const mm = String(wednesday.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(wednesday.getUTCFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

export function chf(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)} CHF`;
}

export function formatCantidad(cantidad: number, unidad: string): string {
  if ((unidad === "kg" || unidad === "litro") && cantidad < 1) {
    if (unidad === "kg") {
      return `${Math.round(cantidad * 1000)}g`;
    }
    if (unidad === "litro") {
      return `${Math.round(cantidad * 1000)}ml`;
    }
  }
  return `${cantidad}${unidad}`;
}
