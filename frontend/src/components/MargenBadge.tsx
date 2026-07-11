interface Props {
  margen: number | null;
  objetivo?: number | null;
}

export function MargenBadge({ margen, objetivo }: Props) {
  if (margen === null) {
    return <span className="text-xs text-slate-400">Sin precio</span>;
  }

  let color = "bg-green-100 text-green-800";
  if (objetivo !== null && objetivo !== undefined) {
    if (margen < objetivo - 5) {
      color = "bg-red-100 text-red-800";
    } else if (margen < objetivo) {
      color = "bg-yellow-100 text-yellow-800";
    }
  } else {
    if (margen < 50) color = "bg-red-100 text-red-800";
    else if (margen < 60) color = "bg-yellow-100 text-yellow-800";
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {margen.toFixed(1)}%
    </span>
  );
}
