"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MOBILE_ITEMS = [
  { href: "/", label: "Menu" },
  { href: "/menu-cafe", label: "Cafe" },
  { href: "/recetas", label: "Recetas" },
  { href: "/ingredientes", label: "Ingred." },
  { href: "/inventario", label: "Stock" },
  { href: "/mermas", label: "Mermas" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/configuracion", label: "Config" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#E8DFD3] z-30 flex pb-[env(safe-area-inset-bottom)]">
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
