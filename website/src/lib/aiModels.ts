// Lista modeli AI do wyboru w panelu (sekcja AI).
// Wszystkie modele ida przez OpenRouter (OPENROUTER_API_KEY w env serwera).
//
// costMultiplier — mnożnik kosztu względem Gemini 2.5 Flash (baseline = 1.0).
// System odejmuje od salda: Math.ceil(real_api_tokens * costMultiplier)
// Gwarantuje ze niezaleznie od modelu 1M "efektywnych tokenow" kosztuje ~$1.40 w API.
// Sugestia: 1M efektywnych tokenow = 1 subskrypcja (API cost ~5.6 PLN, mozna sprzedac za 30 PLN).
//
// vision — czy model przyjmuje obraz na wejsciu. Tryb "zdjecie" w kalkulatorze
// wymaga vision=true; dla modeli tekstowych solve podmienia model na domyslny
// z wizja (inaczej OpenRouter zwraca 404 "No endpoints support image input").
//
// Aby dodac/zmienic model — edytuj ponizsza tablice.
export type AiModelOption = {
  id: string;
  label: string;
  provider: string;
  note?: string;
  costMultiplier: number; // wzgledem Gemini 2.5 Flash = 1.0
  vision: boolean;        // czy obsluguje obraz na wejsciu
};

export const AI_MODELS: AiModelOption[] = [
  // costMultiplier obliczony z: avg(input_price, output_price) / 1.40  (ceny per 1M tokenow)
  // Lista odswiezona 2026-09-18 na podstawie zywego https://openrouter.ai/api/v1/models
  // (ceny i dostepnosc modeli sprawdzone bezposrednio w API OpenRoutera — poprzednia
  // wersja listy mial mistralai/mistral-large-2512 bez wersji real-time (tylko
  // ":batch"), wiec wybor tego modelu konczyl sie bledem 404 przy zwyklym czacie).
  { id: "default",                       label: "Domyślny (Gemini 2.5 Pro)",  provider: "KalkMate",   note: "Domyślny model serwera",                    costMultiplier: 4,    vision: true  },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro",             provider: "Google",     note: "Multimodal, nauki ścisłe",                   costMultiplier: 5,    vision: true  },
  { id: "google/gemini-3.8-flash",       label: "Gemini 3.8 Flash",           provider: "Google",     note: "Najnowszy, szybki i tani",                   costMultiplier: 1.6,  vision: true  },
  { id: "anthropic/claude-opus-5",       label: "Claude Opus 5",              provider: "Anthropic",  note: "Najlepszy do rozumowania i pisania",         costMultiplier: 10.7, vision: true  },
  { id: "anthropic/claude-sonnet-5",     label: "Claude Sonnet 5",            provider: "Anthropic",  note: "Świetny stosunek jakości do ceny",           costMultiplier: 4.3,  vision: true  },
  { id: "anthropic/claude-fable-5.1",    label: "Claude Fable 5.1",           provider: "Anthropic",  note: "Najnowszy flagowiec Anthropic",              costMultiplier: 21.4, vision: true  },
  { id: "openai/gpt-6-astra",            label: "GPT-6 Astra",                provider: "OpenAI",     note: "Start generacji GPT-6, mocne rozumowanie",   costMultiplier: 21.4, vision: true  },
  { id: "openai/gpt-5.6-luna",           label: "GPT-5.6 Luna",               provider: "OpenAI",     note: "Tańsza opcja OpenAI",                        costMultiplier: 0.5,  vision: true  },
  { id: "x-ai/grok-4.6",                 label: "Grok 4.6",                   provider: "xAI",        note: "Mocny na trudnych benchmarkach",             costMultiplier: 2.9,  vision: true  },
  { id: "deepseek/deepseek-v4.1-flash",  label: "DeepSeek V4.1 Flash",        provider: "DeepSeek",   note: "Tani specjalista od rozumowania, już z wizją", costMultiplier: 0.5,  vision: true  },
  { id: "qwen/qwen3.8-flash",            label: "Qwen3.8 Flash",              provider: "Alibaba",    note: "Szybki i bardzo tani, już z wizją",          costMultiplier: 0.2,  vision: true  },
  { id: "meta/muse-spark-1.3",           label: "Muse Spark 1.3",             provider: "Meta",       note: "Najnowszy model Meta (następca Llama)",      costMultiplier: 2,    vision: true  },
  { id: "mistralai/mistral-medium-3-5",  label: "Mistral Medium 3.5",         provider: "Mistral",    note: "Europejski flagowy model",                   costMultiplier: 3.2,  vision: true  },
  { id: "perplexity/sonar-pro",          label: "Sonar Pro",                  provider: "Perplexity", note: "AI z dostępem do internetu",                 costMultiplier: 6.4,  vision: true  },
];

export const AI_MODEL_IDS = AI_MODELS.map((m) => m.id);

// Zwraca mnoznik kosztu dla danego model ID (fallback na "default" jesli nieznany)
export function getCostMultiplier(modelId: string): number {
  return AI_MODELS.find((m) => m.id === modelId)?.costMultiplier
    ?? AI_MODELS.find((m) => m.id === "default")!.costMultiplier;
}

// Czy dany model (id z AI_MODELS) obsluguje obraz na wejsciu. Nieznany id -> true
// (zakladamy ze serwerowy default ma wizje; OPENROUTER_DEFAULT_MODEL = Gemini).
export function modelSupportsVision(modelId: string): boolean {
  const m = AI_MODELS.find((x) => x.id === modelId);
  return m ? m.vision : true;
}
