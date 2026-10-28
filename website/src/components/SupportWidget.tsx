"use client";

// Czat z asystentem AI dla klientow (prawy dolny rog strony) — backend:
// /api/support/*, lib/supportChat.ts; admin widzi rozmowy w /admin/support.
//
// - Start: e-mail + "Nie jestem robotem" (proof-of-work w przegladarce) +
//   akceptacja regulaminu czatu (regulamin §8).
// - Zaczepki (dymek nad przyciskiem): po czasie na stronie, przy cenniku/FAQ,
//   przy probie wyjscia. Max 2 na wizyte, nigdy po zamknieciu dymku/czatu.
//   Stan w pamieci (bez zapisu na urzadzeniu).
// - Przebieg wizyty (podstrony + obejrzane sekcje) zbieramy TYLKO po zgodzie
//   na cookies analityczne (components/consent.ts) i wysylamy z rozmowa;
//   wtedy tez oznaczamy sesje Microsoft Clarity id rozmowy (nagranie
//   przypisane do czatu). Bez zgody: nic nie zbieramy.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeFromPathname, type Locale } from "@/lib/i18n";
import { CONSENT_EVENT, CONSENT_STORAGE_KEY, hasAnalyticsConsent } from "@/components/consent";

const HIDDEN_PREFIXES = ["/admin", "/panel", "/auth", "/claim"];
const NO_TEASER_PREFIXES = ["/koszyk", "/regulamin", "/polityka-prywatnosci", "/reklamacja"];
const CHAT_KEY = "km-support-chat";
const JOURNEY_KEY = "km-support-journey";
const MAX_TEASERS = 2;
const TEASER_GAP_MS = 90_000;

type TeaserKind = "idle" | "pricing" | "faq" | "exit";

interface Texts {
  open: string; close: string; title: string; aiBadge: string;
  teaser: Record<TeaserKind, string>;
  intro: string; email: string; human: string; checking: string; humanOk: string;
  termsBefore: string; terms: string; termsMiddle: string; privacy: string; termsAfter: string;
  start: string; placeholder: string; send: string; disclaimer: string; end: string;
  errEmail: string; errHuman: string; errGeneric: string; errLimit: string; errAi: string; greeting: string;
}

const T: Record<Locale, Texts> = {
  pl: {
    open: "Czat z asystentem", close: "Zamknij", title: "Asystent KalkMate", aiBadge: "AI",
    teaser: { idle: "Cześć! 👋 Masz pytanie o KalkMate? Chętnie pomogę.", pricing: "Zastanawiasz się nad zakupem? Zapytaj o cokolwiek — wysyłka, czas dostawy, tokeny AI.", faq: "Nie ma tu Twojego pytania? Napisz do mnie.", exit: "Zanim wyjdziesz — mogę w czymś pomóc?" },
    intro: "Podaj e-mail, żebyśmy mogli też odpisać, gdyby asystent nie znał odpowiedzi.", email: "Twój e-mail", human: "Nie jestem robotem", checking: "Sprawdzam…", humanOk: "Potwierdzone",
    termsBefore: "Akceptuję ", terms: "regulamin czatu", termsMiddle: " i zapoznałem/am się z ", privacy: "polityką prywatności", termsAfter: ".",
    start: "Rozpocznij czat", placeholder: "Napisz wiadomość…", send: "Wyślij", disclaimer: "Odpowiada AI — może się mylić. W sprawie zamówień: kontakt@kalkmate.pl", end: "Zakończ",
    errEmail: "Podaj poprawny e-mail.", errHuman: "Potwierdź, że nie jesteś robotem.", errGeneric: "Coś poszło nie tak. Spróbuj ponownie.", errLimit: "Limit wiadomości — napisz na kontakt@kalkmate.pl.", errAi: "Asystent chwilowo nie odpowiada. Spróbuj za chwilę.",
    greeting: "Cześć! Jestem asystentem AI KalkMate. O co chcesz zapytać?",
  },
  en: {
    open: "Chat with assistant", close: "Close", title: "KalkMate Assistant", aiBadge: "AI",
    teaser: { idle: "Hi! 👋 Got a question about KalkMate? Happy to help.", pricing: "Thinking about buying? Ask me anything — shipping, delivery time, AI tokens.", faq: "Can't find your question here? Ask me.", exit: "Before you go — can I help with anything?" },
    intro: "Leave your e-mail so we can reply if the assistant doesn't know the answer.", email: "Your e-mail", human: "I'm not a robot", checking: "Checking…", humanOk: "Confirmed",
    termsBefore: "I accept the ", terms: "chat terms", termsMiddle: " and have read the ", privacy: "privacy policy", termsAfter: ".",
    start: "Start chat", placeholder: "Type a message…", send: "Send", disclaimer: "Answers are AI-generated and may be wrong. For orders: kontakt@kalkmate.pl", end: "End",
    errEmail: "Enter a valid e-mail.", errHuman: "Please confirm you're not a robot.", errGeneric: "Something went wrong. Please try again.", errLimit: "Message limit reached — write to kontakt@kalkmate.pl.", errAi: "The assistant isn't responding right now. Try again shortly.",
    greeting: "Hi! I'm the KalkMate AI assistant. What would you like to know?",
  },
  de: {
    open: "Chat mit Assistent", close: "Schließen", title: "KalkMate Assistent", aiBadge: "KI",
    teaser: { idle: "Hallo! 👋 Fragen zu KalkMate? Ich helfe gern.", pricing: "Überlegst du zu kaufen? Frag mich alles — Versand, Lieferzeit, KI-Tokens.", faq: "Deine Frage ist nicht dabei? Schreib mir.", exit: "Bevor du gehst — kann ich helfen?" },
    intro: "Gib deine E-Mail an, damit wir antworten können, falls der Assistent etwas nicht weiß.", email: "Deine E-Mail", human: "Ich bin kein Roboter", checking: "Prüfe…", humanOk: "Bestätigt",
    termsBefore: "Ich akzeptiere die ", terms: "Chat-Bedingungen", termsMiddle: " und habe die ", privacy: "Datenschutzerklärung", termsAfter: " gelesen.",
    start: "Chat starten", placeholder: "Nachricht schreiben…", send: "Senden", disclaimer: "Antworten von KI — können Fehler enthalten. Bestellungen: kontakt@kalkmate.pl", end: "Beenden",
    errEmail: "Bitte gültige E-Mail angeben.", errHuman: "Bitte bestätige, dass du kein Roboter bist.", errGeneric: "Etwas ist schiefgelaufen. Bitte erneut versuchen.", errLimit: "Nachrichtenlimit erreicht — schreib an kontakt@kalkmate.pl.", errAi: "Der Assistent antwortet gerade nicht. Versuch es gleich nochmal.",
    greeting: "Hallo! Ich bin der KI-Assistent von KalkMate. Was möchtest du wissen?",
  },
  cs: {
    open: "Chat s asistentem", close: "Zavřít", title: "Asistent KalkMate", aiBadge: "AI",
    teaser: { idle: "Ahoj! 👋 Máš otázku ke KalkMate? Rád pomůžu.", pricing: "Přemýšlíš o koupi? Zeptej se na cokoli — doprava, dodání, AI tokeny.", faq: "Nenašel jsi svou otázku? Napiš mi.", exit: "Než odejdeš — můžu s něčím pomoct?" },
    intro: "Zadej e-mail, abychom mohli odpovědět, pokud asistent odpověď nezná.", email: "Tvůj e-mail", human: "Nejsem robot", checking: "Ověřuji…", humanOk: "Ověřeno",
    termsBefore: "Souhlasím s ", terms: "podmínkami chatu", termsMiddle: " a četl/a jsem ", privacy: "zásady ochrany soukromí", termsAfter: ".",
    start: "Začít chat", placeholder: "Napiš zprávu…", send: "Odeslat", disclaimer: "Odpovídá AI — může se mýlit. Objednávky: kontakt@kalkmate.pl", end: "Ukončit",
    errEmail: "Zadej platný e-mail.", errHuman: "Potvrď, že nejsi robot.", errGeneric: "Něco se pokazilo. Zkus to znovu.", errLimit: "Limit zpráv — napiš na kontakt@kalkmate.pl.", errAi: "Asistent teď neodpovídá. Zkus to za chvíli.",
    greeting: "Ahoj! Jsem AI asistent KalkMate. Na co se chceš zeptat?",
  },
  sk: {
    open: "Chat s asistentom", close: "Zavrieť", title: "Asistent KalkMate", aiBadge: "AI",
    teaser: { idle: "Ahoj! 👋 Máš otázku o KalkMate? Rád pomôžem.", pricing: "Rozmýšľaš o kúpe? Spýtaj sa na čokoľvek — doprava, doručenie, AI tokeny.", faq: "Nenašiel si svoju otázku? Napíš mi.", exit: "Kým odídeš — môžem s niečím pomôcť?" },
    intro: "Zadaj e-mail, aby sme mohli odpovedať, ak asistent odpoveď nepozná.", email: "Tvoj e-mail", human: "Nie som robot", checking: "Overujem…", humanOk: "Overené",
    termsBefore: "Súhlasím s ", terms: "podmienkami chatu", termsMiddle: " a prečítal/a som si ", privacy: "zásady ochrany súkromia", termsAfter: ".",
    start: "Začať chat", placeholder: "Napíš správu…", send: "Odoslať", disclaimer: "Odpovedá AI — môže sa mýliť. Objednávky: kontakt@kalkmate.pl", end: "Ukončiť",
    errEmail: "Zadaj platný e-mail.", errHuman: "Potvrď, že nie si robot.", errGeneric: "Niečo sa pokazilo. Skús to znova.", errLimit: "Limit správ — napíš na kontakt@kalkmate.pl.", errAi: "Asistent teraz neodpovedá. Skús to o chvíľu.",
    greeting: "Ahoj! Som AI asistent KalkMate. Na čo sa chceš opýtať?",
  },
  lt: {
    open: "Pokalbis su asistentu", close: "Uždaryti", title: "KalkMate asistentas", aiBadge: "DI",
    teaser: { idle: "Labas! 👋 Turi klausimą apie KalkMate? Mielai padėsiu.", pricing: "Svarstai pirkti? Klausk ko nori — siuntimas, pristatymas, DI žetonai.", faq: "Neradai savo klausimo? Parašyk man.", exit: "Prieš išeidamas — ar galiu kuo padėti?" },
    intro: "Įvesk el. paštą, kad galėtume atsakyti, jei asistentas nežinos atsakymo.", email: "Tavo el. paštas", human: "Aš ne robotas", checking: "Tikrinama…", humanOk: "Patvirtinta",
    termsBefore: "Sutinku su ", terms: "pokalbio taisyklėmis", termsMiddle: " ir susipažinau su ", privacy: "privatumo politika", termsAfter: ".",
    start: "Pradėti pokalbį", placeholder: "Rašyk žinutę…", send: "Siųsti", disclaimer: "Atsako DI — gali klysti. Dėl užsakymų: kontakt@kalkmate.pl", end: "Baigti",
    errEmail: "Įvesk teisingą el. paštą.", errHuman: "Patvirtink, kad nesi robotas.", errGeneric: "Kažkas nepavyko. Bandyk dar kartą.", errLimit: "Pasiektas žinučių limitas — rašyk kontakt@kalkmate.pl.", errAi: "Asistentas šiuo metu neatsako. Pabandyk netrukus.",
    greeting: "Labas! Aš KalkMate DI asistentas. Ką norėtum sužinoti?",
  },
  be: {
    open: "Чат з асістэнтам", close: "Закрыць", title: "Асістэнт KalkMate", aiBadge: "ШІ",
    teaser: { idle: "Прывітанне! 👋 Ёсць пытанне пра KalkMate? З радасцю дапамагу.", pricing: "Думаеш пра куплю? Пытайся пра ўсё — дастаўка, тэрміны, токены ШІ.", faq: "Няма твайго пытання? Напішы мне.", exit: "Перш чым сысці — магу чымсьці дапамагчы?" },
    intro: "Пакінь e-mail, каб мы маглі адказаць, калі асістэнт не ведае адказу.", email: "Твой e-mail", human: "Я не робат", checking: "Правяраю…", humanOk: "Пацверджана",
    termsBefore: "Я прымаю ", terms: "правілы чата", termsMiddle: " і азнаёміўся/лася з ", privacy: "палітыкай прыватнасці", termsAfter: ".",
    start: "Пачаць чат", placeholder: "Напішы паведамленне…", send: "Адправіць", disclaimer: "Адказвае ШІ — можа памыляцца. Заказы: kontakt@kalkmate.pl", end: "Скончыць",
    errEmail: "Увядзі правільны e-mail.", errHuman: "Пацвердзі, што ты не робат.", errGeneric: "Нешта пайшло не так. Паспрабуй яшчэ раз.", errLimit: "Ліміт паведамленняў — напішы на kontakt@kalkmate.pl.", errAi: "Асістэнт зараз не адказвае. Паспрабуй крыху пазней.",
    greeting: "Прывітанне! Я ШІ-асістэнт KalkMate. Што хочаш даведацца?",
  },
  es: {
    open: "Chat con el asistente", close: "Cerrar", title: "Asistente KalkMate", aiBadge: "IA",
    teaser: { idle: "¡Hola! 👋 ¿Tienes alguna pregunta sobre KalkMate? Te ayudo.", pricing: "¿Pensando en comprar? Pregúntame lo que quieras — envío, plazos, tokens de IA.", faq: "¿No encuentras tu pregunta? Escríbeme.", exit: "Antes de irte — ¿te puedo ayudar en algo?" },
    intro: "Deja tu e-mail para que podamos responderte si el asistente no sabe la respuesta.", email: "Tu e-mail", human: "No soy un robot", checking: "Comprobando…", humanOk: "Confirmado",
    termsBefore: "Acepto las ", terms: "condiciones del chat", termsMiddle: " y he leído la ", privacy: "política de privacidad", termsAfter: ".",
    start: "Iniciar chat", placeholder: "Escribe un mensaje…", send: "Enviar", disclaimer: "Responde una IA — puede equivocarse. Pedidos: kontakt@kalkmate.pl", end: "Terminar",
    errEmail: "Introduce un e-mail válido.", errHuman: "Confirma que no eres un robot.", errGeneric: "Algo salió mal. Inténtalo de nuevo.", errLimit: "Límite de mensajes — escribe a kontakt@kalkmate.pl.", errAi: "El asistente no responde ahora. Inténtalo en un momento.",
    greeting: "¡Hola! Soy el asistente de IA de KalkMate. ¿Qué quieres saber?",
  },
  pt: {
    open: "Chat com o assistente", close: "Fechar", title: "Assistente KalkMate", aiBadge: "IA",
    teaser: { idle: "Olá! 👋 Tens alguma pergunta sobre o KalkMate? Eu ajudo.", pricing: "A pensar em comprar? Pergunta o que quiseres — envio, prazos, tokens de IA.", faq: "Não encontras a tua pergunta? Escreve-me.", exit: "Antes de saíres — posso ajudar em alguma coisa?" },
    intro: "Deixa o teu e-mail para podermos responder se o assistente não souber.", email: "O teu e-mail", human: "Não sou um robô", checking: "A verificar…", humanOk: "Confirmado",
    termsBefore: "Aceito os ", terms: "termos do chat", termsMiddle: " e li a ", privacy: "política de privacidade", termsAfter: ".",
    start: "Iniciar chat", placeholder: "Escreve uma mensagem…", send: "Enviar", disclaimer: "Responde uma IA — pode errar. Encomendas: kontakt@kalkmate.pl", end: "Terminar",
    errEmail: "Introduz um e-mail válido.", errHuman: "Confirma que não és um robô.", errGeneric: "Algo correu mal. Tenta novamente.", errLimit: "Limite de mensagens — escreve para kontakt@kalkmate.pl.", errAi: "O assistente não está a responder. Tenta daqui a pouco.",
    greeting: "Olá! Sou o assistente de IA do KalkMate. O que queres saber?",
  },
  fr: {
    open: "Chat avec l'assistant", close: "Fermer", title: "Assistant KalkMate", aiBadge: "IA",
    teaser: { idle: "Salut ! 👋 Une question sur KalkMate ? Je t'aide volontiers.", pricing: "Tu hésites à acheter ? Demande-moi tout — livraison, délais, jetons IA.", faq: "Ta question n'y est pas ? Écris-moi.", exit: "Avant de partir — je peux t'aider ?" },
    intro: "Laisse ton e-mail pour qu'on puisse te répondre si l'assistant ne sait pas.", email: "Ton e-mail", human: "Je ne suis pas un robot", checking: "Vérification…", humanOk: "Confirmé",
    termsBefore: "J'accepte les ", terms: "conditions du chat", termsMiddle: " et j'ai lu la ", privacy: "politique de confidentialité", termsAfter: ".",
    start: "Démarrer le chat", placeholder: "Écris un message…", send: "Envoyer", disclaimer: "Réponses générées par IA — erreurs possibles. Commandes : kontakt@kalkmate.pl", end: "Terminer",
    errEmail: "Saisis un e-mail valide.", errHuman: "Confirme que tu n'es pas un robot.", errGeneric: "Un problème est survenu. Réessaie.", errLimit: "Limite de messages — écris à kontakt@kalkmate.pl.", errAi: "L'assistant ne répond pas pour le moment. Réessaie bientôt.",
    greeting: "Salut ! Je suis l'assistant IA de KalkMate. Que veux-tu savoir ?",
  },
  it: {
    open: "Chat con l'assistente", close: "Chiudi", title: "Assistente KalkMate", aiBadge: "IA",
    teaser: { idle: "Ciao! 👋 Hai una domanda su KalkMate? Ti aiuto volentieri.", pricing: "Stai pensando di comprare? Chiedimi qualsiasi cosa — spedizione, tempi, token IA.", faq: "Non trovi la tua domanda? Scrivimi.", exit: "Prima di andare — posso aiutarti?" },
    intro: "Lascia la tua e-mail così possiamo risponderti se l'assistente non sa la risposta.", email: "La tua e-mail", human: "Non sono un robot", checking: "Verifica…", humanOk: "Confermato",
    termsBefore: "Accetto le ", terms: "condizioni della chat", termsMiddle: " e ho letto l'", privacy: "informativa privacy", termsAfter: ".",
    start: "Avvia chat", placeholder: "Scrivi un messaggio…", send: "Invia", disclaimer: "Risponde un'IA — può sbagliare. Ordini: kontakt@kalkmate.pl", end: "Termina",
    errEmail: "Inserisci un'e-mail valida.", errHuman: "Conferma di non essere un robot.", errGeneric: "Qualcosa è andato storto. Riprova.", errLimit: "Limite di messaggi — scrivi a kontakt@kalkmate.pl.", errAi: "L'assistente non risponde al momento. Riprova tra poco.",
    greeting: "Ciao! Sono l'assistente IA di KalkMate. Cosa vuoi sapere?",
  },
};

// ---------------------------------------------------------------------------
// Przebieg wizyty (tylko za zgoda na cookies analityczne)
// ---------------------------------------------------------------------------
interface JourneyEntry { t: number; kind: "page" | "section"; path: string; section?: string }

function readJourney(): JourneyEntry[] {
  if (!hasAnalyticsConsent()) return [];
  try { return JSON.parse(sessionStorage.getItem(JOURNEY_KEY) || "[]") as JourneyEntry[]; } catch { return []; }
}

function pushJourney(e: JourneyEntry) {
  if (!hasAnalyticsConsent()) return;
  try {
    const list = readJourney();
    const last = list[list.length - 1];
    if (last && last.kind === e.kind && last.path === e.path && last.section === e.section) return;
    list.push(e);
    sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(list.slice(-60)));
  } catch { /* brak storage — trudno */ }
}

// Zaczepki — stan w pamieci (przezywa nawigacje SPA, nie przezywa przeladowania).
const teaserState = { shown: 0, lastAt: 0, blocked: false };

function consentDecided(): boolean {
  try { return !!localStorage.getItem(CONSENT_STORAGE_KEY); } catch { return true; }
}

// Proof-of-work (lib/supportChat.ts verifyPow): sha256("<challenge>:<nonce>")
// z co najmniej `bits` zerowymi bitami na poczatku. Partie po 512 skrotow.
async function solvePow(challenge: string, bits: number): Promise<string> {
  const enc = new TextEncoder();
  const ok = (buf: ArrayBuffer) => {
    const b = new Uint8Array(buf);
    let need = bits;
    for (let i = 0; need > 0; i++) {
      if (need >= 8) { if (b[i] !== 0) return false; need -= 8; } else { return b[i] >> (8 - need) === 0; }
    }
    return true;
  };
  for (let base = 0; base < 50_000_000; base += 512) {
    const hashes = await Promise.all(
      Array.from({ length: 512 }, (_, i) => crypto.subtle.digest("SHA-256", enc.encode(`${challenge}:${base + i}`)))
    );
    const hit = hashes.findIndex(ok);
    if (hit >= 0) return String(base + hit);
  }
  throw new Error("pow");
}

interface Msg { role: "user" | "assistant"; content: string }

export default function SupportWidget() {
  const pathname = usePathname() || "/";
  const lang = localeFromPathname(pathname);
  const t = T[lang] ?? T.pl;
  const hidden = HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState<TeaserKind | null>(null);
  const [chat, setChat] = useState<{ chatId: string; token: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [human, setHuman] = useState<"no" | "checking" | "ok">("no");
  const [pow, setPow] = useState<{ challenge: string; sig: string; nonce: string } | null>(null);
  const [terms, setTerms] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Wznowienie rozmowy po przeladowaniu (id + token w localStorage —
  // niezbedne do dzialania czatu, o ktory klient sam poprosil).
  useEffect(() => {
    let saved: { chatId: string; token: string } | null = null;
    try { saved = JSON.parse(localStorage.getItem(CHAT_KEY) || "null"); } catch { /* brak */ }
    if (!saved?.chatId || !saved?.token) return;
    const s = saved;
    fetch(`/api/support/message?chatId=${encodeURIComponent(s.chatId)}&token=${encodeURIComponent(s.token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.ok) { try { localStorage.removeItem(CHAT_KEY); } catch { /* */ } return; }
        setChat(s);
        setMessages(data.messages.map((m: Msg) => ({ role: m.role, content: m.content })));
        teaserState.blocked = true;
      })
      .catch(() => { /* offline — sprobujemy przy nastepnym wejsciu */ });
  }, []);

  // Przebieg wizyty: podstrony + sekcje widoczne >= 1,5 s.
  useEffect(() => {
    if (hidden) return;
    pushJourney({ t: Date.now(), kind: "page", path: pathname });
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).id;
        if (e.isIntersecting) {
          timers.set(e.target, setTimeout(() => pushJourney({ t: Date.now(), kind: "section", path: pathname, section: id }), 1500));
        } else {
          clearTimeout(timers.get(e.target));
        }
      }
    }, { threshold: 0.35 });
    document.querySelectorAll("section[id]").forEach((el) => io.observe(el));
    return () => { io.disconnect(); timers.forEach(clearTimeout); };
  }, [pathname, hidden]);

  // Zaczepki.
  const showTeaser = useCallback((kind: TeaserKind) => {
    const now = Date.now();
    if (teaserState.blocked || teaserState.shown >= MAX_TEASERS || now - teaserState.lastAt < TEASER_GAP_MS) return;
    if (!consentDecided()) return; // nie zaslaniamy banera cookies
    teaserState.shown++;
    teaserState.lastAt = now;
    setTeaser(kind);
  }, []);

  useEffect(() => {
    if (hidden || open || NO_TEASER_PREFIXES.some((p) => pathname.startsWith(p))) return;
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => showTeaser("idle"), 35_000)];
    const seen = new Map<string, ReturnType<typeof setTimeout>>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).id;
        const kind: TeaserKind = id === "kup-teraz" ? "pricing" : "faq";
        if (e.isIntersecting) seen.set(id, setTimeout(() => showTeaser(kind), kind === "pricing" ? 6000 : 10_000));
        else clearTimeout(seen.get(id));
      }
    }, { threshold: 0.3 });
    ["kup-teraz", "faq"].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    const enteredAt = Date.now();
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget && Date.now() - enteredAt > 15_000) showTeaser("exit");
    };
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (fine) document.addEventListener("mouseout", onLeave);
    return () => {
      timers.forEach(clearTimeout);
      seen.forEach(clearTimeout);
      io.disconnect();
      if (fine) document.removeEventListener("mouseout", onLeave);
    };
  }, [pathname, hidden, open, showTeaser]);

  // Ponowne sprawdzenie po decyzji w banerze cookies (zaczepki czekaja na nia).
  useEffect(() => {
    const onConsent = () => { if (hasAnalyticsConsent()) pushJourney({ t: Date.now(), kind: "page", path: window.location.pathname }); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const openChat = () => { setOpen(true); setTeaser(null); teaserState.blocked = true; };
  const closeChat = () => { setOpen(false); teaserState.blocked = true; };
  const dismissTeaser = () => { setTeaser(null); teaserState.blocked = true; };

  const checkHuman = async () => {
    if (human !== "no") return;
    setHuman("checking");
    setError("");
    try {
      const res = await fetch("/api/support/challenge", { cache: "no-store" });
      const c = await res.json();
      if (!c.ok) throw new Error("challenge");
      const nonce = await solvePow(c.challenge, c.bits);
      setPow({ challenge: c.challenge, sig: c.sig, nonce });
      setHuman("ok");
    } catch {
      setHuman("no");
      setError(t.errGeneric);
    }
  };

  const errorText = (code: string) =>
    code === "email" ? t.errEmail : code === "human_check" ? t.errHuman : code === "limit" ? t.errLimit : code === "ai" ? t.errAi : t.errGeneric;

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError(t.errEmail); return; }
    if (human !== "ok" || !pow) { setError(t.errHuman); return; }
    setBusy(true);
    setError("");
    const tracking = hasAnalyticsConsent();
    try {
      const res = await fetch("/api/support/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(), acceptTerms: terms, website: honeypot, lang, page: window.location.pathname,
          trackingConsent: tracking, journey: tracking ? readJourney() : undefined, ...pow,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "generic" }));
      if (!data.ok) {
        // Wyzwanie PoW jest jednorazowe — po bledzie trzeba potwierdzic jeszcze raz.
        setPow(null); setHuman("no");
        setError(errorText(data.error));
        return;
      }
      const c = { chatId: data.chatId as string, token: data.token as string };
      try { localStorage.setItem(CHAT_KEY, JSON.stringify(c)); } catch { /* bez wznawiania */ }
      setChat(c);
      setMessages([]);
      // Nagranie Clarity przypisane do rozmowy (tylko za zgoda — Clarity bez niej w ogole nie dziala).
      const w = window as unknown as { clarity?: (...a: unknown[]) => void };
      if (tracking && typeof w.clarity === "function") {
        try { w.clarity("set", "support_chat", c.chatId); } catch { /* ignore */ }
      }
    } catch {
      setError(t.errGeneric);
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !chat || busy) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const tracking = hasAnalyticsConsent();
      const res = await fetch("/api/support/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...chat, text, page: window.location.pathname, journey: tracking ? readJourney() : undefined }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "generic" }));
      if (!data.ok) {
        if (data.error === "not_found") { endChat(); return; }
        setError(errorText(data.error));
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setError(t.errGeneric);
    } finally {
      setBusy(false);
    }
  };

  const endChat = () => {
    try { localStorage.removeItem(CHAT_KEY); } catch { /* */ }
    setChat(null);
    setMessages([]);
    setPow(null);
    setHuman("no");
    setTerms(false);
  };

  if (hidden) return null;

  const fieldCls = "w-full px-3 py-2.5 bg-[#151515] border border-[rgba(242,237,227,0.14)] text-[14px] text-[#F2EDE3] placeholder:text-[#F2EDE3]/35 focus:outline-none focus:border-[#D8FF3D]/60";

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[90] flex flex-col items-end gap-3 max-w-[calc(100vw-2rem)]">
      {open && (
        <div
          role="dialog"
          aria-label={t.title}
          className="w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100dvh-7rem))] flex flex-col bg-[#0B0B0B] border border-[rgba(242,237,227,0.14)] shadow-2xl shadow-black/60"
        >
          <div className="flex items-center gap-2 px-4 h-12 border-b border-[rgba(242,237,227,0.10)] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#D8FF3D]" aria-hidden />
            <span className="text-[14px] font-semibold text-[#F2EDE3]">{t.title}</span>
            <span className="km-mono-eyebrow text-[10px] px-1.5 py-0.5 border border-[#D8FF3D]/40 text-[#D8FF3D]">{t.aiBadge}</span>
            <div className="ml-auto flex items-center gap-1">
              {chat && (
                <button type="button" onClick={endChat} className="text-[12px] px-2 py-1 text-[#F2EDE3]/50 hover:text-[#F2EDE3]">{t.end}</button>
              )}
              <button type="button" onClick={closeChat} aria-label={t.close} className="w-8 h-8 grid place-items-center text-[#F2EDE3]/60 hover:text-[#F2EDE3]">✕</button>
            </div>
          </div>

          {!chat ? (
            <form onSubmit={start} className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-[14px] leading-relaxed text-[#F2EDE3]/80">{t.greeting}</p>
              <p className="text-[13px] leading-relaxed text-[#F2EDE3]/55">{t.intro}</p>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} className={fieldCls} maxLength={200} />
              {/* Honeypot — niewidoczny dla ludzi. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="absolute -left-[9999px] w-px h-px opacity-0" aria-hidden />
              <button
                type="button"
                onClick={checkHuman}
                disabled={human !== "no"}
                className="w-full flex items-center gap-3 px-3 py-3 border border-[rgba(242,237,227,0.14)] bg-[#151515] text-left text-[14px] text-[#F2EDE3]"
              >
                <span className={`w-5 h-5 grid place-items-center border ${human === "ok" ? "bg-[#D8FF3D] border-[#D8FF3D] text-black" : "border-[#F2EDE3]/40"}`}>
                  {human === "ok" ? "✓" : human === "checking" ? <span className="w-3 h-3 border-2 border-[#D8FF3D] border-t-transparent rounded-full animate-spin" /> : null}
                </span>
                {human === "checking" ? t.checking : human === "ok" ? t.humanOk : t.human}
              </button>
              <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[#F2EDE3]/65">
                <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 accent-[#D8FF3D]" />
                <span>
                  {t.termsBefore}
                  <Link href="/regulamin#sek-8" target="_blank" className="text-[#D8FF3D] hover:underline">{t.terms}</Link>
                  {t.termsMiddle}
                  <Link href="/polityka-prywatnosci" target="_blank" className="text-[#D8FF3D] hover:underline">{t.privacy}</Link>
                  {t.termsAfter}
                </span>
              </label>
              {error && <p className="text-[13px] text-red-400">{error}</p>}
              <button type="submit" disabled={busy || human !== "ok" || !terms} className="w-full py-3 bg-[#D8FF3D] text-black text-[14px] font-semibold disabled:opacity-40">
                {busy ? "…" : t.start}
              </button>
              <p className="text-[11px] text-[#F2EDE3]/40">{t.disclaimer}</p>
            </form>
          ) : (
            <>
              <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
                <div className="max-w-[85%] px-3 py-2 bg-[#151515] text-[14px] leading-relaxed text-[#F2EDE3]/90">{t.greeting}</div>
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[85%] px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === "user" ? "ml-auto bg-[#D8FF3D] text-black" : "bg-[#151515] text-[#F2EDE3]/90"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {busy && (
                  <div className="w-14 px-3 py-2 bg-[#151515] text-[#F2EDE3]/60 text-[14px] tracking-widest animate-pulse">•••</div>
                )}
                {error && <p className="text-[13px] text-red-400">{error}</p>}
              </div>
              <form onSubmit={send} className="shrink-0 border-t border-[rgba(242,237,227,0.10)] p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t.placeholder}
                    maxLength={1000}
                    className={fieldCls}
                    aria-label={t.placeholder}
                  />
                  <button type="submit" disabled={busy || !input.trim()} className="px-4 bg-[#D8FF3D] text-black text-[14px] font-semibold disabled:opacity-40">{t.send}</button>
                </div>
                <p className="text-[11px] text-[#F2EDE3]/40">{t.disclaimer}</p>
              </form>
            </>
          )}
        </div>
      )}

      {!open && teaser && (
        <div className="relative w-[min(300px,calc(100vw-2rem))] bg-[#0B0B0B] border border-[#D8FF3D]/40 shadow-xl shadow-black/50">
          <button type="button" onClick={openChat} className="block w-full text-left px-4 py-3 pr-9 text-[14px] leading-relaxed text-[#F2EDE3]">
            {t.teaser[teaser]}
          </button>
          <button type="button" onClick={dismissTeaser} aria-label={t.close} className="absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center text-[#F2EDE3]/50 hover:text-[#F2EDE3]">✕</button>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={openChat}
          aria-label={t.open}
          className="w-14 h-14 rounded-full bg-[#D8FF3D] text-black grid place-items-center shadow-lg shadow-black/50 hover:scale-105 transition-transform"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
