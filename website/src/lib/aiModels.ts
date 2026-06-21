// Lista modeli AI do wyboru w panelu (sekcja AI).
//
// "default" = serwerowy Gemini (zawsze dziala, bez dodatkowej konfiguracji).
// Pozostale (format provider/model) leca przez OpenRouter — JEDNO API do
// wszystkich najlepszych modeli na swiecie (225+ modeli: OpenAI, Anthropic,
// Google, xAI, DeepSeek, Qwen, Mistral, Llama...). Wymaga OPENROUTER_API_KEY
// w env serwera; bez klucza solve route i tak gracefully spadnie na Gemini.
//
// Aby dodac/zmienic model — edytuj ponizsza tablice (jedno zrodlo prawdy:
// uzywane i przez dropdown w panelu, i przez walidacje w /api/user/ai-settings).
export type AiModelOption = {
  id: string;
  label: string;
  provider: string;
  note?: string;
};

export const AI_MODELS: AiModelOption[] = [
  { id: "default", label: "Domyślny (Gemini 2.5 Pro)", provider: "KalkMate", note: "Zawsze działa, bez konfiguracji" },
  { id: "google/gemini-3-pro", label: "Gemini 3 Pro", provider: "Google", note: "Multimodal, nauki ścisłe, rozumowanie" },
  { id: "google/gemini-3-flash", label: "Gemini 3 Flash", provider: "Google", note: "Szybki i tani" },
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", provider: "Anthropic", note: "Najlepszy do rozumowania i pisania" },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", provider: "Anthropic", note: "Świetny stosunek jakości do ceny" },
  { id: "openai/gpt-5.4", label: "GPT-5.4", provider: "OpenAI", note: "Rozumowanie strukturalne" },
  { id: "x-ai/grok-4", label: "Grok 4", provider: "xAI", note: "Mocny na trudnych benchmarkach" },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2", provider: "DeepSeek", note: "Tani specjalista od rozumowania" },
  { id: "qwen/qwen3-coder", label: "Qwen3 Coder", provider: "Alibaba", note: "Mocny do STEM, często darmowy" },
];

export const AI_MODEL_IDS = AI_MODELS.map((m) => m.id);
