"use client";

import { useState, useEffect, useMemo } from "react";
import AdminShell from "@/components/admin/AdminShell";

interface Capture {
  filename: string;
  deviceId: string;
  timestamp: string;
  sizeKB: number;
}

interface DeviceStat {
  deviceId: string;
  count: number;
}

interface CaptureData {
  ok: boolean;
  items: Capture[];
  stats: {
    total: number;
    filtered: number;
    totalSizeKB: number;
    uniqueDevices: number;
    byDevice: DeviceStat[];
  };
}

function fmt(s: string) {
  return new Date(s).toLocaleString("pl-PL", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function CapturesPage() {
  const [data, setData] = useState<CaptureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<string>("");
  const [opened, setOpened] = useState<Capture | null>(null);

  const load = async (device?: string) => {
    setLoading(true);
    try {
      const url = device ? `/api/admin/captures?device=${encodeURIComponent(device)}` : "/api/admin/captures";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const applyFilter = (d: string) => {
    setDeviceFilter(d);
    load(d || undefined);
  };

  const totalMB = useMemo(
    () => (data ? (data.stats.totalSizeKB / 1024).toFixed(1) : "0"),
    [data]
  );

  return (
    <AdminShell>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Galeria zdjęć z kalkulatorów</h1>
            <p className="text-sm text-[#E0E0E0]/60">
              Wszystkie zdjęcia zadań wysłane do AI przez urządzenia
            </p>
          </div>
          <button
            onClick={() => load(deviceFilter || undefined)}
            className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors"
          >
            Odśwież
          </button>
        </div>

        {loading && <div className="text-[#E0E0E0]/60">Ładowanie…</div>}
        {error && (
          <div className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-4">
            Błąd: {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Wszystkie zdjęcia</p>
                <p className="text-3xl font-bold text-[#3B82F6]">{data.stats.total}</p>
              </div>
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">
                  {deviceFilter ? "Po filtrze" : "Pokazane"}
                </p>
                <p className="text-3xl font-bold text-green-400">{data.stats.filtered}</p>
              </div>
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Urządzenia</p>
                <p className="text-3xl font-bold text-amber-400">{data.stats.uniqueDevices}</p>
              </div>
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">Całkowity rozmiar</p>
                <p className="text-3xl font-bold text-purple-400">{totalMB} MB</p>
              </div>
            </div>

            {/* Filtr po device */}
            <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-4 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-[#E0E0E0]/60 uppercase">Filtruj po device:</span>
                <button
                  onClick={() => applyFilter("")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    deviceFilter === ""
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
                  }`}
                >
                  Wszystkie ({data.stats.total})
                </button>
                {data.stats.byDevice.map((d) => (
                  <button
                    key={d.deviceId}
                    onClick={() => applyFilter(d.deviceId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                      deviceFilter.toUpperCase() === d.deviceId.toUpperCase()
                        ? "bg-[#3B82F6] text-white"
                        : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
                    }`}
                  >
                    {d.deviceId} ({d.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Grid zdjec */}
            {data.items.length === 0 ? (
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] p-12 text-center text-[#E0E0E0]/40">
                Brak zdjęć w wybranej kategorii.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {data.items.map((c) => (
                  <button
                    key={c.filename}
                    onClick={() => setOpened(c)}
                    className="group relative aspect-[4/3] bg-[#1A1A1A] overflow-hidden border border-[#3F4147] hover:border-[#3B82F6] transition-colors rounded-lg"
                    title={`${c.deviceId} · ${fmt(c.timestamp)} · ${c.sizeKB} kB`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/captures/${encodeURIComponent(c.filename)}`}
                      alt={c.filename}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1.5">
                      <div className="text-[10px] font-mono text-[#E0E0E0]/70 truncate">{c.deviceId}</div>
                      <div className="text-[10px] font-mono text-[#E0E0E0]/50 truncate">
                        {new Date(c.timestamp).toLocaleString("pl-PL", {
                          day: "2-digit", month: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Modal pelnoekranowy */}
            {opened && (
              <div
                onClick={() => setOpened(null)}
                className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
              >
                <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/captures/${encodeURIComponent(opened.filename)}`}
                    alt={opened.filename}
                    className="max-w-full max-h-[85vh] object-contain"
                  />
                  <div className="mt-3 bg-[#0E0E0E] border border-[#3F4147] rounded-lg p-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-[#E0E0E0]/70">
                      <div><span className="text-[#E0E0E0]/45">Device:</span> <span className="font-mono">{opened.deviceId}</span></div>
                      <div><span className="text-[#E0E0E0]/45">Rozmiar:</span> {opened.sizeKB} kB</div>
                      <div className="col-span-2"><span className="text-[#E0E0E0]/45">Czas:</span> {fmt(opened.timestamp)}</div>
                      <div className="col-span-2"><span className="text-[#E0E0E0]/45">Plik:</span> <span className="font-mono text-[10px]">{opened.filename}</span></div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setOpened(null)}
                  className="absolute top-4 right-4 px-3 py-1.5 bg-[#313338] text-[#E0E0E0]/80 hover:text-[#3B82F6] border border-[#3F4147] rounded-lg text-xs"
                >
                  Zamknij ×
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
