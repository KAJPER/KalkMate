"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";

interface MailAddress {
  name: string;
  address: string;
}

interface MessageSummary {
  uid: number;
  subject: string;
  from: MailAddress | null;
  to: MailAddress[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
}

interface Attachment {
  index: number;
  filename: string;
  size: number;
  contentType: string;
}

interface MessageFull {
  uid: number;
  folder: string;
  subject: string;
  from: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  date: string | null;
  html: string | null;
  text: string | null;
  messageId: string | null;
  references: string[];
  attachments: Attachment[];
}

const FOLDERS = [
  { path: "INBOX", label: "Odebrane" },
  { path: "Sent", label: "Wysłane" },
  { path: "Junk", label: "Spam" },
  { path: "INBOX.spam", label: "Spam (stary)" },
  { path: "Drafts", label: "Robocze" },
  { path: "Trash", label: "Kosz" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtAddr(a: MailAddress | null): string {
  if (!a) return "(brak nadawcy)";
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MailboxPage() {
  const [folder, setFolder] = useState("INBOX");
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listErr, setListErr] = useState("");

  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [message, setMessage] = useState<MessageFull | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [msgErr, setMsgErr] = useState("");

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");

  // Tlumaczenie odczytywanej wiadomosci (AI, /api/admin/mailbox/translate)
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateErr, setTranslateErr] = useState("");

  // Tlumaczenie szkicu odpowiedzi na jezyk klienta
  const [translatingReply, setTranslatingReply] = useState(false);
  const [replyTranslateErr, setReplyTranslateErr] = useState("");

  const loadList = useCallback(async (f: string) => {
    setLoadingList(true);
    setListErr("");
    try {
      const res = await fetch(`/api/admin/mailbox?folder=${encodeURIComponent(f)}&limit=150`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setListErr(data.error || "Błąd pobierania listy");
        setMessages([]);
        return;
      }
      setMessages(data.messages || []);
    } catch {
      setListErr("Błąd sieci");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    setSelectedUid(null);
    setMessage(null);
    setReplyOpen(false);
    loadList(folder);
  }, [folder, loadList]);

  // Text mailu do tlumaczenia/cytowania — preferuje wersje tekstowa, w razie
  // braku zdziera znaczniki z HTML (wystarczajaco dobre dla tlumaczenia AI).
  const plainTextOf = (m: MessageFull): string => {
    if (m.text && m.text.trim()) return m.text;
    if (m.html) return m.html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return "";
  };

  const openMessage = async (uid: number) => {
    setSelectedUid(uid);
    setMessage(null);
    setMsgErr("");
    setReplyOpen(false);
    setSendMsg("");
    setTranslated(null);
    setShowTranslation(false);
    setTranslateErr("");
    setLoadingMsg(true);
    try {
      const res = await fetch(`/api/admin/mailbox/${uid}?folder=${encodeURIComponent(folder)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsgErr(data.error || "Błąd pobierania wiadomości");
        return;
      }
      setMessage(data.message);
      // lokalnie oznacz jako przeczytana (serwer i tak juz to zrobil w IMAP)
      setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)));
    } catch {
      setMsgErr("Błąd sieci");
    } finally {
      setLoadingMsg(false);
    }
  };

  const startReply = () => {
    if (!message) return;
    setReplyTo(message.from?.address || "");
    setReplySubject(message.subject.toLowerCase().startsWith("re:") ? message.subject : `Re: ${message.subject}`);
    setReplyText("");
    setSendMsg("");
    setReplyTranslateErr("");
    setReplyOpen(true);
  };

  const sendReply = async () => {
    if (!message || !replyText.trim()) return;
    setSending(true);
    setSendMsg("");
    try {
      const html = `<div style="font-family:sans-serif;font-size:14px;white-space:pre-wrap;">${replyText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</div>`;
      const res = await fetch(`/api/admin/mailbox/${message.uid}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, toAddress: replyTo, subject: replySubject, html }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSendMsg(data.error || "Błąd wysyłki");
        return;
      }
      setSendMsg("Wysłano.");
      setReplyText("");
      setTimeout(() => setReplyOpen(false), 1200);
    } catch {
      setSendMsg("Błąd sieci");
    } finally {
      setSending(false);
    }
  };

  const handleTranslate = async () => {
    if (!message) return;
    if (translated) {
      // drugi klik po udanym tlumaczeniu — po prostu przelacz widok
      setShowTranslation((v) => !v);
      return;
    }
    const text = plainTextOf(message);
    if (!text) return;
    setTranslating(true);
    setTranslateErr("");
    try {
      const res = await fetch("/api/admin/mailbox/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "to-polish", text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setTranslateErr(data.error || "Błąd tłumaczenia");
        return;
      }
      setTranslated(data.translated);
      setShowTranslation(true);
    } catch {
      setTranslateErr("Błąd sieci");
    } finally {
      setTranslating(false);
    }
  };

  const handleTranslateReply = async () => {
    if (!message || !replyText.trim()) return;
    setTranslatingReply(true);
    setReplyTranslateErr("");
    try {
      const res = await fetch("/api/admin/mailbox/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "match-language", text: replyText, referenceText: plainTextOf(message) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setReplyTranslateErr(data.error || "Błąd tłumaczenia");
        return;
      }
      setReplyText(data.translated);
    } catch {
      setReplyTranslateErr("Błąd sieci");
    } finally {
      setTranslatingReply(false);
    }
  };

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Poczta</h1>
          <p className="text-sm text-[#E0E0E0]/60">kontakt@kalkmate.pl</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {FOLDERS.map((f) => (
            <button
              key={f.path}
              onClick={() => setFolder(f.path)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                folder === f.path
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#313338] hover:bg-[#3F4147] text-[#E0E0E0]/70"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => loadList(folder)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#313338] hover:bg-[#3F4147] text-[#3B82F6] transition-colors"
          >
            Odśwież
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[500px]"
      >
        {/* Lista wiadomosci */}
        <div className="bg-[#313338] rounded-2xl border border-[#3F4147] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <p className="text-sm text-[#E0E0E0]/50 p-4">Ładowanie…</p>
            ) : listErr ? (
              <p className="text-sm text-red-400 p-4">{listErr}</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-[#E0E0E0]/40 p-4">Brak wiadomości w tym folderze.</p>
            ) : (
              messages.map((m) => (
                <button
                  key={m.uid}
                  onClick={() => openMessage(m.uid)}
                  className={`w-full text-left px-4 py-3 border-b border-[#3F4147]/50 hover:bg-[#3A3C41] transition-colors ${
                    selectedUid === m.uid ? "bg-[#3A3C41]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${m.seen ? "text-[#E0E0E0]/60" : "text-[#E0E0E0] font-semibold"}`}>
                      {fmtAddr(m.from)}
                    </span>
                    <span className="text-[10px] text-[#E0E0E0]/40 flex-shrink-0">{fmtDate(m.date)}</span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${m.seen ? "text-[#E0E0E0]/40" : "text-[#E0E0E0]/80"}`}>
                    {!m.seen && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#3B82F6] mr-1.5 align-middle" />}
                    {m.subject}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Podglad wiadomosci */}
        <div className="bg-[#313338] rounded-2xl border border-[#3F4147] overflow-hidden flex flex-col">
          {!selectedUid ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#E0E0E0]/30">
              Wybierz wiadomość z listy
            </div>
          ) : loadingMsg ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#E0E0E0]/50">Ładowanie…</div>
          ) : msgErr ? (
            <div className="flex-1 flex items-center justify-center text-sm text-red-400">{msgErr}</div>
          ) : message ? (
            <>
              <div className="p-4 border-b border-[#3F4147] flex-shrink-0">
                <h2 className="text-lg font-semibold text-[#E0E0E0] mb-1">{message.subject}</h2>
                <p className="text-xs text-[#E0E0E0]/60">
                  Od: <span className="text-[#E0E0E0]/90">{fmtAddr(message.from)}</span>
                </p>
                <p className="text-xs text-[#E0E0E0]/60">
                  Do: <span className="text-[#E0E0E0]/90">{message.to.map(fmtAddr).join(", ")}</span>
                </p>
                {message.cc.length > 0 && (
                  <p className="text-xs text-[#E0E0E0]/60">
                    DW: <span className="text-[#E0E0E0]/90">{message.cc.map(fmtAddr).join(", ")}</span>
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-[10px] text-[#E0E0E0]/40">
                    {message.date ? new Date(message.date).toLocaleString("pl-PL") : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    {translateErr && <span className="text-[10px] text-red-400">{translateErr}</span>}
                    <button
                      onClick={handleTranslate}
                      disabled={translating}
                      className="text-[11px] px-2 py-1 rounded-md bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/70 hover:bg-[#3F4147] hover:text-[#E0E0E0] transition-colors disabled:opacity-50"
                    >
                      {translating ? "Tłumaczę…" : translated ? (showTranslation ? "🌐 Pokaż oryginał" : "🌐 Pokaż tłumaczenie") : "🌐 Przetłumacz na polski"}
                    </button>
                  </div>
                </div>
                {message.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {message.attachments.map((a) => (
                      <a
                        key={a.index}
                        href={`/api/admin/mailbox/${message.uid}/attachment/${a.index}?folder=${encodeURIComponent(folder)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] px-2 py-1 rounded-md bg-[#2B2D31] border border-[#3F4147] text-[#3B82F6] hover:bg-[#3F4147] transition-colors"
                      >
                        📎 {a.filename} ({fmtSize(a.size)})
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {showTranslation && translated ? (
                  <div className="bg-[#2B2D31] border border-[#3F4147] rounded-lg p-4">
                    <p className="text-[10px] uppercase tracking-wide text-[#3B82F6] mb-2">Tłumaczenie (AI)</p>
                    <pre className="whitespace-pre-wrap text-sm text-[#E0E0E0]/90 font-sans">{translated}</pre>
                  </div>
                ) : message.html ? (
                  // Tresc maila to NIEZAUFANY HTML od nadawcy z internetu — sandbox
                  // bez allow-scripts, zeby zaden <script>/onerror z maila nie
                  // wykonal sie w kontekscie zalogowanego admina.
                  <iframe
                    title="Treść wiadomości"
                    sandbox="allow-same-origin"
                    srcDoc={message.html}
                    className="w-full h-full min-h-[300px] bg-white rounded-lg"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-[#E0E0E0]/90 font-sans">{message.text || "(pusta wiadomość)"}</pre>
                )}
              </div>

              <div className="p-4 border-t border-[#3F4147] flex-shrink-0">
                {!replyOpen ? (
                  <button
                    onClick={startReply}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-[#3B82F6] hover:bg-[#2f6fd6] text-white transition-colors"
                  >
                    ↩ Odpowiedz
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <input
                        value={replyTo}
                        onChange={(e) => setReplyTo(e.target.value)}
                        placeholder="Do"
                        className="flex-1 min-w-[200px] bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2 text-[#E0E0E0]"
                      />
                      <input
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                        placeholder="Temat"
                        className="flex-1 min-w-[200px] bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2 text-[#E0E0E0]"
                      />
                    </div>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Treść odpowiedzi…"
                      rows={6}
                      className="w-full bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2.5 text-sm text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={sendReply}
                        disabled={sending || !replyText.trim() || !replyTo}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-[#3B82F6] hover:bg-[#2f6fd6] text-white transition-colors disabled:opacity-50"
                      >
                        {sending ? "Wysyłam…" : "Wyślij"}
                      </button>
                      <button
                        onClick={() => setReplyOpen(false)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-[#3F4147] hover:bg-[#4a4d55] text-[#E0E0E0] transition-colors"
                      >
                        Anuluj
                      </button>
                      <button
                        onClick={handleTranslateReply}
                        disabled={translatingReply || !replyText.trim()}
                        title="Tłumaczy powyższą treść na język, w którym napisany jest oryginalny mail klienta"
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80 hover:bg-[#3F4147] hover:text-[#E0E0E0] transition-colors disabled:opacity-50"
                      >
                        {translatingReply ? "Tłumaczę…" : "🌐 Przetłumacz na język klienta"}
                      </button>
                      {sendMsg && (
                        <span className={`text-xs ${sendMsg === "Wysłano." ? "text-green-400" : "text-red-400"}`}>{sendMsg}</span>
                      )}
                      {replyTranslateErr && <span className="text-xs text-red-400">{replyTranslateErr}</span>}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </motion.div>
    </AdminShell>
  );
}
