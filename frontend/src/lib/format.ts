/** Format an API date ("2026-09-30") for display, without moving the day.
 *
 * The backend stores these as calendar dates, not instants, and sends them as
 * plain "YYYY-MM-DD". `new Date("2026-09-30")` parses that as midnight **UTC**,
 * so `toLocaleDateString()` then renders it in the viewer's own timezone and
 * hands back the day before to anyone west of UTC — the Historial de Conteos
 * showed a count taken on 30/9 as 29/9, every column shifted by one. Pinning
 * the formatter to UTC keeps the two ends on the same clock.
 *
 * weekKeyToLabel() below is immune for the same reason: it builds and reads
 * its date entirely in UTC.
 */
export function formatFechaISO(
  fecha: string,
  opts: { conAno?: boolean } = {},
): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    ...(opts.conAno ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  });
}

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
