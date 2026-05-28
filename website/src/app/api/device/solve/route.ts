import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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
// Katalog zapisu zdjec z kalkulator'ow. POZA public/ zeby nie byly dostepne
// po HTTP bez autoryzacji. Domyslnie /home/ubuntu/kalkulator/captures/
const CAPTURES_DIR = process.env.CALCULATOR_CAPTURES_DIR ||
  path.join(process.cwd(), "..", "captures");

// Zapisz JPEG z zadania na dysk. Nie rzuca - log error jak fail.
// Nazwa: YYYY-MM-DD_HH-MM-SS_<deviceId>_<licenseTail>.jpg
async function saveCapture(
  base64Data: string,
  deviceId: string | null,
  licenseKey: string,
  fwVersion: string | null
): Promise<string | null> {
  try {
    await mkdir(CAPTURES_DIR, { recursive: true });
    const now = new Date();
    const stamp = now.toISOString().replace(/[:T]/g, "-").slice(0, 19);  // 2026-05-28_14-33-12
    const devTag = (deviceId || "unknown").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16);
    const licTag = licenseKey.replace(/[^A-Za-z0-9_-]/g, "").slice(-8);
    const filename = `${stamp}_${devTag}_${licTag}.jpg`;
    const filepath = path.join(CAPTURES_DIR, filename);
    const buffer = Buffer.from(base64Data, "base64");
    await writeFile(filepath, buffer);
    console.log(`[capture] saved: ${filename} (${buffer.length} B, fw=${fwVersion || "?"})`);
    return filename;
  } catch (err) {
    console.error("[capture] save error:", err);
    return null;
  }
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
// Hostname mozna nadpisac przez env (np. proxy Cloudflare Workers gdy
// IP serwera jest blokowany przez geo-restrykcje Gemini API)
const GEMINI_HOST = process.env.GEMINI_HOST || "generativelanguage.googleapis.com";
const GEMINI_API_URL =
  `https://${GEMINI_HOST}/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

    // Weryfikacja wlasciwosci licencji:
    // Jezeli licencja jest "claimed" przez konto webowe (claimedByUserId),
    // to urzadzenie wysylajace ja MUSI byc sparowane z TYM SAMYM kontem.
    // Inaczej kazdy z dostepem do kodu mogłby ja uzywac na obcym device.
    // Jezeli licencja nie jest claimed - dopuszczamy "device-only" usage
    // (legacy mode: licencja przypisana do urzadzenia bez konta).
    const deviceIdHeader = request.headers.get("x-device-id");
    if (license.claimedByUserId) {
      if (!deviceIdHeader) {
        return NextResponse.json(
          { ok: false, error: "Brak x-device-id" },
          { status: 403 }
        );
      }
      const device = await prisma.device.findUnique({
        where: { deviceId: deviceIdHeader },
      });
      if (!device || device.userId !== license.claimedByUserId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Urzadzenie nie sparowane z kontem wlasciciela licencji",
          },
          { status: 403 }
        );
      }
    }

    // Pierwsza aktywacja licencji — ustaw timer wygasania
    if (!license.isUsed || !license.usedAt) {
      await prisma.license.update({
        where: { id: license.id },
        data: {
          isUsed: true,
          usedBy: license.usedBy || (license.claimedByUserId ? "user" : "device"),
          usedAt: license.usedAt || new Date(),
        },
      });
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

      // Zapis na dysku PRZED wyslaniem do AI — gdyby Gemini sie wywalil,
      // wciaz mamy oryginalne zdjecie do debugu/audytu.
      const deviceId  = request.headers.get("x-device-id");
      const fwVersion = request.headers.get("x-fw-version");
      await saveCapture(base64Data, deviceId, licenseKey, fwVersion);

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

    // Nowy format Gemini API: klucz w headerze "x-goog-api-key"
    // (zamiast w URL parameter "?key=" - to nadal dziala ale jest legacy)
    const geminiRes = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY!,
      },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`Gemini error ${geminiRes.status} (model=${GEMINI_MODEL}):`, errText);
      // Wyciagnij krotki opis bledu z JSON (jesli jest)
      let detail = errText.slice(0, 200);
      try {
        const j = JSON.parse(errText);
        if (j?.error?.message) detail = String(j.error.message).slice(0, 200);
      } catch {}
      return NextResponse.json(
        {
          ok: false,
          error: `AI ${geminiRes.status}: ${detail}`,
          model: GEMINI_MODEL,
        },
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

    // Zlicz zapytanie + log do DeviceSolve (fire-and-forget, nie blokuje odpowiedzi)
    if (deviceIdHeader) {
      const fwVer = request.headers.get("x-fw-version");
      prisma.device
        .update({
          where: { deviceId: deviceIdHeader },
          data: {
            requestCount: { increment: 1 },
            lastSeen: new Date(),
            firmwareVersion: fwVer || undefined,
            licenseCode: license.code,
          },
        })
        .catch((e) => console.error("[solve] device.update fail:", e));

      prisma.deviceSolve
        .create({
          data: {
            deviceId: deviceIdHeader,
            licenseCode: license.code,
            userId: license.claimedByUserId,
            mode,
            question: mode === "text" ? (text || "") : "[zdjecie kamery]",
            answer: solution,
          },
        })
        .catch((e) => console.error("[solve] deviceSolve.create fail:", e));
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
