"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import StatCard from "@/components/admin/StatCard";
import { toast, toastError } from "@/components/admin/toast";
import { usePolling } from "@/components/admin/usePolling";
import { fmtDateTime } from "@/components/admin/format";

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
  rentalUntil: string | null;
  rentalLocked: boolean;
  // Nowsze API: czy urzadzenie ma zapisany token (bez jego wartosci).
  hasToken?: boolean;
  // Aktywna blokada parowania (za duzo blednych kodow odblokowania).
  pairLockedUntil?: string | null;
}

interface DeviceLogEntry {
  id: number;
  deviceId: string;
  deviceTs: number | null;
  receivedAt: number;
  tag: string;
  message: string;
}

interface DeviceData {
  ok: boolean;
  q?: string;
  stats: {
    totalDevices: number;
    totalRequests: number;
    activeNow: number;
    active24h?: number;
    pairedCount: number;
    withTokenCount?: number;
    rentalCount?: number;
  };
  devices: Device[];
}

type Filter = "all" | "paired" | "unpaired" | "token" | "rental";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "paired", label: "Sparowane" },
  { id: "unpaired", label: "Niesparowane" },
  { id: "token", label: "Z tokenem" },
  { id: "rental", label: "Najem" },
];
const isFilter = (v: string | null): v is Filter => FILTERS.some((f) => f.id === v);

const ACTIVE_MS = 5 * 60 * 1000;
// Numer ostatniego zapytania listy — odpowiedz starszego (np. sprzed zmiany
// wyszukiwania) jest ignorowana. Poza komponentem: strona ma jedna instancje.
let loadSeq = 0;
const tsOf = (s: string) => new Date(s).getTime();

function timeAgo(s: string, now: number) {
  const t = tsOf(s);
  if (isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 45) return "przed chwilą";
  const min = Math.floor(sec / 60);
  if (min < 1) return "1 min temu";
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  if (d === 1) return "wczoraj";
  if (d < 30) return `${d} dni temu`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mies. temu`;
  return `${Math.floor(d / 365)} l. temu`;
}

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const m10 = n % 10, m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const hasRental = (d: Device) => !!d.rentalUntil || d.rentalLocked;
const rentalExpired = (d: Device, now: number) => !!d.rentalUntil && tsOf(d.rentalUntil) < now;

async function copyText(text: string, label: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast(`Skopiowano ${label}`, "info");
  } catch {
    toast("Nie udało się skopiować", "error");
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        copyText(text, label);
      }}
      title={`Kopiuj ${label}`}
      aria-label={`Kopiuj ${label}`}
      className="flex-shrink-0 p-1 rounded text-[#E0E0E0]/30 hover:text-[#E0E0E0] hover:bg-[#3F4147] transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 012-2h10" />
      </svg>
    </button>
  );
}

function Badge({ tone, children, title }: { tone: "blue" | "green" | "amber" | "red" | "purple" | "slate"; children: React.ReactNode; title?: string }) {
  const map = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    green: "bg-green-500/10 border-green-500/30 text-green-300",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    red: "bg-red-500/10 border-red-500/30 text-red-300",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-300",
    slate: "bg-[#2B2D31] border-[#3F4147] text-[#E0E0E0]/50",
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${map[tone]}`}>
      {children}
    </span>
  );
}

function Flags({ d, now }: { d: Device; now: number }) {
  const expired = rentalExpired(d, now);
  const pairLocked = !!d.pairLockedUntil && tsOf(d.pairLockedUntil) > now;
  const items: React.ReactNode[] = [];
  if (d.hasToken) items.push(<Badge key="t" tone="purple" title="Urządzenie ma zapisany token (wartość nie jest pokazywana)">Token</Badge>);
  if (d.rentalLocked) items.push(<Badge key="l" tone="red" title="Ręczna blokada AI">Zablokowane AI</Badge>);
  else if (expired) items.push(<Badge key="e" tone="red" title={`Najem wygasł ${fmtDateTime(d.rentalUntil as string)}`}>Najem wygasł</Badge>);
  else if (d.rentalUntil) items.push(<Badge key="r" tone="amber" title={`Koniec najmu: ${fmtDateTime(d.rentalUntil)}`}>Najem do {fmtDateTime(d.rentalUntil).slice(0, 10)}</Badge>);
  if (pairLocked) items.push(<Badge key="p" tone="red" title={`Za dużo błędnych kodów parowania — blokada do ${fmtDateTime(d.pairLockedUntil as string)}`}>Blokada parowania</Badge>);
  if (!items.length) return <span className="text-[#E0E0E0]/25 text-xs">—</span>;
  return <div className="flex flex-wrap gap-1">{items}</div>;
}

interface MenuItem {
  label: string;
  hint?: string;
  tone?: "default" | "danger" | "warn" | "ok";
  onClick: () => void;
}

// Menu akcji renderowane jako position:fixed — tabela ma overflow-hidden,
// wiec zwykly dropdown absolute bylby przyciety.
function ActionsMenu({ items, disabled }: { items: MenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 280;
    setPos({ top: up ? r.top : r.bottom, right: window.innerWidth - r.right, up });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toneCls = {
    default: "text-[#E0E0E0]",
    danger: "text-red-400",
    warn: "text-amber-400",
    ok: "text-green-400",
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Więcej akcji"
        className="px-2 py-1.5 rounded-lg bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/70 hover:text-[#E0E0E0] hover:bg-[#3F4147] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && pos && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", right: pos.right, ...(pos.up ? { bottom: window.innerHeight - pos.top + 6 } : { top: pos.top + 6 }) }}
          className="z-[60] w-64 rounded-lg border border-[#3F4147] bg-[#1E1F22] shadow-2xl py-1"
        >
          {items.map((it, i) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`w-full text-left px-3 py-2 hover:bg-[#313338] transition-colors ${
                it.tone === "danger" && i > 0 ? "border-t border-[#3F4147] mt-1 pt-2.5" : ""
              }`}
            >
              <span className={`block text-sm ${toneCls[it.tone || "default"]}`}>{it.label}</span>
              {it.hint && <span className="block text-[11px] text-[#E0E0E0]/40 leading-snug">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function LastSeen({ d, now }: { d: Device; now: number }) {
  const active = now - tsOf(d.lastSeen) < ACTIVE_MS;
  return (
    <span className="inline-flex items-center gap-2" title={`Ostatnio: ${fmtDateTime(d.lastSeen, { seconds: true })}\nPierwsze użycie: ${fmtDateTime(d.firstSeen)}`}>
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
          active ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-[#E0E0E0]/15"
        }`}
      />
      <span className={active ? "text-green-300" : "text-[#E0E0E0]/80"}>{timeAgo(d.lastSeen, now)}</span>
    </span>
  );
}

function Account({ d }: { d: Device }) {
  return d.userId ? (
    <div className="min-w-0">
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-amber-400 font-medium truncate" title={d.User?.name || undefined}>
          {d.User?.email || "— konto usunięte —"}
        </span>
        {d.User?.email && <CopyButton text={d.User.email} label="e-mail" />}
      </div>
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-mono text-[11px] text-[#E0E0E0]/40 truncate">{d.userId}</span>
        <CopyButton text={d.userId} label="ID konta" />
      </div>
      {d.licenseCode && (
        <div className="font-mono text-[11px] text-[#E0E0E0]/30 truncate" title="Kod licencji">
          lic. {d.licenseCode}
        </div>
      )}
    </div>
  ) : (
    <div>
      <span className="text-[#E0E0E0]/35 text-xs">— niesparowane —</span>
      {d.licenseCode && (
        <div className="font-mono text-[11px] text-[#E0E0E0]/30 truncate" title="Kod licencji">
          lic. {d.licenseCode}
        </div>
      )}
    </div>
  );
}

function DevicesInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const initialF = searchParams.get("f");

  const [data, setData] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(isFilter(initialF) ? initialF : "all");
  const [search, setSearch] = useState(initialQ);
  const [q, setQ] = useState(initialQ.trim().slice(0, 100));
  const [logsDeviceId, setLogsDeviceId] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsData, setLogsData] = useState<DeviceLogEntry[] | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Debounce 250 ms: wpisywanie -> q (zapytanie do serwera).
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim().slice(0, 100)), 250);
    return () => clearTimeout(t);
  }, [search]);

  // q + filtr w URL (?q=&f=) — przezywa odswiezenie, mozna wkleic link.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    if (filter !== "all") url.searchParams.set("f", filter);
    else url.searchParams.delete("f");
    if (url.toString() !== window.location.href) window.history.replaceState(window.history.state, "", url.toString());
  }, [q, filter]);

  // Skrot "/" = fokus na wyszukiwarce.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === "/" && !(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const openLogs = async (deviceId: string) => {
    setLogsDeviceId(deviceId);
    setLogsData(null);
    setLogsLoading(true);
    try {
      const r = await fetch(`/api/admin/devices/${encodeURIComponent(deviceId)}/logs`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        toast(j.error || `Błąd pobierania logów (HTTP ${r.status})`, "error");
        setLogsDeviceId(null);
      } else {
        setLogsData(j.logs);
      }
    } catch (e) {
      toastError(e);
      setLogsDeviceId(null);
    } finally {
      setLogsLoading(false);
    }
  };

  const load = async () => {
    const seq = ++loadSeq;
    const query = q;
    setRefreshing(true);
    try {
      const url = query ? `/api/admin/devices?q=${encodeURIComponent(query)}` : "/api/admin/devices";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (seq !== loadSeq) return; // nowsze zapytanie w toku
      setData(json);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      if (seq !== loadSeq) return;
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      if (seq === loadSeq) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Pierwsze pobranie + ponowne przy zmianie q.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  // Co 30 s, wstrzymane gdy karta jest w tle (document.hidden).
  usePolling(load, 30000);

  // Starsze API zwracalo surowy rekord (z deviceToken) i NIE zna akcji
  // reset_token — kazdy PATCH bez action=rental odpinal tam urzadzenie.
  // Przycisk pokazujemy tylko dla nowego API (bez deviceToken w odpowiedzi).
  const resetTokenSupported = !!data && !data.devices.some((d) => "deviceToken" in d);

  const resetToken = async (deviceId: string) => {
    if (!resetTokenSupported) return;
    if (!confirm(`Unieważnić token urządzenia ${deviceId}?\n\nUrządzenie dostanie nowy token przy następnej rejestracji. Do tego czasu stary token przestaje działać (np. gdy wyciekł albo urządzenie zmieniło właściciela).`)) return;
    setActionBusy(deviceId);
    try {
      const r = await fetch(`/api/admin/devices?deviceId=${encodeURIComponent(deviceId)}&action=reset_token`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_token" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        toast(j.error || `Błąd resetu tokenu (HTTP ${r.status})`, "error");
      } else if (j.action === "unpaired") {
        // Nie powinno sie zdarzyc (patrz resetTokenSupported), ale gdyby — powiedz wprost.
        toast("Serwer nie zna resetu tokenu i ODPIĄŁ urządzenie — sprawdź powiązanie.", "error");
        await load();
      } else {
        toast("Token unieważniony — urządzenie dostanie nowy przy następnej rejestracji");
        await load();
      }
    } catch (e) {
      toastError(e);
    } finally {
      setActionBusy(null);
    }
  };

  const unpairDevice = async (deviceId: string) => {
    if (!confirm(`Odpiąć urządzenie ${deviceId}?\n\nWyzeruje userId i licenseCode. Kalkulator pozostanie w bazie i będzie mógł być sparowany ponownie.`)) return;
    setActionBusy(deviceId);
    try {
      const r = await fetch(`/api/admin/devices?deviceId=${encodeURIComponent(deviceId)}`, {
        method: "PATCH",
      });
      const j = await r.json();
      if (!j.ok) {
        toast(j.error || "Błąd odpinania", "error");
      } else {
        toast(`Odpięto ${deviceId}`);
        await load();
      }
    } catch (e) {
      toastError(e);
    } finally {
      setActionBusy(null);
    }
  };

  const setRental = async (deviceId: string, current: Device) => {
    const input = prompt(
      `Ustaw koniec najmu dla ${deviceId} (format RRRR-MM-DD, np. 2027-05-15).\n\nZostaw puste i zatwierdź, żeby wyczyścić datę (bez limitu czasowego).`,
      current.rentalUntil ? current.rentalUntil.slice(0, 10) : ""
    );
    if (input === null) return; // anulowano
    let rentalUntil: string | null = null;
    if (input.trim()) {
      const d = new Date(input.trim() + "T23:59:59");
      if (isNaN(d.getTime())) {
        toast("Nieprawidłowy format daty. Użyj RRRR-MM-DD.", "error");
        return;
      }
      rentalUntil = d.toISOString();
    }
    setActionBusy(deviceId);
    try {
      const r = await fetch(
        `/api/admin/devices?deviceId=${encodeURIComponent(deviceId)}&action=rental`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rentalUntil, rentalLocked: current.rentalLocked }),
        }
      );
      const j = await r.json();
      if (!j.ok) {
        toast(j.error || "Błąd ustawiania najmu", "error");
      } else {
        await load();
      }
    } catch (e) {
      toastError(e);
    } finally {
      setActionBusy(null);
    }
  };

  const toggleRentalLock = async (deviceId: string, current: Device) => {
    const next = !current.rentalLocked;
    if (
      next &&
      !confirm(
        `Zablokować ${deviceId} NATYCHMIAST?\n\nUrządzenie straci dostęp do AI (zostanie zwykłym kalkulatorem) do czasu ręcznego odblokowania.`
      )
    )
      return;
    setActionBusy(deviceId);
    try {
      const r = await fetch(
        `/api/admin/devices?deviceId=${encodeURIComponent(deviceId)}&action=rental`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rentalUntil: current.rentalUntil, rentalLocked: next }),
        }
      );
      const j = await r.json();
      if (!j.ok) {
        toast(j.error || "Błąd blokady", "error");
      } else {
        await load();
      }
    } catch (e) {
      toastError(e);
    } finally {
      setActionBusy(null);
    }
  };

  const deleteDevice = async (deviceId: string) => {
    if (!confirm(`USUNĄĆ urządzenie ${deviceId} z bazy?\n\nUWAGA: Skasuje również całą historię rozwiązań (DeviceSolve). Tej akcji nie da się cofnąć.`)) return;
    if (!confirm(`Na pewno? Wpisz potwierdzenie w następnym oknie.`)) return;
    const typed = prompt(`Aby potwierdzić, wpisz dokładnie: ${deviceId}`);
    if (typed?.trim().toUpperCase() !== deviceId.toUpperCase()) {
      toast("Anulowano — wpisany tekst się nie zgadza.", "info");
      return;
    }
    setActionBusy(deviceId);
    try {
      const r = await fetch(`/api/admin/devices?deviceId=${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!j.ok) {
        toast(j.error || "Błąd usuwania", "error");
      } else {
        toast(`Usunięto ${deviceId}`);
        await load();
      }
    } catch (e) {
      toastError(e);
    } finally {
      setActionBusy(null);
    }
  };

  const devices = useMemo(() => data?.devices ?? [], [data]);
  // Liczniki chipow — w obrebie aktualnego wyszukiwania.
  const counts = useMemo<Record<Filter, number>>(
    () => ({
      all: devices.length,
      paired: devices.filter((d) => !!d.userId).length,
      unpaired: devices.filter((d) => !d.userId).length,
      token: devices.filter((d) => !!d.hasToken).length,
      rental: devices.filter(hasRental).length,
    }),
    [devices]
  );
  // "Z tokenem" tylko gdy API zwraca hasToken (nowsze API).
  const visibleFilters = FILTERS.filter((f) => f.id !== "token" || devices.some((d) => d.hasToken !== undefined) || filter === "token");

  const filteredDevices = devices.filter((d) => {
    if (filter === "paired") return !!d.userId;
    if (filter === "unpaired") return !d.userId;
    if (filter === "token") return !!d.hasToken;
    if (filter === "rental") return hasRental(d);
    return true;
  });

  const actionsFor = (d: Device): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: d.rentalUntil ? "Zmień datę najmu" : "Ustaw najem",
        hint: "Po tej dacie urządzenie traci dostęp do AI",
        onClick: () => setRental(d.deviceId, d),
      },
      d.rentalLocked
        ? { label: "Odblokuj AI", hint: "Zdejmij ręczną blokadę", tone: "ok", onClick: () => toggleRentalLock(d.deviceId, d) }
        : { label: "Zablokuj AI teraz", hint: "Natychmiastowa ręczna blokada (np. kradzież)", tone: "warn", onClick: () => toggleRentalLock(d.deviceId, d) },
    ];
    if (resetTokenSupported && d.hasToken !== false) {
      items.push({
        label: "Reset tokenu",
        hint: "Nowy token przy następnej rejestracji",
        onClick: () => resetToken(d.deviceId),
      });
    }
    if (d.userId || d.licenseCode) {
      items.push({
        label: "Odepnij od konta",
        hint: "Czyści userId + licenseCode, rekord zostaje",
        tone: "warn",
        onClick: () => unpairDevice(d.deviceId),
      });
    }
    items.push({
      label: "Usuń z bazy",
      hint: "Razem z historią rozwiązań — nieodwracalne",
      tone: "danger",
      onClick: () => deleteDevice(d.deviceId),
    });
    return items;
  };

  // "Teraz" dla czasow wzglednych = moment ostatniego pobrania (co 30 s).
  const now = updatedAt ?? 0;
  const stats = data?.stats;
  const unpairedTotal = stats ? stats.totalDevices - stats.pairedCount : 0;
  // Wyszukiwanie w toku: debounce jeszcze nie minal albo wynik dla nowego q nie dotarl.
  const searching = search.trim().slice(0, 100) !== q || (!!data && (data.q ?? "") !== q);

  const renderRowActions = (d: Device) => {
    const busy = actionBusy === d.deviceId;
    return (
      <div className="flex justify-end items-center gap-1.5">
        {busy && <span className="text-xs text-[#E0E0E0]/40 mr-1">…</span>}
        <button
          type="button"
          onClick={() => openLogs(d.deviceId)}
          disabled={busy}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80 hover:text-[#E0E0E0] hover:bg-[#3F4147] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Ostatnie zdarzenia zgłaszane przez urządzenie (błędy WiFi/TLS, reset, awarie kamery)"
        >
          Logi
        </button>
        <ActionsMenu items={actionsFor(d)} disabled={busy} />
      </div>
    );
  };

  return (
    <>
      {/* Naglowek */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#E0E0E0]">Urządzenia</h1>
          <p className="text-sm text-[#E0E0E0]/50 mt-0.5">Kalkulatory zarejestrowane na serwerze</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-xs text-[#E0E0E0]/35" title="Auto-odświeżanie co 30 s">
              Zaktualizowano {fmtDateTime(updatedAt, { seconds: true }).split(", ")[1]}
            </span>
          )}
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[#313338] border border-[#3F4147] text-[#E0E0E0]/80 hover:text-[#E0E0E0] hover:bg-[#3F4147] transition-colors disabled:opacity-60"
          >
            <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Odśwież
          </button>
        </div>
      </div>

      {/* Statystyki — zawsze dla calej bazy */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <StatCard title="Wszystkie" value={stats.totalDevices} color="blue" />
          <StatCard
            title="Sparowane"
            value={stats.pairedCount}
            subtitle={stats.totalDevices ? `${Math.round((stats.pairedCount / stats.totalDevices) * 100)}% wszystkich` : undefined}
            color="yellow"
          />
          <StatCard title="Niesparowane" value={unpairedTotal} color="purple" />
          <StatCard
            title="Online (5 min)"
            value={stats.activeNow}
            subtitle={stats.active24h !== undefined ? `${stats.active24h} w ostatnich 24 h` : undefined}
            color="green"
          />
          <StatCard title="Zapytania łącznie" value={stats.totalRequests.toLocaleString("pl-PL")} color="cyan" />
        </div>
      )}

      {/* Wyszukiwarka + filtry */}
      <div className="mb-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative w-full lg:max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#E0E0E0]/30 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearch("");
                setQ("");
              }
            }}
            placeholder="Szukaj: Device ID (MAC), ID konta, e-mail…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Szukaj urządzeń"
            className="w-full pl-9 pr-16 py-2 rounded-lg border border-[#3F4147] bg-[#313338] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] placeholder:text-[#E0E0E0]/30 [&::-webkit-search-cancel-button]:hidden"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searching && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#3B82F6]/30 border-t-[#3B82F6] animate-spin" aria-hidden />
            )}
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setQ("");
                  searchRef.current?.focus();
                }}
                className="p-1 rounded text-[#E0E0E0]/40 hover:text-[#E0E0E0] hover:bg-[#3F4147]"
                aria-label="Wyczyść wyszukiwanie"
              >
                ✕
              </button>
            ) : (
              <kbd className="hidden sm:inline px-1.5 py-0.5 rounded border border-[#3F4147] text-[10px] text-[#E0E0E0]/30 font-mono">/</kbd>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {visibleFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.id
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#313338] border border-[#3F4147] text-[#E0E0E0]/70 hover:text-[#E0E0E0]"
              }`}
            >
              {f.label}
              {data && (
                <span className={`ml-1.5 ${filter === f.id ? "text-white/80" : "text-[#E0E0E0]/40"}`}>{counts[f.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <p className="mb-2 text-xs text-[#E0E0E0]/45">
          {q ? (
            <>
              {filteredDevices.length} {plural(filteredDevices.length, "wynik", "wyniki", "wyników")} dla „<span className="text-[#E0E0E0]/80">{q}</span>”
              {filter !== "all" && <> · filtr: {FILTERS.find((f) => f.id === filter)?.label}</>}
            </>
          ) : (
            <>
              {filteredDevices.length} {plural(filteredDevices.length, "urządzenie", "urządzenia", "urządzeń")}
              {filter !== "all" && <> · filtr: {FILTERS.find((f) => f.id === filter)?.label}</>}
            </>
          )}
        </p>
      )}

      {loading && !data && (
        <div className="bg-[#313338] rounded-lg border border-[#3F4147] p-8 text-center text-sm text-[#E0E0E0]/50">Ładowanie…</div>
      )}
      {error && (
        <div className="mb-3 text-sm text-red-300 bg-red-900/20 border border-red-800/60 rounded-lg p-3">
          Błąd: {error}
        </div>
      )}

      {data && (
        <div className={`bg-[#313338] rounded-lg border border-[#3F4147] overflow-hidden transition-opacity ${searching ? "opacity-70" : ""}`}>
          {filteredDevices.length === 0 ? (
            <div className="px-6 py-14 text-center">
              {data.stats.totalDevices === 0 ? (
                <p className="text-sm text-[#E0E0E0]/50">Żadne urządzenie się jeszcze nie kontaktowało.</p>
              ) : q && devices.length === 0 ? (
                <>
                  <p className="text-sm text-[#E0E0E0]/70">Brak wyników dla „{q}”</p>
                  <p className="mt-1 text-xs text-[#E0E0E0]/40">
                    Szukaj po Device ID (np. <span className="font-mono">AABBCC112233</span> lub <span className="font-mono">AA:BB:CC</span>), ID konta albo e-mailu.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setQ("");
                    }}
                    className="mt-4 px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80 hover:bg-[#3F4147]"
                  >
                    Wyczyść wyszukiwanie
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#E0E0E0]/60">Brak urządzeń w tej kategorii.</p>
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="mt-4 px-3 py-1.5 rounded-lg text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80 hover:bg-[#3F4147]"
                  >
                    Pokaż wszystkie
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Telefon / tablet: karty */}
              <div className="lg:hidden divide-y divide-[#3F4147]">
                {filteredDevices.map((d) => (
                  <div key={d.id} className="px-4 py-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm text-[#E0E0E0] tracking-wide">{d.deviceId}</span>
                          <CopyButton text={d.deviceId} label="Device ID" />
                        </div>
                        <div className="text-xs mt-0.5">
                          <LastSeen d={d} now={now} />
                        </div>
                      </div>
                      {renderRowActions(d)}
                    </div>
                    <div className="text-xs">
                      <Account d={d} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#E0E0E0]/50">
                      <span>
                        FW <span className="font-mono text-[#E0E0E0]/80">{d.firmwareVersion || "—"}</span>
                      </span>
                      <span>
                        IP <span className="font-mono text-[#E0E0E0]/70">{d.lastIp || "—"}</span>
                      </span>
                      <span>
                        Zapytania <span className="text-[#3B82F6] font-semibold">{d.requestCount}</span>
                      </span>
                    </div>
                    <Flags d={d} now={now} />
                  </div>
                ))}
              </div>

              {/* Desktop: tabela */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#2B2D31] border-b border-[#3F4147]">
                    <tr className="text-left text-[11px] font-semibold text-[#E0E0E0]/50 uppercase tracking-wider">
                      <th className="px-4 py-2.5">Device ID</th>
                      <th className="px-4 py-2.5">Konto</th>
                      <th className="px-4 py-2.5">Firmware</th>
                      <th className="px-4 py-2.5">Ostatnio</th>
                      <th className="px-4 py-2.5">Ostatnie IP</th>
                      <th className="px-4 py-2.5 text-right">Zapytania</th>
                      <th className="px-4 py-2.5">Flagi</th>
                      <th className="px-4 py-2.5 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3F4147]">
                    {filteredDevices.map((d) => (
                      <tr
                        key={d.id}
                        className={`hover:bg-[#3F4147]/25 transition-colors ${actionBusy === d.deviceId ? "opacity-60" : ""}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[#E0E0E0] tracking-wide">{d.deviceId}</span>
                            <CopyButton text={d.deviceId} label="Device ID" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[280px]">
                          <Account d={d} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {d.firmwareVersion ? (
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80">
                              {d.firmwareVersion}
                            </span>
                          ) : (
                            <span className="text-[#E0E0E0]/25 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <LastSeen d={d} now={now} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#E0E0E0]/60 whitespace-nowrap">{d.lastIp || "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#3B82F6] tabular-nums">{d.requestCount}</td>
                        <td className="px-4 py-3">
                          <Flags d={d} now={now} />
                        </td>
                        <td className="px-4 py-3">
                          {renderRowActions(d)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {data && (
        <details className="mt-4 text-xs text-[#E0E0E0]/45 group">
          <summary className="cursor-pointer select-none hover:text-[#E0E0E0]/70 w-fit">Co robią akcje?</summary>
          <ul className="mt-2 space-y-1 pl-1">
            <li>Auto-odświeżanie co 30 s. Online = zapytanie w ostatnich 5 min. Najedź na czas, żeby zobaczyć dokładną datę.</li>
            <li><span className="text-[#E0E0E0]/80">Logi</span> — ostatnie zdarzenia zgłoszone przez urządzenie (błędy WiFi/TLS, powód resetu, awarie kamery), dołączane do każdej automatycznej rejestracji.</li>
            <li><span className="text-blue-400">Ustaw najem</span> — data końca najmu; po niej urządzenie automatycznie traci dostęp do AI (zostaje zwykłym kalkulatorem).</li>
            <li><span className="text-amber-400">Zablokuj AI</span> / <span className="text-green-400">Odblokuj AI</span> — natychmiastowa ręczna blokada, niezależna od daty (np. brak zwrotu, zgłoszona kradzież).</li>
            <li><span className="text-purple-400">Reset tokenu</span> — unieważnia token urządzenia; urządzenie dostanie nowy przy następnej rejestracji.</li>
            <li><span className="text-amber-400">Odepnij od konta</span> — czyści powiązanie z kontem, rekord urządzenia zostaje.</li>
            <li><span className="text-red-400">Usuń z bazy</span> — kasuje rekord wraz z historią rozwiązań (nieodwracalne).</li>
          </ul>
        </details>
      )}

      {logsDeviceId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setLogsDeviceId(null)}
        >
          <div
            className="bg-[#2B2D31] border border-[#3F4147] rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#3F4147]">
              <h3 className="font-semibold text-[#E0E0E0]">
                Logi — <span className="font-mono">{logsDeviceId}</span>
              </h3>
              <button
                onClick={() => setLogsDeviceId(null)}
                className="text-[#E0E0E0]/50 hover:text-[#E0E0E0] text-xl leading-none"
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-1.5">
              {logsLoading ? (
                <p className="text-sm text-[#E0E0E0]/50">Ładowanie…</p>
              ) : !logsData || logsData.length === 0 ? (
                <p className="text-sm text-[#E0E0E0]/50">Brak zgłoszonych zdarzeń.</p>
              ) : (
                logsData.map((l) => (
                  <div key={l.id} className="text-xs font-mono flex gap-2 border-b border-[#3F4147]/50 pb-1.5">
                    <span className="text-[#E0E0E0]/40 whitespace-nowrap">{fmtDateTime(new Date(l.receivedAt).toISOString())}</span>
                    <span className="text-blue-400 whitespace-nowrap">[{l.tag}]</span>
                    <span className="text-[#E0E0E0]/80 break-words">{l.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function DevicesPage() {
  return (
    <AdminShell>
      {/* useSearchParams wymaga granicy Suspense przy buildzie (prerender). */}
      <Suspense fallback={<div className="text-sm text-[#E0E0E0]/50">Ładowanie…</div>}>
        <DevicesInner />
      </Suspense>
    </AdminShell>
  );
}
