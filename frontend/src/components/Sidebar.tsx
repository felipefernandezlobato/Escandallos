"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Menú" },
  { href: "/recetas", label: "Recetas" },
  { href: "/ingredientes", label: "Ingredientes" },
  { href: "/importar", label: "Importar" },
  { href: "/configuracion", label: "Configuración" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col bg-[#8B1A2B] text-white z-30">
      <div className="px-5 py-4 border-b border-white/20">
        <img src="/logo-bru-white.png" alt="BRÜ Specialty Coffee" className="h-16 w-auto" />
        <p className="text-[10px] uppercase tracking-widest text-white/50 mt-1.5">Escandallos</p>
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
              className={`flex items-center px-5 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/20">
        <button
          onClick={() => {
            localStorage.removeItem("bru_token");
            window.location.href = "/login";
          }}
          className="text-white/50 hover:text-white text-sm transition-colors"
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
