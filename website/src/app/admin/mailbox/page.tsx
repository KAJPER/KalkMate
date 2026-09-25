"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";
import EmailFrame from "@/components/admin/EmailFrame";

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
  answered: boolean;
}

// Wiadomosc powiazana z otwartym mailem (nasza odpowiedz, kolejny mail klienta, oryginal).
interface ThreadMessage {
  uid: number;
  folder: string;
  direction: "in" | "out";
  subject: string;
  from: MailAddress | null;
  to: MailAddress[];
  date: string | null;
  text: string;
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

// Na liscie wystarczy nazwa nadawcy (adres tylko gdy brak nazwy) — na telefonie
// "Imie <dlugi@adres>" i tak sie ucina.
function listSender(a: MailAddress | null): string {
  if (!a) return "(brak nadawcy)";
  return a.name || a.address;
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

  const replyRef = useRef<HTMLDivElement>(null);

  // Rozmowa: nasze odpowiedzi z "Sent" pod otwartym mailem
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const selectedUidRef = useRef<number | null>(null);

  // Nowa wiadomosc do dowolnego adresu ("Nowa wiadomosc" jak w zwyklej poczcie)
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeShowCc, setComposeShowCc] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeText, setComposeText] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeMsg, setComposeMsg] = useState("");
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

  // Szkic odpowiedzi wygenerowany przez AI (OpenRouter + dane zamowien z bazy)
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftErr, setDraftErr] = useState("");
  const [draftOrdersFound, setDraftOrdersFound] = useState<number | null>(null);

  // Tlumaczenie szkicu odpowiedzi na jezyk klienta
  const [translatingReply, setTranslatingReply] = useState(false);
  const [replyTranslateErr, setReplyTranslateErr] = useState("");

  // Po otwarciu odpowiedzi przewin do formularza — na telefonie jest pod treścią maila.
  useEffect(() => {
    if (replyOpen) replyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [replyOpen]);

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
    setComposeOpen(false);
    loadList(folder);
  }, [folder, loadList]);

  // Text mailu do tlumaczenia/cytowania — preferuje wersje tekstowa, w razie
  // braku zdziera znaczniki z HTML (wystarczajaco dobre dla tlumaczenia AI).
  const plainTextOf = (m: MessageFull): string => {
    if (m.text && m.text.trim()) return m.text;
    if (m.html) return m.html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return "";
  };

  // Rozmowa doladowuje sie po otwarciu maila (osobne, wolniejsze zapytanie IMAP).
  const loadThread = useCallback(async (uid: number, f: string) => {
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/admin/mailbox/${uid}/thread?folder=${encodeURIComponent(f)}`);
      const data = await res.json();
      // odpowiedz dla juz zamknietego/zmienionego maila ignorujemy
      if (selectedUidRef.current !== uid) return;
      setThread(res.ok && data.ok ? data.messages || [] : []);
    } catch {
      if (selectedUidRef.current === uid) setThread([]);
    } finally {
      if (selectedUidRef.current === uid) setThreadLoading(false);
    }
  }, []);

  // Telefon: wiadomosc zastepuje liste (a nie laduje sie pod nia), wiec wracamy na gore.
  const closeMessage = () => {
    selectedUidRef.current = null;
    setSelectedUid(null);
    setMessage(null);
    setReplyOpen(false);
    setThread([]);
  };

  const startCompose = () => {
    selectedUidRef.current = null;
    setSelectedUid(null);
    setMessage(null);
    setReplyOpen(false);
    setThread([]);
    setComposeTo("");
    setComposeCc("");
    setComposeShowCc(false);
    setComposeSubject("");
    setComposeText("");
    setComposeMsg("");
    setComposeOpen(true);
    window.scrollTo({ top: 0 });
  };

  const sendCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeText.trim()) return;
    setComposeSending(true);
    setComposeMsg("");
    try {
      const html = `<div style="font-family:sans-serif;font-size:14px;white-space:pre-wrap;">${composeText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</div>`;
      const res = await fetch("/api/admin/mailbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: composeTo, cc: composeCc, subject: composeSubject, html }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setComposeMsg(data.error || "Błąd wysyłki");
        return;
      }
      setComposeMsg("Wysłano.");
      setTimeout(() => {
        setComposeOpen(false);
        if (folder === "Sent") loadList("Sent");
      }, 1200);
    } catch {
      setComposeMsg("Błąd sieci");
    } finally {
      setComposeSending(false);
    }
  };

  const openMessage = async (uid: number) => {
    window.scrollTo({ top: 0 });
    selectedUidRef.current = uid;
    setComposeOpen(false);
    setThread([]);
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
      loadThread(uid, folder);
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
    setDraftErr("");
    setDraftOrdersFound(null);
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
      const uid = message.uid;
      setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, answered: true } : m)));
      setTimeout(() => {
        setReplyOpen(false);
        loadThread(uid, folder); // nowa odpowiedz jest juz w "Sent"
      }, 1200);
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

  // Generuje szkic odpowiedzi przez AI (OpenRouter + prawdziwe zamowienia
  // klienta z bazy). Zawsze tylko wypelnia pole tekstowe — wysylka to nadal
  // osobny, reczny krok ("Wyslij"), zeby czlowiek zawsze widzial i mogl
  // poprawic tresc zanim poleci realny mail do klienta.
  const handleGenerateDraft = async () => {
    if (!message) return;
    const wasOpen = replyOpen;
    if (wasOpen && replyText.trim() && !confirm("Zastąpić obecną treść odpowiedzi wygenerowaną przez AI?")) return;
    if (!wasOpen) startReply();
    setGeneratingDraft(true);
    setDraftErr("");
    setDraftOrdersFound(null);
    try {
      const res = await fetch(`/api/admin/mailbox/${message.uid}/draft-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setDraftErr(data.error || "Błąd generowania");
        return;
      }
      setReplyText(data.draft);
      setDraftOrdersFound(data.ordersFound ?? 0);
    } catch {
      setDraftErr("Błąd sieci");
    } finally {
      setGeneratingDraft(false);
    }
  };

  const btnBase = "px-4 py-3 sm:py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";
  const btnSecondary = `${btnBase} bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80 hover:bg-[#3F4147] hover:text-[#E0E0E0] leading-tight`;
  // text-base (16 px) na telefonie: mniejsza czcionka w polu wymusza na iOS
  // automatyczne przyblizenie strony po kliknieciu w pole.
  const fieldClass =
    "w-full min-w-0 bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2.5 text-base sm:text-sm text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]";

  // Telefon: podglad wiadomosci LUB formularz nowej wiadomosci zastepuje liste.
  const showDetail = selectedUid !== null || composeOpen;

  // Telefon: wiadomosc zastepuje liste, wiec potrzebny jest powrot.
  const backBar = (
    <button onClick={closeMessage} className="lg:hidden self-start m-3 px-3 py-2 rounded-lg text-sm text-[#3B82F6] bg-[#2B2D31] border border-[#3F4147]">
      ← Wróć do listy
    </button>
  );

  return (
    <AdminShell>
      <div className="mb-4 sm:mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex w-full sm:w-auto items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Poczta</h1>
            <p className="text-sm text-[#E0E0E0]/60">kontakt@kalkmate.pl</p>
          </div>
          <button
            onClick={startCompose}
            className="flex-shrink-0 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium bg-[#3B82F6] hover:bg-[#2f6fd6] text-white transition-colors sm:ml-4"
          >
            ✏ Nowa wiadomość
          </button>
        </div>
        <div className="flex items-center gap-2 max-w-full overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {FOLDERS.map((f) => (
            <button
              key={f.path}
              onClick={() => setFolder(f.path)}
              className={`flex-shrink-0 whitespace-nowrap px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
            className="flex-shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium bg-[#313338] hover:bg-[#3F4147] text-[#3B82F6] transition-colors"
          >
            Odśwież
          </button>
        </div>
      </div>

      {/* Desktop: dwa panele o stalej wysokosci. Telefon: jeden widok naraz (lista ALBO wiadomosc), bez stalej wysokosci. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 lg:h-[calc(100vh-220px)] lg:min-h-[500px] -mx-3 sm:mx-0"
      >
        {/* Lista wiadomosci */}
        <div className={`bg-[#313338] rounded-2xl border border-[#3F4147] overflow-hidden flex-col ${showDetail ? "hidden lg:flex" : "flex"}`}>
          <div className="flex-1 overflow-y-auto max-h-[calc(100dvh-13rem)] lg:max-h-none">
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
                  className={`w-full text-left px-4 py-3.5 lg:py-3 border-b border-[#3F4147]/50 hover:bg-[#3A3C41] active:bg-[#3A3C41] transition-colors ${
                    selectedUid === m.uid ? "bg-[#3A3C41]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${m.seen ? "text-[#E0E0E0]/60" : "text-[#E0E0E0] font-semibold"}`}>
                      {listSender(m.from)}
                    </span>
                    <span className="text-[11px] text-[#E0E0E0]/40 flex-shrink-0">{fmtDate(m.date)}</span>
                  </div>
                  <p className={`text-[13px] lg:text-xs truncate mt-0.5 ${m.seen ? "text-[#E0E0E0]/40" : "text-[#E0E0E0]/80"}`}>
                    {!m.seen && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#3B82F6] mr-1.5 align-middle" />}
                    {m.answered && <span title="Odpowiedziano" className="mr-1 text-[#3B82F6]">↩</span>}
                    {m.subject}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Podglad wiadomosci */}
        <div className={`bg-[#313338] rounded-2xl border border-[#3F4147] flex-col overflow-visible lg:overflow-hidden ${showDetail ? "flex" : "hidden lg:flex"}`}>
          {composeOpen ? (
            <div className="flex-1 lg:overflow-y-auto p-3 sm:p-4 space-y-3">
              <button
                onClick={() => setComposeOpen(false)}
                className="lg:hidden px-3 py-2 rounded-lg text-sm text-[#3B82F6] bg-[#2B2D31] border border-[#3F4147]"
              >
                ← Wróć do listy
              </button>
              <div>
                <h2 className="text-lg font-semibold text-[#E0E0E0]">Nowa wiadomość</h2>
                <p className="text-xs text-[#E0E0E0]/50 break-words">Od: KalkMate &lt;kontakt@kalkmate.pl&gt;</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Do"
                  inputMode="email"
                  autoComplete="off"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="Do (kilka adresów po przecinku)"
                  className={fieldClass}
                />
                {!composeShowCc && (
                  <button
                    type="button"
                    onClick={() => setComposeShowCc(true)}
                    className="flex-shrink-0 px-3 py-2.5 rounded-lg text-sm text-[#3B82F6] bg-[#2B2D31] border border-[#3F4147]"
                  >
                    + DW
                  </button>
                )}
              </div>
              {composeShowCc && (
                <input
                  aria-label="DW"
                  inputMode="email"
                  autoComplete="off"
                  value={composeCc}
                  onChange={(e) => setComposeCc(e.target.value)}
                  placeholder="DW (kopia)"
                  className={fieldClass}
                />
              )}
              <input
                aria-label="Temat"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Temat"
                className={fieldClass}
              />
              <textarea
                aria-label="Treść wiadomości"
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                placeholder="Treść wiadomości…"
                rows={10}
                className={`${fieldClass} min-h-[240px] resize-y leading-relaxed`}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={sendCompose}
                  disabled={composeSending || !composeTo.trim() || !composeSubject.trim() || !composeText.trim()}
                  className={`${btnBase} flex-1 sm:flex-none bg-[#3B82F6] hover:bg-[#2f6fd6] text-white`}
                >
                  {composeSending ? "Wysyłam…" : "Wyślij"}
                </button>
                <button
                  onClick={() => setComposeOpen(false)}
                  className={`${btnBase} bg-[#3F4147] hover:bg-[#4a4d55] text-[#E0E0E0]`}
                >
                  Anuluj
                </button>
              </div>
              {composeMsg && (
                <p className={`text-xs ${composeMsg === "Wysłano." ? "text-green-400" : "text-red-400"}`}>{composeMsg}</p>
              )}
            </div>
          ) : !selectedUid ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#E0E0E0]/30">
              Wybierz wiadomość z listy
            </div>
          ) : loadingMsg ? (
            <>
              {backBar}
              <div className="flex-1 flex items-center justify-center text-sm text-[#E0E0E0]/50 py-16">Ładowanie…</div>
            </>
          ) : msgErr ? (
            <>
              {backBar}
              <div className="flex-1 flex items-center justify-center text-sm text-red-400 py-16 px-4 text-center">{msgErr}</div>
            </>
          ) : message ? (
            <>
              <div className="p-3 sm:p-4 border-b border-[#3F4147] flex-shrink-0">
                <button
                  onClick={closeMessage}
                  className="lg:hidden mb-3 px-3 py-2 rounded-lg text-sm text-[#3B82F6] bg-[#2B2D31] border border-[#3F4147]"
                >
                  ← Wróć do listy
                </button>
                <h2 className="text-lg font-semibold text-[#E0E0E0] mb-1 break-words">{message.subject}</h2>
                <p className="text-xs text-[#E0E0E0]/60 break-words">
                  Od: <span className="text-[#E0E0E0]/90">{fmtAddr(message.from)}</span>
                </p>
                <p className="text-xs text-[#E0E0E0]/60 break-words">
                  Do: <span className="text-[#E0E0E0]/90">{message.to.map(fmtAddr).join(", ")}</span>
                </p>
                {message.cc.length > 0 && (
                  <p className="text-xs text-[#E0E0E0]/60 break-words">
                    DW: <span className="text-[#E0E0E0]/90">{message.cc.map(fmtAddr).join(", ")}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <p className="text-[11px] text-[#E0E0E0]/40">
                    {message.date ? new Date(message.date).toLocaleString("pl-PL") : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {translateErr && <span className="text-[11px] text-red-400">{translateErr}</span>}
                    <button
                      onClick={handleTranslate}
                      disabled={translating}
                      className="text-xs px-3 py-2 sm:px-2 sm:py-1 rounded-md bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/70 hover:bg-[#3F4147] hover:text-[#E0E0E0] transition-colors disabled:opacity-50"
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
                        className="text-xs px-2.5 py-1.5 rounded-md bg-[#2B2D31] border border-[#3F4147] text-[#3B82F6] hover:bg-[#3F4147] transition-colors break-all"
                      >
                        📎 {a.filename} ({fmtSize(a.size)})
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop: tresc przewija sie w panelu. Telefon: przewija sie cala strona (ramka maila sama dopasowuje wysokosc). */}
              <div className="lg:flex-1 lg:overflow-y-auto p-2 sm:p-4">
                {showTranslation && translated ? (
                  <div className="bg-[#2B2D31] border border-[#3F4147] rounded-lg p-3 sm:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-[#3B82F6] mb-2">Tłumaczenie (AI)</p>
                    <pre className="whitespace-pre-wrap break-words text-[15px] sm:text-sm text-[#E0E0E0]/90 font-sans">{translated}</pre>
                  </div>
                ) : message.html ? (
                  // Tresc maila to NIEZAUFANY HTML od nadawcy z internetu — patrz
                  // EmailFrame (sandbox bez allow-scripts + dopasowanie do ekranu).
                  <EmailFrame html={message.html} />
                ) : (
                  <pre className="whitespace-pre-wrap break-words text-[15px] sm:text-sm text-[#E0E0E0]/90 font-sans">{message.text || "(pusta wiadomość)"}</pre>
                )}

                {/* Rozmowa: nasze odpowiedzi (z "Sent"), kolejne maile klienta, a dla maila z "Sent" — oryginal. */}
                {(threadLoading || thread.length > 0) && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-[#E0E0E0]/40">
                      Rozmowa{thread.length > 0 ? ` (${thread.length})` : ""}
                    </p>
                    {thread.map((t) => (
                      <div
                        key={`${t.folder}-${t.uid}`}
                        className={`rounded-lg border p-3 ${
                          t.direction === "out"
                            ? "bg-[#3B82F6]/10 border-[#3B82F6]/30 sm:ml-6"
                            : "bg-[#2B2D31] border-[#3F4147] sm:mr-6"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 mb-1.5">
                          <span className={`text-xs font-medium break-words ${t.direction === "out" ? "text-[#3B82F6]" : "text-[#E0E0E0]/80"}`}>
                            {t.direction === "out"
                              ? `↩ Twoja wiadomość${t.to[0] ? ` do ${t.to[0].name || t.to[0].address}` : ""}`
                              : `✉ ${t.from?.name || t.from?.address || "Klient"}`}
                          </span>
                          <span className="text-[11px] text-[#E0E0E0]/40">{t.date ? new Date(t.date).toLocaleString("pl-PL") : ""}</span>
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-[15px] sm:text-sm text-[#E0E0E0]/90 font-sans">{t.text || "(brak treści)"}</pre>
                      </div>
                    ))}
                    {threadLoading && <p className="text-xs text-[#E0E0E0]/40">Szukam powiązanych wiadomości…</p>}
                  </div>
                )}
              </div>

              {/* Telefon: gdy odpowiedz nie jest otwarta, pasek akcji przykleja sie do dolu ekranu (nie trzeba przewijac dlugiego maila). */}
              <div
                ref={replyRef}
                className={`border-t border-[#3F4147] flex-shrink-0 p-3 sm:p-4 scroll-mt-16 ${
                  replyOpen ? "" : "max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:bg-[#313338] max-lg:rounded-b-2xl"
                }`}
              >
                {!replyOpen ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={startReply}
                      className={`${btnBase} flex-1 sm:flex-none bg-[#3B82F6] hover:bg-[#2f6fd6] text-white`}
                    >
                      ↩ Odpowiedz
                    </button>
                    <button
                      onClick={handleGenerateDraft}
                      disabled={generatingDraft}
                      title="AI napisze szkic odpowiedzi na podstawie tresci maila i danych zamowien klienta z bazy — do przejrzenia przed wyslaniem"
                      className={`${btnSecondary} flex-1 sm:flex-none`}
                    >
                      {generatingDraft ? "Generuję…" : (
                        <>
                          <span className="sm:hidden">✨ Odpowiedź AI</span>
                          <span className="hidden sm:inline">✨ Wygeneruj odpowiedź AI</span>
                        </>
                      )}
                    </button>
                    {draftErr && <span className="text-xs text-red-400">{draftErr}</span>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        inputMode="email"
                        aria-label="Do"
                        value={replyTo}
                        onChange={(e) => setReplyTo(e.target.value)}
                        placeholder="Do"
                        className={fieldClass}
                      />
                      <input
                        aria-label="Temat"
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                        placeholder="Temat"
                        className={fieldClass}
                      />
                    </div>
                    <textarea
                      aria-label="Treść odpowiedzi"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Treść odpowiedzi…"
                      rows={6}
                      className={`${fieldClass} min-h-[200px] lg:min-h-[120px] resize-y leading-relaxed`}
                    />
                    <div className="space-y-3 lg:space-y-0 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={sendReply}
                        disabled={sending || !replyText.trim() || !replyTo}
                        className={`${btnBase} flex-1 sm:flex-none bg-[#3B82F6] hover:bg-[#2f6fd6] text-white`}
                      >
                        {sending ? "Wysyłam…" : "Wyślij"}
                      </button>
                      <button
                        onClick={() => setReplyOpen(false)}
                        className={`${btnBase} bg-[#3F4147] hover:bg-[#4a4d55] text-[#E0E0E0]`}
                      >
                        Anuluj
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                      <button
                        onClick={handleGenerateDraft}
                        disabled={generatingDraft}
                        title="AI napisze/przepisze szkic na podstawie tresci maila i danych zamowien klienta z bazy"
                        className={btnSecondary}
                      >
                        {generatingDraft ? "Generuję…" : "✨ Wygeneruj odpowiedź AI"}
                      </button>
                      <button
                        onClick={handleTranslateReply}
                        disabled={translatingReply || !replyText.trim()}
                        title="Tłumaczy powyższą treść na język, w którym napisany jest oryginalny mail klienta"
                        className={btnSecondary}
                      >
                        {translatingReply ? "Tłumaczę…" : "🌐 Przetłumacz na język klienta"}
                      </button>
                    </div>
                    </div>
                    {(sendMsg || replyTranslateErr || draftErr || draftOrdersFound !== null) && (
                      <div className="space-y-1">
                        {sendMsg && (
                          <p className={`text-xs ${sendMsg === "Wysłano." ? "text-green-400" : "text-red-400"}`}>{sendMsg}</p>
                        )}
                        {replyTranslateErr && <p className="text-xs text-red-400">{replyTranslateErr}</p>}
                        {draftErr && <p className="text-xs text-red-400">{draftErr}</p>}
                        {draftOrdersFound !== null && (
                          <p className="text-xs text-[#E0E0E0]/40">
                            {draftOrdersFound > 0
                              ? `AI widziało ${draftOrdersFound} zamówień(-ie) tego klienta`
                              : "AI nie znalazło żadnego zamówienia tego adresu e-mail w bazie"}
                          </p>
                        )}
                      </div>
                    )}
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
