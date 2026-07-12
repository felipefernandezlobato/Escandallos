"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Panel", icon: "📊" },
  { href: "/menu", label: "Menú", icon: "📖" },
  { href: "/recetas", label: "Recetas", icon: "📋" },
  { href: "/ingredientes", label: "Ingredientes", icon: "🥫" },
  { href: "/proveedores", label: "Proveedores", icon: "🏪" },
  { href: "/importar", label: "Importar", icon: "📥" },
  { href: "/configuracion", label: "Configuración", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col bg-slate-800 text-white z-30">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight">Escandallos</h1>
        <p className="text-xs text-slate-400 mt-0.5">Gestión de costes</p>
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-slate-700 text-white font-medium"
                  : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
