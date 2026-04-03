import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Endpoint dla kalkulatora ESP32 — rozwiązywanie zadań przez AI
// POST /api/device/solve
// Headers: x-api-key: <CALCULATOR_API_KEY>, x-license-key: <licenseCode>
// Body (JSON):
//   { mode: "text", text: "treść zadania" }
//   { mode: "image", image: "<base64 JPEG>", mimeType: "image/jpeg" }
// Response:
//   { ok: true, solution: "..." }
//   { ok: false, error: "..." }

const CALCULATOR_API_KEY = process.env.CALCULATOR_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT = `Jesteś ekspertem od polskiego egzaminu maturalnego. Rozwiązujesz zadania z matematyki, fizyki, chemii i biologii.
Odpowiadaj KRÓTKO i ZWIĘŹLE — ekran kalkulatora ma ograniczoną przestrzeń.
Format odpowiedzi:
1. Dane/Szukane (1-2 linijki)
2. Rozwiązanie krok po kroku (maksymalnie 6 kroków)
3. Odpowiedź: [wynik z jednostkami]
Nie używaj markdown, gwiazdek, nagłówków. Tylko czysty tekst. Maksymalnie 800 znaków.`;

export async function POST(request: NextRequest) {
  try {
    // Weryfikacja API key urządzenia
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

    // Sprawdź licencję w bazie
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
      // Licencja nieaktywowana — ale pozwól na użycie (jednorazowe urządzenie)
      // Aktywuj ją teraz, wiążąc z device (usedBy = "device")
      await prisma.license.update({
        where: { id: license.id },
        data: {
          isUsed: true,
          usedBy: "device",
          usedAt: new Date(),
        },
      });
    } else if (license.usedBy !== "device" && license.usedBy !== null) {
      // Licencja użyta przez innego użytkownika (konto webowe) — zablokuj
      return NextResponse.json(
        { ok: false, error: "Licencja juz uzyta przez inne konto" },
        { status: 403 }
      );
    }

    // Sprawdź czy licencja nie wygasła (na podstawie durationDays od daty aktywacji)
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

    // Zbuduj wiadomość dla Gemini
    const userParts: any[] = [];

    if (mode === "text") {
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return NextResponse.json(
          { ok: false, error: "Brak treści zadania" },
          { status: 400 }
        );
      }
      userParts.push({ text: text.trim() });
    } else {
      // mode === "image"
      if (!image || typeof image !== "string") {
        return NextResponse.json(
          { ok: false, error: "Brak obrazu" },
          { status: 400 }
        );
      }
      const imgMime = mimeType || "image/jpeg";
      // Usuń ewentualny prefiks data:image/...;base64,
      const base64Data = image.includes(",") ? image.split(",")[1] : image;
      userParts.push({
        inlineData: {
          mimeType: imgMime,
          data: base64Data,
        },
      });
      userParts.push({ text: "Rozwiąż zadanie z tego zdjęcia." });
    }

    const geminiBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }],
        },
        {
          role: "model",
          parts: [
            {
              text: "Rozumiem. Rozwiązuję zadania maturalne krótko i zwięźle. Podaj zadanie.",
            },
          ],
        },
        {
          role: "user",
          parts: userParts,
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      return NextResponse.json(
        { ok: false, error: "Blad AI (Gemini)" },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const solution =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

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
