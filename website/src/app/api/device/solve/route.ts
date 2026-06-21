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
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
// Gdy glowny model padnie na 5xx (overload), sprobuj fallbacka. Flash jest
// szybszy i znacznie rzadziej przeciazony niz Pro.
const GEMINI_MODEL_FALLBACK = process.env.GEMINI_MODEL_FALLBACK || "gemini-2.5-flash";
// Hostname mozna nadpisac przez env (np. proxy Cloudflare Workers gdy
// IP serwera jest blokowany przez geo-restrykcje Gemini API)
const GEMINI_HOST = process.env.GEMINI_HOST || "generativelanguage.googleapis.com";
const buildGeminiUrl = (model: string) =>
  `https://${GEMINI_HOST}/v1beta/models/${model}:generateContent`;
const GEMINI_API_URL = buildGeminiUrl(GEMINI_MODEL);

// Wyciagnij text ze wszystkich parts (Gemini moze zwrocic multi-part response,
// szczegolnie z thinking). Zwraca null gdy nic sensownego nie ma.
function extractText(geminiData: any): string | null {
  const parts = geminiData?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  return text || null;
}

// Pojedyncze wywolanie Gemini z retry na:
//  - 5xx (overload Google)
//  - pusty wynik (MAX_TOKENS / SAFETY / inny finishReason bez tekstu)
// Zwraca ostatnia odpowiedz, uzyty model i wyciagniety solution (moze byc null).
async function callGeminiWithRetry(
  body: unknown,
  apiKey: string,
): Promise<{ res: Response; modelUsed: string; solution: string | null }> {
  const attempts: { model: string; url: string }[] = [
    { model: GEMINI_MODEL, url: GEMINI_API_URL },
    { model: GEMINI_MODEL, url: GEMINI_API_URL }, // retry tego samego po krotkim sleep
    { model: GEMINI_MODEL_FALLBACK, url: buildGeminiUrl(GEMINI_MODEL_FALLBACK) },
  ];
  let last: Response | null = null;
  let lastModel = GEMINI_MODEL;
  let lastSolution: string | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const { model, url } = attempts[i];
    if (i > 0) await new Promise((r) => setTimeout(r, i === 1 ? 800 : 200));
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
    last = res;
    lastModel = model;
    if (!res.ok) {
      if (res.status < 500) return { res, modelUsed: model, solution: null }; // 4xx — nie retrowac
      console.warn(`[solve] Gemini ${res.status} on ${model} (attempt ${i + 1}/${attempts.length})`);
      continue;
    }
    // 200 OK — sprawdz czy faktycznie jest text. Klon zeby moc czytac body
    // jeszcze raz w callerze gdyby trzeba bylo (np. error reporting).
    const data = await res.clone().json().catch(() => null);
    const text = extractText(data);
    if (text) return { res, modelUsed: model, solution: text };
    lastSolution = null;
    const finishReason = data?.candidates?.[0]?.finishReason || "?";
    const usage = data?.usageMetadata
      ? `prompt=${data.usageMetadata.promptTokenCount} thoughts=${data.usageMetadata.thoughtsTokenCount ?? 0} candidates=${data.usageMetadata.candidatesTokenCount ?? 0}`
      : "?";
    console.warn(
      `[solve] Gemini 200 but empty text on ${model} (attempt ${i + 1}/${attempts.length}) — finishReason=${finishReason} usage=${usage}`,
    );
    // Pusty wynik: kontynuuj petle (retry tego samego, potem fallback)
  }
  return { res: last as Response, modelUsed: lastModel, solution: lastSolution };
}

// === OpenRouter — jedno API do wszystkich najlepszych modeli (GPT, Claude,
// Gemini, Grok, DeepSeek, Qwen...). Uzywane gdy user wybral konkretny model w
// panelu. Bez OPENROUTER_API_KEY solve route i tak spadnie na Gemini. ===
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  mode: string,
  text: string,
  base64Data: string | null,
  imgMime: string,
): Promise<{ ok: boolean; status: number; solution: string | null; detail: string }> {
  const content: any[] = [];
  if (mode === "text") {
    content.push({ type: "text", text });
  } else {
    content.push({ type: "text", text: "Rozwiąż zadanie z tego zdjęcia." });
    content.push({
      type: "image_url",
      image_url: { url: `data:${imgMime};base64,${base64Data}` },
    });
  }
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kalkmate.pl",
      "X-Title": "KalkMate",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    let detail = t.slice(0, 200);
    try {
      const j = JSON.parse(t);
      if (j?.error?.message) detail = String(j.error.message).slice(0, 200);
    } catch {}
    return { ok: false, status: res.status, solution: null, detail };
  }
  const data = await res.json().catch(() => null);
  const sol = data?.choices?.[0]?.message?.content;
  const solution = typeof sol === "string" && sol.trim() ? sol.trim() : null;
  return { ok: true, status: 200, solution, detail: "" };
}

const SYSTEM_PROMPT_MATURA = `Jesteś ekspertem od polskiego egzaminu maturalnego. Rozwiązujesz zadania z matematyki, fizyki, chemii i biologii.
Odpowiadaj KRÓTKO i ZWIĘŹLE — ekran kalkulatora ma ograniczoną przestrzeń.
Format odpowiedzi:
1. Dane/Szukane (1-2 linijki)
2. Rozwiązanie krok po kroku (maksymalnie 6 kroków)
3. Odpowiedź: [wynik z jednostkami]
Nie używaj markdown, gwiazdek, nagłówków. Tylko czysty tekst. Maksymalnie 800 znaków.`;

// Tryb "raw" — bez ograniczenia do maturalnych przedmiotow. Tylko hint o
// formacie pod maly ekran OLED. User wybiera ten tryb gdy robi zdjecia spoza
// matury (elektronika, informatyka, jezyki obce itp.).
const SYSTEM_PROMPT_RAW = `Odpowiadaj po polsku, KRÓTKO i ZWIĘŹLE — ekran kalkulatora jest mały.
Maksymalnie 6 krótkich kroków. Wyróżnij końcową odpowiedź.
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
    let license = await prisma.license.findUnique({
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
    let pairedDevice: { id: string; userId: string | null } | null = null;
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
      pairedDevice = { id: device.id, userId: device.userId };
    } else if (deviceIdHeader) {
      // license-only mode — i tak chcemy znac device.userId zeby ew. zrobic
      // auto-upgrade na nowsza licencje usera.
      const device = await prisma.device.findUnique({
        where: { deviceId: deviceIdHeader },
      });
      if (device) pairedDevice = { id: device.id, userId: device.userId };
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

    // Czy licencja z headera wygasla?
    const isExpired = (l: NonNullable<typeof license>) => {
      if (!l.usedAt) return false;
      const activatedAt = new Date(l.usedAt);
      const expiresAt = new Date(
        activatedAt.getTime() + l.durationDays * 24 * 60 * 60 * 1000,
      );
      return new Date() > expiresAt;
    };

    if (isExpired(license)) {
      // Auto-upgrade: jezeli device jest sparowane z userem, ktory ma INNA
      // aktywna licencje (zaclaim'owana w panelu), uzyj jej zamiast tej z
      // headera. Pokrywa przypadek: firmware ma na flashu stary kod, user
      // zclaim'owal nowy w panelu — chcemy zeby kalkulator dzialal bez
      // koniecznosci recznego przepisywania kodu.
      if (pairedDevice?.userId) {
        const candidates = await prisma.license.findMany({
          where: { claimedByUserId: pairedDevice.userId },
        });
        const active = candidates.find((c) => !isExpired(c));
        if (active) {
          console.log(
            `[solve] auto-upgrade license ${license.code} (expired) -> ${active.code} for device ${deviceIdHeader}`,
          );
          license = active;
          // Zaktualizuj Device.licenseCode zeby panel admin widzial wlasciwa
          await prisma.device
            .update({
              where: { id: pairedDevice.id },
              data: { licenseCode: active.code },
            })
            .catch((e) => console.error("[solve] licenseCode upgrade fail:", e));
        }
      }
      // Jezeli po fallbacku dalej expired → odrzuc
      if (isExpired(license)) {
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

    // Ustawienia AI usera: model (przez OpenRouter) + tryb prompta. Kolumny
    // User.aiModel / User.aiMode oraz Device.promptMode nie sa w Prisma schemie
    // -> raw SQL. Priorytet trybu: user.aiMode -> Device.promptMode (legacy) ->
    // default "matura". Model: user.aiModel -> "default" (Gemini).
    const ownerUserId = license.claimedByUserId || pairedDevice?.userId || null;
    let aiMode: "matura" | "raw" = "matura";
    let aiModel = "default";
    if (ownerUserId) {
      try {
        const urows = await prisma.$queryRaw<{ aiModel: string | null; aiMode: string | null }[]>`
          SELECT "aiModel", "aiMode" FROM "User" WHERE "id" = ${ownerUserId} LIMIT 1
        `;
        if (urows?.[0]?.aiMode === "raw") aiMode = "raw";
        if (urows?.[0]?.aiModel) aiModel = urows[0].aiModel;
      } catch (e) {
        // Kolumny aiModel/aiMode moga nie istniec (stara baza) — fallback na default
        console.error("[solve] ai-settings read fail:", e);
      }
    }
    // Fallback trybu na ustawienie per-device (legacy) gdy user nie wybral "raw"
    if (aiMode === "matura" && deviceIdHeader) {
      const rows = await prisma.$queryRaw<{ promptMode: string | null }[]>`
        SELECT "promptMode" FROM "Device" WHERE "deviceId" = ${deviceIdHeader} LIMIT 1
      `;
      if (rows?.[0]?.promptMode === "raw") aiMode = "raw";
    }
    const systemPrompt = aiMode === "raw" ? SYSTEM_PROMPT_RAW : SYSTEM_PROMPT_MATURA;
    // OpenRouter tylko gdy user wybral konkretny model (provider/model) i jest klucz
    const useOpenRouter = aiModel !== "default" && aiModel.includes("/") && !!OPENROUTER_API_KEY;

    // Parsuj body
    const body = await request.json();
    const { mode, text, image, mimeType } = body;

    if (!mode || (mode !== "text" && mode !== "image")) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidlowy tryb (text/image)" },
        { status: 400 }
      );
    }

    // Limity rozmiarow — anty-DoS (atakujacy z API key moglby spamowac OOM).
    // OV2640 UXGA jpeg @ Q12 = ~150-200kB raw → ~270kB base64. 8MB base64 ≈ 6MB raw
    // (z duzym zapasem). Text → 50kB to dlugie zadania matematyczne.
    const MAX_IMAGE_B64 = 8_000_000;
    const MAX_TEXT_LEN = 50_000;
    if (mode === "image" && typeof image === "string" && image.length > MAX_IMAGE_B64) {
      return NextResponse.json(
        { ok: false, error: "Obraz za duzy (max 8MB base64)" },
        { status: 413 }
      );
    }
    if (mode === "text" && typeof text === "string" && text.length > MAX_TEXT_LEN) {
      return NextResponse.json(
        { ok: false, error: "Tekst za dlugi (max 50kB)" },
        { status: 413 }
      );
    }

    // Zbuduj wiadomość (parts dla Gemini / content dla OpenRouter)
    const userParts: any[] = [];
    let imgMime = "image/jpeg";
    let base64Data: string | null = null;

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
      imgMime = mimeType || "image/jpeg";
      // Usuń ewentualny prefiks data:image/...;base64,
      base64Data = image.includes(",") ? image.split(",")[1] : image;

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
          parts: [{ text: systemPrompt }],
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
        // 8192 daje Pro 2.5 zapas na thinking + wynik. Wczesniej 1024 czesto
        // konczylo sie MAX_TOKENS po samym thinking i pustym parts[].
        maxOutputTokens: 8192,
      },
    };

    // === Wywolanie AI: OpenRouter (wybrany model) lub Gemini (default) ===
    let solution: string | null = null;
    let modelUsed = GEMINI_MODEL;

    if (useOpenRouter) {
      modelUsed = aiModel;
      const r = await callOpenRouter(aiModel, systemPrompt, mode, (text || "").trim(), base64Data, imgMime);
      if (!r.ok) {
        console.error(`[solve] OpenRouter ${r.status} (model=${aiModel}): ${r.detail}`);
        // Fallback na Gemini — user nie zostaje bez odpowiedzi gdy OpenRouter padnie
        const g = await callGeminiWithRetry(geminiBody, GEMINI_API_KEY!);
        if (g.solution) {
          solution = g.solution;
          modelUsed = `${g.modelUsed} (fallback)`;
        } else {
          return NextResponse.json(
            { ok: false, error: `AI ${r.status}: ${r.detail}`, model: aiModel },
            { status: 502 }
          );
        }
      } else if (!r.solution) {
        return NextResponse.json(
          { ok: false, error: "Brak odpowiedzi AI (pusty wynik modelu)", model: aiModel },
          { status: 502 }
        );
      } else {
        solution = r.solution;
      }
    } else {
      const g = await callGeminiWithRetry(geminiBody, GEMINI_API_KEY!);
      modelUsed = g.modelUsed;
      if (!g.res.ok) {
        const errText = await g.res.text();
        console.error(`Gemini error ${g.res.status} (model=${modelUsed}):`, errText);
        let detail = errText.slice(0, 200);
        try {
          const j = JSON.parse(errText);
          if (j?.error?.message) detail = String(j.error.message).slice(0, 200);
        } catch {}
        return NextResponse.json(
          { ok: false, error: `AI ${g.res.status}: ${detail}`, model: modelUsed },
          { status: 502 }
        );
      }
      solution = g.solution;
      if (!solution) {
        const finalData = await g.res.clone().json().catch(() => null);
        const finishReason = finalData?.candidates?.[0]?.finishReason || "UNKNOWN";
        const promptFeedback = finalData?.promptFeedback?.blockReason || null;
        console.error(
          `[solve] empty response (model=${modelUsed}) finishReason=${finishReason} blockReason=${promptFeedback || "-"} usage=${JSON.stringify(finalData?.usageMetadata || {})}`,
        );
        const hint = promptFeedback
          ? `zablokowane (${promptFeedback})`
          : finishReason === "MAX_TOKENS"
            ? "przekroczono limit"
            : finishReason === "SAFETY"
              ? "blokada bezpieczenstwa"
              : finishReason;
        return NextResponse.json(
          { ok: false, error: `Brak odpowiedzi AI: ${hint}`, model: modelUsed },
          { status: 502 }
        );
      }
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
