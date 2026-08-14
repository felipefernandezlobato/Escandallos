"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function isTokenValid(token: string): boolean {
  try {
    const payloadB64 = token.split(".")[0];
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    return (payload.exp || 0) > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const serverChecked = useRef(false);

  useEffect(() => {
    if (pathname === "/login") {
      setAuthed(true);
      return;
    }
    const token = localStorage.getItem("bru_token");
    if (!token || !isTokenValid(token)) {
      localStorage.removeItem("bru_token");
      router.replace("/login");
      return;
    }

    // Token is locally valid — render immediately
    setAuthed(true);

    // Verify with server once per session (background, non-blocking)
    if (!serverChecked.current) {
      serverChecked.current = true;
      fetch(`${API_BASE}/api/auth/check`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) {
            localStorage.removeItem("bru_token");
            router.replace("/login");
          }
        })
        .catch(() => {});
    }
  }, [pathname, router]);

  if (authed === null) {
    return <p className="text-[#6B5E52] py-10 text-center">Cargando...</p>;
  }

  return <>{children}</>;
}
