"use client";

import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ToastProvider } from "@/components/Toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <ToastProvider>
      <AuthGuard>
        {!isLogin && <Sidebar />}
        <main className={isLogin ? "flex-1" : "flex-1 md:ml-56 pb-20 md:pb-0"}>
          {isLogin ? (
            children
          ) : (
            <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
          )}
        </main>
        {!isLogin && <MobileNav />}
      </AuthGuard>
    </ToastProvider>
  );
}
