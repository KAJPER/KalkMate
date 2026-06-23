import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { AI_MODEL_IDS, getCostMultiplier, modelSupportsVision } from "@/lib/aiModels";

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
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || "google/gemini-2.5-pro";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  mode: string,
  text: string,
  base64Data: string | null,
  imgMime: string,
): Promise<{ ok: boolean; status: number; solution: string | null; detail: string; tokensUsed: number }> {
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
      max_tokens: 16000,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    let detail = t.slice(0, 200);
    try {
      const j = JSON.parse(t);
      if (j?.error?.message) detail = String(j.error.message).slice(0, 200);
    } catch {}
    return { ok: false, status: res.status, solution: null, detail, tokensUsed: 0 };
  }
  const data = await res.json().catch(() => null);
  const sol = data?.choices?.[0]?.message?.content;
  const solution = typeof sol === "string" && sol.trim() ? sol.trim() : null;
  const tokensUsed: number = data?.usage?.total_tokens ?? 0;
  return { ok: true, status: 200, solution, detail: "", tokensUsed };
}

// Framing (przedmiot) — niezalezny od poziomu szczegolowosci (aiMode matura/raw).
const BASE_MATURA = `Jesteś ekspertem od polskiego egzaminu maturalnego (CKE). Rozwiązujesz zadania z matematyki, fizyki, chemii i biologii zgodnie ze standardami oceniania CKE. Stosuj poprawne wzory, jednostki i sensowne zaokrąglenia.`;
const BASE_RAW = `Jesteś dokładnym, pomocnym asystentem AI. Odpowiadasz po polsku na dowolne pytanie lub zadanie (nie tylko maturalne).`;

// Poziom szczegolowosci sterowany ustawieniem kalkulatora "Tryb rozwiazan"
// (kalkSettings.solveMode, wysylany w naglowku x-solve-mode):
//   0 = Szczegolowy, 1 = Tylko obliczenia, 2 = Tylko wynik.
const DETAIL_PROMPTS = [
  // 0 Szczegolowy
  `Rozwiąż zadanie KROK PO KROKU. Pokaż KAŻDY etap rozumowania oraz WSZYSTKIE obliczenia i przekształcenia — dokładnie tak, jak wymaga egzamin, by zdobyć PEŁNĄ punktację. Nie pomijaj kroków i NIE przeskakuj od razu do wyniku. Dla każdego działania zapisz: użyty wzór, podstawienie liczb i wynik działania, oraz krótko wyjaśnij co robisz. To kluczowe — uczeń musi pokazać pełne obliczenia. Na końcu wyraźnie: "Odpowiedź: ...".`,
  // 1 Tylko obliczenia
  `Pokaż obliczenia prowadzące do wyniku w schemacie: wzór → podstawienie liczb → wynik. Zwięźle, bez długiego opisu słownego, ale KAŻDE działanie widoczne. Na końcu: "Odpowiedź: ...".`,
  // 2 Tylko wynik
  `Podaj WYŁĄCZNIE końcowy wynik (z jednostką, jeśli dotyczy). Bez kroków, bez obliczeń, bez opisu.`,
];

const FORMAT_RULES = `Formatowanie pod mały ekran kalkulatora:
- NIE używaj LaTeX (żadnych \\frac, \\sqrt, \\(, \\[, $, \\boxed, \\begin) ani markdown (gwiazdek, #, |, tabel, pogrubień).
- Pisz matematykę zwykłym tekstem z symbolami Unicode: ułamek a/b, potęga x² lub x^n, pierwiastek √(x), mnożenie ·, oraz Δ, π, α, ≤, ≥, ≠, °, ± gdy trzeba.
- Każdy krok w osobnej linii. ZAWSZE dokończ całe rozwiązanie — nie przerywaj w połowie.`;

function buildSystemPrompt(aiMode: string, solveMode: number): string {
  const base = aiMode === "raw" ? BASE_RAW : BASE_MATURA;
  const detail = DETAIL_PROMPTS[solveMode] ?? DETAIL_PROMPTS[0];
  return `${base}\n\n${detail}\n\n${FORMAT_RULES}`;
}

// === Normalizacja odpowiedzi AI dla malego ekranu kalkulatora ===
// Rozne modele zwracaja matematyke roznie (DeepSeek/GPT: ciezki LaTeX \frac \(
// \Delta; Qwen/Mistral: gotowe Unicode). Zamieniamy WSZYSTKO na czysty tekst z
// symbolami Unicode, ktore czcionka OLED (6x12_te) renderuje. Dziala dla
// kazdego modelu i kazdej wersji firmware (kalkulator dostaje gotowy tekst).
const _GREEK_OPS: Record<string, string> = {
  alpha:"α",beta:"β",gamma:"γ",delta:"δ",epsilon:"ε",varepsilon:"ε",zeta:"ζ",eta:"η",
  theta:"θ",vartheta:"θ",iota:"ι",kappa:"κ",lambda:"λ",mu:"μ",nu:"ν",xi:"ξ",pi:"π",
  rho:"ρ",sigma:"σ",tau:"τ",upsilon:"υ",phi:"φ",varphi:"φ",chi:"χ",psi:"ψ",omega:"ω",
  Gamma:"Γ",Delta:"Δ",Theta:"Θ",Lambda:"Λ",Xi:"Ξ",Pi:"Π",Sigma:"Σ",Phi:"Φ",Psi:"Ψ",Omega:"Ω",
  cdot:"·",times:"×",div:"÷",pm:"±",mp:"∓",ast:"*",star:"*",
  leq:"≤",le:"≤",geq:"≥",ge:"≥",neq:"≠",ne:"≠",approx:"≈",equiv:"≡",cong:"≅",sim:"~",propto:"∝",
  infty:"∞",partial:"∂",nabla:"∇",prime:"′",
  rightarrow:"→",to:"→",longrightarrow:"→",leftarrow:"←",leftrightarrow:"↔",mapsto:"→",
  Rightarrow:"⇒",implies:"⇒",Leftarrow:"⇐",iff:"⇔",Leftrightarrow:"⇔",
  in:"∈",notin:"∉",subset:"⊂",subseteq:"⊆",supset:"⊃",cup:"∪",cap:"∩",emptyset:"∅",varnothing:"∅",
  forall:"∀",exists:"∃",neg:"¬",lnot:"¬",land:"∧",wedge:"∧",lor:"∨",vee:"∨",
  sum:"Σ",prod:"Π",int:"∫",oint:"∮",angle:"∠",perp:"⊥",parallel:"∥",
  ldots:"…",dots:"…",cdots:"…",vdots:"⋮",deg:"°",circ:"°",degree:"°",
  left:"",right:"",bigg:"",Big:"",big:"",Bigg:"",displaystyle:"",textstyle:"",limits:"",nolimits:"",
  quad:" ",qquad:"  ",",":" ",";":" ",":":" ","!":"",
};
const _SUP: Record<string, string> = {"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻","(":"⁽",")":"⁾","n":"ⁿ","i":"ⁱ"};
const _SUB: Record<string, string> = {"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉","+":"₊","-":"₋","(":"₍",")":"₎"};
function _toScript(x: string, map: Record<string, string>): string | null {
  let out = "";
  for (const c of x) { if (!(c in map)) return null; out += map[c]; }
  return out;
}
function normalizeForCalc(input: string): string {
  if (!input) return input;
  let t = input;
  // delimitery LaTeX
  t = t.replace(/\\[()[\]]/g, "").replace(/\$\$?/g, "");
  // srodowiska \begin{...}..\end{...} -> nowa linia (zawartosc zostaje)
  t = t.replace(/\\(?:begin|end)\s*\{[^}]*\}/g, "\n");
  // \boxed{X} \text{X} \mathrm{X} ... -> X
  t = t.replace(/\\(?:boxed|text|mathrm|mathbf|mathit|mathsf|operatorname|mathbb)\s*\{([^{}]*)\}/g, "$1");
  // \frac{A}{B} / \dfrac / \tfrac -> (A)/(B), kilka przebiegow dla zagniezdzen
  for (let i = 0; i < 5; i++) t = t.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
  // \sqrt[n]{X} -> [n]√(X) ; \sqrt{X} -> √(X)
  t = t.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, "$1√($2)");
  for (let i = 0; i < 3; i++) t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
  // greka + operatory + komendy (po frac/sqrt). Nieznane \komenda -> sama nazwa.
  t = t.replace(/\\([A-Za-z]+)|\\(.)/g, (m, w, sym) => {
    if (w !== undefined) return w in _GREEK_OPS ? _GREEK_OPS[w] : w;
    return sym in _GREEK_OPS ? _GREEK_OPS[sym] : sym; // \, \; itp.
  });
  // potegi i indeksy -> Unicode (gdy sie da), inaczej ^(...) / _(...)
  t = t.replace(/\^\{([^{}]*)\}/g, (m, e) => _toScript(e, _SUP) ?? `^(${e})`);
  t = t.replace(/\^\(([^()]*)\)/g, (m, e) => _toScript(e, _SUP) ?? `^(${e})`);
  t = t.replace(/\^(\S)/g, (m, c) => _toScript(c, _SUP) ?? `^${c}`);
  t = t.replace(/_\{([^{}]*)\}/g, (m, e) => _toScript(e, _SUB) ?? `_(${e})`);
  t = t.replace(/_(\S)/g, (m, c) => _toScript(c, _SUB) ?? `_${c}`);
  // markdown: **bold** __bold__ -> tekst, ### naglowki -> usun, listy -> zostaw
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "").replace(/`/g, "");
  // \\ -> nowa linia, resztki klamr -> usun
  t = t.replace(/\\\\/g, "\n").replace(/[{}]/g, "");
  // sprzataj biale znaki
  t = t.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

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
      // Jezeli po fallbacku dalej expired:
      // Model tokenowy — wygasla licencja CZASOWA nie blokuje, jezeli wlasciciel
      // ma tokeny (tokeny = nowa waluta, dokupisz w sklepie). Brak tokenow
      // obsluzy ponizej token-gate (402 "Brak tokenow"). Dzieki temu konto z
      // saldem dziala mimo wygaslej 30-dniowej licencji.
      if (isExpired(license)) {
        const oid = license.claimedByUserId || pairedDevice?.userId || null;
        let hasTokens = false;
        if (oid) {
          try {
            const br = await prisma.$queryRaw<{ tokenBalance: number | null }[]>`
              SELECT "tokenBalance" FROM "User" WHERE "id" = ${oid} LIMIT 1
            `;
            hasTokens = (br?.[0]?.tokenBalance ?? 0) >= 1000;
          } catch {}
        }
        if (!hasTokens) {
          return NextResponse.json(
            { ok: false, error: "Licencja wygasla" },
            { status: 403 }
          );
        }
        console.log(`[solve] expired license ${license.code} OK via token balance (user ${oid})`);
      }
    }

    if (!OPENROUTER_API_KEY) {
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
    // Poziom szczegolowosci z kalkulatora (kalkSettings.solveMode -> naglowek).
    // Domyslnie 0 = Szczegolowy (gdy stary firmware nie wysyla naglowka).
    const solveMode = Math.max(0, Math.min(2, parseInt(request.headers.get("x-solve-mode") || "0", 10) || 0));
    const systemPrompt = buildSystemPrompt(aiMode, solveMode);
    let modelToUse = (aiModel !== "default" && aiModel.includes("/") && AI_MODEL_IDS.includes(aiModel))
      ? aiModel
      : OPENROUTER_DEFAULT_MODEL;
    const costMultiplier = getCostMultiplier(aiModel);

    // Sprawdz saldo tokenow (tylko dla userow z kontem)
    // Minimum 1000 efektywnych tokenow w rezerwie przed kazdym zapytaniem
    if (ownerUserId) {
      const balRows = await prisma.$queryRaw<{ tokenBalance: number }[]>`
        SELECT "tokenBalance" FROM "User" WHERE "id" = ${ownerUserId} LIMIT 1
      `.catch(() => null);
      const tokenBalance = balRows?.[0]?.tokenBalance ?? 0;
      if (tokenBalance < 1000) {
        return NextResponse.json(
          { ok: false, error: `Brak tokenow (${tokenBalance}). Odnow subskrypcje na kalkmate.pl.` },
          { status: 402 }
        );
      }
    }

    // Parsuj body: JSON (tryb text / legacy image base64) ALBO multipart/form-data
    // (nowy upload zdjecia z firmware — pole "image" = binarny JPEG). Bez tego
    // request.json() na multipart rzuca "No number after minus sign" (--boundary) -> 500.
    let mode: string | undefined;
    let text: string | undefined;
    let image: string | undefined;
    let mimeType: string | undefined;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("image");
      if (!file || typeof file === "string") {
        return NextResponse.json({ ok: false, error: "Brak obrazu (multipart)" }, { status: 400 });
      }
      const f = file as File;
      image = Buffer.from(await f.arrayBuffer()).toString("base64");
      mimeType = f.type || "image/jpeg";
      mode = "image";
    } else {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { ok: false, error: "Nieprawidlowy format zapytania" },
          { status: 400 }
        );
      }
      mode = body?.mode;
      text = body?.text;
      image = body?.image;
      mimeType = body?.mimeType;
    }

    if (!mode || (mode !== "text" && mode !== "image")) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidlowy tryb (text/image)" },
        { status: 400 }
      );
    }

    // Tryb zdjecia wymaga modelu z wizja. Modele tekstowe (DeepSeek/Qwen/Mistral/
    // Sonar) zwracaja z OpenRouter 404 "No endpoints support image input" —
    // podmieniamy na domyslny model z wizja (OPENROUTER_DEFAULT_MODEL = Gemini).
    if (mode === "image" && !modelSupportsVision(modelToUse)) {
      console.log(`[solve] image: model ${modelToUse} bez wizji -> ${OPENROUTER_DEFAULT_MODEL}`);
      modelToUse = OPENROUTER_DEFAULT_MODEL;
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

    // === Wywolanie AI przez OpenRouter ===
    let solution: string | null = null;
    const r = await callOpenRouter(modelToUse, systemPrompt, mode, (text || "").trim(), base64Data, imgMime);
    if (!r.ok) {
      console.error(`[solve] OpenRouter ${r.status} (model=${modelToUse}): ${r.detail}`);
      return NextResponse.json(
        { ok: false, error: `AI ${r.status}: ${r.detail}`, model: modelToUse },
        { status: 502 }
      );
    }
    if (!r.solution) {
      return NextResponse.json(
        { ok: false, error: "Brak odpowiedzi AI (pusty wynik modelu)", model: modelToUse },
        { status: 502 }
      );
    }
    solution = normalizeForCalc(r.solution);

    // Odejmij tokeny po udanej odpowiedzi (fire-and-forget)
    if (ownerUserId) {
      const effectiveTokens = Math.ceil(r.tokensUsed * costMultiplier);
      prisma.$executeRaw`
        UPDATE "User" SET "tokenBalance" = MAX(0, "tokenBalance" - ${effectiveTokens}) WHERE "id" = ${ownerUserId}
      `.catch((e: any) => console.error("[solve] token deduction fail:", e));
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
