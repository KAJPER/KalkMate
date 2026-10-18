import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AI_MODEL_IDS, getCostMultiplier, modelSupportsVision } from "@/lib/aiModels";
import {
  effectiveTokensFromUsage,
  estimateInputTokens,
  estimateReservation,
  reserveTokens,
  settleTokens,
  refundTokens,
  readTokenBalance,
  isSubscriptionValid,
  licenseDailyTokenLimit,
  getDailyUsage,
  addDailyUsage,
} from "@/lib/aiCost";
import { rateLimit } from "@/lib/rate-limit";
import { checkRentalLock } from "@/lib/deviceRental";
import { verifyDeviceAuth } from "@/lib/device-auth";
import { saveCapture } from "@/lib/captures";

// Endpoint dla kalkulatora ESP32 — rozwiązywanie zadań przez AI
// POST /api/device/solve
// Headers: x-api-key: <CALCULATOR_API_KEY>, x-device-id: <MAC 12 hex>,
//          x-device-token: <token z /register> (wymagany gdy device ma token w DB;
//          przy DEVICE_AUTH_STRICT=1 zawsze), x-license-key: <licenseCode> (opcjonalny),
//          x-request-id: <8-64 [A-Za-z0-9_-]> (opcjonalny, idempotencja ponowien — K3)
// Body (JSON):
//   { mode: "text", text: "treść zadania" }
//   { mode: "image", image: "<base64 JPEG>", mimeType: "image/jpeg" }
// albo multipart/form-data z polem "image" (binarny JPEG).
// Response:
//   { ok: true, solution: "..." }
//   { ok: false, error: "..." }   (komunikat trafia na OLED — ASCII, < 64 znakow)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || "google/gemini-2.5-pro";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// UWAGA: OpenRouter rezerwuje srodki pod max_tokens PRZED policzeniem
// realnego zuzycia, a my rezerwujemy pod max_tokens saldo usera. Kalkulator
// i tak pokazuje maks. ~6k znakow (bufor 24 KB), wiec 16000 bylo przesada.
// 8000 zostawia zapas na tokeny "myslenia" modeli rozumujacych (Gemini 2.5 Pro
// liczy je do max_tokens). Nadpisywalne env SOLVE_MAX_TOKENS.
const SOLVE_MAX_TOKENS = (() => {
  const n = parseInt(process.env.SOLVE_MAX_TOKENS || "", 10);
  return Number.isFinite(n) && n >= 1000 ? Math.min(n, 32000) : 8000;
})();
// Timeout upstream. Dluzszy niz timeout HTTP firmware (45 s) — wynik i tak
// trafia do cache idempotencji, wiec ponowienie z tym samym x-request-id
// dostaje gotowa odpowiedz bez ponownego pobrania tokenow.
const UPSTREAM_TIMEOUT_MS = 120_000;

const UPSTREAM_ERROR_MSG = "Serwis AI chwilowo niedostepny. Sprobuj ponownie.";
const EMPTY_ANSWER_MSG = "Brak odpowiedzi AI. Sprobuj ponownie.";
const DB_ERROR_MSG = "Blad bazy danych. Sprobuj ponownie.";
// Prog salda, przy ktorym wygasla licencja czasowa nadal dziala (model tokenowy).
const MIN_TOKENS_FOR_EXPIRED_LICENSE = 1000;

interface OpenRouterResult {
  ok: boolean;
  status: number;
  solution: string | null;
  detail: string;
  tokensUsed: number;
  costUsd: number;
  finishReason: string | null;
}

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  mode: string,
  text: string,
  base64Data: string | null,
  imgMime: string,
): Promise<OpenRouterResult> {
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
  let res: Response;
  try {
    // Celowo BEZ request.signal: rozlaczenie klienta (timeout firmware) nie
    // przerywa przetwarzania — retry z tym samym x-request-id dostanie wynik.
    res = await fetch(OPENROUTER_URL, {
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
        max_tokens: SOLVE_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    return {
      ok: false, status: 0, solution: null,
      detail: timedOut ? `timeout ${UPSTREAM_TIMEOUT_MS} ms` : String(err?.message || e).slice(0, 200),
      tokensUsed: 0, costUsd: 0, finishReason: null,
    };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    let detail = t.slice(0, 200);
    try {
      const j = JSON.parse(t);
      if (j?.error?.message) detail = String(j.error.message).slice(0, 200);
    } catch {}
    return { ok: false, status: res.status, solution: null, detail, tokensUsed: 0, costUsd: 0, finishReason: null };
  }
  const data = await res.json().catch(() => null);
  const choice = data?.choices?.[0];
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
  const sol = choice?.message?.content;
  const solution = typeof sol === "string" && sol.trim() ? sol.trim() : null;
  const tokensUsed: number = Number(data?.usage?.total_tokens) || 0;
  const costUsd: number = Number(data?.usage?.cost) || 0;
  return { ok: true, status: 200, solution, detail: data ? "" : "invalid JSON", tokensUsed, costUsd, finishReason };
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

// Jezyk odpowiedzi — sterowany ustawieniem kalkulatora (kalkSettings.language),
// wysylanym w naglowku x-language: "pl" (domyslnie), "en", "de".
const LANGUAGE_NAMES: Record<string, string> = {
  pl: "polskim",
  en: "angielskim (English)",
  de: "niemieckim (Deutsch)",
};
function buildSystemPrompt(aiMode: string, solveMode: number, language: string): string {
  const base = aiMode === "raw" ? BASE_RAW : BASE_MATURA;
  const detail = DETAIL_PROMPTS[solveMode] ?? DETAIL_PROMPTS[0];
  const langName = LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES.pl;
  const langRule = language === "pl"
    ? ""
    : `\n\nODPOWIADAJ WYŁĄCZNIE w języku ${langName}, niezależnie od języka treści zadania. Terminy matematyczne/fizyczne/chemiczne/biologiczne oraz cała odpowiedź (w tym słowo "Odpowiedź:" na końcu) mają być w tym języku.`;
  return `${base}\n\n${detail}\n\n${FORMAT_RULES}${langRule}`;
}

// === Normalizacja odpowiedzi AI dla malego ekranu kalkulatora ===
// Rozne modele zwracaja matematyke roznie (DeepSeek/GPT: ciezki LaTeX \frac \(
// \Delta; Qwen/Mistral: gotowe Unicode). Zamieniamy WSZYSTKO na czysty tekst.
// WAZNE: czcionka OLED (u8g2_font_6x12_te) to okrojony font terminalowy —
// NIE MA greki ani wiekszosci symboli matematycznych Unicode (sprawdzone
// narzedziem dekodujacym dane fontu). Ma tylko: · × ÷ ± ~ ¬ ° * oraz Latin-1
// (w tym ¹²³, ₀-₉). GRECKI DZIALA MIMO TO — kalkulator (solve_screen.h,
// _solDrawMathLine) przelacza font na u8g2_font_unifont_t_greek TYLKO dla
// znakow z bloku greckiego Unicode, wiec tu wysylamy prawdziwe greckie
// litery. Wybrany po wizualnym tescie 3 kandydatow na prawdziwym OLED
// (tools/greek_font_test). Pozostale "egzotyczne" symbole matematyczne
// (bez dedykowanego fontu) nadal zamieniamy na czytelne ASCII, bo dla nich
// nie ma odpowiednika — font ich nie ma i nie ma dla nich osobnej czcionki.
const _GREEK_OPS: Record<string, string> = {
  // Litery greckie — prawdziwy Unicode, kalkulator ma dla nich osobny font.
  alpha:"α",beta:"β",gamma:"γ",delta:"δ",epsilon:"ε",varepsilon:"ε",zeta:"ζ",eta:"η",
  theta:"θ",vartheta:"θ",iota:"ι",kappa:"κ",lambda:"λ",mu:"μ",nu:"ν",xi:"ξ",pi:"π",
  rho:"ρ",sigma:"σ",tau:"τ",upsilon:"υ",phi:"φ",varphi:"φ",chi:"χ",psi:"ψ",omega:"ω",
  Gamma:"Γ",Delta:"Δ",Theta:"Θ",Lambda:"Λ",Xi:"Ξ",Pi:"Π",Sigma:"Σ",Phi:"Φ",Psi:"Ψ",Omega:"Ω",
  // Operatory obecne w foncie OLED — zostawiamy jako prawdziwy Unicode.
  cdot:"·",times:"×",div:"÷",pm:"±",ast:"*",star:"*",sim:"~",neg:"¬",lnot:"¬",
  deg:"°",circ:"°",degree:"°",
  // Reszta — font ich nie ma i nie ma dla nich osobnej czcionki jak grecki,
  // zamiana na czytelne ASCII.
  mp:"-+",
  leq:"<=",le:"<=",geq:">=",ge:">=",neq:"!=",ne:"!=",approx:"~=",equiv:"===",cong:"~=",
  infty:"inf",partial:"d",prime:"'",
  rightarrow:"->",to:"->",longrightarrow:"->",leftarrow:"<-",leftrightarrow:"<->",mapsto:"->",
  Rightarrow:"=>",implies:"=>",Leftarrow:"<-",iff:"<=>",Leftrightarrow:"<=>",
  notin:"not in",emptyset:"{}",varnothing:"{}",forall:"for all",
  land:"AND",wedge:"AND",lor:"OR",vee:"OR",cup:"union",cap:"intersect",
  parallel:"||",ldots:"...",dots:"...",cdots:"...",vdots:"...",
  left:"",right:"",bigg:"",Big:"",big:"",Bigg:"",displaystyle:"",textstyle:"",limits:"",nolimits:"",
  quad:" ",qquad:"  ",",":" ",";":" ",":":" ","!":"",
};
// Tylko cyfry — font OLED ma podpis dolny ₀-₉, ale NIE MA ₊₋₍₎ (sprawdzone
// dekoderem fontu). Znaki spoza tej listy spadaja na fallback "_(...)".
const _SUB: Record<string, string> = {"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉"};
// Odwrotna mapa: literalny Unicode superscript (ktory model czasem wypisuje
// wprost zamiast LaTeX-owego ^{...}, np. kopiujac zapis "10⁻⁵" ze zdjecia
// zadania) -> zwykly znak. Font OLED ma tylko ¹²³ z tego zakresu — reszta
// (w tym sam minus ⁻!) byla cicha, niewidoczna luka w tekscie.
const _SUP_REV: Record<string, string> = {
  "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9",
  "⁺":"+","⁻":"-","⁽":"(","⁾":")","ⁿ":"n","ⁱ":"i",
};
const _SUP_RUN_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ⁿⁱ]+/g;
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
  // \sqrt[n]{X} -> root_n(X) ; \sqrt{X} -> sqrt(X) — "√" nie istnieje w foncie OLED.
  t = t.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, "root_$1($2)");
  for (let i = 0; i < 3; i++) t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)");
  // greka + operatory + komendy (po frac/sqrt). Nieznane \komenda -> sama nazwa.
  t = t.replace(/\\([A-Za-z]+)|\\(.)/g, (m, w, sym) => {
    if (w !== undefined) return w in _GREEK_OPS ? _GREEK_OPS[w] : w;
    return sym in _GREEK_OPS ? _GREEK_OPS[sym] : sym; // \, \; itp.
  });
  // potegi -> zawsze ^(...) / ^X — kalkulator rysuje to sam podniesionym,
  // mniejszym fontem (patrz _solDrawMathLine w solve_screen.h). CELOWO nie
  // zamieniamy na Unicode superscript (⁴⁵⁶⁷⁸⁹ⁿ itd.) — font OLED ma tylko
  // ¹²³, reszta byla cichą, niewidoczną luką w wyswietlanym tekscie.
  t = t.replace(/\^\{([^{}]*)\}/g, (m, e) => `^(${e})`);
  t = t.replace(/\^\(([^()]*)\)/g, (m, e) => `^(${e})`);
  // Wykladniki bez klamer: "10^-12"/"10^12" (cyfry, np. potegi 10 - jednostki
  // SI) ORAZ "e^-x"/"2^-n" (ujemna zmienna, bez cyfr). Bez tego tylko "-"
  // trafialoby do exponentu, a reszta (cyfry LUB litera zmiennej) zostawala
  // na normalnej linii (rozjechany, "polamany" zapis).
  // "[^(" wykluczone z fallbacku — na tym etapie "^(" zawsze pochodzi juz z
  // normalizacji wyzej (regex braced/paren), nie jest surowym wejsciem.
  t = t.replace(/\^(-?(?:\d+|[^\s(]))/g, (m, e) => `^(${e})`);
  // Literalny Unicode superscript wypisany wprost przez model (bez ^ w
  // ogole) — np. skopiowany zapis "2 · 10⁻⁵ Pa" ze zdjecia zadania. Bez
  // tego omija cala logike wyzej (nie ma zadnego "^" do zlapania), a font
  // OLED nie ma tych glifow (w tym samego minusa ⁻) -> niewidoczna luka.
  t = t.replace(_SUP_RUN_RE, (run) => `^(${[...run].map((c) => _SUP_REV[c]).join("")})`);
  // indeksy dolne -> Unicode cyfry (gdy sie da), inaczej _(...)
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

// === K3: idempotencja ponowien =============================================
// Firmware (nowe wersje) wysyla x-request-id. Ten sam (deviceId, requestId)
// w ciagu TTL -> zwracamy zapisany wynik bez ponownego pobierania tokenow;
// gdy pierwsze zadanie jeszcze trwa — czekamy na ten sam Promise. W cache
// zostaja tylko sukcesy (200); bledy (402/429/502...) nic nie pobieraja, wiec
// ponowienie po bledzie wykonuje sie normalnie. Pamiec procesu wystarczy
// (pm2: 1 instancja).
type SolveResult = { status: number; body: Record<string, unknown> };
interface SolveCacheEntry {
  promise: Promise<SolveResult>;
  createdAt: number;
}
const SOLVE_CACHE_TTL_MS = 20 * 60_000;
const SOLVE_CACHE_MAX = 300;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const _g = globalThis as unknown as { __kalkSolveCache?: Map<string, SolveCacheEntry> };
const solveCache: Map<string, SolveCacheEntry> = _g.__kalkSolveCache ?? (_g.__kalkSolveCache = new Map());

function pruneSolveCache(now = Date.now()): void {
  // Map trzyma kolejnosc wstawiania = kolejnosc createdAt.
  for (const [k, e] of solveCache) {
    if (now - e.createdAt <= SOLVE_CACHE_TTL_MS) break;
    solveCache.delete(k);
  }
  while (solveCache.size > SOLVE_CACHE_MAX) {
    const oldest = solveCache.keys().next().value;
    if (oldest === undefined) break;
    solveCache.delete(oldest);
  }
}

// Limity rozmiarow — anty-DoS. Sprawdzane z content-length PRZED wczytaniem
// body (formData()/json()), potem jeszcze raz po faktycznym rozmiarze.
// OV2640 UXGA jpeg @ Q12 = ~150-200kB raw → ~270kB base64. 8MB base64 ≈ 6MB raw
// (z duzym zapasem). Text → 50kB to dlugie zadania matematyczne.
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_B64 = 8_000_000;
const MAX_TEXT_LEN = 50_000;

export async function POST(request: NextRequest) {
  try {
    const len = Number(request.headers.get("content-length") || 0);
    if (len > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Zapytanie za duze (max 10MB)" }, { status: 413 });
    }

    // Audyt 2026-10-16: wczesniej tylko wspolny (publiczny) x-api-key + MAC
    // z naglowka — spoof MAC dawal dostep do cudzej subskrypcji/tokenow/zdjec.
    // Teraz token urzadzenia (lib/device-auth.ts) + znormalizowany deviceId.
    // x-device-id jest wymagany zawsze (blokada najmu nie moze byc omijana
    // jego brakiem).
    const auth = await verifyDeviceAuth(request);
    if (!auth.ok) {
      console.warn(`[solve] odrzucone ${auth.status} ${auth.error} device=${request.headers.get("x-device-id")} fw=${request.headers.get("x-fw-version")} tok=${request.headers.get("x-device-token") ? "tak" : "brak"}`);
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }
    const deviceId = auth.deviceId;

    // Zdalna blokada wynajmowanych urzadzen — sprawdzana PRZED jakakolwiek
    // logika licencji/subskrypcji, przed cache idempotencji i przed zuzyciem
    // tokenow OpenRouter. Zablokowane urzadzenie dziala nadal jako zwykly
    // kalkulator offline, traci tylko dostep do AI. Patrz src/lib/deviceRental.ts.
    const rentalCheck = await checkRentalLock(deviceId);
    if (rentalCheck.locked) {
      return NextResponse.json({ ok: false, error: rentalCheck.reason }, { status: 403 });
    }

    const rawReqId = request.headers.get("x-request-id")?.trim() || "";
    const requestId = REQUEST_ID_RE.test(rawReqId) ? rawReqId : null;
    if (!requestId) {
      const r = await processSolve(request, deviceId);
      return NextResponse.json(r.body, { status: r.status });
    }

    pruneSolveCache();
    const key = `${deviceId}:${requestId}`;
    const hit = solveCache.get(key);
    if (hit) {
      console.log(`[solve] idempotent replay ${key}`);
      const r = await hit.promise;
      return NextResponse.json(r.body, { status: r.status });
    }
    const promise = processSolve(request, deviceId).then(
      (r) => {
        if (r.status !== 200) solveCache.delete(key);
        return r;
      },
      (e) => {
        solveCache.delete(key);
        throw e;
      }
    );
    solveCache.set(key, { promise, createdAt: Date.now() });
    const r = await promise;
    return NextResponse.json(r.body, { status: r.status });
  } catch (err) {
    console.error("Device solve error:", err);
    return NextResponse.json(
      { ok: false, error: "Blad serwera" },
      { status: 500 }
    );
  }
}

async function processSolve(request: NextRequest, deviceId: string): Promise<SolveResult> {
  const fail = (status: number, error: string): SolveResult => {
    console.warn(`[solve] odrzucone ${status} ${error} device=${deviceId}`);
    return { status, body: { ok: false, error } };
  };

  // Weryfikacja klucza licencyjnego — opcjonalny, patrz fallback
  // subskrypcyjny nizej (dla userow z AI Chat ale bez fizycznej licencji).
  const licenseKey = request.headers.get("x-license-key");
  const fwVersion = request.headers.get("x-fw-version");

  // Sprawdź licencję w bazie
  let license = licenseKey
    ? await prisma.license.findUnique({
        where: { code: licenseKey.trim().toLowerCase() },
      })
    : null;

  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: { id: true, userId: true },
  });
  const pairedDevice: { id: string; userId: string | null } | null = device
    ? { id: device.id, userId: device.userId }
    : null;

  // Weryfikacja wlasciwosci licencji:
  // Jezeli licencja jest "claimed" przez konto webowe (claimedByUserId),
  // to urzadzenie wysylajace ja MUSI byc sparowane z TYM SAMYM kontem.
  // Inaczej kazdy z dostepem do kodu mogłby ja uzywac na obcym device.
  // Jezeli licencja nie jest claimed - dopuszczamy "device-only" usage
  // (legacy mode: licencja przypisana do urzadzenia bez konta).
  if (license?.claimedByUserId) {
    if (!pairedDevice || pairedDevice.userId !== license.claimedByUserId) {
      return fail(403, "Urzadzenie nie sparowane z kontem wlasciciela licencji");
    }
  }

  // Fallback: brak (lub nierozpoznany) klucz licencyjny, ale urzadzenie
  // jest sparowane z kontem ktore ma aktywna subskrypcje AI Chat —
  // niektore kalkulatory sprzedawane sa bez fizycznego kodu licencyjnego,
  // dostep dziala wtedy wylacznie przez subskrypcje z panelu.
  // K2: "active" wazne tylko do konca okresu (stripeCurrentPeriodEnd).
  if (!license) {
    let subscriptionActive = false;
    if (pairedDevice?.userId) {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: pairedDevice.userId },
      });
      subscriptionActive = isSubscriptionValid(subscription);
    }
    if (!subscriptionActive) {
      // Trzy rozne przyczyny tego samego 403 — rozne komunikaty, zeby klient
      // wiedzial co realnie zrobic (zamiast mylacego "zly klucz" gdy w ogole
      // nie ma zadnego konta/klucza). Audyt 2026-10-18: zgloszenie klienta,
      // ktory widzial "Nieprawidlowy klucz licencji" mimo ze nigdy zadnego
      // klucza nie mial — kalkulator po prostu nie byl podpiety do konta.
      if (licenseKey) {
        return fail(403, "Nieprawidlowy klucz licencji");
      }
      if (!pairedDevice?.userId) {
        return fail(403, "Konto nie jest podpiete do tego urzadzenia");
      }
      return fail(403, "Brak aktywnej subskrypcji AI");
    }
  }

  // H6: rate limit — per licencja, albo per urzadzenie gdy dostep jest
  // przez subskrypcje (brak licencji)
  const rl = rateLimit(`solve:${license?.code || pairedDevice?.id || deviceId}`, 30, 60_000);
  if (!rl.ok) {
    return fail(429, "Za duzo zadan. Poczekaj chwile.");
  }

  // Pierwsza aktywacja licencji — ustaw timer wygasania
  // (caly ten blok dotyczy tylko dostepu przez fizyczna licencje; dostep
  // przez subskrypcje, obsluzony wyzej, nie ma z nim nic wspolnego)
  if (license && (!license.isUsed || !license.usedAt)) {
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

  if (license && isExpired(license)) {
    // Auto-upgrade: jezeli device jest sparowane z userem, ktory ma INNA
    // aktywna licencje (zaclaim'owana w panelu), uzyj jej zamiast tej z
    // headera. Pokrywa przypadek: firmware ma na flashu stary kod, user
    // zclaim'owal nowy w panelu — chcemy zeby kalkulator dzialal bez
    // koniecznosci recznego przepisywania kodu.
    if (pairedDevice?.userId) {
      const candidates = await prisma.license.findMany({
        where: { claimedByUserId: pairedDevice.userId },
        orderBy: { usedAt: "desc" },
      });
      const active = candidates.find((c) => !isExpired(c));
      if (active) {
        console.log(
          `[solve] auto-upgrade license ${license.code} (expired) -> ${active.code} for device ${deviceId}`,
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
    // ma wazna subskrypcje (K2) albo tokeny (tokeny = nowa waluta, dokupisz w
    // sklepie). Brak tokenow obsluzy ponizej rezerwacja (402 "Brak tokenow").
    if (isExpired(license)) {
      const oid = license.claimedByUserId || pairedDevice?.userId || null;
      let allowed = false;
      if (oid) {
        const sub = await prisma.subscription.findUnique({ where: { userId: oid } });
        if (isSubscriptionValid(sub)) {
          allowed = true;
        } else {
          const bal = await readTokenBalance(oid);
          if (bal === null) return fail(503, DB_ERROR_MSG);
          allowed = bal >= MIN_TOKENS_FOR_EXPIRED_LICENSE;
        }
      }
      if (!allowed) {
        return fail(403, "Licencja wygasla");
      }
      console.log(`[solve] expired license ${license.code} OK via subscription/token balance (user ${oid})`);
    }
  }

  if (!OPENROUTER_API_KEY) {
    return fail(500, "AI nie skonfigurowane");
  }

  // Ustawienia AI usera: model (przez OpenRouter) + tryb prompta. Kolumny
  // User.aiModel / User.aiMode oraz Device.promptMode nie sa w Prisma schemie
  // -> raw SQL. Priorytet trybu: user.aiMode -> Device.promptMode (legacy) ->
  // default "matura". Model: user.aiModel -> "default" (Gemini).
  const ownerUserId = license?.claimedByUserId || pairedDevice?.userId || null;
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
  if (aiMode === "matura" && device) {
    try {
      const rows = await prisma.$queryRaw<{ promptMode: string | null }[]>`
        SELECT "promptMode" FROM "Device" WHERE "deviceId" = ${deviceId} LIMIT 1
      `;
      if (rows?.[0]?.promptMode === "raw") aiMode = "raw";
    } catch (e) {
      console.error("[solve] promptMode read fail:", e);
    }
  }
  // Poziom szczegolowosci z kalkulatora (kalkSettings.solveMode -> naglowek).
  // Domyslnie 0 = Szczegolowy (gdy stary firmware nie wysyla naglowka).
  const solveMode = Math.max(0, Math.min(2, parseInt(request.headers.get("x-solve-mode") || "0", 10) || 0));
  // Jezyk odpowiedzi (kalkSettings.language -> naglowek x-language).
  // Domyslnie "pl" (stary firmware bez tego naglowka).
  const langHeader = (request.headers.get("x-language") || "pl").toLowerCase();
  const language = langHeader === "en" || langHeader === "de" ? langHeader : "pl";
  const systemPrompt = buildSystemPrompt(aiMode, solveMode, language);
  let modelToUse = (aiModel !== "default" && aiModel.includes("/") && AI_MODEL_IDS.includes(aiModel))
    ? aiModel
    : OPENROUTER_DEFAULT_MODEL;
  let costMultiplier = getCostMultiplier(aiModel);

  // Parsuj body: JSON (tryb text / legacy image base64) ALBO multipart/form-data
  // (nowy upload zdjecia z firmware — pole "image" = binarny JPEG). Bez tego
  // request.json() na multipart rzuca "No number after minus sign" (--boundary) -> 500.
  let mode: string | undefined;
  let text: string | undefined;
  let image: string | undefined;
  let mimeType: string | undefined;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, "Nieprawidlowy format zapytania");
    }
    const file = form.get("image");
    if (!file || typeof file === "string") {
      return fail(400, "Brak obrazu (multipart)");
    }
    const f = file as File;
    if (f.size > MAX_IMAGE_BYTES) {
      return fail(413, "Obraz za duzy (max 6MB)");
    }
    image = Buffer.from(await f.arrayBuffer()).toString("base64");
    mimeType = f.type || "image/jpeg";
    mode = "image";
  } else {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return fail(400, "Nieprawidlowy format zapytania");
    }
    mode = body?.mode;
    text = body?.text;
    image = body?.image;
    mimeType = body?.mimeType;
  }

  if (!mode || (mode !== "text" && mode !== "image")) {
    return fail(400, "Nieprawidlowy tryb (text/image)");
  }

  // Tryb zdjecia wymaga modelu z wizja. Modele tekstowe (DeepSeek/Qwen/Mistral/
  // Sonar) zwracaja z OpenRouter 404 "No endpoints support image input" —
  // podmieniamy na domyslny model z wizja (OPENROUTER_DEFAULT_MODEL = Gemini).
  if (mode === "image" && !modelSupportsVision(modelToUse)) {
    console.log(`[solve] image: model ${modelToUse} bez wizji -> ${OPENROUTER_DEFAULT_MODEL}`);
    modelToUse = OPENROUTER_DEFAULT_MODEL;
    costMultiplier = getCostMultiplier("default");
  }

  if (mode === "image" && typeof image === "string" && image.length > MAX_IMAGE_B64) {
    return fail(413, "Obraz za duzy (max 8MB base64)");
  }
  if (mode === "text" && typeof text === "string" && text.length > MAX_TEXT_LEN) {
    return fail(413, "Tekst za dlugi (max 50kB)");
  }

  let imgMime = "image/jpeg";
  let base64Data: string | null = null;

  if (mode === "text") {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return fail(400, "Brak treści zadania");
    }
  } else {
    // mode === "image"
    if (!image || typeof image !== "string") {
      return fail(400, "Brak obrazu");
    }
    imgMime = typeof mimeType === "string" && /^image\/[a-z0-9.+-]+$/i.test(mimeType) ? mimeType : "image/jpeg";
    // Usuń ewentualny prefiks data:image/...;base64,
    base64Data = image.includes(",") ? image.split(",")[1] : image;
  }

  // Dzienny budzet dla trybu license-only (licencja bez konta -> brak salda,
  // ktore by limitowalo koszt). Trwaly licznik per kod licencji i per
  // urzadzenie (tabela DeviceDailyUsage), limit LICENSE_DAILY_TOKEN_LIMIT.
  if (!ownerUserId) {
    const limit = licenseDailyTokenLimit();
    try {
      const [licUsed, devUsed] = await Promise.all([
        license ? getDailyUsage("license", license.code) : Promise.resolve(0),
        getDailyUsage("device", deviceId),
      ]);
      if (licUsed >= limit || devUsed >= limit) {
        console.warn(`[solve] dzienny limit license-only: lic=${license?.code} ${licUsed} dev=${deviceId} ${devUsed} / ${limit}`);
        return fail(429, "Dzienny limit AI wyczerpany. Sprobuj jutro.");
      }
    } catch (e) {
      console.error("[solve] daily usage read fail:", e);
      return fail(503, DB_ERROR_MSG);
    }
  }

  // Atomowa rezerwacja salda PRZED wywolaniem AI (tylko userzy z kontem).
  // Szacunek: (wejscie + max_tokens) x mnoznik modelu; po odpowiedzi
  // rozliczamy roznice, przy bledzie zwracamy rezerwacje. Blad bazy -> 503.
  let reserved = 0;
  if (ownerUserId) {
    const inputTokens = estimateInputTokens(
      systemPrompt.length + (mode === "text" ? (text || "").length : 0),
      mode === "image" ? 1 : 0
    );
    const est = estimateReservation(inputTokens, SOLVE_MAX_TOKENS, costMultiplier);
    const rr = await reserveTokens(ownerUserId, est);
    if (rr === "db_error") return fail(503, DB_ERROR_MSG);
    if (rr === "insufficient") {
      const bal = await readTokenBalance(ownerUserId);
      if (bal === null) return fail(503, DB_ERROR_MSG);
      return fail(402, `Brak tokenow (${bal}). Dokup na kalkmate.pl.`);
    }
    reserved = est;
  }

  try {
    if (mode === "image" && base64Data) {
      // Zapis na dysku PRZED wyslaniem do AI — gdyby model sie wywalil,
      // wciaz mamy oryginalne zdjecie do debugu/audytu. userId = wlasciciel
      // urzadzenia w chwili zdjecia (tabela Capture, lib/captures.ts).
      await saveCapture(
        base64Data,
        deviceId,
        licenseKey || license?.code || "subscription",
        fwVersion,
        pairedDevice?.userId ?? null
      );
    }

    // === Wywolanie AI przez OpenRouter ===
    const r = await callOpenRouter(modelToUse, systemPrompt, mode, (text || "").trim(), base64Data, imgMime);
    const solution = r.ok && r.solution && r.finishReason !== "error" ? normalizeForCalc(r.solution) : "";
    if (!r.ok || !solution) {
      // Nie rozliczaj bledu ani pustej odpowiedzi — zwrot calej rezerwacji.
      if (ownerUserId && reserved) await refundTokens(ownerUserId, reserved);
      if (!r.ok) {
        // Szczegoly tylko do logu — na OLED neutralny komunikat.
        console.error(`[solve] OpenRouter ${r.status} (model=${modelToUse}): ${r.detail}`);
        return fail(502, UPSTREAM_ERROR_MSG);
      }
      console.error(`[solve] pusta odpowiedz (model=${modelToUse}, finish=${r.finishReason}, tokens=${r.tokensUsed}) ${r.detail}`);
      return fail(502, EMPTY_ANSWER_MSG);
    }

    // Rozliczenie: preferuje realny koszt zwrocony przez OpenRouter
    // (usage.cost) zamiast szacunku z costMultiplier — patrz src/lib/aiCost.ts.
    const { effectiveTokens, source } = effectiveTokensFromUsage(
      { total_tokens: r.tokensUsed, cost: r.costUsd },
      costMultiplier
    );
    if (source === "estimate") {
      console.warn(`[solve] usage.cost brak dla modelu ${modelToUse} — fallback na szacunek (tokens=${r.tokensUsed}, mult=${costMultiplier})`);
    }
    if (ownerUserId) {
      await settleTokens(ownerUserId, reserved, effectiveTokens);
    } else {
      if (license) {
        addDailyUsage("license", license.code, effectiveTokens)
          .catch((e) => console.error("[solve] daily usage (license) fail:", e));
      }
      addDailyUsage("device", deviceId, effectiveTokens)
        .catch((e) => console.error("[solve] daily usage (device) fail:", e));
    }

    // Zlicz zapytanie + log do DeviceSolve (fire-and-forget, nie blokuje odpowiedzi)
    if (device) {
      prisma.device
        .update({
          where: { deviceId },
          data: {
            requestCount: { increment: 1 },
            lastSeen: new Date(),
            firmwareVersion: fwVersion || undefined,
            licenseCode: license?.code || undefined,
          },
        })
        .catch((e) => console.error("[solve] device.update fail:", e));

      prisma.deviceSolve
        .create({
          data: {
            deviceId,
            licenseCode: license?.code || null,
            userId: ownerUserId,
            mode,
            question: mode === "text" ? (text || "") : "[zdjecie kamery]",
            answer: solution,
          },
        })
        .catch((e) => console.error("[solve] deviceSolve.create fail:", e));
    }

    return { status: 200, body: { ok: true, solution } };
  } catch (e) {
    // Nieoczekiwany wyjatek po rezerwacji — nie zostawiaj pobranych tokenow.
    if (ownerUserId && reserved) await refundTokens(ownerUserId, reserved);
    throw e;
  }
}
