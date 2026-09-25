// Generowanie SZKICU odpowiedzi na maila do kontakt@kalkmate.pl przez AI
// (OpenRouter) — patrz /admin/mailbox. Celowo NIE wysyla automatycznie:
// admin przegląda/edytuje przed kliknieciem "Wyslij" (ten sam formularz co
// zwykla reczna odpowiedz). Model dostaje realne dane o zamowieniach klienta
// z naszej bazy, zeby nie zmyslal statusow/numerow.

import { prisma } from "@/lib/db";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const REPLY_MODEL = process.env.MAILBOX_REPLY_MODEL || "google/gemini-3.8-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Baza wiedzy o produkcie dla AI — skondensowane z publicznej strony pomocy
// (src/components/PomocContent.tsx) i realnych zgloszen, zeby AI odpowiadalo
// na pytania techniczne/uzytkowe zgodnie z prawda, a nie zgadywalo. To NIE
// jest tekst do kopiowania 1:1 do klienta — to kontekst, z ktorego model
// korzysta budujac wlasna, zwiezla odpowiedz.
const KALKMATE_KNOWLEDGE = `=== O PRODUKCIE: KalkMate v3.0 ===
Kalkulator edukacyjny z ukrytym AI — rozwiazuje zadania z matematyki, fizyki, chemii i biologii oraz kazdego innego przedmiotu krok po kroku. Wyglada i dziala jak zwykly kalkulator prosty (obudowa Esperanza T8809-2) — funkcje AI sa ukryte pod kodem, dyskretne na egzaminie/zajeciach.

Podzespoly i funkcje (jezyk dla klienta, nie techniczny):
- Kamera — robi zdjecie zadania, wysyla do AI (model dziala na serwerze KalkMate, nie na urzadzeniu).
- Ekran OLED — wyswietla rozwiazania krok po kroku, notatki, sprawdziany.
- Klawiatura 27 klawiszy — w trybie kalkulatora dziala normalnie (cyfry/dzialania); w menu AI te same klawisze sluza do nawigacji (8/2/4/6 = gora/dol/lewo/prawo, 5 = OK, C/CE = wstecz).
- Bateria LiPo 1500 mAh — ladowanie USB-C, dowolna ladowarka >=5V/1A, pelne ladowanie ~2h. Typowe uzycie: 2-3 dni. Stand-by: 5-7 dni.
- WiFi TYLKO 2.4GHz (bez 5GHz) — wymagane do AI, synchronizacji notatek/sprawdzianow i aktualizacji OTA. Bez WiFi kalkulator dalej dziala jako zwykly kalkulator + czyta juz zsynchronizowane notatki/historie.
- Kod AI (domyslnie 1111, 4 cyfry) — wpisywany w trybie kalkulatora, odblokowuje menu AI. Mozna zmienic w Ustawieniach (wymaga podania aktualnego kodu).
- Klawisz Panic (domyslnie MU) — natychmiastowy powrot do trybu kalkulatora z kazdego ekranu (przydatne gdy ktos patrzy).
- Pamiec offline: do 50 notatek (60 KB) i 50 sprawdzianow (160 KB) — dodawane/edytowane WYLACZNIE na kalkmate.pl/panel, synchronizowane na kalkulator przez WiFi (Menu -> Notatki -> sync), czytane offline.
- Aktualizacje OTA — darmowe, dobrowolne, przez Ustawienia -> Aktualizacje, ~1 minuta, bez komputera. Stary firmware dalej dziala, tylko bez nowych funkcji.
- Dostep do AI wymaga aktywnej licencji/subskrypcji lub tokenow na koncie kalkmate.pl (Subskrypcja w panelu).
- Dwa tryby AI (przelaczane w panelu kalkmate.pl/panel, zakladka AI): "Egzamin" — wyspecjalizowany prompt pod zadania maturalne (matematyka, fizyka, chemia, biologia) zgodnie ze standardami CKE; "Czysty AI" — tryb uniwersalny, dziala jak zwykly ogolny asystent AI (jak np. ChatGPT) i odpowiada na DOWOLNE pytanie/zadanie, nie tylko maturalne — elektronika, informatyka, jezyki obce, cokolwiek. Klient sam wybiera tryb w ustawieniach, kalkulator wysyla zadanie do tego samego mechanizmu AI niezaleznie od trybu.
- Reset fabryczny: w trybie kalkulatora przytrzymaj C/CE przez 5s -> potwierdzenie -> OK = kasuje WiFi, kod AI, historie, notatki, sprawdziany, powiazanie z kontem.

Typowe zgloszenia i PRAWIDLOWA odpowiedz (nie obiecuj napraw softwarowych, ktorych faktycznie nie ma):
- Ekran sie nie wlacza / czarny -> sprawdz przelacznik ON, naladuj min. 30 minut, sprawdz kabel/port USB-C.
- WiFi nie widzi sieci -> obslugiwane jest TYLKO 2.4GHz (nie 5GHz), sprobowac ponownie po kilku sekundach.
- AI zwraca blad / timeout -> sprawdzic WiFi (Ustawienia -> Status konta ma pokazywac "Podlaczone") i czy jest aktywna subskrypcja/tokeny.
- Migajacy ekran / biale paski / buczenie -> zazwyczaj wada sprzetowa przetwornicy zasilania -> wymiana plytki W GWARANCJI, to NIE jest cos co naprawia sie softwarowo ani samodzielnie w domu.
- Klawisze nie reaguja -> moze byc wada lutowania -> zglaszane do zespolu (czasem mozliwe przemapowanie, ale to robi zespol, nie instrukcja dla klienta).
- Notatki/sprawdziany nie synchronizuja sie -> WiFi musi dzialac, konto musi byc sparowane z urzadzeniem, sprawdzic limit (50 sprawdzianow / 160 KB lacznie).
- Zapomniane haslo do konta -> kalkmate.pl/auth/forgot-password (link resetujacy wazny 60 minut).
- Zwrot / odstapienie od umowy: konsumentowi w UE przysluguje 14 dni na zwrot bez podania przyczyny (RODO + prawa konsumenta) — WSPOMNIJ o tym TYLKO jesli klient WPROST pyta o zwrot/odstapienie, nigdy sam z siebie.
- Gwarancja: 24 miesiace.
- Wysylka: Polska — kurier/Paczkomat InPost. Zagranica (np. Niemcy, USA) — kurier DPD/UPS/GLS w zaleznosci od kraju, dluzszy czas dostawy.`;

export interface OrderContext {
  orderNumber: string;
  status: string;
  fulfillmentStatus: string;
  trackingNumber: string | null;
  createdAt: string;
}

// Ostatnie zamowienia tego adresu e-mail — kontekst dla AI, zeby odpowiedz
// odwolywala sie do prawdziwych danych, a nie zgadywala.
export async function findOrdersByEmail(email: string): Promise<OrderContext[]> {
  if (!email) return [];
  const rows = await prisma.order.findMany({
    where: { customerEmail: email },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return rows.map((o) => ({
    orderNumber: o.orderNumber,
    status: o.status,
    fulfillmentStatus: o.fulfillmentStatus || "unfulfilled",
    trackingNumber: o.trackingNumber,
    createdAt: o.createdAt.toISOString(),
  }));
}

const FULFILLMENT_LABELS: Record<string, string> = {
  unfulfilled: "nieopracowane",
  in_progress: "w trakcie realizacji",
  shipped: "wysłane",
  fulfilled: "dostarczone/zrealizowane",
  cancelled: "anulowane",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "oczekuje na płatność",
  paid: "opłacone",
  cancelled: "anulowane",
  failed: "nieudana płatność",
};

function describeOrder(o: OrderContext): string {
  const payment = PAYMENT_LABELS[o.status] || o.status;
  const fulfillment = FULFILLMENT_LABELS[o.fulfillmentStatus] || o.fulfillmentStatus;
  const tracking = o.trackingNumber ? `, numer przesyłki ${o.trackingNumber}` : "";
  return `- Zamówienie ${o.orderNumber} (złożone ${o.createdAt.slice(0, 10)}): płatność ${payment}, realizacja ${fulfillment}${tracking}`;
}

async function callOpenRouter(system: string, user: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter API key not configured");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kalkmate.pl",
      "X-Title": "KalkMate",
    },
    body: JSON.stringify({
      model: REPLY_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 4000,
      // patrz src/lib/translate.ts — ten model ma obowiazkowy reasoning i przy
      // dluzszych promptach potrafi zjesc caly max_tokens na "mysli", zwracajac
      // pusta tresc. "minimal" = reasoning_tokens=0, zweryfikowane na zywo.
      reasoning: { effort: "minimal" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Pusta odpowiedz modelu");
  return content.trim();
}

export async function generateReplyDraft(params: {
  customerEmailText: string;
  customerName?: string | null;
  orders: OrderContext[];
}): Promise<string> {
  const ordersBlock = params.orders.length
    ? params.orders.map(describeOrder).join("\n")
    : "Brak zamówień powiązanych z tym adresem e-mail w bazie KalkMate.";

  const system = `Jestes pomocnym, uprzejmym asystentem obslugi klienta sklepu KalkMate (kalkulator edukacyjny z AI dla maturzystow, kalkmate.pl).
Dostajesz mail od klienta, dane o jego zamowieniach z naszej bazy oraz baze wiedzy o produkcie. Napisz zwiezla, uprzejma odpowiedz.

${KALKMATE_KNOWLEDGE}

Zasady (waznie przestrzegaj):
- JEZYK: napisz odpowiedz W TYM SAMYM JEZYKU, w ktorym napisany jest mail klienta (np. mail po niemiecku -> odpowiedz po niemiecku, mail po angielsku -> po angielsku). Jesli jezyka nie da sie jednoznacznie rozpoznac, uzyj polskiego.
- Pytania techniczne/o produkt (bateria, WiFi, kod AI, notatki, aktualizacje, zwrot, gwarancja itp.) odpowiadaj na podstawie bazy wiedzy powyzej — nie zmyslaj specyfikacji ani procedur.
- Uzywaj WYLACZNIE podanych danych o zamowieniu — nie wymyslaj statusow, dat, numerow przesylek ani kwot, ktorych nie masz w danych.
- Jesli klient prosi o cos, czego nie mozesz sam zalatwic z tego miejsca (np. anulowanie zamowienia, zwrot pieniedzy, wymiana, reklamacja sprzetowa) — NIE pisz ze to juz zrobiles/zalatwiles. Napisz ze zespol zajmie sie sprawa i wroci z odpowiedzia/potwierdzeniem.
- Jesli w bazie nie ma zadnego pasujacego zamowienia, a klient pyta o konkretne zamowienie — napisz ze nie mozesz go znalezc po tym adresie e-mail i popros o numer zamowienia.
- Ton: cieply, konkretny, rzeczowy, bez sztucznego entuzjazmu, bez emoji.
- Podpis na koncu, przetlumaczony na jezyk odpowiedzi (np. "Zespół KalkMate" / "KalkMate Team" / "Ihr KalkMate-Team").
- To jest SZKIC do przejrzenia przez czlowieka przed wyslaniem, wiec mozesz w tresci wprost zaznaczyc niepewnosc, jesli czegos w danych brakuje.
- Wypisz WYLACZNIE tresc odpowiedzi (bez tematu maila, bez komentarzy w stylu "Oto szkic odpowiedzi:", bez nazwy jezyka).`;

  const user = `[DANE O ZAMOWIENIACH KLIENTA]\n${ordersBlock}\n\n[MAIL OD KLIENTA${params.customerName ? ` (${params.customerName})` : ""}]\n${params.customerEmailText.slice(0, 8000)}`;

  return callOpenRouter(system, user);
}

// Szkic NOWEGO maila do klienta wysylanego z inicjatywy admina ze strony
// zamowienia (nie jest to odpowiedz na wiadomosc od klienta) — patrz
// /admin/orders/[id]. Admin moze podac krotka instrukcje/temat (np.
// "poinformuj o opoznieniu wysylki"); bez niej model pisze ogolny status.
export async function generateOrderEmailDraft(params: {
  customerName?: string | null;
  orders: OrderContext[];
  focusOrderNumber: string;
  instruction?: string;
}): Promise<string> {
  const ordersBlock = params.orders.length
    ? params.orders.map(describeOrder).join("\n")
    : "Brak zamówień powiązanych z tym adresem e-mail w bazie KalkMate.";

  const system = `Jestes pomocnym, uprzejmym asystentem obslugi klienta sklepu KalkMate (kalkulator edukacyjny z AI dla maturzystow, kalkmate.pl).
Piszesz NOWEGO maila DO klienta z inicjatywy zespolu — to NIE jest odpowiedz na wiadomosc od klienta. Dotyczy zamowienia ${params.focusOrderNumber}. Dostajesz dane o zamowieniach tego klienta z naszej bazy oraz baze wiedzy o produkcie.

${KALKMATE_KNOWLEDGE}

Zasady (waznie przestrzegaj):
- JEZYK: pisz po polsku, chyba ze instrukcja ponizej jest w innym jezyku — wtedy uzyj tego jezyka.
- Skup sie GLOWNIE na zamowieniu ${params.focusOrderNumber}, chyba ze instrukcja mowi inaczej.
- Uzywaj WYLACZNIE podanych danych o zamowieniach — nie wymyslaj statusow, dat, numerow przesylek ani kwot, ktorych nie masz w danych.
- Jesli nie dostales konkretnej instrukcji, napisz krotka, uprzejma wiadomosc z aktualnym statusem tego zamowienia.
- Nie obiecuj dzialan/terminow, ktorych nie mozesz stad realnie zagwarantowac (np. konkretnej daty dostawy, zwrotu pieniedzy) — pisz ze zespol sie tym zajmie.
- Ton: cieply, konkretny, rzeczowy, bez sztucznego entuzjazmu, bez emoji.
- Podpis na koncu, przetlumaczony na jezyk odpowiedzi (np. "Zespół KalkMate" / "KalkMate Team").
- To jest SZKIC do przejrzenia przez czlowieka przed wyslaniem.
- Wypisz WYLACZNIE tresc maila (bez tematu, bez komentarzy w stylu "Oto szkic:", bez nazwy jezyka).`;

  const user = `[DANE O ZAMOWIENIACH KLIENTA]\n${ordersBlock}\n\n[TEMAT/INSTRUKCJA OD ADMINA]\n${
    params.instruction?.trim() || `(brak — napisz ogolna wiadomosc o statusie zamowienia ${params.focusOrderNumber})`
  }`;

  return callOpenRouter(system, user);
}
