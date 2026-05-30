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
  userId: string | null;
  User: { id: string; email: string; name: string | null } | null;
}

interface DeviceData {
  ok: boolean;
  stats: {
    totalDevices: number;
    totalRequests: number;
    activeNow: number;
    pairedCount: number;
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
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "paired" | "unpaired">("all");

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

  const unpairDevice = async (deviceId: string) => {
    if (!confirm(`Odepnac urzadzenie ${deviceId}?\n\nWyzeruje userId i licenseCode. Kalkulator pozostanie w bazie i bedzie mogl byc sparowany ponownie.`)) return;
    setActionBusy(deviceId);
    try {
      const r = await fetch(`/api/admin/devices?deviceId=${encodeURIComponent(deviceId)}`, {
        method: "PATCH",
      });
      const j = await r.json();
      if (!j.ok) {
        alert(j.error || "Blad odpinania");
      } else {
        await load();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Blad sieci");
    } finally {
      setActionBusy(null);
    }
  };

  const deleteDevice = async (deviceId: string) => {
    if (!confirm(`USUNAC urzadzenie ${deviceId} z bazy?\n\nUWAGA: Skasuje rowniez calA historie rozwiazan (DeviceSolve). Tej akcji nie da sie cofnac.`)) return;
    if (!confirm(`Na pewno? Wpisz potwierdzenie w nastepnym oknie.`)) return;
    const typed = prompt(`Aby potwierdzic, wpisz dokladnie: ${deviceId}`);
    if (typed?.trim().toUpperCase() !== deviceId.toUpperCase()) {
      alert("Anulowano — wpisany tekst sie nie zgadza.");
      return;
    }
    setActionBusy(deviceId);
    try {
      const r = await fetch(`/api/admin/devices?deviceId=${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!j.ok) {
        alert(j.error || "Blad usuwania");
      } else {
        await load();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Blad sieci");
    } finally {
      setActionBusy(null);
    }
  };

  const filteredDevices = data?.devices.filter((d) => {
    if (filter === "paired") return !!d.userId;
    if (filter === "unpaired") return !d.userId;
    return true;
  }) || [];

  return (
    <AdminShell>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">
              Urządzenia ESP32
            </h1>
            <p className="text-sm text-[#E0E0E0]/60">
              Zarządzanie kalkulatorami zarejestrowanymi na serwerze
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
            <div className="grid grid-cols-4 gap-4 mb-6">
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
                  Sparowane
                </p>
                <p className="text-3xl font-bold text-amber-400">
                  {data.stats.pairedCount}
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

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === "all"
                    ? "bg-[#3B82F6] text-white"
                    : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
                }`}
              >
                Wszystkie ({data.stats.totalDevices})
              </button>
              <button
                onClick={() => setFilter("paired")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === "paired"
                    ? "bg-amber-500 text-white"
                    : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
                }`}
              >
                Sparowane ({data.stats.pairedCount})
              </button>
              <button
                onClick={() => setFilter("unpaired")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === "unpaired"
                    ? "bg-purple-500 text-white"
                    : "bg-[#2B2D31] text-[#E0E0E0]/60 hover:bg-[#313338]"
                }`}
              >
                Wolne ({data.stats.totalDevices - data.stats.pairedCount})
              </button>
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
                      Sparowany z
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
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#E0E0E0]/60 uppercase">
                      Akcje
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center py-8 text-[#E0E0E0]/40"
                      >
                        {data.devices.length === 0
                          ? "Żadne urządzenie się jeszcze nie kontaktowało"
                          : "Brak urządzeń w tej kategorii"}
                      </td>
                    </tr>
                  ) : (
                    filteredDevices.map((d) => {
                      const isActive =
                        Date.now() - new Date(d.lastSeen).getTime() <
                        5 * 60 * 1000;
                      const busy = actionBusy === d.deviceId;
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
                          <td className="px-4 py-3 text-xs">
                            {d.User ? (
                              <div className="flex flex-col">
                                <span className="text-amber-400 font-medium">
                                  {d.User.email}
                                </span>
                                {d.User.name && (
                                  <span className="text-[#E0E0E0]/40 text-[10px]">
                                    {d.User.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#E0E0E0]/40">— wolne —</span>
                            )}
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
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {(d.userId || d.licenseCode) && (
                                <button
                                  onClick={() => unpairDevice(d.deviceId)}
                                  disabled={busy}
                                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Wyzeruj userId + licenseCode (rekord zostaje)"
                                >
                                  Odepnij
                                </button>
                              )}
                              <button
                                onClick={() => deleteDevice(d.deviceId)}
                                disabled={busy}
                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Usun rekord z bazy (kaskadowo DeviceSolve)"
                              >
                                {busy ? "…" : "Usuń"}
                              </button>
                            </div>
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
              <br />
              <span className="text-amber-400">Odepnij</span> — czyści powiązanie z kontem, rekord urządzenia zostaje.
              <br />
              <span className="text-red-400">Usuń</span> — kasuje rekord wraz z historią rozwiązań (nieodwracalne).
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
