"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/login") {
      setAuthed(true);
      return;
    }
    const token = localStorage.getItem("bru_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    fetch(`${API_BASE}/api/auth/check`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) setAuthed(true);
        else {
          localStorage.removeItem("bru_token");
          router.replace("/login");
        }
      })
      .catch(() => {
        localStorage.removeItem("bru_token");
        router.replace("/login");
      });
  }, [pathname, router]);

  if (authed === null) {
    return <p className="text-[#6B5E52] py-10 text-center">Cargando...</p>;
  }

  return <>{children}</>;
}
