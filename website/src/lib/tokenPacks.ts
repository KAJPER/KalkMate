// Paczki tokenów do kupienia w sklepie (panel → zakładka AI → "Kup tokeny").
// Jedno źródło prawdy: używane przez /api/tokens/checkout (walidacja + cena)
// oraz UI w panelu. Cena w groszach PLN. 1 mln efektywnych tokenów ≈ koszt API
// ~5-6 PLN, sprzedaż z marżą.
export type TokenPack = {
  id: string;
  tokens: number;
  priceGrosze: number;
  label: string;
  popular?: boolean;
};

export const TOKEN_PACKS: TokenPack[] = [
  { id: "tok_1m", tokens: 1_000_000, priceGrosze: 2900, label: "1 mln tokenów" },
  { id: "tok_5m", tokens: 5_000_000, priceGrosze: 11900, label: "5 mln tokenów", popular: true },
  { id: "tok_10m", tokens: 10_000_000, priceGrosze: 19900, label: "10 mln tokenów" },
];

export const getTokenPack = (id: string) => TOKEN_PACKS.find((p) => p.id === id);
