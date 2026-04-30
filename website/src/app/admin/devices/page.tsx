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
    const interval = setInterval(load, 30000); // odśwież co 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <AdminShell>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Urządzenia ESP32</h1>

        {loading && <div>Ładowanie...</div>}
        {error && <div className="text-red-500">Błąd: {error}</div>}

        {data && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Wszystkie urządzenia</div>
                <div className="text-3xl font-bold">{data.stats.totalDevices}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Aktywne teraz (5 min)</div>
                <div className="text-3xl font-bold text-green-600">
                  {data.stats.activeNow}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Łączna liczba zapytań</div>
                <div className="text-3xl font-bold">{data.stats.totalRequests}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Device ID (MAC)</th>
                    <th className="px-4 py-3 text-left">Ostatnio</th>
                    <th className="px-4 py-3 text-right">Zapytania</th>
                    <th className="px-4 py-3 text-left">Firmware</th>
                    <th className="px-4 py-3 text-left">Licencja</th>
                    <th className="px-4 py-3 text-left">IP</th>
                    <th className="px-4 py-3 text-left">Pierwsze użycie</th>
                  </tr>
                </thead>
                <tbody>
                  {data.devices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        Żadne urządzenie się jeszcze nie kontaktowało
                      </td>
                    </tr>
                  ) : (
                    data.devices.map((d) => {
                      const isActive =
                        Date.now() - new Date(d.lastSeen).getTime() < 5 * 60 * 1000;
                      return (
                        <tr key={d.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono">{d.deviceId}</td>
                          <td className="px-4 py-3">
                            {isActive && (
                              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            )}
                            {timeAgo(d.lastSeen)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            {d.requestCount}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {d.firmwareVersion || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {d.licenseCode || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {d.lastIp || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {formatDate(d.firstSeen)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              Auto-odświeżanie co 30 s. Aktywne = zapytanie w ostatnich 5 min.
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
