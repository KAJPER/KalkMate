"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ClaimInfo {
  ok: boolean;
  claimed: boolean;
  license?: { code: string; durationDays: number; activatedAt: string | null };
  device?: {
    deviceId: string;
    firstSeen: string;
    lastSeen: string;
    requestCount: number;
    firmwareVersion: string | null;
  } | null;
}

interface SolveItem {
  id: string;
  deviceId: string;
  mode: string;
  question: string;
  answer: string;
  createdAt: string;
}

function fmt(s: string) {
  return new Date(s).toLocaleString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function KalkulatorPage() {
  const { status } = useSession();
  const router = useRouter();

  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [items, setItems] = useState<SolveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<SolveItem | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r1 = await fetch("/api/user/license/claim", { cache: "no-store" });
      const j1: ClaimInfo = await r1.json();
      setInfo(j1);
      if (j1.claimed) {
        const r2 = await fetch("/api/user/conversations?limit=50", { cache: "no-store" });
        const j2 = await r2.json();
        setItems(j2.items || []);
      } else {
        setItems([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClaim = async () => {
    if (!code.trim()) return;
    setClaiming(true);
    setError(null);
    try {
      const r = await fetch("/api/user/license/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error || "Nie udało się zaclaimować licencji");
      } else {
        setCode("");
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setClaiming(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="p-6">Ładowanie…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Mój kalkulator</h1>
          <Link href="/panel" className="text-sm text-blue-600 hover:underline">
            ← Powrót do panelu
          </Link>
        </div>

        {/* Sekcja claim licencji */}
        {!info?.claimed && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-2">Przypisz licencję kalkulatora</h2>
            <p className="text-sm text-gray-600 mb-4">
              Wpisz kod licencji który masz w urządzeniu (Settings → Licencja). Po
              zapisaniu zobaczysz tutaj historię swoich rozwiązań z kalkulatora.
              <br />
              <strong>Zasada:</strong> jedno konto = jedna licencja = jedno
              urządzenie.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Np. h33=q%%ok21682y%"
                className="flex-1 px-3 py-2 border rounded font-mono text-sm"
              />
              <button
                onClick={handleClaim}
                disabled={claiming || !code.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {claiming ? "Zapisuję…" : "Przypisz"}
              </button>
            </div>
            {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          </div>
        )}

        {/* Info o urzadzeniu */}
        {info?.claimed && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold mb-2">Twoje urządzenie</h2>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-gray-500">Licencja:</span>{" "}
                    <span className="font-mono">{info.license?.code}</span>
                  </div>
                  {info.device && (
                    <>
                      <div>
                        <span className="text-gray-500">Device ID (MAC):</span>{" "}
                        <span className="font-mono">{info.device.deviceId}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Firmware:</span>{" "}
                        <span className="font-mono">
                          {info.device.firmwareVersion || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Zapytań:</span>{" "}
                        <strong>{info.device.requestCount}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500">Ostatni kontakt:</span>{" "}
                        {fmt(info.device.lastSeen)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista konwersacji */}
        {info?.claimed && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">
              Historia rozwiązań ({items.length})
            </h2>
            {items.length === 0 ? (
              <div className="text-gray-500 text-sm">
                Żadnych zadań jeszcze nie rozwiązano. Zacznij od kalkulatora.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => setOpened(it)}
                    className="block w-full text-left bg-gray-50 hover:bg-gray-100 rounded p-3 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {it.mode === "image" ? "📷 Zdjęcie" : it.question}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {it.answer.slice(0, 120)}…
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                        {fmt(it.createdAt)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal szczegolow */}
        {opened && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setOpened(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-xs text-gray-500">{fmt(opened.createdAt)}</div>
                  <div className="text-xs font-mono text-gray-400">
                    {opened.deviceId}
                  </div>
                </div>
                <button
                  onClick={() => setOpened(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="mb-4">
                <div className="text-sm font-bold mb-1">Zadanie:</div>
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                  {opened.question}
                </div>
              </div>
              <div>
                <div className="text-sm font-bold mb-1">Rozwiązanie:</div>
                <div className="bg-blue-50 p-3 rounded text-sm whitespace-pre-wrap font-mono">
                  {opened.answer}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
