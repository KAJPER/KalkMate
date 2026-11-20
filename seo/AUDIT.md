# KalkMate — audyt SEO / GEO (etap 1)

Data: 2026-11-18 · Zakres: kod `website/` (Next.js 16), żywa strona https://kalkmate.pl, `public/llms.txt`, instrukcje w `docs/`, README, aktualna dokumentacja crawlerów AI.
Tryb: **tylko odczyt** — ten etap niczego w stronie nie zmienia. Dowody: `plik:linia` (ścieżki względem `website/`, chyba że zaznaczono inaczej).

---

## 0. Podsumowanie

**Fundament techniczny jest dobry:** wszystkie publiczne strony mają canonical, hreflang na 44 stronach wielojęzycznych jest wzajemny i z `x-default`, prywatne sekcje są `noindex`, sitemap zwraca 46 adresów i każdy daje HTTP 200, JSON-LD parsuje się bez błędów, główna treść strony głównej jest w HTML bez JavaScriptu, redirecty http→https i www→bez-www są jednoetapowe (301).

**Największe problemy nie są techniczne, tylko w treści:**

1. **Twierdzenia niezgodne z kodem lub nieudokumentowane** — m.in. obietnica, że zdjęcia są usuwane od razu (w kodzie są trzymane 180 dni), autofocus (kamera OV2640 go nie ma), „model trenowany na tysiącach zadań” (to model Gemini przez OpenRouter), trzy różne czasy pracy baterii.
2. **Komunikacja „do użycia na egzaminie / ukryte”** — nadal w `llms.txt` (zmiana z 17.11 została cofnięta), w opisach JSON-LD na każdej stronie głównej („for exams… discreet”), w metadanych DE/CS/SK i w części tekstów i opinii. To ryzyko wizerunkowe, prawne i wobec zasad Google Ads/Merchant Center („enabling dishonest behaviour”). Asystent AI, który przeczyta te teksty, opisze KalkMate jako urządzenie do ściągania — dokładnie odwrotnie niż chcemy.
3. **Sprzeczności między stronami** — prawo odstąpienia (14 dni vs wyłączenie dla personalizowanego urządzenia), wersje produktu (v1 / v3 / v4), wersja firmware (0.6.4 na stronie, 2.0.5 w instrukcji, 2.1.7 w rzeczywistości), dwa różne kody EAN.

Poprawienie punktu 1–3 da więcej niż jakiekolwiek nowe strony: zarówno Google, jak i asystenci AI opisują produkt na podstawie tego, co znajdą — jeśli fakty są sprzeczne albo nieprawdziwe, taki będzie opis.

---

## 1. Architektura (stan faktyczny)

| Element | Stan |
|---|---|
| Framework | Next.js 16 App Router, React 19, Prisma 6 + SQLite; `next start` za nginx (Docker) + PM2, VPS Mediolan; edge `ca.kalkmate.pl` tylko dla `/api/device/solve` |
| Języki | 11: `pl` bez prefiksu, `/en /de /cs /sk /lt /be /es /pt /fr /it` — każdy jako osobny, ręcznie skopiowany katalog (nie segment `[lang]`), `src/lib/i18n.ts:1-46`; `/pl/*` → 301 na wersję bez prefiksu |
| Strony publiczne (49) | 11× strona główna, 11× `/pomoc`, 11× `/regulamin`, 11× `/polityka-prywatnosci`, tylko PL: `/wypozyczenie`, `/reklamacja`, `/black-friday` |
| Strony prywatne | `/admin/*`, `/panel/*`, `/auth/*`, `/koszyk`, `/claim`, `/opinia/[token]` — wszystkie `noindex, nofollow`; `/api/*` zablokowane w robots |
| Blog / artykuły | brak |
| Domeny | `kalkmate.pl` i `kalkmate.eu` serwują ten sam kod; każda ma własny self-canonical (`i18n.ts:19-33`) |
| Renderowanie | strona główna = server components (Hero, HowItWorks, Specs, Gallery, Reviews, FAQ w HTML); `BuyNow` (cała sekcja zakupu), `VideoScroll`, `StickyBuyBar`, `CartDrawer` = `ssr:false` (`ClientShell.tsx:6-12`) |
| Skrypty zewnętrzne | brak GA/GTM; Microsoft Clarity tylko po zgodzie (`ClarityAnalytics.tsx`); InPost, Stripe, Google Customer Reviews wstrzykiwane dopiero gdy potrzebne — wpływ na pierwsze ładowanie niski |

---

## 2. Problemy — priorytet P0 (prawne / zaufanie / reputacja)

### P0-1. Obietnica prywatności niezgodna z kodem
- FAQ: „nie przechowujemy zdjęć — są usuwane z serwera natychmiast po wysłaniu odpowiedzi” — `src/lib/content/faq.ts:36` (+ EN :90 i pozostałe języki).
- Kod: `src/app/api/device/solve/route.ts:768-778` zapisuje każde zdjęcie (`saveCapture`) przed wysłaniem do AI; `src/lib/captures.ts:337-341` — domyślna retencja **180 dni**; panel admina ma przeglądarkę zdjęć.
- **Do decyzji właściciela:** albo zmienić tekst (i sprawdzić zgodność z polityką prywatności), albo skrócić retencję. Tego nie da się „poprawić SEO-wo” — to jest kwestia RODO.

### P0-2. Prawo odstąpienia — sprzeczne komunikaty
- `BuyNow.tsx:198-199` i `content/legal/regulamin/pl.tsx:78-85`: urządzenie personalizowane jest **wyłączone** z 14-dniowego odstąpienia.
- `components/PomocContent.tsx:181` (i wszystkie języki): „Tak, 14 dni od dostawy bez podania przyczyny (RODO + ustawa…)” — przeczy regulaminowi, a RODO to zła podstawa prawna.
- `content/legal/regulamin/pl.tsx:9` meta description: „14 dni na zwrot” bez zastrzeżenia.

### P0-3. Komunikacja „na egzamin / ukryte / dyskretne” w treściach publicznych
Polityka strony od 17.11: KalkMate to narzędzie do nauki w domu, **niedozwolone** na maturze, egzaminach, sprawdzianach i kartkówkach (`faq.ts:16`). Sprzeczne z tym nadal są:

| Gdzie | Co | Dowód |
|---|---|---|
| `public/llms.txt` | „kalkulator do ściągania”, „can be used during the exam itself”, „usable during a real, proctored exam” — **na żywo**; poprawka z 17.11 nie trafiła do commita i została nadpisana przy auto-deployu z GitHuba | `llms.txt:32-34` |
| JSON-LD Product (każda strona główna) | „AI camera calculator for exams… Smart, discreet”, „für Prüfungen”, „na zkoušky… nenápadná”, „para exámenes… discreta” itd. | `src/lib/seo.ts:22-31` |
| Metadane DE/CS/SK | „KI Taschenrechner mit Kamera für Prüfungen”, „AI Prüfungsrechner”; „na zkoušky a maturitu”; tytuł SK „…na maturitu a písomky” | `app/de/page.tsx:29,36,41`, `app/cs/page.tsx:29,37,38`, `app/sk/page.tsx:27,35` |
| Hero | „wygląda dokładnie jak zwykły kalkulator prosty… ukrytą kamerę”, alt „z ukrytą kamerą”, etykieta „UKRYTA · 2MP”; EN „it hides something… concealed camera”, „HIDDEN”; analogicznie wszystkie języki | `components/Hero.tsx:39-54, 80-94, 121-134…` |
| HowItWorks | „Ukryta kamera… zadanie z arkusza” / „from an exam paper” / „aus dem Prüfungsbogen”… | `components/HowItWorks.tsx:40, 76, 112…` |
| FAQ | „ukrytą kombinacją klawiszy — nie ma żadnych ikon ani wskaźników” (11 języków) | `faq.ts:12, 66, 116…` |
| Pomoc | klawisz paniki „przydaje się gdy ktoś patrzy” / „when someone's looking”; „wygląda jak zwykła Esperanza T8809-2” (do tego cudzy znak towarowy) | `PomocContent.tsx:173, 175` (+ wszystkie języki) |
| ExamBenefits | „Accuracy on exam problems 94%” | `components/ExamBenefits.tsx:155, 569…` |
| Opinie (widoczne) | id 5 „uratował mnie na zaliczeniu”, 9 „nic nie widać z boku”, 22 „Dyskrecja…”, 23, 31 „Ukryta kamerka…”, 33 „bardzo niepozorny”, 36 „sprzęt ukryty w zwykłej obudowie”, 46 „nie rzuca się w oczy na ławce”, 54 „używam codziennie na lekcjach” (graniczne: 1, 18) | `lib/content/reviews-source.json` (7, 32, 50 już ukryte) |
| Instrukcje | blok „Klawisz paniki — z każdego ekranu AI od razu wraca do zwykłego kalkulatora” | `docs/kalkmate_instrukcja_v4_pl.html:160-164` (+ EN) |

Opisy zgodne z rzeczywistością i bez tej narracji: „kalkulator z kamerą i AI do nauki”, „rozwiązanie krok po kroku”, „bez telefonu i rozpraszaczy”. Kamera z tyłu obudowy może być opisana neutralnie („wbudowana kamera”).

### P0-4. Twierdzenia nieprawdziwe lub bez pokrycia
| Twierdzenie | Rzeczywistość | Dowód |
|---|---|---|
| „Autofocus · 10–∞ cm”, „ostrzy automatycznie” | OV2640 = stała ostrość; AF tylko OV5640 na PCB v6 | `Specs.tsx:43,89`, `HowItWorks.tsx:40…`, `src/camera.h:3-9` (firmware) |
| „Pole widzenia 78°”, „Kontrast 10000:1” | brak źródła w repo | `Specs.tsx:42, 51` |
| „OCR < 1.2 s”, „1.2 sekundy”, „94% trafność”, „1.2 s średni czas” | brak pomiaru; model Gemini 2.5 Pro, odpowiedzi do 18 tys. tokenów (dziesiątki sekund); opinia 41 sama to podważa | `Hero.tsx:45, 61, 551`, `ExamBenefits.tsx:83-93` |
| „model AI trenowany na tysiącach zadań z ostatnich 10 lat”, „10 lat danych treningowych” | KalkMate nie trenuje modelu — używa Gemini przez OpenRouter z własnym promptem | `Hero.tsx:41` (+ języki), `ExamBenefits.tsx:35` |
| Bateria: „~6 h” / „~8 h tryb mieszany” / „~2–3 dni, stand-by 5–7 dni” | trzy różne wartości, **żadna nie jest zmierzona**; z poborów prądu (README) wychodzi ~5–7 h przy wszystkim włączonym | `Hero.tsx:547`, `faq.ts:32…`, `Specs.tsx:58…`, `PomocContent.tsx:171…` |

---

## 3. Problemy — P1 (techniczne SEO o realnym wpływie)

1. **`<html lang="pl">` na wszystkich 11 wersjach językowych** w HTML z serwera (`app/layout.tsx:140`); poprawiane dopiero w przeglądarce (`components/HtmlLang.tsx:10-17`). Dotyczy też strony 404. Nagłówek `Content-Language` i `og:locale` są poprawne, ale crawlery czytające HTML widzą „pl”.
2. **Sekcja zakupu renderowana tylko w przeglądarce** (`BuyNow` `ssr:false`): H2, co jest w zestawie, wysyłka, gwarancja, szczegóły ceny nie istnieją w HTML. W HTML cena występuje tylko w przycisku hero („Zamów — 699 zł”).
3. **Open Graph na `/wypozyczenie`, `/black-friday`, `/reklamacja`**: `og:url` = `https://kalkmate.pl` i ogólny `og:title` dziedziczony z layoutu — udostępnienie linku pokazuje stronę główną. Regulamin i polityka prywatności (11 języków) bez `og:image` i bez `twitter`.
4. **Sitemap**: `lastmod` = moment startu serwera dla wszystkich 46 URL (`app/sitemap.ts:13`) — nic nie mówi crawlerom; brak `/black-friday` (indeksowalna, 200, własny canonical); brak `x-default` w alternates sitemapy.
5. **JSON-LD Product/Offer**:
   - cena i `availability: InStock` wpisane na sztywno (`seo.ts:88, 95`), choć stan magazynu jest w bazie (`api/stock`); opisy meta też mają „699 zł/169 EUR” na sztywno — w czasie Black Friday rozjazd z ceną promocyjną;
   - brak `gtin13`, a w kodzie są **dwa różne EAN**: `5908202546201` (etykieta produktowa, `admin/ProductLabel.tsx:48`) i `5904224900012` (`BuyNow.tsx:1591`, Google Customer Reviews) — trzeba ustalić, który jest zarejestrowany w GS1;
   - brak `hasMerchantReturnPolicy` (Google Merchant listings tego oczekuje);
   - `aggregateRating`: po ≥5 opiniach w bazie bierze dane z bazy, a na stronie wyświetla dane statyczne i gwiazdki na sztywno `rating={5}` (`Reviews.tsx:20, 165`) → oznaczenie może nie zgadzać się z tym, co widzi użytkownik (wymóg Google: zgodność z widoczną treścią);
   - czasy dostawy w schema: handling 1–20 dni + transit do 15 dni (do 35 dni) vs „2–4 tygodnie” w FAQ/regulaminie.
6. **Duplikat domeny**: `kalkmate.eu` = te same treści, własne canonicale, brak powiązania z `.pl` → dwie konkurujące kopie serwisu. Do decyzji: 301 `.eu → .pl` (najprościej) albo canonical `.eu → .pl`.
7. **Strona 404**: brak `not-found.tsx`; HTML ma dwa `<title>` i dwa sprzeczne meta robots (`noindex` + `index, follow`).
8. **`/pomoc`**: odpowiedzi FAQ renderowane dopiero po kliknięciu (`PomocContent.tsx:1895`) — nie ma ich w HTML; changelog ładowany z zablokowanego w robots `/api/`; filmy bez napisów, transkrypcji, plakatu i VideoObject (plik nazywa się `instrukacja-kalkmate-bez-napisow.mp4`).

---

## 4. Problemy — P2 (spójność encji i porządki)

- **Nazewnictwo wersji**: strona „KalkMate v3.0 / KM-v3.0”, schema `sku/mpn KM-V3`, `PRODUCT_ID "kalkmate-v1"`, etykieta i instrukcje „model KalkMate-ESP32S3-v1, partia PCB-v4-2026”, instrukcja „(v4)”. Propozycja: **produkt = KalkMate v3**, **płytka = rewizja v4** — i tylko tak.
- **Wersja firmware na stronie**: „FW 0.6.4” (`Footer.tsx:485`, `Navigation.tsx:172`, `Specs.tsx:586`, `auth/signin/page.tsx:767,824`, `PomocContent.tsx:160` „w v0.6.4 dodaliśmy…”); instrukcje „2.0.5”; aktualna **2.1.7**.
- **Języki**: strona wszędzie „11”, koreańskiego (odpowiedzi AI) nie wymienia nigdzie.
- **Offline**: firmware ma lokalny solver (równania liniowe/kwadratowe, układy 2×2) i kolejkę offline, a `llms.txt:10` mówi „AI does NOT run… offline, do not describe as offline”, Pomoc: „bez WiFi działa tylko kalkulator…”. Lokalny solver nigdzie nie jest opisany.
- **Modele AI**: strona mówi tylko „Gemini”; wybór innego modelu w panelu i własny prompt nie są opisane publicznie.
- **Wymiary i waga**: nie występują nigdzie publicznie — **nieznane** (nie publikować, dopóki nie zostaną zmierzone).
- **Stopka**: współrzędne „LAT 50.0647 LON 19.9450” to Kraków, firma jest w Choroszczy.
- **Organization** w schema: brak `logo`, brak `sameAs`, zawsze `kalkmate.pl` także na `.eu`; `/be` dostaje cenę w PLN i wysyłkę tylko do PL (`seo.ts:64-66`) — inaczej niż pozostałe języki.
- **FAQ wypożyczeń** ma ceny wpisane ręcznie (`faq.ts:56`) zamiast z `RENTAL_PLANS` — w czasie Black Friday pokaże 149 zł zamiast 99 zł.
- **Martwy kod**: `lib/pricing.ts` (stary model abonamentowy), `CameraReveal.tsx`, `Features.tsx` (nieużywane, z tekstami „ukryta kamera… nikt jej nie zauważy”) — do usunięcia, żeby ktoś ich przypadkiem nie podpiął.
- **H1**: słowa łamane `<br/>` bez spacji („Zróbzdjęcie”, „Regulaminsklepu.”) — ekstraktory tekstu i część crawlerów sklejają wyrazy.
- **Manifest PWA**: `theme_color/background_color #ffffff` przy ciemnym motywie strony.

---

## 5. Wydajność (pomiary z żywej strony, bez Lighthouse)

| Obszar | Stan | Uwagi |
|---|---|---|
| Rozmiar HTML `/` | 611 KB (52 KB gzip); `/en` 720 KB (59 KB gzip) | dużo inline (style/RSC payload) |
| Kompresja | tylko gzip, brak Brotli | nginx edge — do włączenia `brotli` lub `gzip_static` |
| Cache HTML | `private, no-cache, no-store` — każda wizyta renderuje stronę od nowa | strony główne są dynamiczne (`headers()` + zapytania do bazy o oceny/promocje) — kandydat na ISR/`revalidate` |
| Obraz hero | `priority`, ale schowany na mobile (`hidden lg:block`, `sizes …0px`) — preload na telefonach bez sensu | `Hero.tsx:561, 575` |
| `public/` | ~60 MB plików nieużywanych przez kod (m.in. `KalkMate2-5.png` po 6 MB, `galeria/*.png` 5–8 MB, stare `.mp4`), wszystkie publicznie dostępne i indeksowalne w Google Grafika — część to zdjęcia prototypów | lista w raporcie technicznym; do przeniesienia poza `public/` |
| Nagłówki | `X-Powered-By: Next.js` ujawniony; 8 preloadów fontów w `Link` | `poweredByHeader: false`; ograniczyć fonty |

Lighthouse / PageSpeed / CrUX **nie były uruchamiane** — wymagają osobnego pomiaru (PSI API albo Search Console → Core Web Vitals).

---

## 6. Crawlery AI — stan i opcje

**robots.txt teraz** (`app/robots.txt/route.ts:10-18`): jedna grupa `User-agent: *` z `Content-Signal: search=yes, ai-input=yes, ai-train=no` (niestandardowa dyrektywa w stylu Cloudflare — Google ją ignoruje, nie szkodzi), `Allow: /`, `Disallow: /admin/`, `Disallow: /api/`. Żadnych reguł per bot → **wszystkie boty, w tym treningowe, mają pełny dostęp**; deklaracja `ai-train=no` nie jest egzekwowana przez nikogo.

Zweryfikowane w dokumentacji dostawców (18.11.2026):

| Token | Do czego | Szanuje robots.txt |
|---|---|---|
| Googlebot | Google Search, w tym AI Overviews / AI Mode | tak |
| Google-Extended | tylko token: trening i grounding Gemini/Vertex; nie wpływa na Google Search | tak (token) |
| Bingbot | Bing + odpowiedzi Copilot (nowe preferencje `__usage_ai-training` od 1.02.2027) | tak |
| OAI-SearchBot | wyniki ChatGPT Search | tak |
| GPTBot | trening modeli OpenAI | tak |
| ChatGPT-User | pobranie na żądanie użytkownika | „może nie stosować się” |
| Claude-SearchBot | indeks wyszukiwania Claude | tak |
| ClaudeBot | trening modeli Anthropic | tak |
| Claude-User | pobranie na żądanie użytkownika | tak |
| PerplexityBot | indeks Perplexity (nie trening) | tak |
| Perplexity-User | pobranie na żądanie | zwykle ignoruje |
| Applebot / Applebot-Extended | Siri/Spotlight / tylko token opt-out treningu | tak |
| CCBot | Common Crawl (zbiór używany do treningu) | tak |

Źródła: developers.openai.com/api/docs/bots, developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers, support.claude.com/en/articles/8896518, docs.perplexity.ai/guides/bots, support.apple.com/en-us/119829, blogs.bing.com (10.2026), commoncrawl.org/ccbot.

**`llms.txt`**: nieformalna propozycja (llmstxt.org), żaden silnik wyszukiwania nie dokumentuje, że go używa; Google wprost pisze, że do AI Overviews **nie trzeba** specjalnych plików. Plik jest tani i nie szkodzi, ale jego treść musi być prawdziwa — dziś jest najgorszym miejscem w serwisie (P0-3).

**Do decyzji właściciela** (obie opcje są uczciwe):
- **A — pozwól na trening**: jawnie dopuść wszystkie boty; fakty o KalkMate mogą trafić do wiedzy przyszłych modeli. Wtedy usunąć mylące `ai-train=no`.
- **B — bez treningu, ale widoczny w wyszukiwarkach AI**: `Disallow: /` dla GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot; zostawić Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, PerplexityBot, Applebot. Uwaga: blokada Google-Extended ogranicza też grounding w aplikacji Gemini (poza Google Search).

---

## 7. Fakty — stan „jednego źródła prawdy”

| Fakt | Wartość zweryfikowana | Źródło |
|---|---|---|
| Nazwa / wersja | KalkMate v3 (produkt), płytka rev. v4 | `lib/content/shop.ts:11`, pudełko, `CLAUDE.md` |
| Cena | 699 PLN / 169 EUR; Black Friday 549 PLN / 129 EUR (27–30.11.2026, 50 szt.) | `shop.ts:13`, `checkoutPricing.ts:30`, `content/promo.ts:8-19` |
| W zestawie | 2 mln tokenów AI (kod z pudełka) + 200 tys. przy rejestracji, bez abonamentu | `lib/tokenGrants.ts:6,9` |
| Gwarancja | 24 miesiące | regulamin `pl.tsx:123` |
| MCU | ESP32-S3-WROOM-1-N16R8 (16 MB flash, 8 MB PSRAM) | `CLAUDE.md`, `platformio.ini` |
| Kamera | OV2640 2 MP, **stała ostrość** | `src/camera.h` |
| Ekran | OLED SSD1322 256×64 | `CLAUDE.md` |
| Bateria | LiPo 3,7 V 1500 mAh, ładowanie USB-C ~2 h; **czas pracy: nieznany (niezmierzony)** | etykieta, README |
| Łączność | WiFi 2,4 GHz, USB-C | `CLAUDE.md` |
| AI | domyślnie Gemini 2.5 Pro przez OpenRouter; w panelu wybór innych modeli i własny prompt | `api/device/solve/route.ts:39` |
| Offline | kalkulator + lokalny solver prostych równań + kolejka zadań do wysłania | `src/offline_solver.h`, `src/offline_queue.h` |
| Języki | menu 11 języków; odpowiedzi AI dodatkowo po koreańsku | `src/settings_screen.h:152-157` |
| Przedmioty | matematyka, fizyka, chemia, biologia (+ tryb ogólny) | `faq.ts` |
| Wysyłka | PL: Paczkomat InPost 0 zł; UE 20 EUR; świat 35 EUR | `faq.ts:40`, `seo.ts:93-94` |
| Wypożyczenie | 7 / 30 / 60 dni: 79 / 149 / 249 zł, kaucja 300 zł albo weryfikacja Didit; najem od odbioru paczki | `lib/content/rentalPlans.ts`, `lib/rentals.ts` |
| Firmware | 2.1.7 | `src/main.cpp` |
| Firma | KAJPA Kacper Popko, ul. Zastawie I 37, 16-070 Choroszcz; kontakt@kalkmate.pl | `seo.ts:184-196`, stopka |
| EAN | **do ustalenia** (`5908202546201` vs `5904224900012`) | j.w. |
| Wymiary, waga | **nieznane** | — |

Dziś te fakty są rozrzucone po ~15 plikach i wielu kopiach na język. Etap 2 powinien zebrać je w jednym module (np. `src/lib/content/productFacts.ts`), z którego czytają: JSON-LD, metadane, Specs, FAQ, `llms.txt` (generowany z route handlera zamiast pliku statycznego).

---

## 8. Plan dalszych etapów (każdy do osobnej akceptacji)

**Etap 2 — prawda i spójność (P0 + fakty)** — największy zysk, mało kodu:
1. Decyzje właściciela: prywatność zdjęć, prawo odstąpienia, czas pracy baterii (pomiar), EAN, opcja A/B dla crawlerów, `.eu → .pl`.
2. Usunięcie narracji egzaminacyjnej/„ukrytej” z `llms.txt`, JSON-LD, metadanych DE/CS/SK, Hero, HowItWorks, FAQ, Pomocy, instrukcji; ukrycie opinii z listy w P0-3.
3. Usunięcie nieprawdziwych twierdzeń (autofocus, 1,2 s, 94%, „trenowany”, FOV/kontrast bez źródła); jedna wartość baterii albo żadna.
4. Moduł `productFacts.ts` + `llms.txt` generowany z niego; wersja FW i ceny (w tym promocyjne) z jednego miejsca.

**Etap 3 — techniczne SEO (P1)**:
`<html lang>` po stronie serwera (np. przez middleware ustawiający nagłówek + odczyt w root layout), SSR treści sekcji zakupu (statyczny fragment + interaktywny koszyk w kliencie), OG/twitter dla 3 stron PL i stron prawnych, sitemap (`/black-friday`, `x-default`, prawdziwe `lastmod` albo brak), `not-found.tsx`, JSON-LD (dynamiczna cena/stan, `gtin13`, `hasMerchantReturnPolicy`, spójny rating, BreadcrumbList), FAQ `/pomoc` w HTML, robots wg decyzji A/B.

**Etap 4 — strony informacyjne**: „O KalkMate” (definicja, specyfikacja, jak działa, ograniczenia — w tym „niedozwolony na egzaminach”, prywatność, cena, gdzie kupić) i „Dla prasy” (zdjęcia, logo, dane firmy) — w istniejącym układzie adresów (`/o-kalkmate`, `/en/about` …), z danych z `productFacts.ts`.

**Etap 5 — treści**: 2–3 artykuły z realną wartością (np. „Jak działa kalkulator z kamerą i AI — od zdjęcia do rozwiązania”, „KalkMate a Photomath / ChatGPT — czym się różnią i do czego służą”), czytane przez właściciela przed publikacją.

**Etap 6 — wydajność i pomiar**: Brotli, cache/ISR stron głównych, porządek w `public/`, preload hero tylko na desktopie, pomiar PSI/CrUX; benchmark widoczności w AI (`seo/AI_VISIBILITY.md`).

---

## 9. Rzeczy wymagające dostępu do kont (poza repo)

- Google Search Console + Bing Webmaster Tools: zgłoszenie sitemap, sprawdzenie indeksacji `.eu`, raport Core Web Vitals, test wyników z elementami rozszerzonymi.
- Google Merchant Center (jeśli używany): zgodność ceny/stanu/polityki zwrotów z JSON-LD; ryzyko polityk przy obecnych tekstach „na egzamin”.
- GS1 Polska: potwierdzenie, który EAN jest przydzielony.
- Opis i tematy repozytorium GitHub (`gh repo edit`) — repo jest publiczne; ten plik audytu też trafi do publicznego repo po commicie (zawiera m.in. informację o retencji zdjęć — rozważ przed commitem).

---

## 10. Uwagi do metody

- Pomiary żywej strony: ~80 sekwencyjnych zapytań HTTP 18.11.2026, bez logowania, bez `/api/`.
- Nie uruchamiano: Lighthouse, Rich Results Test, walidatora Schema.org (wymagają przeglądarki/usług Google) — do zrobienia w etapie 3 po zmianach.
- Fakty oznaczone „nieznane” nie mają w repo żadnego źródła i nie powinny być publikowane, dopóki nie zostaną zmierzone/potwierdzone.
