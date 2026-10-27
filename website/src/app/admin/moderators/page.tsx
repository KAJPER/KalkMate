"use client";

import { useState, useEffect, useCallback } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { ADMIN_SECTIONS } from "@/lib/admin-permissions";

// Moderatorzy panelu (tylko wlasciciel) — konta z dostepem do wybranych
// sekcji, logowanie loginem + kodem z wlasnego Authenticatora.
// API: /api/admin/moderators, /api/admin/moderators/[id].

interface Moderator { id: string; username: string; permissions: string[]; createdAt: string; lastLoginAt: string | null }
interface TotpSetup { secret: string; otpauth: string; qr: string }

const card = "bg-[#313338] rounded-xl border border-[#3F4147] p-4 sm:p-5";
const btn = "px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50";
const input = "w-full px-3 py-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]";

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : "nigdy";
}

function SectionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
      {ADMIN_SECTIONS.map((s) => (
        <label key={s.key} className="flex items-center gap-2 text-sm text-[#E0E0E0]/80 rounded-md px-2 py-1.5 bg-[#2B2D31] border border-[#3F4147] cursor-pointer">
          <input type="checkbox" checked={value.includes(s.key)} onChange={() => toggle(s.key)} />
          {s.label}
        </label>
      ))}
    </div>
  );
}

function TotpBox({ username, setup, onClose }: { username: string; setup: TotpSetup; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-[#D8FF3D]/40 bg-[#D8FF3D]/5 p-4 flex flex-col sm:flex-row gap-4 items-start">
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL z serwera */}
      <img src={setup.qr} alt={`Kod QR Authenticatora dla ${username}`} width={180} height={180} className="rounded-lg bg-white p-1 shrink-0" />
      <div className="text-sm text-[#E0E0E0]/80 space-y-2 min-w-0">
        <p className="font-semibold text-[#E0E0E0]">Kod do Authenticatora dla „{username}”</p>
        <p>Zeskanuj QR w Google Authenticator / Authy / 1Password na telefonie moderatora. Logowanie: login <strong>{username}</strong> + 6-cyfrowy kod z aplikacji.</p>
        <p className="text-xs text-[#E0E0E0]/50">Nie da się zeskanować? Wpisz klucz ręcznie:</p>
        <code className="block text-xs break-all bg-[#2B2D31] rounded px-2 py-1 select-all">{setup.secret}</code>
        <p className="text-xs text-amber-300/80">Ten kod pokazuje się tylko teraz. Jeśli go zgubisz, użyj „Nowy kod 2FA”.</p>
        <button type="button" onClick={onClose} className={`${btn} bg-[#3F4147] text-[#E0E0E0]`}>Gotowe, zeskanowane</button>
      </div>
    </div>
  );
}

async function fetchModerators(): Promise<Moderator[]> {
  const res = await fetch("/api/admin/moderators");
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.moderators;
}

export default function ModeratorsPage() {
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [newName, setNewName] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // QR do pokazania (po utworzeniu albo resecie) — klucz: id moderatora.
  const [setup, setSetup] = useState<{ id: string; username: string; totp: TotpSetup } | null>(null);
  const [editing, setEditing] = useState<{ id: string; perms: string[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchModerators()
        .then(setModerators)
        .catch((e: Error) => setMsg({ ok: false, text: e.message }))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetchModerators()
      .then((list) => { if (!cancelled) setModerators(list); })
      .catch((e: Error) => { if (!cancelled) setMsg({ ok: false, text: e.message }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const call = async (url: string, init: RequestInit) => {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!res.ok || !data.ok) throw new Error(data.error || "Błąd");
    return data;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    try {
      const data = await call("/api/admin/moderators", { method: "POST", body: JSON.stringify({ username: newName, permissions: newPerms }) });
      setSetup({ id: data.moderator.id, username: data.moderator.username, totp: data.totp });
      setNewName("");
      setNewPerms([]);
      await load();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const savePerms = async (id: string, perms: string[]) => {
    setBusyId(id);
    setMsg(null);
    try {
      await call(`/api/admin/moderators/${id}`, { method: "PATCH", body: JSON.stringify({ permissions: perms }) });
      setEditing(null);
      setMsg({ ok: true, text: "Zapisano — zmiana działa od razu." });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const reset2fa = async (m: Moderator) => {
    if (!confirm(`Wygenerować nowy kod 2FA dla „${m.username}”? Stary kod przestanie działać, a moderator zostanie wylogowany.`)) return;
    setBusyId(m.id);
    setMsg(null);
    try {
      const data = await call(`/api/admin/moderators/${m.id}`, { method: "POST", body: JSON.stringify({ action: "reset2fa" }) });
      setSetup({ id: m.id, username: m.username, totp: data.totp });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: Moderator) => {
    if (!confirm(`Usunąć moderatora „${m.username}”? Zostanie od razu wylogowany.`)) return;
    setBusyId(m.id);
    setMsg(null);
    try {
      await call(`/api/admin/moderators/${m.id}`, { method: "DELETE" });
      if (setup?.id === m.id) setSetup(null);
      await load();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const labelOf = (key: string) => ADMIN_SECTIONS.find((s) => s.key === key)?.label ?? key;

  return (
    <AdminShell>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Moderatorzy</h1>
        <p className="text-sm text-[#E0E0E0]/60">
          Konta z dostępem tylko do wybranych sekcji panelu. Każdy moderator loguje się swoim loginem i kodem z własnego Authenticatora.
          Zarządzać nimi możesz tylko Ty.
        </p>
      </div>

      <div className="space-y-4 max-w-4xl">
        {setup && <TotpBox username={setup.username} setup={setup.totp} onClose={() => setSetup(null)} />}

        <form onSubmit={create} className={`${card} space-y-3`}>
          <h2 className="text-lg font-semibold text-[#E0E0E0]">Nowy moderator</h2>
          <div className="max-w-xs">
            <label className="block text-xs text-[#E0E0E0]/60 mb-1">Login (małe litery, cyfry, . _ -)</label>
            <input
              className={input}
              value={newName}
              onChange={(e) => setNewName(e.target.value.toLowerCase())}
              placeholder="np. ania"
              maxLength={32}
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
          <div>
            <p className="text-xs text-[#E0E0E0]/60 mb-1.5">Dostęp do:</p>
            <SectionPicker value={newPerms} onChange={setNewPerms} />
          </div>
          <button type="submit" disabled={creating || !newName.trim() || !newPerms.length} className={`${btn} bg-[#3B82F6] hover:bg-[#2f6fd6] text-white`}>
            {creating ? "Tworzę…" : "Utwórz i pokaż kod 2FA"}
          </button>
        </form>

        {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>}

        <div className={card}>
          <h2 className="text-lg font-semibold text-[#E0E0E0] mb-3">Konta</h2>
          {loading ? (
            <p className="text-sm text-[#E0E0E0]/40">Ładowanie…</p>
          ) : !moderators.length ? (
            <p className="text-sm text-[#E0E0E0]/40">Brak moderatorów.</p>
          ) : (
            <ul className="divide-y divide-[#3F4147]">
              {moderators.map((m) => (
                <li key={m.id} className="py-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#E0E0E0]">{m.username}</span>
                    <span className="text-xs text-[#E0E0E0]/40">ostatnie logowanie: {fmtDate(m.lastLoginAt)}</span>
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      <button type="button" disabled={busyId === m.id} onClick={() => setEditing(editing?.id === m.id ? null : { id: m.id, perms: m.permissions })} className={`${btn} bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80`}>
                        {editing?.id === m.id ? "Anuluj" : "Zmień dostęp"}
                      </button>
                      <button type="button" disabled={busyId === m.id} onClick={() => reset2fa(m)} className={`${btn} bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80`}>
                        Nowy kod 2FA
                      </button>
                      <button type="button" disabled={busyId === m.id} onClick={() => remove(m)} className={`${btn} bg-red-500/10 border border-red-500/30 text-red-300`}>
                        Usuń
                      </button>
                    </div>
                  </div>
                  {editing?.id === m.id ? (
                    <div className="space-y-2">
                      <SectionPicker value={editing.perms} onChange={(perms) => setEditing({ id: m.id, perms })} />
                      <button type="button" disabled={busyId === m.id || !editing.perms.length} onClick={() => savePerms(m.id, editing.perms)} className={`${btn} bg-[#3B82F6] text-white`}>
                        Zapisz dostęp
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {m.permissions.map((p) => (
                        <span key={p} className="text-[11px] px-1.5 py-0.5 rounded bg-[#3B82F6]/15 text-[#93C5FD]">{labelOf(p)}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
