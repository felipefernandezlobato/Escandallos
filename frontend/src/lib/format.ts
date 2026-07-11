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
