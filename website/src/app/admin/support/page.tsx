"use client";

import { useState, useEffect, useCallback } from "react";
import AdminShell from "@/components/admin/AdminShell";

// Rozmowy klientow z asystentem AI na stronie (SupportWidget).
// API: /api/admin/support, /api/admin/support/[id]. Lista odswieza sie co 30 s.

interface ChatItem {
  id: string;
  email: string;
  lang: string;
  createdAt: string;
  lastMessageAt: string;
  firstPage: string | null;
  trackingConsent: boolean;
  userMessages: number;
  adminReadAt: string | null;
  lastMessage: string | null;
}
interface JourneyEntry { t: number; kind: "page" | "section"; path: string; section?: string }
interface ChatDetail extends Omit<ChatItem, "lastMessage"> { userAgent: string | null; journey: JourneyEntry[] }
interface Message { id: number; role: "user" | "assistant"; content: string; page: string | null; createdAt: string }

const CLARITY_URL = "https://clarity.microsoft.com/projects/view/xnarb47w07/impressions";
const card = "bg-[#313338] rounded-xl border border-[#3F4147]";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

async function fetchChats(): Promise<ChatItem[]> {
  const res = await fetch("/api/admin/support");
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.chats;
}

export default function SupportChatsPage() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ chat: ChatDetail; messages: Message[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const reload = useCallback(
    () => fetchChats().then(setChats).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const tick = () =>
      fetchChats()
        .then((list) => { if (!cancelled) setChats(list); })
        .catch((e: Error) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    tick();
    const iv = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const openChat = async (id: string) => {
    setSelected(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/support/${id}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Błąd");
      setDetail({ chat: data.chat, messages: data.messages });
      setChats((list) => list.map((c) => (c.id === id ? { ...c, adminReadAt: new Date().toISOString() } : c)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Usunąć całą rozmowę? (np. na prośbę klienta o usunięcie danych)")) return;
    const res = await fetch(`/api/admin/support/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("Nie udało się usunąć."); return; }
    setSelected(null);
    setDetail(null);
    void reload();
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? chats.filter((c) => c.email.includes(q) || (c.lastMessage || "").toLowerCase().includes(q))
    : chats;
  const unread = chats.filter((c) => !c.adminReadAt).length;

  return (
    <AdminShell>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Czat klientów</h1>
          <p className="text-sm text-[#E0E0E0]/60">
            Rozmowy z asystentem AI na stronie · {chats.length} rozmów{unread ? ` · ${unread} nowych` : ""} · usuwane automatycznie po 12 mies. od ostatniej wiadomości
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj e-maila / treści"
          className="w-full sm:w-64 px-3 py-2 rounded-lg border border-[#3F4147] bg-[#2B2D31] text-[#E0E0E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        />
      </div>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,360px)_1fr] gap-4">
        <div className={`${card} overflow-hidden ${selected ? "hidden lg:block" : ""}`}>
          {loading ? (
            <p className="p-4 text-sm text-[#E0E0E0]/40">Ładowanie…</p>
          ) : !filtered.length ? (
            <p className="p-4 text-sm text-[#E0E0E0]/40">Brak rozmów.</p>
          ) : (
            <ul className="divide-y divide-[#3F4147] max-h-[75vh] overflow-y-auto">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openChat(c.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-[#3F4147]/40 ${selected === c.id ? "bg-[#3B82F6]/10" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {!c.adminReadAt && <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" aria-label="nowa" />}
                      <span className="text-sm font-medium text-[#E0E0E0] truncate">{c.email}</span>
                      <span className="ml-auto text-[11px] text-[#E0E0E0]/40 shrink-0">{fmt(c.lastMessageAt)}</span>
                    </div>
                    <p className="text-xs text-[#E0E0E0]/50 truncate mt-0.5">{c.lastMessage || "—"}</p>
                    <div className="flex gap-1.5 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2B2D31] text-[#E0E0E0]/60 uppercase">{c.lang}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2B2D31] text-[#E0E0E0]/60">{c.userMessages} wiad.</span>
                      {c.trackingConsent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D8FF3D]/15 text-[#D8FF3D]">przebieg wizyty</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${card} p-4 sm:p-5 min-h-[300px] ${selected ? "" : "hidden lg:block"}`}>
          {!selected ? (
            <p className="text-sm text-[#E0E0E0]/40">Wybierz rozmowę z listy.</p>
          ) : detailLoading || !detail ? (
            <p className="text-sm text-[#E0E0E0]/40">Ładowanie…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => { setSelected(null); setDetail(null); }} className="lg:hidden text-sm text-[#3B82F6]">← Lista</button>
                <h2 className="text-lg font-semibold text-[#E0E0E0] break-all">{detail.chat.email}</h2>
                <div className="ml-auto flex gap-2">
                  <a
                    href={`mailto:${detail.chat.email}?subject=${encodeURIComponent("KalkMate — odpowiedź na Twoje pytanie z czatu")}`}
                    className="px-3 py-1.5 rounded-lg text-sm bg-[#3B82F6] text-white"
                  >
                    Odpisz mailem
                  </a>
                  <button type="button" onClick={() => remove(detail.chat.id)} className="px-3 py-1.5 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-300">
                    Usuń
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#E0E0E0]/50">
                Start: {fmt(detail.chat.createdAt)} · język {detail.chat.lang.toUpperCase()} · pierwsza strona {detail.chat.firstPage || "—"}
                {detail.chat.userAgent ? ` · ${detail.chat.userAgent.slice(0, 90)}` : ""}
              </p>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {detail.messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.role === "user" ? "ml-auto bg-[#3B82F6]/20 text-[#E0E0E0]" : "bg-[#2B2D31] text-[#E0E0E0]/85"}`}>
                    <p>{m.content}</p>
                    <p className="text-[10px] text-[#E0E0E0]/40 mt-1">
                      {m.role === "user" ? "Klient" : "AI"} · {fmt(m.createdAt)}{m.page ? ` · ${m.page}` : ""}
                    </p>
                  </div>
                ))}
                {!detail.messages.length && <p className="text-sm text-[#E0E0E0]/40">Klient otworzył czat, ale nic nie napisał.</p>}
              </div>

              <div className="border-t border-[#3F4147] pt-3">
                <h3 className="text-sm font-semibold text-[#E0E0E0] mb-2">Przebieg wizyty</h3>
                {!detail.chat.trackingConsent ? (
                  <p className="text-xs text-[#E0E0E0]/50">Klient nie zgodził się na cookies analityczne — przebieg wizyty nie jest zbierany.</p>
                ) : (
                  <>
                    <ol className="text-xs text-[#E0E0E0]/70 space-y-0.5 max-h-48 overflow-y-auto">
                      {detail.chat.journey.map((e, i) => (
                        <li key={i}>
                          <span className="text-[#E0E0E0]/40 font-mono">{fmtTime(e.t)}</span>{" "}
                          {e.kind === "page" ? <>strona <code>{e.path}</code></> : <>sekcja <code>#{e.section}</code></>}
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs text-[#E0E0E0]/50 mt-2">
                      Nagranie sesji: w{" "}
                      <a href={CLARITY_URL} target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] hover:underline">Microsoft Clarity</a>{" "}
                      filtr „Custom tags” → <code>support_chat</code> = <code className="select-all">{detail.chat.id}</code>
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
