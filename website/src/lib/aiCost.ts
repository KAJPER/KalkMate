// Przeliczanie zuzycia OpenRouter na "efektywne tokeny" odejmowane z salda usera.
//
// HISTORIA BLEDU (naprawione 2026-09-18): stara wersja liczyla
// `effectiveTokens = total_tokens * costMultiplier`, gdzie costMultiplier to
// SREDNIA ceny input/output modelu (avg(price_in, price_out) / 1.40). To jest
// poprawne TYLKO gdy zapytanie ma mniej wiecej rowny podzial prompt:completion.
// W praktyce KalkMate to prawie zawsze NIE jest prawda:
//   - /api/device/solve wysyla max_tokens: 16000 i prosi o pelne rozwiazanie
//     krok po kroku -> completion_tokens >>> prompt_tokens (zdjecie zadania to
//     relatywnie mało tokenow, odpowiedz to czesto tysiace).
//   - ceny modeli maja completion 4-6x wyzsze niz prompt (patrz aiModels.ts),
//     wiec kiedy completion dominuje total_tokens, prawdziwy koszt jest BLISKO
//     ceny completion, a nie sredniej -> system systematycznie NIEDOSZACOWAC
//     realny koszt i pobiera userowi za malo tokenow wzgledem tego, ile
//     naprawde kosztuje to OpenRouter (obserwacja: 40 zl realnie vs 26 zl
//     pokazane w panelu -> ~35% niedoszacowania, dokladnie w te strone co
//     przewiduje ten mechanizm).
//
// FIX: OpenRouter od pewnego czasu ZAWSZE zwraca w kazdej odpowiedzi
// (bez zadnych dodatkowych parametrow) usage.cost — realny koszt w USD tego
// konkretnego zapytania (uwzglednia faktyczny podzial prompt/completion oraz
// realne ceny modelu, cache itp.). Uzywamy TEGO wprost zamiast liczyc szacunek
// z costMultiplier. costMultiplier zostaje tylko jako fallback (np. gdyby
// OpenRouter kiedys nie zwrocil usage.cost dla jakiegos modelu) i jako baza
// do etykiet "×" w panelu wyboru modelu.

// 1M "efektywnych tokenow" = $1.40 realnego kosztu API (kalibracja niezalezna
// od modelu — patrz komentarz w aiModels.ts).
export const EFFECTIVE_TOKEN_USD = 1.40 / 1_000_000;

export interface OpenRouterUsage {
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number; // realny koszt w USD/kredytach OpenRouter tego zapytania
}

// Zwraca liczbe efektywnych tokenow do odjecia z salda usera. Preferuje
// realny koszt (usage.cost) zwrocony przez OpenRouter; spada na stary
// szacunek (total_tokens * costMultiplier) TYLKO gdy cost jest nieobecny
// lub <= 0 (np. blad/model bez raportowania kosztu).
export function effectiveTokensFromUsage(
  usage: OpenRouterUsage | null | undefined,
  costMultiplier: number
): { effectiveTokens: number; source: "real_cost" | "estimate" } {
  const realCost = Number(usage?.cost);
  if (Number.isFinite(realCost) && realCost > 0) {
    return { effectiveTokens: Math.ceil(realCost / EFFECTIVE_TOKEN_USD), source: "real_cost" };
  }
  const totalTokens = Number(usage?.total_tokens) || 0;
  return { effectiveTokens: Math.ceil(totalTokens * costMultiplier), source: "estimate" };
}
