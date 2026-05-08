"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

function ClaimInner() {
  const params = useSearchParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDeviceId(params.get("d") || "");
    setCode(params.get("c") || "");
  }, [params]);

  // Wymagaj logowania
  useEffect(() => {
    if (status === "unauthenticated") {
      const url = new URL(window.location.href);
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(url.pathname + url.search)}`);
    }
  }, [status, router]);

  const submit = async () => {
    if (!deviceId.trim()) {
      setError("Brak Device ID");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/user/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId.trim() }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error || "Nie udało się");
      } else {
        setResult("Sparowano! Przekierowuję do panelu...");
        setTimeout(() => router.push("/panel"), 1500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") return <div className="p-6 text-[#1a1a1a] dark:text-[#E0E0E0]">Ładowanie...</div>;
  if (status !== "authenticated") return null;

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338] p-6">
      <div className="max-w-lg mx-auto bg-white dark:bg-[#2B2D31] rounded-2xl shadow-xl p-8 mt-12 border border-gray-100 dark:border-[#3F4147]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="8" y1="10" x2="16" y2="10" />
              <line x1="8" y1="14" x2="16" y2="14" />
              <line x1="8" y1="18" x2="16" y2="18" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">Sparuj kalkulator</h1>
        </div>
        <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-4">
          Skanowałeś kod QR z urządzenia. Sparuj je z kontem — kalkulator
          będzie używał Twojej licencji bez wpisywania kodu.
          <br />
          <strong className="text-[#1a1a1a] dark:text-[#E0E0E0]">Wymagana aktywna licencja na koncie.</strong>
        </p>

        {deviceId && (
          <div className="bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 border border-[#2563EB]/30 dark:border-[#3B82F6]/30 rounded p-3 mb-4 text-sm">
            <span className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">Device ID:</span>{" "}
            <span className="font-mono text-[#1a1a1a] dark:text-[#E0E0E0]">{deviceId}</span>
          </div>
        )}

        {!deviceId && (
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
            placeholder="Device ID (MAC) z ekranu Settings → Device ID + QR"
            className="w-full px-3 py-2 bg-white dark:bg-[#1A1B1E] border border-gray-200 dark:border-[#3F4147] rounded font-mono text-sm mb-3 text-[#1a1a1a] dark:text-[#E0E0E0] placeholder:text-[#1a1a1a]/40 dark:placeholder:text-[#E0E0E0]/40"
          />
        )}

        <button
          onClick={submit}
          disabled={submitting || !deviceId.trim()}
          className="w-full px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
        >
          {submitting ? "Paruję..." : "Sparuj urządzenie"}
        </button>

        {error && <div className="mt-3 text-red-500 dark:text-red-400 text-sm">{error}</div>}
        {result && <div className="mt-3 text-green-600 dark:text-green-400 text-sm">{result}</div>}

        <div className="mt-6 text-xs">
          <Link href="/panel" className="text-[#2563EB] dark:text-[#3B82F6] hover:underline">
            ← Wróć do panelu
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="p-6">Ładowanie...</div>}>
      <ClaimInner />
    </Suspense>
  );
}
