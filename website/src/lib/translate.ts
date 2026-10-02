// Tlumaczenie maili w panelu Poczta (/admin/mailbox) — przez OpenRouter,
// niezaleznie od mechanizmu tokenow userow (to koszt operacyjny firmy, nie
// zuzycie klienta, wiec woalmy OpenRouter bezposrednio, tak jak /api/device/solve).
//
// Model celowo tani/szybki — tlumaczenie to prosta, deterministyczna operacja,
// nie potrzeba tu drogiego modelu rozumowania.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TRANSLATE_MODEL = process.env.MAILBOX_TRANSLATE_MODEL || "google/gemini-3.8-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Limit dlugosci tekstu wysylanego do tlumaczenia — ochrona przed
// pojedynczym gigantycznym mailem zjadajacym cala odpowiedz/koszt.
const MAX_CHARS = 12000;

async function callTranslate(system: string, user: string, maxTokens = 4000): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter API key not configured");
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kalkmate.pl",
      "X-Title": "KalkMate",
    },
    body: JSON.stringify({
      model: TRANSLATE_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
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
// Admin pisze po polsku, odbiorcy dostaja PL / DE (kraje niemieckojezyczne) /
// EN (reszta swiata). Jedno wywolanie na jezyk, wszystkie pola naraz w JSON,
// zeby temat, tytul i tresc byly spojne.

export interface NewsletterTexts {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaText: string;
}

const LANG_NAMES = { en: "English", de: "German (Deutsch)" } as const;

export async function translateNewsletter(src: NewsletterTexts, target: "en" | "de"): Promise<NewsletterTexts> {
  const system =
    `You translate marketing newsletters of KalkMate (an AI calculator for students, kalkmate.pl) from Polish to ${LANG_NAMES[target]}.\n` +
    "Rules:\n" +
    "- Natural, friendly, native-sounding copy for students and parents — not word-for-word." +
    (target === "de" ? " Use informal \"du\" (as on the KalkMate website).\n" : "\n") +
    "- Keep the lightweight formatting EXACTLY: lines starting with \"## \" (heading) and \"- \" (list), **bold**, *italic*, [link text](url), blank lines between paragraphs.\n" +
    "- Keep the placeholder {{imie}} unchanged (it becomes the recipient's first name). Keep URLs, numbers, prices and the name KalkMate unchanged.\n" +
    "- Polish exam names: \"matura\" -> in English \"final exams (Matura)\", in German \"Abitur/Matura\" only where it reads naturally.\n" +
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
