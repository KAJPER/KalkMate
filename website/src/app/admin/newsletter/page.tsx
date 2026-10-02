"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import AdminShell from "@/components/admin/AdminShell";
import { newsletterEmail } from "@/lib/email-templates";
import { type PendingAttachment, fileToAttachment } from "@/components/admin/imageAttachments";

interface Recipient {
  email: string;
  name: string | null;
  registered: boolean;
  buyer: boolean;
  country: string | null;
  unsubscribed: boolean;
  consent: boolean;
}

interface Campaign {
  id: string;
  subject: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
  finishedAt: string | null;
  running: boolean;
}

interface Draft {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  lang: "pl" | "en" | "de";
}

const EMPTY_DRAFT: Draft = {
  subject: "",
  preheader: "",
  eyebrow: "",
  title: "",
  body: "Cześć {{imie}},\n\n",
  ctaText: "",
  ctaUrl: "https://kalkmate.pl",
  lang: "pl",
};

const DRAFT_KEY = "km-newsletter-draft";

// Podglad: {{imie}} -> przykladowe imie (serwer robi to samo per odbiorca).
function previewPersonalize(s: string): string {
  return s.replace(/\{\{\s*(imie|imię|name)\s*\}\}/gi, "Jan");
}

export default function NewsletterPage() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [image, setImage] = useState<PendingAttachment | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [previewMobile, setPreviewMobile] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Odbiorcy
  const [registered, setRegistered] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [buyers, setBuyers] = useState(true);
  const [country, setCountry] = useState<"all" | "PL" | "foreign">("all");
  // Domyslnie tylko osoby ze zgoda marketingowa — patrz ostrzezenie przy wysylce.
  const [consentOnly, setConsentOnly] = useState(true);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [recErr, setRecErr] = useState("");
  const [recSearch, setRecSearch] = useState("");
  const [showList, setShowList] = useState(false);

  // Wysylka
  const [testTo, setTestTo] = useState("kontakt@kalkmate.pl");
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [failures, setFailures] = useState<{ id: string; list: { email: string; error: string | null }[] } | null>(null);

  // Szkic tekstu pamietany w przegladarce (bez zdjecia — za duze na localStorage).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(saved) });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const loadRecipients = useCallback(async () => {
    setRecLoading(true);
    setRecErr("");
    try {
      const q = new URLSearchParams({
        registered: registered ? "1" : "0",
        verifiedOnly: verifiedOnly ? "1" : "0",
        buyers: buyers ? "1" : "0",
        country,
        consentOnly: consentOnly ? "1" : "0",
      });
      const res = await fetch(`/api/admin/newsletter/recipients?${q}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Błąd");
      setRecipients(data.recipients);
    } catch (e) {
      setRecErr((e as Error).message);
      setRecipients([]);
    } finally {
      setRecLoading(false);
    }
  }, [registered, verifiedOnly, buyers, country, consentOnly]);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/newsletter/campaigns");
      const data = await res.json();
      if (res.ok && data.ok) setCampaigns(data.campaigns);
    } catch {}
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // W trakcie wysylki odswiezamy postep co 3 s.
  const anyRunning = campaigns.some((c) => c.running);
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(loadCampaigns, 3000);
    return () => clearInterval(t);
  }, [anyRunning, loadCampaigns]);

  const activeCount = recipients.filter((r) => !r.unsubscribed).length;
  const unsubCount = recipients.length - activeCount;
  const filteredRecipients = useMemo(() => {
    const q = recSearch.trim().toLowerCase();
    return q ? recipients.filter((r) => r.email.includes(q) || (r.name || "").toLowerCase().includes(q)) : recipients;
  }, [recipients, recSearch]);

  const previewHtml = useMemo(
    () =>
      newsletterEmail({
        ...draft,
        title: previewPersonalize(draft.title),
        body: previewPersonalize(draft.body),
        // data: zamiast blob: — iframe z sandbox="" ma inny origin i nie widzi blob-ow strony.
        imageSrc: image ? `data:${image.contentType};base64,${image.data}` : undefined,
        unsubscribeUrl: "#",
      }),
    [draft, image]
  );

  const payloadContent = () => ({
    ...draft,
    image: image ? { filename: image.filename, contentType: image.contentType, data: image.data } : null,
  });

  // Pasek formatowania: owija zaznaczenie albo wstawia znacznik w miejscu kursora.
  const wrap = (before: string, after = "", placeholder = "") => {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    set("body", next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const linePrefix = (prefix: string) => {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const chunk = value.slice(lineStart, e) || "";
    const replaced = (chunk || " ").split("\n").map((l) => prefix + l.replace(/^(## |- )/, "")).join("\n");
    set("body", value.slice(0, lineStart) + replaced + value.slice(e));
    requestAnimationFrame(() => ta.focus());
  };
  const addLink = () => {
    const url = prompt("Adres linku (https://…)", "https://kalkmate.pl");
    if (!url) return;
    wrap("[", `](${url})`, "tekst linku");
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ ok: false, text: "To nie jest zdjęcie." });
      return;
    }
    setImageBusy(true);
    try {
      // 1200 px — mail ma 600 px szerokosci, x2 dla ekranow retina.
      const att = await fileToAttachment(file, 1200);
      if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(att.contentType)) {
        setMsg({ ok: false, text: "Tego formatu (np. HEIC) przeglądarka nie umie przekonwertować — zapisz zdjęcie jako JPG." });
        return;
      }
      if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
      setImage(att);
    } finally {
      setImageBusy(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/newsletter/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payloadContent(), to: testTo }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
      setMsg(data.ok ? { ok: true, text: `Test wysłany na ${testTo}.` } : { ok: false, text: data.error || "Błąd" });
    } catch {
      setMsg({ ok: false, text: "Błąd sieci" });
    } finally {
      setTesting(false);
    }
  };

  const sendAll = async () => {
    if (!activeCount) return;
    if (!confirm(`Wysłać „${draft.subject}” do ${activeCount} odbiorców?\n\nTego nie da się cofnąć. Najpierw wyślij test do siebie.`)) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/newsletter/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: payloadContent(), filter: { registered, verifiedOnly, buyers, country, consentOnly } }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
      if (!data.ok) {
        setMsg({ ok: false, text: data.error || "Błąd" });
        return;
      }
      setMsg({ ok: true, text: `Wysyłka ruszyła: ${data.total} odbiorców. Postęp w historii poniżej.` });
      loadCampaigns();
    } catch {
      setMsg({ ok: false, text: "Błąd sieci" });
    } finally {
      setSending(false);
    }
  };

  const campaignAction = async (id: string, action: "stop" | "resume") => {
    await fetch(`/api/admin/newsletter/campaigns/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    loadCampaigns();
  };

  const reuseCampaign = async (id: string) => {
    const res = await fetch(`/api/admin/newsletter/campaigns/${id}`);
    const data = await res.json();
    if (!data.ok) return;
    const c = data.content;
    setDraft({
      subject: c.subject || "",
      preheader: c.preheader || "",
      eyebrow: c.eyebrow || "",
      title: c.title || "",
      body: c.body || "",
      ctaText: c.ctaText || "",
      ctaUrl: c.ctaUrl || "",
      lang: c.lang || "pl",
    });
    if (c.image) {
      const blob = await (await fetch(`data:${c.image.contentType};base64,${c.image.data}`)).blob();
      setImage({
        id: `${Date.now()}`,
        filename: c.image.filename,
        contentType: c.image.contentType,
        data: c.image.data,
        size: blob.size,
        previewUrl: URL.createObjectURL(blob),
      });
    } else setImage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showFailures = async (id: string) => {
    if (failures?.id === id) return setFailures(null);
    const res = await fetch(`/api/admin/newsletter/campaigns/${id}`);
    const data = await res.json();
    if (data.ok) setFailures({ id, list: data.failures });
  };

  const toggleUnsub = async (r: Recipient) => {
    if (!r.unsubscribed && !confirm(`Wypisać ${r.email} z newslettera?`)) return;
    if (r.unsubscribed && !confirm(`Przywrócić ${r.email}? Rób to tylko, jeśli ta osoba sama o to poprosiła.`)) return;
    await fetch("/api/admin/newsletter/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: r.email, unsubscribed: !r.unsubscribed }),
    });
    setRecipients((list) => list.map((x) => (x.email === r.email ? { ...x, unsubscribed: !r.unsubscribed } : x)));
  };

  const field =
    "w-full min-w-0 bg-[#2B2D31] border border-[#3F4147] rounded-lg px-3 py-2.5 text-base sm:text-sm text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]";
  const label = "block text-xs text-[#E0E0E0]/60 mb-1";
  const card = "bg-[#313338] rounded-2xl border border-[#3F4147] p-4 sm:p-5";
  const btn = "px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";
  const btnSecondary = `${btn} bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80 hover:bg-[#3F4147]`;
  const tool = "px-2.5 py-1.5 rounded-md text-xs bg-[#2B2D31] border border-[#3F4147] text-[#E0E0E0]/80 hover:bg-[#3F4147]";
  const canSend = !!draft.subject.trim() && !!draft.body.trim();

  return (
    <AdminShell>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold text-[#E0E0E0] mb-1">Newsletter</h1>
        <p className="text-sm text-[#E0E0E0]/60">Wiadomość do zarejestrowanych użytkowników i kupujących · wysyłka z noreply@kalkmate.pl</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Kompozytor */}
        <div className={`${card} space-y-3`}>
          <h2 className="text-lg font-semibold text-[#E0E0E0]">Treść</h2>
          <div>
            <label className={label}>Temat maila *</label>
            <input value={draft.subject} onChange={(e) => set("subject", e.target.value)} className={field} placeholder="np. Nowa aktualizacja KalkMate 1.8 🎉" />
          </div>
          <div>
            <label className={label}>Zajawka w skrzynce (szary tekst obok tematu)</label>
            <input value={draft.preheader} onChange={(e) => set("preheader", e.target.value)} className={field} placeholder="np. Szybsze AI i tryb ciemny notatek" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
            <div>
              <label className={label}>Nadtytuł (mały, zielony)</label>
              <input value={draft.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} className={field} placeholder="Nowość" />
            </div>
            <div>
              <label className={label}>Tytuł (duży nagłówek)</label>
              <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={field} placeholder="KalkMate jest jeszcze szybszy" />
            </div>
          </div>

          <div>
            <label className={label}>Zdjęcie (nad tytułem)</label>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
            {image ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.previewUrl || ""} alt="" className="h-16 w-24 object-cover rounded-md border border-[#3F4147]" />
                <button type="button" onClick={() => imageInputRef.current?.click()} className={btnSecondary}>Zmień</button>
                <button
                  type="button"
                  onClick={() => { if (image.previewUrl) URL.revokeObjectURL(image.previewUrl); setImage(null); }}
                  className={`${btn} text-red-400 hover:bg-red-500/10`}
                >
                  Usuń
                </button>
              </div>
            ) : (
              <button type="button" disabled={imageBusy} onClick={() => imageInputRef.current?.click()} className={btnSecondary}>
                {imageBusy ? "Przetwarzam…" : "🖼 Dodaj zdjęcie"}
              </button>
            )}
          </div>

          <div>
            <label className={label}>Treść *</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <button type="button" className={tool} onClick={() => wrap("**", "**", "pogrubienie")}><b>B</b></button>
              <button type="button" className={tool} onClick={() => wrap("*", "*", "kursywa")}><i>I</i></button>
              <button type="button" className={tool} onClick={addLink}>🔗 Link</button>
              <button type="button" className={tool} onClick={() => linePrefix("## ")}>Śródtytuł</button>
              <button type="button" className={tool} onClick={() => linePrefix("- ")}>• Lista</button>
              <button type="button" className={tool} onClick={() => wrap("{{imie}}")}>{"{{imie}}"}</button>
            </div>
            <textarea
              ref={bodyRef}
              value={draft.body}
              onChange={(e) => set("body", e.target.value)}
              rows={12}
              className={`${field} min-h-[260px] resize-y leading-relaxed font-mono text-[13px]`}
            />
            <p className="text-[11px] text-[#E0E0E0]/40 mt-1">
              Pusta linia = nowy akapit · <code>## </code> śródtytuł · <code>- </code> lista · <code>**pogrubienie**</code> · <code>{"{{imie}}"}</code> = imię odbiorcy (gdy brak — znika)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
            <div>
              <label className={label}>Przycisk — tekst</label>
              <input value={draft.ctaText} onChange={(e) => set("ctaText", e.target.value)} className={field} placeholder="Zobacz nowości" />
            </div>
            <div>
              <label className={label}>Przycisk — link</label>
              <input value={draft.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} className={field} placeholder="https://kalkmate.pl/panel" inputMode="url" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className={label}>Język stopki</label>
              <select value={draft.lang} onChange={(e) => set("lang", e.target.value as Draft["lang"])} className={field}>
                <option value="pl">Polski</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => { if (confirm("Wyczyścić cały szkic?")) { setDraft(EMPTY_DRAFT); setImage(null); } }}
              className={`${btn} self-end text-[#E0E0E0]/50 hover:text-[#E0E0E0]`}
            >
              Wyczyść szkic
            </button>
          </div>
        </div>

        {/* Podglad */}
        <div className={`${card} flex flex-col`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#E0E0E0]">Podgląd</h2>
            <div className="flex gap-1">
              <button type="button" onClick={() => setPreviewMobile(false)} className={`${tool} ${!previewMobile ? "!bg-[#3B82F6] !text-white" : ""}`}>🖥 Komputer</button>
              <button type="button" onClick={() => setPreviewMobile(true)} className={`${tool} ${previewMobile ? "!bg-[#3B82F6] !text-white" : ""}`}>📱 Telefon</button>
            </div>
          </div>
          <div className="text-xs text-[#E0E0E0]/60 mb-2 break-words">
            <span className="text-[#E0E0E0]/40">Temat:</span> {draft.subject || "—"}
            {draft.preheader && <span className="text-[#E0E0E0]/40"> — {draft.preheader}</span>}
          </div>
          <div className="flex-1 flex justify-center bg-[#0B0B0B] rounded-lg overflow-hidden min-h-[520px]">
            <iframe
              title="Podgląd newslettera"
              sandbox=""
              srcDoc={previewHtml}
              className="bg-[#0B0B0B] h-[700px] transition-all"
              style={{ width: previewMobile ? 380 : "100%" }}
            />
          </div>
        </div>

        {/* Odbiorcy */}
        <div className={`${card} space-y-3`}>
          <h2 className="text-lg font-semibold text-[#E0E0E0]">Odbiorcy</h2>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#E0E0E0]/80">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={registered} onChange={(e) => setRegistered(e.target.checked)} /> Zarejestrowani
            </label>
            <label className={`flex items-center gap-2 ${registered ? "" : "opacity-40"}`}>
              <input type="checkbox" disabled={!registered} checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> tylko z potwierdzonym e-mailem
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={buyers} onChange={(e) => setBuyers(e.target.checked)} /> Kupujący (urządzenie / tokeny)
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-[#E0E0E0]/90 rounded-lg border border-[#3F4147] bg-[#2B2D31] p-2.5">
            <input type="checkbox" className="mt-0.5" checked={consentOnly} onChange={(e) => setConsentOnly(e.target.checked)} />
            <span>
              Tylko ze zgodą marketingową
              <span className="block text-[11px] text-[#E0E0E0]/50">
                {consentOnly
                  ? "Bezpieczne dla promocji, rabatów i kuponów."
                  : "Uwaga: wysyłasz też do osób bez zgody — wolno tylko z informacjami o produkcie, który mają (aktualizacje, zmiany w usłudze), bez reklamy."}
              </span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#E0E0E0]/60">Kraj zamówienia:</span>
            {([["all", "Wszyscy"], ["PL", "Polska"], ["foreign", "Zagranica"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setCountry(v)} className={`${tool} ${country === v ? "!bg-[#3B82F6] !text-white" : ""}`}>{l}</button>
            ))}
          </div>
          {country !== "all" && (
            <p className="text-[11px] text-[#E0E0E0]/40">Filtr kraju bierze tylko osoby z zamówieniem (konta bez zamówienia nie mają kraju).</p>
          )}

          <div className="rounded-lg bg-[#2B2D31] border border-[#3F4147] p-3">
            {recLoading ? (
              <p className="text-sm text-[#E0E0E0]/50">Liczę…</p>
            ) : recErr ? (
              <p className="text-sm text-red-400">{recErr}</p>
            ) : (
              <p className="text-sm text-[#E0E0E0]">
                <span className="text-2xl font-bold text-[#3B82F6] mr-1">{activeCount}</span> odbiorców
                {unsubCount > 0 && <span className="text-[#E0E0E0]/40"> · {unsubCount} wypisanych (pominięci)</span>}
              </p>
            )}
            <button type="button" onClick={() => setShowList((v) => !v)} className="text-xs text-[#3B82F6] mt-1">
              {showList ? "Ukryj listę" : "Pokaż listę"}
            </button>
          </div>

          {showList && (
            <div className="space-y-2">
              <input value={recSearch} onChange={(e) => setRecSearch(e.target.value)} placeholder="Szukaj adresu / imienia" className={field} />
              <div className="max-h-[360px] overflow-y-auto rounded-lg border border-[#3F4147] divide-y divide-[#3F4147]/60">
                {filteredRecipients.slice(0, 500).map((r) => (
                  <div key={r.email} className={`flex items-center gap-2 px-3 py-2 text-sm ${r.unsubscribed ? "opacity-50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#E0E0E0] truncate">{r.email}</p>
                      {r.name && <p className="text-[11px] text-[#E0E0E0]/50 truncate">{r.name}</p>}
                    </div>
                    {r.registered && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3B82F6]/20 text-[#3B82F6]">konto</span>}
                    {r.buyer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">kupił</span>}
                    {r.consent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D8FF3D]/20 text-[#D8FF3D]">zgoda</span>}
                    {r.country && <span className="text-[10px] text-[#E0E0E0]/50">{r.country}</span>}
                    <button
                      type="button"
                      onClick={() => toggleUnsub(r)}
                      title={r.unsubscribed ? "Przywróć do newslettera" : "Wypisz z newslettera"}
                      className="text-[11px] px-2 py-1 rounded border border-[#3F4147] text-[#E0E0E0]/60 hover:bg-[#3F4147]"
                    >
                      {r.unsubscribed ? "wypisany ↺" : "wypisz"}
                    </button>
                  </div>
                ))}
                {filteredRecipients.length > 500 && (
                  <p className="px-3 py-2 text-xs text-[#E0E0E0]/40">…i {filteredRecipients.length - 500} więcej (zawęź wyszukiwaniem)</p>
                )}
                {!filteredRecipients.length && <p className="px-3 py-2 text-xs text-[#E0E0E0]/40">Brak.</p>}
              </div>
            </div>
          )}
        </div>

        {/* Wysylka */}
        <div className={`${card} space-y-4`}>
          <h2 className="text-lg font-semibold text-[#E0E0E0]">Wysyłka</h2>
          <div>
            <label className={label}>1. Wyślij test do siebie</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} className={field} inputMode="email" />
              <button type="button" onClick={sendTest} disabled={testing || !canSend} className={`${btnSecondary} whitespace-nowrap`}>
                {testing ? "Wysyłam…" : "✉ Wyślij test"}
              </button>
            </div>
          </div>
          <div>
            <label className={label}>2. Wyślij do wszystkich</label>
            <button
              type="button"
              onClick={sendAll}
              disabled={sending || !canSend || !activeCount || recLoading}
              className={`${btn} w-full bg-[#3B82F6] hover:bg-[#2f6fd6] text-white py-3`}
            >
              {sending ? "Uruchamiam…" : `🚀 Wyślij do ${activeCount} odbiorców`}
            </button>
            <p className="text-[11px] text-[#E0E0E0]/40 mt-1.5 leading-relaxed">
              Maile idą po kolei w tle (kilka sekund przerwy, żeby serwer pocztowy nie zablokował konta) — możesz zamknąć tę stronę.
              Każdy mail ma link „Wypisz się”; wypisani są pomijani automatycznie.
            </p>
          </div>
          {msg && <p className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>}
          {!consentOnly && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200/80 leading-relaxed">
              Wysyłasz też do osób bez zgody marketingowej. Promocji, rabatów i kuponów wolno wysyłać tylko osobom ze zgodą (art. 398 Prawa komunikacji elektronicznej, RODO) —
              do pozostałych wyłącznie informacje o produkcie, który już mają (aktualizacje, zmiany w usłudze).
            </div>
          )}
        </div>

        {/* Historia */}
        <div className={`${card} xl:col-span-2`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#E0E0E0]">Historia wysyłek</h2>
            <button type="button" onClick={loadCampaigns} className="text-xs text-[#3B82F6]">Odśwież</button>
          </div>
          {!campaigns.length ? (
            <p className="text-sm text-[#E0E0E0]/40">Jeszcze nic nie wysłano.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const done = c.sent + c.failed;
                const pct = c.total ? Math.round((done / c.total) * 100) : 0;
                const stalled = c.status === "sending" && !c.running;
                return (
                  <div key={c.id} className="rounded-lg bg-[#2B2D31] border border-[#3F4147] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-[#E0E0E0] font-medium truncate">{c.subject}</p>
                        <p className="text-[11px] text-[#E0E0E0]/40">{new Date(c.createdAt).toLocaleString("pl-PL")}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded ${
                          c.status === "done" ? "bg-green-500/20 text-green-400"
                            : stalled || c.status === "stopped" ? "bg-amber-500/20 text-amber-300"
                            : "bg-[#3B82F6]/20 text-[#3B82F6]"
                        }`}>
                          {c.status === "done" ? "wysłano" : c.status === "stopped" ? "zatrzymano" : stalled ? "przerwana (restart serwera)" : "wysyłam…"}
                        </span>
                        {c.running && <button type="button" className={tool} onClick={() => campaignAction(c.id, "stop")}>⏸ Zatrzymaj</button>}
                        {!c.running && c.status !== "done" && <button type="button" className={tool} onClick={() => campaignAction(c.id, "resume")}>▶ Wznów</button>}
                        {c.failed > 0 && <button type="button" className={tool} onClick={() => showFailures(c.id)}>Błędy ({c.failed})</button>}
                        <button type="button" className={tool} onClick={() => reuseCampaign(c.id)}>Użyj ponownie</button>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded bg-[#3F4147] overflow-hidden">
                      <div className="h-full bg-[#3B82F6] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-[#E0E0E0]/50 mt-1">
                      {c.sent} / {c.total} wysłanych{c.failed ? ` · ${c.failed} nieudanych` : ""}
                    </p>
                    {failures?.id === c.id && (
                      <div className="mt-2 max-h-40 overflow-y-auto text-[11px] text-red-300/80 space-y-0.5">
                        {failures.list.map((f) => (
                          <p key={f.email} className="break-all">{f.email} — {f.error}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </AdminShell>
  );
}
