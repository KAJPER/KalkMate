"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";
import { splitLabelSheet, downloadSplitLabelSheet, LABEL_MAX_W_MM, LABEL_MAX_H_MM } from "@/lib/labelSheet";

export default function EtykietyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sourcePages: number; outputPages: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    setError(null);
    setResult(null);
    if (f && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("To nie jest plik PDF.");
      setFile(null);
      return;
    }
    setFile(f);
  };

  const run = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const outBytes = await splitLabelSheet(bytes);
      await downloadSplitLabelSheet(bytes, file.name);
      // policz strony wyniku (kazda strona zrodlowa -> 4 cwiartki)
      const { PDFDocument } = await import("pdf-lib");
      const srcDoc = await PDFDocument.load(bytes);
      const outDoc = await PDFDocument.load(outBytes);
      setResult({ sourcePages: srcDoc.getPageCount(), outputPages: outDoc.getPageCount() });
    } catch (e) {
      console.error("Label split error:", e);
      setError("Nie udało się przetworzyć PDF-a. Sprawdź czy to poprawny plik.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Krajalnica etykiet</h1>
        <p className="text-sm text-[#E0E0E0]/60">
          Wrzuć arkusz A4 z etykietami InPost (siatka 2×2) — dostaniesz PDF z każdą etykietą na osobnej
          stronie, dopasowaną do max {LABEL_MAX_W_MM}×{LABEL_MAX_H_MM}mm, gotowy do drukarki etykiet.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-6 shadow-xl max-w-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#E0E0E0]">Wgraj arkusz etykiet</h2>
            <p className="text-sm text-[#E0E0E0]/60">PDF z InPost (etykieta.pdf), 1 lub więcej stron</p>
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files?.[0] || null);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragOver ? "border-[#3B82F6] bg-[#3B82F6]/5" : "border-[#3F4147] hover:border-[#3B82F6]/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <div>
              <p className="text-[#E0E0E0] font-medium">{file.name}</p>
              <p className="text-xs text-[#E0E0E0]/40 mt-1">{(file.size / 1024).toFixed(0)} KB — kliknij, żeby zmienić</p>
            </div>
          ) : (
            <div>
              <p className="text-[#E0E0E0]/70">Przeciągnij PDF tutaj albo kliknij, żeby wybrać plik</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 border border-red-500/40 bg-red-500/[0.06] p-3 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 border border-green-500/40 bg-green-500/[0.06] p-4 rounded-lg">
            <p className="text-sm text-green-400 font-semibold">✓ Gotowe — plik pobrany</p>
            <p className="text-xs text-[#E0E0E0]/60 mt-1">
              {result.sourcePages} {result.sourcePages === 1 ? "strona" : "stron"} źródłowych →{" "}
              {result.outputPages} stron wynikowych (po 4 na arkusz). Jeśli ostatni arkusz miał mniej niż
              4 etykiety, na końcu mogą być 1-3 puste strony — po prostu je pomiń przy drukowaniu.
            </p>
          </div>
        )}

        <button
          onClick={run}
          disabled={!file || processing}
          className="mt-6 w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6 py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? "Tnę..." : "Potnij i pobierz PDF"}
        </button>
      </motion.div>
    </AdminShell>
  );
}
