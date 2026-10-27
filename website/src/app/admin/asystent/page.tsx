"use client";

import { useState, useEffect, useRef } from "react";
import AdminShell from "@/components/admin/AdminShell";

// Czat z baza wiedzy KalkMate — do odpowiadania na maile z adresow spoza
// panelu Poczta. Backend: /api/admin/assistant (lib/adminAssistant.ts).
// Historia rozmowy zostaje w localStorage tej przegladarki (wygoda — po
// odswiezeniu strony nie znika wklejony mail i szkic).

interface Lookup {
  kind: "order" | "account" | "device" | "missing";
  label: string;
}
interface Msg {
  role: "user" | "assistant";
  content: string;
  lookups?: Lookup[];
  error?: boolean;
}

const STORAGE_KEY = "km-admin-assistant-v1";

const STARTERS = [
  { label: "Odpisz na maila", text: "Napisz odpowiedź na tego maila:\n\n" },
  { label: "Status zamówienia", text: "Co się dzieje z zamówieniem " },
  { label: "Wysyłka za granicę", text: "Ile kosztuje i ile trwa wysyłka do Niemiec?" },
  { label: "Tokeny", text: "Jak działają tokeny i ile kosztuje doładowanie?" },
];

const LOOKUP_STYLE: Record<Lookup["kind"], string> = {
  order: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  account: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  device: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  missing: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};
const LOOKUP_PREFIX: Record<Lookup["kind"], string> = {
  order: "Zamówienie",
  account: "Konto",
  device: "Kalkulator",
  missing: "Brak w bazie:",
};

// Szkic odpowiedzi model zwraca miedzy liniami "---" (patrz systemPrompt) —
// wyciagamy go, zeby przycisk "Kopiuj odpowiedz" bral sam mail, bez uwag.
function splitDraft(text: string): { before: string; draft: string | null; after: string } {
  const m = text.match(/^([\s\S]*?)^\s*---\s*$([\s\S]*?)^\s*---\s*$([\s\S]*)$/m);
  if (!m || !m[2].trim()) return { before: text, draft: null, after: "" };
  return { before: m[1].trim(), draft: m[2].trim(), after: m[3].trim() };
}

// Model lubi **pogrubienia** w odpowiedziach na pytania — renderujemy tylko
// to (bez pelnego Markdown), reszta zostaje zwyklym tekstem z \n.
function renderText(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
      : part
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch { /* brak uprawnien do schowka — admin skopiuje recznie */ }
      }}
      className="text-xs px-2.5 py-1 rounded-md border border-[#3F4147] text-[#E0E0E0]/70 hover:text-[#E0E0E0] hover:bg-[#3F4147]/60 transition-colors"
    >
      {done ? "Skopiowano ✓" : label}
    </button>
  );
}

function AssistantBubble({ msg }: { msg: Msg }) {
  const { before, draft, after } = splitDraft(msg.content);
  return (
    <div className="max-w-[85%] space-y-2">
      <div
        className={`rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap border ${
          msg.error ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-[#313338] border-[#3F4147] text-[#E0E0E0]"
        }`}
      >
        {before && <div>{renderText(before)}</div>}
        {draft && (
          <div className={`${before ? "mt-3" : ""} rounded-xl bg-[#2B2D31] border border-[#3B82F6]/30 p-3`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] uppercase tracking-wide text-[#3B82F6]/80 font-semibold">Odpowiedź do wysłania</span>
              <CopyButton text={draft} label="Kopiuj odpowiedź" />
            </div>
            <div>{draft}</div>
          </div>
        )}
        {after && <div className="mt-3 text-[#E0E0E0]/70">{renderText(after)}</div>}
      </div>
      {!msg.error && (
        <div className="flex flex-wrap items-center gap-1.5">
          {msg.lookups?.map((l, i) => (
            <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full border ${LOOKUP_STYLE[l.kind]}`}>
              {LOOKUP_PREFIX[l.kind]} {l.label}
            </span>
          ))}
          <CopyButton text={msg.content} label="Kopiuj całość" />
        </div>
      )}
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch { /* prywatne okno / uszkodzony wpis — zaczynamy od zera */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch { /* ignore */ }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Bledne odpowiedzi (error) nie ida do modelu jako historia.
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, lookups: data.lookups }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Błąd: ${(e as Error).message}`, error: true }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const applyStarter = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(text.length, text.length); }
    });
  };

  return (
    <AdminShell>
      <div className="max-w-4xl mx-auto flex flex-col h-[calc(100dvh-6.5rem)] lg:h-[calc(100dvh-3rem)]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#E0E0E0]">Asystent AI</h1>
            <p className="text-sm text-[#E0E0E0]/50 mt-1">
              Wklej maila od klienta albo zapytaj o cokolwiek o KalkMate. Adresy e-mail, numery zamówień (KM-…) i Device ID są automatycznie sprawdzane w bazie.
            </p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              disabled={loading}
              className="shrink-0 text-sm px-3 py-1.5 rounded-lg border border-[#3F4147] text-[#E0E0E0]/70 hover:text-[#E0E0E0] hover:bg-[#3F4147]/50 disabled:opacity-40"
            >
              Nowa rozmowa
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl bg-[#2B2D31] border border-[#3F4147] p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-[#E0E0E0] font-medium">W czym pomóc?</p>
              <p className="text-sm text-[#E0E0E0]/50 mt-1 max-w-md">
                Wklej całego maila razem z adresem nadawcy — dostaniesz gotową odpowiedź w języku klienta, opartą na prawdziwych danych z zamówień.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {STARTERS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => applyStarter(s.text)}
                    className="text-sm px-3 py-1.5 rounded-full border border-[#3F4147] bg-[#313338] text-[#E0E0E0]/80 hover:border-[#3B82F6]/50 hover:text-[#E0E0E0] transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#E0E0E0] max-h-80 overflow-y-auto">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <AssistantBubble msg={m} />
              </div>
            )
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-[#313338] border border-[#3F4147] flex gap-1.5">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-2 h-2 rounded-full bg-[#E0E0E0]/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); send(input); }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); }
            }}
            rows={Math.min(10, Math.max(2, input.split("\n").length))}
            placeholder="Wklej maila albo zadaj pytanie… (Enter = wyślij, Shift+Enter = nowa linia)"
            className="flex-1 resize-none rounded-xl bg-[#313338] border border-[#3F4147] px-4 py-3 text-sm text-[#E0E0E0] placeholder:text-[#E0E0E0]/30 focus:outline-none focus:border-[#3B82F6]/60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-11 px-5 rounded-xl bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Wyślij
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
