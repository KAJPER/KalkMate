import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Endpoint dla kalkulatora ESP32 - rozwiazywanie zadan przez AI
// POST /api/device/solve
// Headers: x-api-key: <CALCULATOR_API_KEY>, x-license-key: <licenseCode>
// Body (JSON):
//   { mode: "text", text: "tresc zadania" }
//   { mode: "image", image: "<base64 JPEG>", mimeType: "image/jpeg" }
// Response:
//   { ok: true, solution: "..." }
//   { ok: false, error: "..." }

const CALCULATOR_API_KEY = process.env.CALCULATOR_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.1-pro-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `Jestes ekspertem od polskiego egzaminu maturalnego. Rozwiazujesz zadania z matematyki, fizyki, chemii i biologii.
Wynik wyswietla sie na ekranie OLED kalkulatora - uzywaj TYLKO czystego tekstu ASCII, bez polskich znakow diakrytycznych.

OBOWIAZKOWY FORMAT (zawsze wszystkie sekcje, nie skracaj):
Dane: [co jest dane]
Szukane: [co szukamy]
Rozwiazanie:
Krok 1: [pelny opis i obliczenie]
Krok 2: [pelny opis i obliczenie]
Krok 3: [pelny opis i obliczenie]
[kolejne kroki jesli potrzeba]
Odpowiedz: [wynik z jednostkami]

ZASADY NOTACJI (obowiazkowe):
- Potegi: x^2, x^3, e^x (NIE uzywaj LaTeX, superscript, Unicode)
- Pierwiastki: sqrt(x), sqrt(x^2+1)
- Ulamki: (a/b) lub a/b
- Mnozenie: *
- NIE uzywaj: $, $$, LaTeX, markdown (**, ##), symboli Unicode
- Tylko: litery ASCII a-z A-Z, cyfry 0-9, znaki + - * / ^ = ( ) [ ] , . : spacja
- Dlugosc odpowiedzi: MINIMUM 200 znakow, MAKSIMUM 800 znakow
- Pokazuj WSZYSTKIE kroki obliczen, nie pomijaj zadnego`;

export async function POST(request: NextRequest) {
  try {
    // Weryfikacja API key urzadzenia
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== CALCULATOR_API_KEY) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Weryfikacja klucza licencyjnego
    const licenseKey = request.headers.get("x-license-key");
    if (!licenseKey) {
      return NextResponse.json(
        { ok: false, error: "Brak klucza licencyjnego" },
        { status: 403 }
      );
    }

    // Sprawdz licencje w bazie
    const license = await prisma.license.findUnique({
      where: { code: licenseKey.trim().toLowerCase() },
    });

    if (!license) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidlowy klucz licencji" },
        { status: 403 }
      );
    }

    if (!license.isUsed) {
      await prisma.license.update({
        where: { id: license.id },
        data: { isUsed: true, usedBy: "device", usedAt: new Date() },
      });
    } else if (license.usedBy !== "device" && license.usedBy !== null) {
      return NextResponse.json(
        { ok: false, error: "Licencja juz uzyta przez inne konto" },
        { status: 403 }
      );
    }

    // Sprawdz czy licencja nie wygasla
    if (license.usedAt) {
      const activatedAt = new Date(license.usedAt);
      const expiresAt = new Date(
        activatedAt.getTime() + license.durationDays * 24 * 60 * 60 * 1000
      );
      if (new Date() > expiresAt) {
        return NextResponse.json(
          { ok: false, error: "Licencja wygasla" },
          { status: 403 }
        );
      }
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "AI nie skonfigurowane" },
        { status: 500 }
      );
    }

    // Parsuj body
    const body = await request.json();
    const { mode, text, image, mimeType } = body;

    if (!mode || (mode !== "text" && mode !== "image")) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidlowy tryb (text/image)" },
        { status: 400 }
      );
    }

    // Zbuduj parts dla Gemini
    const userParts: any[] = [];

    if (mode === "text") {
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return NextResponse.json(
          { ok: false, error: "Brak tresci zadania" },
          { status: 400 }
        );
      }
      userParts.push({ text: text.trim() });
    } else {
      if (!image || typeof image !== "string") {
        return NextResponse.json(
          { ok: false, error: "Brak obrazu" },
          { status: 400 }
        );
      }
      const imgMime = mimeType || "image/jpeg";
      const base64Data = image.includes(",") ? image.split(",")[1] : image;
      userParts.push({ inlineData: { mimeType: imgMime, data: base64Data } });
      userParts.push({ text: "Rozwiz zadanie z tego zdjecia." });
    }

    // Wywolanie Gemini REST API bezposrednio
    const geminiPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }],
        },
        {
          role: "model",
          parts: [{ text: "Rozumiem. Bede rozwiazywac zadania maturalne pokazujac wszystkie kroki w formacie ASCII. Podaj zadanie." }],
        },
        {
          role: "user",
          parts: userParts,
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 16384,
      },
    };

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`[device/solve] Gemini error ${geminiRes.status}: ${errText.slice(0, 200)}`);
      return NextResponse.json(
        { ok: false, error: `AI error ${geminiRes.status}` },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const solution: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    console.log(`[device/solve] model=${GEMINI_MODEL} solution_len=${solution.length}`);

    if (!solution) {
      return NextResponse.json(
        { ok: false, error: "Brak odpowiedzi od AI" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, solution });
  } catch (err) {
    console.error("Device solve error:", err);
    return NextResponse.json(
      { ok: false, error: "Blad serwera" },
      { status: 500 }
    );
  }
}
