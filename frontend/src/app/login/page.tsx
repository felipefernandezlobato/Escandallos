"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Contrasena incorrecta");
        return;
      }
      const data = await res.json();
      localStorage.setItem("bru_token", data.token);
      router.push("/");
    } catch {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8] px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img
            src="/logo-bru-burgundy.png"
            alt="BRU Specialty Coffee"
            className="h-20 w-auto"
          />
        </div>
        <div className="bg-white rounded-xl border border-[#E8DFD3] shadow-sm p-8">
          <h1 className="text-center text-xl font-semibold text-[#1A1A1A] mb-1 font-serif">
            Escandallos
          </h1>
          <p className="text-center text-sm text-[#6B5E52] mb-6">
            Introduce la contrasena para acceder
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#1A1A1A] mb-1.5"
              >
                Contrasena
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Introduce la contrasena"
                required
                autoFocus
                className="w-full rounded-lg border border-[#D4C4A8] bg-white px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#6B5E52]/50 focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B] transition-colors"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#8B1A2B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6B1420] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-[#6B5E52]/70 mt-6">
          BRU Specialty Coffee
        </p>
      </div>
    </div>
  );
}
