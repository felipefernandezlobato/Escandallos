"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MOBILE_ITEMS = [
  { href: "/", label: "Menú", icon: "📖" },
  { href: "/recetas", label: "Recetas", icon: "📋" },
  { href: "/ingredientes", label: "Ingredientes", icon: "🥫" },
  { href: "/proveedores", label: "Proveedores", icon: "🏪" },
  { href: "/importar", label: "Importar", icon: "📥" },
  { href: "/configuracion", label: "Config", icon: "⚙️" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#E8DFD3] z-30 flex">
      {MOBILE_ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
              active
                ? "text-[#8B1A2B] font-medium"
                : "text-[#6B5E52]"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
