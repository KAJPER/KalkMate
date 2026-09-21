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

async function callTranslate(system: string, user: string): Promise<string> {
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
      max_tokens: 4000,
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
