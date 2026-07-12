"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { ImportarPreview } from "@/lib/types";

const EJEMPLO_JSON = `{
  "proveedor": "Makro",
  "fecha": "2025-01-15",
  "items": [
    {
      "nombre": "Leche entera",
      "cantidad": 6,
      "unidad": "litro",
      "precio_total": 7.20,
      "precio_unitario": 1.20
    }
  ]
}`;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ImportarPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [pdfTexto, setPdfTexto] = useState("");
  const [preview, setPreview] = useState<ImportarPreview | null>(null);
  const [resultado, setResultado] = useState<{ actualizados: number; creados: number } | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setPdfTexto("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/importar/pdf`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPdfTexto(data.texto);
    } catch (err: any) {
      setError(err.message || "Error al procesar PDF");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handlePreview = async () => {
    setError("");
    setResultado(null);
    try {
      const data = JSON.parse(jsonInput);
      const result = await apiFetch<ImportarPreview>("/api/importar/preview", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setPreview(result);
    } catch (err: any) {
      setError(err.message || "JSON no válido");
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    try {
      const items = preview.matches.map((m) => ({
        ingrediente_id: m.ingrediente_id,
        nombre: m.item.nombre,
        unidad_compra: m.item.unidad,
        cantidad_compra: m.item.cantidad,
        precio_compra: m.item.precio_unitario,
        crear_nuevo: m.es_nuevo,
      }));
      const result = await apiFetch<{ actualizados: number; creados: number }>(
        "/api/importar/confirm",
        {
          method: "POST",
          body: JSON.stringify({ proveedor: preview.proveedor, items }),
        }
      );
      setResultado(result);
      setPreview(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Importar Datos de Factura</h1>

      {/* Step 1: PDF Upload */}
      <div className="bg-white border border-[#E8DFD3] rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">1. Sube la factura (PDF)</h3>
        <div className="flex gap-3 items-center">
          <label className="bg-[#8B1A2B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420] cursor-pointer transition-colors">
            {uploading ? "Procesando..." : "Subir PDF"}
            <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={uploading} />
          </label>
          <span className="text-xs text-[#6B5E52]/70">Se extrae el texto automáticamente</span>
        </div>

        {pdfTexto && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-[#6B5E52]">Texto extraído del PDF:</p>
              <button
                onClick={() => navigator.clipboard.writeText(pdfTexto)}
                className="text-xs text-[#8B1A2B] hover:underline"
              >
                Copiar texto
              </button>
            </div>
            <pre className="bg-[#F5F0E8] border border-[#E8DFD3] rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
              {pdfTexto}
            </pre>
          </div>
        )}
      </div>

      {/* Step 2: JSON */}
      <div className="bg-white border border-[#E8DFD3] rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">2. Pega el JSON de Claude</h3>
        <p className="text-xs text-[#6B5E52]">
          Copia el texto del PDF + el prompt template de abajo a Claude. Pega el JSON resultante aquí.
        </p>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="Pega el JSON aquí..."
          className="w-full border border-[#D4C4A8] rounded-lg px-3 py-2 text-sm font-mono"
          rows={8}
        />
        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={!jsonInput.trim()}
            className="bg-[#8B1A2B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6B1420] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Vista Previa
          </button>
          <button
            onClick={() => setJsonInput(EJEMPLO_JSON)}
            className="border border-[#D4C4A8] px-4 py-2 rounded-lg text-sm hover:bg-[#F5F0E8]"
          >
            Ejemplo
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {resultado && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          <p className="font-medium">Importación completada</p>
          <p className="text-sm mt-1">
            {resultado.actualizados} ingredientes actualizados, {resultado.creados} nuevos creados.
            Los costes de las recetas se han recalculado automáticamente.
          </p>
        </div>
      )}

      {preview && (
        <div className="bg-white border border-[#E8DFD3] rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Vista Previa — {preview.proveedor}</h3>
              <p className="text-xs text-[#6B5E52]">Fecha: {preview.fecha}</p>
            </div>
            <button
              onClick={handleConfirm}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Confirmar Importación
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8DFD3] text-left text-[#6B5E52]">
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium text-right">Cantidad</th>
                  <th className="pb-2 font-medium text-right">Precio Unit.</th>
                  <th className="pb-2 font-medium text-right">Precio Ant.</th>
                  <th className="pb-2 font-medium text-right">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {preview.matches.map((m, i) => {
                  const cambio =
                    m.precio_anterior && m.precio_anterior > 0
                      ? ((m.item.precio_unitario - m.precio_anterior) / m.precio_anterior) * 100
                      : null;
                  return (
                    <tr key={i} className="border-b border-[#E8DFD3]/50">
                      <td className="py-2">
                        <div>{m.item.nombre}</div>
                        {m.ingrediente_nombre && (
                          <div className="text-xs text-[#6B5E52]/70">→ {m.ingrediente_nombre}</div>
                        )}
                      </td>
                      <td className="py-2">
                        {m.es_nuevo ? (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">Nuevo</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs">Match</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {m.item.cantidad} {m.item.unidad}
                      </td>
                      <td className="py-2 text-right">{m.item.precio_unitario.toFixed(2)} CHF</td>
                      <td className="py-2 text-right text-[#6B5E52]/70">
                        {m.precio_anterior ? `${m.precio_anterior.toFixed(2)} CHF` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {cambio !== null ? (
                          <span className={cambio > 0 ? "text-red-600" : "text-green-600"}>
                            {cambio > 0 ? "+" : ""}
                            {cambio.toFixed(1)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prompt template */}
      <details className="bg-white border border-[#E8DFD3] rounded-lg">
        <summary className="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-[#F5F0E8]">
          Prompt Template para Claude
        </summary>
        <div className="px-4 pb-4">
          <pre className="bg-[#F5F0E8] rounded p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto">{`Analiza esta factura de proveedor y extrae los datos en el siguiente formato JSON:

{
  "proveedor": "nombre del proveedor",
  "fecha": "YYYY-MM-DD",
  "items": [
    {
      "nombre": "nombre del producto",
      "cantidad": 0,
      "unidad": "kg/litro/unidad/paquete",
      "precio_total": 0.00,
      "precio_unitario": 0.00
    }
  ]
}

Reglas:
- Usa siempre punto como separador decimal
- Si el precio unitario no aparece, calcúlalo dividiendo precio_total / cantidad
- Ignora líneas de IVA, totales, o datos que no sean productos
- Normaliza las unidades a: kg, g, litro, ml, unidad, paquete`}</pre>
        </div>
      </details>
    </div>
  );
}
