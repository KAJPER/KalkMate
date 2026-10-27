// Tlumaczenie maili w panelu Poczta (/admin/mailbox) — przez OpenRouter,
// niezaleznie od mechanizmu tokenow userow (to koszt operacyjny firmy, nie
// zuzycie klienta, wiec woalmy OpenRouter bezposrednio, tak jak /api/device/solve).
//
// Model celowo tani/szybki — tlumaczenie to prosta, deterministyczna operacja,
// nie potrzeba tu drogiego modelu rozumowania.

import { KALKMATE_KNOWLEDGE } from "@/lib/mailReply";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TRANSLATE_MODEL = process.env.MAILBOX_TRANSLATE_MODEL || "google/gemini-3.8-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Limit dlugosci tekstu wysylanego do tlumaczenia — ochrona przed
// pojedynczym gigantycznym mailem zjadajacym cala odpowiedz/koszt.
const MAX_CHARS = 12000;

async function callTranslate(system: string, user: string, maxTokens = 4000, temperature = 0.2): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter API key not configured");
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kalkmate.pl",
      "X-Title": "KalkMate",
    },
    // Bez limitu zawieszony OpenRouter trzymal request panelu w nieskonczonosc.
    // Newsletter (do 12k tokenow wyjscia) dostaje wiecej czasu niz zwykly mail.
    signal: AbortSignal.timeout(maxTokens > 4000 ? 90_000 : 60_000),
    body: JSON.stringify({
      model: TRANSLATE_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      // gemini-3.8-flash ma OBOWIAZKOWY reasoning (OpenRouter odrzuca
      // "effort":"none" bledem 400 dla tego modelu) i przy dluzszych mailach
      // potrafilo zjesc caly max_tokens na wewnetrzne rozumowanie, zwracajac
      // pusta tresc (obserwowane na zywo: "Pusta odpowiedz modelu"). "minimal"
      // to najnizszy dopuszczalny poziom — zweryfikowane ze zwraca
      // reasoning_tokens=0 i pelne, poprawne tlumaczenie.
      reasoning: { effort: "minimal" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Pusta odpowiedz modelu");
  return content.trim();
}

// Tlumaczy dowolna wiadomosc (mail przychodzacy) na polski, do czytania.
export async function translateToPolish(text: string): Promise<string> {
  return callTranslate(
    "Jestes tlumaczem. Przetlumacz podana wiadomosc e-mail na jezyk polski. " +
      "Zachowaj ton, sens i podzial na akapity/linie. Wypisz WYLACZNIE tlumaczenie " +
      "— bez komentarzy, bez cudzyslowow, bez dopiskow typu 'Oto tlumaczenie:'.",
    text.slice(0, MAX_CHARS)
  );
}

// Tlumaczy SZKIC odpowiedzi (po polsku) na jezyk, w ktorym napisany jest
// oryginalny mail klienta — model sam rozpoznaje jezyk z referenceText,
// wiec nie trzeba osobnej detekcji jezyka po stronie serwera.
export async function translateMatchingLanguage(draftText: string, referenceText: string): Promise<string> {
  return callTranslate(
    "Jestes tlumaczem. Otrzymasz oryginalny mail klienta oraz szkic odpowiedzi " +
      "napisany po polsku. Przetlumacz SZKIC ODPOWIEDZI na TEN SAM jezyk, w ktorym " +
      "napisany jest oryginalny mail klienta. Jesli oryginalny mail jest juz po polsku, " +
      "zwroc szkic bez zmian (co najwyzej z drobna korekta stylistyczna). Wypisz " +
      "WYLACZNIE przetlumaczona odpowiedz — bez komentarzy, bez nazwy jezyka, bez cudzyslowow.",
    `[ORYGINALNY MAIL KLIENTA]\n${referenceText.slice(0, MAX_CHARS / 2)}\n\n[SZKIC ODPOWIEDZI PO POLSKU]\n${draftText.slice(0, MAX_CHARS / 2)}`
  );
}

// === Newsletter (/admin/newsletter) ===
// Admin pisze po polsku, odbiorcy dostaja wersje w swoim jezyku (wszystkie
// jezyki strony poza pl — lib/newsletter.ts NL_TRANSLATED_LANGS). Jedno
// wywolanie na jezyk, wszystkie pola naraz w JSON, zeby temat, tytul i tresc
// byly spojne.

export interface NewsletterTexts {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaText: string;
}

export type NewsletterTargetLang = "en" | "de" | "cs" | "sk" | "lt" | "be" | "es" | "pt" | "fr" | "it";

const LANG_NAMES: Record<NewsletterTargetLang, string> = {
  en: "English",
  de: "German (Deutsch)",
  cs: "Czech (čeština)",
  sk: "Slovak (slovenčina)",
  lt: "Lithuanian (lietuvių)",
  be: "Belarusian (беларуская, Cyrillic script)",
  es: "Spanish (español, Spain)",
  pt: "European Portuguese (português de Portugal)",
  fr: "French (français)",
  it: "Italian (italiano)",
};

// Ton jak na stronie KalkMate (forma "ty" / odpowiednik) + poprawna pisownia.
const LANG_STYLE: Record<NewsletterTargetLang, string> = {
  en: "",
  de: " Use informal \"du\" (as on the KalkMate website).",
  cs: " Use informal \"ty\" (as on the KalkMate website) and proper Czech diacritics.",
  sk: " Use informal \"ty\" (as on the KalkMate website) and proper Slovak diacritics.",
  lt: " Use informal \"tu\" (as on the KalkMate website) and proper Lithuanian diacritics.",
  be: " Use informal \"ты\", standard modern Belarusian orthography in Cyrillic (not Russian, not Łacinka).",
  es: " Use informal \"tú\" (as on the KalkMate website), European Spanish.",
  pt: " Use informal \"tu\" (as on the KalkMate website), European Portuguese spelling (not Brazilian).",
  fr: " Use informal \"tu\" (as on the KalkMate website) and French typography (non-breaking space before ? ! : ;).",
  it: " Use informal \"tu\" (as on the KalkMate website).",
};

// Nazwa polskiej matury w danym jezyku (tam, gdzie brzmi naturalnie).
const MATURA_HINT: Record<NewsletterTargetLang, string> = {
  en: "\"final exams (Matura)\"",
  de: "\"Abitur/Matura\" only where it reads naturally",
  cs: "\"maturita\"",
  sk: "\"maturita\"",
  lt: "\"brandos egzaminai\"",
  be: "\"выпускныя экзамены\"",
  es: "\"selectividad / exámenes finales\"",
  pt: "\"exames nacionais\"",
  fr: "\"bac\"",
  it: "\"maturità\"",
};

export async function translateNewsletter(src: NewsletterTexts, target: NewsletterTargetLang): Promise<NewsletterTexts> {
  const system =
    `You translate marketing newsletters of KalkMate (an AI calculator for students, kalkmate.pl) from Polish to ${LANG_NAMES[target]}.\n` +
    "Rules:\n" +
    "- Natural, friendly, native-sounding copy for students and parents — not word-for-word." +
    LANG_STYLE[target] + "\n" +
    "- Keep the lightweight formatting EXACTLY: lines starting with \"## \" (heading) and \"- \" (list), **bold**, *italic*, [link text](url), blank lines between paragraphs.\n" +
    "- Keep the placeholder {{imie}} unchanged (it becomes the recipient's first name). Keep URLs, numbers, prices and the name KalkMate unchanged.\n" +
    `- The Polish exam name "matura" -> ${MATURA_HINT[target]}.\n` +
    "- Empty input fields stay empty strings.\n" +
    "- Answer with ONLY a JSON object with the same keys: subject, preheader, eyebrow, title, body, ctaText. No comments, no code fences.";
  const input = JSON.stringify(src);
  // Bez obcinania — uciety JSON bylby bezsensowny dla modelu.
  if (input.length > 20000) throw new Error("Newsletter jest za długi do automatycznego tłumaczenia (max ok. 20 000 znaków).");
  const raw = await callTranslate(system, input, 12000);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("Tłumaczenie: model nie zwrócił JSON");
  const out = JSON.parse(json) as Partial<NewsletterTexts>;
  const pick = (k: keyof NewsletterTexts) => (src[k] ? (typeof out[k] === "string" ? out[k]!.trim() : src[k]) : "");
  return {
    subject: pick("subject"), preheader: pick("preheader"), eyebrow: pick("eyebrow"),
    title: pick("title"), body: pick("body"), ctaText: pick("ctaText"),
  };
}

// === Newsletter — szkic z krotkiego opisu ("Napisz z AI" w /admin/newsletter) ===
// Admin opisuje w 1-2 zdaniach, co chce wyslac; model pisze wszystkie pola po
// polsku w formacie edytora. Fakty o produkcie z KALKMATE_KNOWLEDGE, zeby nie
// zmyslal funkcji. serviceNotice = wysylka takze do osob BEZ zgody
// marketingowej (newsletterInput.ts) — wtedy twardy zakaz tresci reklamowych.
export interface NewsletterDraftTexts extends NewsletterTexts {
  ctaUrl: string;
}

export async function composeNewsletter(brief: string, serviceNotice: boolean): Promise<NewsletterDraftTexts> {
  const system =
    "Piszesz newslettery KalkMate (kalkulator z ukrytym AI dla uczniow, kalkmate.pl) do zarejestrowanych uzytkownikow i kupujacych.\n" +
    "Dostajesz krotki opis od wlasciciela. Napisz z niego gotowy mail PO POLSKU.\n" +
    "Zasady:\n" +
    "- Zwracaj sie na \"ty\", przyjaznie i konkretnie, jak na stronie KalkMate. Bez korpomowy, bez przesady z wykrzyknikami.\n" +
    "- Tresc (body): zacznij od \"Czesc {{imie}},\" w osobnej linii (z polskimi znakami: \"Cześć {{imie}},\"), potem 2-4 krotkie akapity (lacznie ok. 60-180 slow). " +
    "Formatowanie TYLKO takie: pusta linia miedzy akapitami, \"## \" na poczatku linii = srodtytul, \"- \" = punkt listy, **pogrubienie**, [tekst](https://...) = link. Bez HTML, bez naglowkow \"#\" pojedynczych. Zakoncz podpisem \"Zespół KalkMate\".\n" +
    "- subject: max ok. 60 znakow, konkretny, najwyzej jedno emoji. preheader: max ok. 90 znakow, uzupelnia temat (nie powtarza go). " +
    "eyebrow: 1-2 slowa (np. \"Nowość\", \"Przerwa techniczna\", \"Promocja\"). title: krotki duzy naglowek, max ok. 50 znakow.\n" +
    "- ctaText + ctaUrl: przycisk tylko jesli ma sens (np. \"Zobacz nowości\" -> https://kalkmate.pl/panel). Uzywaj WYLACZNIE adresow https://kalkmate.pl/... (np. /panel, /pomoc, /) albo adresu podanego w opisie. Bez sensownego przycisku: oba pola puste.\n" +
    "- NIE wymyslaj faktow: dat, godzin, cen, kodow rabatowych, procentow, numerow wersji ani funkcji, ktorych nie ma w opisie lub w wiedzy o produkcie ponizej. Jesli opis czegos nie podaje, napisz ogolniej.\n" +
    (serviceNotice
      ? "- To KOMUNIKAT SERWISOWY wysylany takze do osob BEZ zgody marketingowej: tylko informacja o usludze/produkcie, ktory odbiorca ma. ZERO reklamy, promocji, rabatow, zachet do zakupu i linkow do sklepu.\n"
      : "") +
    "- Odpowiedz WYLACZNIE obiektem JSON z kluczami: subject, preheader, eyebrow, title, body, ctaText, ctaUrl. Bez komentarzy i bez ``` .\n\n" +
    KALKMATE_KNOWLEDGE;
  const raw = await callTranslate(system, `Opis newslettera od wlasciciela:\n${brief.slice(0, 2000)}`, 4000, 0.7);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("Model nie zwrócił JSON — spróbuj jeszcze raz");
  const out = JSON.parse(json) as Partial<Record<keyof NewsletterDraftTexts, unknown>>;
  const str = (k: keyof NewsletterDraftTexts, max: number) => (typeof out[k] === "string" ? (out[k] as string).trim().slice(0, max) : "");
  const body = str("body", 20000);
  if (!body) throw new Error("Model nie napisał treści — spróbuj jeszcze raz");
  const ctaUrl = str("ctaUrl", 500);
  const ctaText = str("ctaText", 60);
  // Link z opisu albo kalkmate.pl — inne adresy (zmyslone) odrzucamy razem z przyciskiem.
  const urlOk = /^https:\/\/(www\.)?kalkmate\.pl(\/|$)/.test(ctaUrl) || (!!ctaUrl && brief.includes(ctaUrl) && /^https?:\/\//.test(ctaUrl));
  return {
    subject: str("subject", 200),
    preheader: str("preheader", 200),
    eyebrow: str("eyebrow", 60),
    title: str("title", 200),
    body,
    ctaText: urlOk ? ctaText : "",
    ctaUrl: urlOk && ctaText ? ctaUrl : "",
  };
}
