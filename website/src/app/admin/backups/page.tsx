"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";

interface Backup { name: string; size: number; createdAt: string }
interface Status { dir: string; keepDays: number; offsite: string | null; lastAt: string | null; backups: Backup[] }

function fmtSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function ago(iso: string) {
  const h = (Date.now() - Date.parse(iso)) / 3600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min temu`;
  if (h < 48) return `${Math.round(h)} h temu`;
  return `${Math.round(h / 24)} dni temu`;
}

export default function BackupsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backups");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Błąd");
      setStatus(data);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const backupNow = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Błąd");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stale = status && (!status.lastAt || Date.now() - Date.parse(status.lastAt) > 30 * 3600_000);
  const card = "bg-[#313338] rounded-2xl border border-[#3F4147] p-4 sm:p-5";

  return (
    <AdminShell>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Kopie bazy</h1>
          <p className="text-sm text-[#E0E0E0]/60">Automatycznie raz na dobę (z godzinnego crona). Zamówienia, konta, licencje — wszystko w jednym pliku.</p>
        </div>
        <button
          onClick={backupNow}
          disabled={busy}
          className="px-4 py-2.5 rounded-lg text-sm font-medium bg-[#3B82F6] hover:bg-[#2f6fd6] text-white disabled:opacity-50"
        >
          {busy ? "Robię kopię…" : "💾 Zrób kopię teraz"}
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {err && <p className="text-sm text-red-400">{err}</p>}
        {status && (
          <div className={`${card} grid gap-3 sm:grid-cols-3`}>
            <div>
              <p className="text-xs text-[#E0E0E0]/50">Ostatnia kopia</p>
              <p className={`text-lg font-semibold ${stale ? "text-red-400" : "text-green-400"}`}>
                {status.lastAt ? ago(status.lastAt) : "brak"}
              </p>
              {stale && <p className="text-[11px] text-red-300/80">Ponad dobę bez kopii — sprawdź, czy cron działa.</p>}
            </div>
            <div>
              <p className="text-xs text-[#E0E0E0]/50">Przechowywanie</p>
              <p className="text-lg font-semibold text-[#E0E0E0]">{status.keepDays} dni</p>
              <p className="text-[11px] text-[#E0E0E0]/40 break-all">{status.dir}</p>
            </div>
            <div>
              <p className="text-xs text-[#E0E0E0]/50">Kopia poza serwerem</p>
              {status.offsite ? (
                <p className="text-lg font-semibold text-green-400 break-all">{status.offsite}</p>
              ) : (
                <>
                  <p className="text-lg font-semibold text-amber-300">wyłączona</p>
                  <p className="text-[11px] text-[#E0E0E0]/50">Kopie leżą na tym samym dysku co baza. Pobieraj je co jakiś czas albo ustaw BACKUP_RCLONE_REMOTE.</p>
                </>
              )}
            </div>
          </div>
        )}

        <div className={card}>
          <h2 className="text-lg font-semibold text-[#E0E0E0] mb-3">Kopie ({status?.backups.length ?? 0})</h2>
          {!status ? (
            <p className="text-sm text-[#E0E0E0]/50">Ładowanie…</p>
          ) : !status.backups.length ? (
            <p className="text-sm text-[#E0E0E0]/40">Jeszcze nie ma żadnej kopii — kliknij „Zrób kopię teraz”.</p>
          ) : (
            <div className="divide-y divide-[#3F4147]/60">
              {status.backups.map((b) => (
                <div key={b.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-[#E0E0E0] break-all">{b.name}</p>
                    <p className="text-[11px] text-[#E0E0E0]/40">{new Date(b.createdAt).toLocaleString("pl-PL")} · {fmtSize(b.size)}</p>
                  </div>
                  <a
                    href={`/api/admin/backups/${encodeURIComponent(b.name)}`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] border border-[#3F4147] text-[#3B82F6] hover:bg-[#3F4147]"
                  >
                    ⬇ Pobierz
                  </a>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-[#E0E0E0]/40 mt-3 leading-relaxed">
            Przywracanie: zatrzymaj aplikację, rozpakuj plik (<code>gunzip</code>) i podmień nim plik bazy z DATABASE_URL, potem uruchom aplikację.
          </p>
        </div>
      </motion.div>
    </AdminShell>
  );
}
