// Lista modeli AI do wyboru w panelu (sekcja AI).
// Wszystkie modele ida przez OpenRouter (OPENROUTER_API_KEY w env serwera).
//
// costMultiplier — mnożnik kosztu względem Gemini 2.5 Flash (baseline = 1.0).
// System odejmuje od salda: Math.ceil(real_api_tokens * costMultiplier)
// Gwarantuje ze niezaleznie od modelu 1M "efektywnych tokenow" kosztuje ~$1.40 w API.
// Sugestia: 1M efektywnych tokenow = 1 subskrypcja (API cost ~5.6 PLN, mozna sprzedac za 30 PLN).
//
// Aby dodac/zmienic model — edytuj ponizsza tablice.
export type AiModelOption = {
  id: string;
  label: string;
  provider: string;
  note?: string;
  costMultiplier: number; // wzgledem Gemini 2.5 Flash = 1.0
};

export const AI_MODELS: AiModelOption[] = [
  // costMultiplier obliczony z: avg(input_price, output_price) / 1.40  (ceny per 1M tokenow)
  { id: "default",                       label: "Domyślny (Gemini 2.5 Pro)",  provider: "KalkMate",   note: "Domyślny model serwera",             costMultiplier: 4   },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro",             provider: "Google",     note: "Multimodal, nauki ścisłe",            costMultiplier: 5   },
  { id: "google/gemini-3.5-flash",       label: "Gemini 3.5 Flash",           provider: "Google",     note: "Szybki, dobre rozumowanie",           costMultiplier: 4   },
  { id: "anthropic/claude-opus-4.6",     label: "Claude Opus 4.6",            provider: "Anthropic",  note: "Najlepszy do rozumowania i pisania",  costMultiplier: 10  },
  { id: "anthropic/claude-sonnet-4.6",   label: "Claude Sonnet 4.6",          provider: "Anthropic",  note: "Świetny stosunek jakości do ceny",    costMultiplier: 6   },
  { id: "openai/gpt-5.4",                label: "GPT-5.4",                    provider: "OpenAI",     note: "Rozumowanie strukturalne",            costMultiplier: 6   },
  { id: "x-ai/grok-4.3",                 label: "Grok 4.3",                   provider: "xAI",        note: "Mocny na trudnych benchmarkach",      costMultiplier: 1.3 },
  { id: "deepseek/deepseek-v3.2",        label: "DeepSeek V3.2",              provider: "DeepSeek",   note: "Tani specjalista od rozumowania",     costMultiplier: 0.2 },
  { id: "qwen/qwen3-coder",              label: "Qwen3 Coder",                provider: "Alibaba",    note: "Mocny do STEM",                       costMultiplier: 0.7 },
  { id: "meta-llama/llama-4-maverick",   label: "Llama 4 Maverick",           provider: "Meta",       note: "Szybki open-source od Meta",          costMultiplier: 0.3 },
  { id: "mistralai/mistral-large-2512",  label: "Mistral Large 3",            provider: "Mistral",    note: "Europejski flagowy model",            costMultiplier: 0.7 },
  { id: "perplexity/sonar-pro",          label: "Sonar Pro",                  provider: "Perplexity", note: "AI z dostępem do internetu",          costMultiplier: 6   },
];

export const AI_MODEL_IDS = AI_MODELS.map((m) => m.id);

// Zwraca mnoznik kosztu dla danego model ID (fallback na "default" jesli nieznany)
export function getCostMultiplier(modelId: string): number {
  return AI_MODELS.find((m) => m.id === modelId)?.costMultiplier
    ?? AI_MODELS.find((m) => m.id === "default")!.costMultiplier;
}
