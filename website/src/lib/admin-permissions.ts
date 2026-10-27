// Uprawnienia moderatorow panelu admina — WSPOLNE dla serwera (requireAdminAuth)
// i przegladarki (AdminShell: kafelki + blokada stron). Bez importow, zeby
// dalo sie to uzyc wszedzie.
//
// Wlasciciel (logowanie samym kodem z ADMIN_2FA_SECRET) ma dostep do
// wszystkiego. Moderator (lib/admin-moderators.ts) — tylko do wybranych sekcji.
// Prawdziwa ochrona to API (requireAdminAuth sprawdza KAZDE zadanie); ukrycie
// kafelkow/stron w panelu to tylko wygoda.
//
// Nowy endpoint /api/admin/... bez wpisu w API_RULES = moderator NIE ma do
// niego dostepu (domyslnie zakaz) — dopisz go tutaj do wlasciwej sekcji.

export const ADMIN_SECTIONS = [
  { key: "dashboard",  label: "Dashboard",          page: "/admin" },
  { key: "licenses",   label: "Generator Licencji", page: "/admin/licenses" },
  { key: "coupons",    label: "Kupony",             page: "/admin/coupons" },
  { key: "mailbox",    label: "Poczta",             page: "/admin/mailbox" },
  { key: "assistant",  label: "Asystent AI",        page: "/admin/asystent" },
  { key: "newsletter", label: "Newsletter",         page: "/admin/newsletter" },
  { key: "ai",         label: "OpenRouter AI",      page: "/admin/gemini" },
  { key: "devices",    label: "Urządzenia",         page: "/admin/devices" },
  { key: "captures",   label: "Galeria zdjęć",      page: "/admin/captures" },
  { key: "users",      label: "Użytkownicy",        page: "/admin/users" },
  { key: "orders",     label: "Zamówienia",         page: "/admin/orders" },
  { key: "fiscal",     label: "Fiskalizacja",       page: "/admin/fiscal" },
  { key: "inventory",  label: "Magazyn",            page: "/admin/inventory" },
  { key: "labels",     label: "Krajalnica etykiet", page: "/admin/etykiety" },
  { key: "remote",     label: "Zdalna pomoc",       page: "/admin/remote" },
  { key: "backups",    label: "Kopie bazy",         page: "/admin/backups" },
  { key: "analytics",  label: "Analityka",          page: "/admin/analytics" },
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number]["key"];

const SECTION_KEYS = new Set<string>(ADMIN_SECTIONS.map((s) => s.key));

export function isAdminSection(v: unknown): v is AdminSection {
  return typeof v === "string" && SECTION_KEYS.has(v);
}

// Strony tylko dla wlasciciela (zarzadzanie moderatorami).
export const OWNER_ONLY_PAGES = ["/admin/moderators"];

interface ApiRule {
  prefix: string;
  // Sekcje z pelnym dostepem (kazda metoda).
  sections: AdminSection[];
  // Sekcje z dostepem tylko do odczytu (GET) — np. Dashboard pokazuje
  // podsumowania z kilku miejsc, ale niczego tam nie zmienia.
  read?: AdminSection[];
}

// Pierwsza pasujaca (najdluzszy prefiks wyzej) wygrywa.
const API_RULES: ApiRule[] = [
  // Kazdy zalogowany: kim jestem + wylogowanie (owner-only czesci sprawdza sam route).
  { prefix: "/api/admin/me", sections: [...ADMIN_SECTIONS.map((s) => s.key)] },
  { prefix: "/api/admin/auth", sections: [...ADMIN_SECTIONS.map((s) => s.key)] },

  { prefix: "/api/admin/stats", sections: ["dashboard"] },
  { prefix: "/api/admin/gemini-stats", sections: ["dashboard", "ai"] },
  { prefix: "/api/admin/visits", sections: ["dashboard", "analytics"] },
  { prefix: "/api/admin/stock", sections: ["dashboard", "inventory"] },
  { prefix: "/api/admin/analytics", sections: ["analytics"], read: ["dashboard"] },
  { prefix: "/api/admin/backups", sections: ["backups"], read: ["dashboard"] },
  { prefix: "/api/admin/users", sections: ["users"], read: ["dashboard"] },

  { prefix: "/api/admin/licenses", sections: ["licenses"] },
  { prefix: "/api/admin/coupons", sections: ["coupons"] },
  { prefix: "/api/admin/mailbox", sections: ["mailbox"] },
  { prefix: "/api/admin/assistant", sections: ["assistant"] },
  { prefix: "/api/admin/newsletter", sections: ["newsletter"] },
  { prefix: "/api/admin/openrouter-stats", sections: ["ai"] },
  { prefix: "/api/admin/devices", sections: ["devices"] },
  { prefix: "/api/admin/captures", sections: ["captures"] },
  { prefix: "/api/admin/orders", sections: ["orders"] },
  { prefix: "/api/admin/furgonetka", sections: ["orders"] },
  { prefix: "/api/admin/product-serials", sections: ["orders"] },
  { prefix: "/api/admin/fiscal", sections: ["fiscal"] },
  // Agent fiskalny w aplikacji desktopowej loguje sie sesja admina (lib/fiscal.ts).
  { prefix: "/api/fiscal/agent", sections: ["fiscal"] },
  { prefix: "/api/admin/inventory", sections: ["inventory"] },
  { prefix: "/api/admin/remote", sections: ["remote"] },
];

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

// Czy moderator z danymi sekcjami moze wywolac to API. Nieznana sciezka = nie.
export function moderatorApiAllowed(path: string, method: string, perms: readonly string[]): boolean {
  const rule = API_RULES.find((r) => matchesPrefix(path, r.prefix));
  if (!rule) return false;
  if (rule.sections.some((s) => perms.includes(s))) return true;
  const m = method.toUpperCase();
  return (m === "GET" || m === "HEAD") && !!rule.read?.some((s) => perms.includes(s));
}

// Sekcja, do ktorej nalezy strona panelu (null = strona spoza listy).
export function sectionForPage(path: string): AdminSection | null {
  // Najdluzsze dopasowanie — "/admin" pasuje do wszystkiego.
  let best: { key: AdminSection; len: number } | null = null;
  for (const s of ADMIN_SECTIONS) {
    const ok = s.page === "/admin" ? path === "/admin" : matchesPrefix(path, s.page);
    if (ok && (!best || s.page.length > best.len)) best = { key: s.key, len: s.page.length };
  }
  return best?.key ?? null;
}

export function moderatorPageAllowed(path: string, perms: readonly string[]): boolean {
  if (OWNER_ONLY_PAGES.some((p) => matchesPrefix(path, p))) return false;
  const section = sectionForPage(path);
  return !!section && perms.includes(section);
}
