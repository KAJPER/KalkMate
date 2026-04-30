"use client";

import { useState, useEffect } from "react";
import AdminShell from "@/components/admin/AdminShell";

interface Device {
  id: string;
  deviceId: string;
  firstSeen: string;
  lastSeen: string;
  requestCount: number;
  firmwareVersion: string | null;
  lastIp: string | null;
  licenseCode: string | null;
  notes: string | null;
}

interface DeviceData {
  ok: boolean;
  stats: {
    totalDevices: number;
    totalRequests: number;
    activeNow: number;
  };
  devices: Device[];
}

function formatDate(s: string) {
  const d = new Date(s);
  return d.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(s: string) {
  const ms = Date.now() - new Date(s).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s temu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h temu`;
  return `${Math.floor(h / 24)}d temu`;
}

export default function DevicesPage() {
  const [data, setData] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/devices", { cache: "no-store" });
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
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AdminShell>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">
              Urządzenia ESP32
            </h1>
            <p className="text-sm text-[#E0E0E0]/60">
              Statystyki kontaktów kalkulatorów z serwerem
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 bg-[#313338] hover:bg-[#3F4147] rounded-lg text-sm text-[#3B82F6] transition-colors"
          >
            Odśwież
          </button>
        </div>

        {loading && (
          <div className="text-[#E0E0E0]/60">Ładowanie…</div>
        )}
        {error && (
          <div className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-4">
            Błąd: {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">
                  Wszystkie urządzenia
                </p>
                <p className="text-3xl font-bold text-[#3B82F6]">
                  {data.stats.totalDevices}
                </p>
              </div>
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">
                  Aktywne (5 min)
                </p>
                <p className="text-3xl font-bold text-green-400">
                  {data.stats.activeNow}
                </p>
              </div>
              <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-xl border border-[#3F4147] p-5">
                <p className="text-xs text-[#E0E0E0]/60 mb-1">
                  Łączna liczba zapytań
                </p>
                <p className="text-3xl font-bold text-purple-400">
                  {data.stats.totalRequests}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#313338] to-[#2B2D31] rounded-2xl border border-[#3F4147] overflow-hidden shadow-xl">
              <table className="w-full text-sm">
                <thead className="bg-[#2B2D31] border-b border-[#3F4147]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/60 uppercase">
                      Device ID (MAC)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/60 uppercase">
                      Ostatnio
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#E0E0E0]/60 uppercase">
                      Zapytania
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/60 uppercase">
                      Firmware
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/60 uppercase">
                      Licencja
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/60 uppercase">
                      IP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#E0E0E0]/60 uppercase">
                      Pierwsze użycie
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.devices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-[#E0E0E0]/40"
                      >
                        Żadne urządzenie się jeszcze nie kontaktowało
                      </td>
                    </tr>
                  ) : (
                    data.devices.map((d) => {
                      const isActive =
                        Date.now() - new Date(d.lastSeen).getTime() <
                        5 * 60 * 1000;
                      return (
                        <tr
                          key={d.id}
                          className="border-t border-[#3F4147] hover:bg-[#3F4147]/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-[#E0E0E0]">
                            {d.deviceId}
                          </td>
                          <td className="px-4 py-3 text-[#E0E0E0]/80">
                            {isActive && (
                              <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                            )}
                            {timeAgo(d.lastSeen)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#3B82F6]">
                            {d.requestCount}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#E0E0E0]/80">
                            {d.firmwareVersion || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#E0E0E0]/60">
                            {d.licenseCode || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#E0E0E0]/60">
                            {d.lastIp || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#E0E0E0]/40">
                            {formatDate(d.firstSeen)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-xs text-[#E0E0E0]/40">
              Auto-odświeżanie co 30 s. Aktywne = zapytanie w ostatnich 5 min.
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
