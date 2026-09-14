# KalkMate — Security Audit

**Data audytu:** 2026-06-23
**Zakres:** `website/` (Next.js 16 / NextAuth v4 / Prisma / Stripe — 65 API routes) oraz `src/` (firmware ESP32, C++/Arduino)
**Metoda:** 7 równoległych audytów domenowych (auth, płatności, admin, device/OTA, dane użytkownika, sekrety/konfiguracja, firmware)

---

## Streszczenie

Kod aplikacji jest porządnie napisany: zapytania SQL są parametryzowane, sekrety czytane z `process.env`, podpis webhooka Stripe weryfikowany poprawnie, a krypto OTA (ECDSA P-256 + SHA-256) zaimplementowane prawidłowo. **Problemy leżą w modelu bezpieczeństwa, nie w jakości kodu:**

1. **Prywatny klucz podpisujący firmware i klucz szyfrowania flash są w historii gita** → traktować jako skompromitowane.
2. **Firmware nie weryfikuje TLS ani — domyślnie — podpisu OTA** → łańcuch do zdalnego przejęcia urządzenia (RCE).
3. **Urządzenia nie mają tożsamości per-device** (jeden współdzielony `CALCULATOR_API_KEY` + spoofowalny MAC jako `x-device-id`) → masowy IDOR na danych i PII użytkowników.
4. **Brak rate-limitingu** na endpointach AI i auth → nadużycia kosztowe i brute-force.

### Kill-chain (RCE na urządzeniu)
> C3 (brak walidacji TLS) → atakujący on-path podstawia odpowiedź `/api/device/firmware/check` → C5 (dowolny URL binarki) + C4 (brak wymogu podpisu) → urządzenie flashuje złośliwy firmware → **trwałe RCE na urządzeniu ucznia**.
> Naprawienie C3 (cert pinning) i C4 (obowiązkowy podpis) przerywa łańcuch.

### Tabela zbiorcza

| ID | Severity | Obszar | Problem |
|----|----------|--------|---------|
| C1 | Critical | Sekrety | Prywatny klucz podpisujący firmware w gicie |
| C2 | Critical | Sekrety | Klucz szyfrowania flash ESP32 w gicie |
| C3 | Critical | Firmware | TLS wyłączony wszędzie (`setInsecure()`) |
| C4 | Critical | Firmware | OTA akceptuje niepodpisany firmware domyślnie |
| C5 | Critical | Firmware | URL binarki OTA kontrolowany przez serwer, brak wymogu HTTPS |
| C6 | Critical | Deploy | Hasło SSH do produkcji plaintextem w `deploy.ps1` |
| H1 | High | Device API | Brak tożsamości per-urządzenie (współdzielony klucz + spoofowalny MAC) |
| H2 | High | Device API | `/sync/*` przyjmuje dowolne `userId` (IDOR odczyt+zapis) |
| H3 | High | Device API | `/device/register` nadpisuje `unlockCode` dowolnego urządzenia |
| H4 | High | Admin | 7 admin route'ów bez własnego sprawdzenia auth |
| H5 | High | Sekrety | `dev.db` z prawdziwym PII w repo |
| H6 | High | AI/koszty | Brak rate-limitu na `/chat` i `/device/solve`, nieatomowe tokeny |
| H7 | High | Auth | Brak rate-limitu na login/register/reset/2FA |
| H8 | High | Firmware | Klucz API tylko XOR-obfuskowany (trywialnie odwracalny) |
| H9 | High | Firmware | Brak Flash Encryption/Secure Boot — NVS plaintextem |
| H10 | High | Płatności | `shippingCents` z klienta zaufane serwerowo (kwota ujemna) |
| H11 | High | Płatności | Kupony jednorazowe wielokrotnego użytku (wyścig) |
| M1 | Medium | Admin | Statyczny token admina, porównanie nie-constant-time |
| M2 | Medium | Admin | Niespójność nazwy cookie → 401 w produkcji / ryzyko bypassu |
| M3 | Medium | Płatności | Webhook nie weryfikuje zapłaconej kwoty vs cena |
| M4 | Medium | Cron | `/api/cron/tracking` fail-open + PII w odpowiedzi |
| M5 | Medium | Płatności | Plan `second_month` (-98%) dostępny dla każdego |
| M6 | Medium | Płatności | License redeem TOCTOU (podwójne wykorzystanie) |
| M7 | Medium | Config | Brak nagłówków bezpieczeństwa (CSP/HSTS/X-Frame-Options) |
| M8 | Medium | Dane | Captures autoryzacja po nazwie pliku; change-email bez weryfikacji; forgeable role w `/chat` |
| M9 | Medium | Firmware | Sekrety (SSID, licencja) w logu serial |
| L1–L7 | Low | różne | patrz sekcja Low/Informational |

---

## CRITICAL

### C1 — Prywatny klucz podpisujący firmware w repozytorium
- **Severity:** Critical
- **Plik:** `tools/flasher/Klucze kalkmate/firmware_signing.pem` (EC private key), commit `495122d` „Add backup date, firmware signing keys, and flash encryption key"
- **Opis:** Klucz EC podpisujący firmware OTA jest w historii gita. Kto go ma, może podpisać złośliwy firmware przechodzący weryfikację podpisu na każdym wysłanym urządzeniu → zdalne RCE na całej flocie. `.gitignore` zawiera `tools/flasher/keys/`, ale klucz leży w `tools/flasher/Klucze kalkmate/`, który nie jest ignorowany.
- **Fix:** Traktować jako w pełni skompromitowany. Wygenerować nowy keypair, re-provisioning klucza publicznego na urządzeniach, usunąć z historii (`git filter-repo`), zrotować.

### C2 — Klucz szyfrowania flash ESP32 w repozytorium
- **Severity:** Critical
- **Plik:** `tools/flasher/Klucze kalkmate/flash_encryption_key.bin` (32 bajty AES), commit `495122d`
- **Opis:** Ujawnienie klucza flash-encryption pozwala odszyfrować firmware/sekrety i klonować urządzenia.
- **Fix:** Klucza nie da się zrotować na już sflashowanych urządzeniach (eFuse wypalony). Dla przyszłych partii generować świeży klucz per-batch, trzymać offline. Usunąć z historii.

### C3 — TLS wyłączony w całym firmware (`setInsecure()`)
- **Severity:** Critical
- **Pliki:** `src/ota_update.h:102,317`, `src/device_account.h:66,106`, `src/solve_screen.h:567,667`
- **Opis:** Każdy `WiFiClientSecure` wywołuje `setInsecure()` — brak weryfikacji certyfikatu i hosta. Atakujący on-path (rogue AP, ARP spoofing w sieci szkolnej/kawiarni) czyta cały ruch: `x-api-key`, `x-license-key`, MAC, treść zadań i odpowiedzi AI, oraz może wstrzykiwać odpowiedzi.
```cpp
WiFiClientSecure client;
client.setInsecure();   // brak cert, brak weryfikacji hosta
```
- **Fix:** Pinować CA serwera (`client.setCACert(rootCA)` / `setTrustAnchors`), CA w firmware. Nigdy `setInsecure()` w produkcji (ewentualnie tylko za flagą debug build).

### C4 — OTA akceptuje niepodpisany firmware domyślnie
- **Severity:** Critical
- **Plik:** `src/ota_update.h:305,366-375`
- **Opis:** `otaInstall()` weryfikuje podpis tylko `if (sigB64.length() > 0)`. Jeśli odpowiedź (lub MITM przy C3) nie zawiera `sig`, urządzenie loguje „install bez weryfikacji" i flashuje binarkę. Twardy wymóg jest tylko pod `#ifdef KALK_REQUIRE_SIGNED_OTA`, którego nie ma w konfiguracji builda.
```cpp
bool verifySignature = (sigB64.length() > 0);
...
} else {
    Serial.println("[OTA] UWAGA: brak podpisu z serwera, install bez weryfikacji");
}
```
- **Fix:** Bezwarunkowo odrzucać aktualizacje z pustym `sig` lub błędną weryfikacją ECDSA. Usunąć ścieżkę unsigned z buildów produkcyjnych. (Samo krypto jest poprawne — problem to jego opcjonalność.)

### C5 — URL binarki OTA kontrolowany przez serwer, brak wymogu HTTPS/własnej domeny
- **Severity:** Critical (wzmacnia C3/C4)
- **Plik:** `src/ota_update.h:132,320`
- **Opis:** `.bin` URL pochodzi wprost z JSON serwera (`info.url`) i trafia do `http.begin(client, binUrl)` bez sprawdzenia, że to HTTPS i host = `kalkmate.pl`. Sfałszowana odpowiedź może wskazać `http://atakujący/evil.bin`.
- **Fix:** Odrzucać każdy URL OTA nie zaczynający się od `https://kalkmate.pl/`. Łącznie z C4 i C3.

### C6 — Hasło SSH do produkcji plaintextem w deploy.ps1
- **Severity:** Critical (zmitygowane gitignore, ale klucz/hasło są żywe)
- **Plik:** `deploy.ps1:33-37`
- **Opis:** Pełny login SSH do serwera produkcyjnego cleartextem, podawany w CLI do `pscp`/`plink` (`-pw`):
  - `:35` `$ServerPass = "1234Kacper!"` (słabe, 8 znaków)
  - `:33` host `57.131.30.57`, `:34` user `ubuntu`, `:37` `$ApiKey = "<CALCULATOR_API_KEY-REDACTED>"`
  - **Zweryfikowane: NIE w gicie** (gitignored, brak w historii). Ryzyko = lokalny dysk / przypadkowe udostępnienie. `-pw` w CLI ujawnia hasło innym procesom i historii powłoki.
- **Fix:** Przejść na uwierzytelnianie kluczem SSH (bez `-pw`). Zrotować hasło serwera (i wzmocnić). Zrotować `CALCULATOR_API_KEY` (`<CALCULATOR_API_KEY-REDACTED>`) na losową wartość.

---

## HIGH

### H1 — Brak tożsamości per-urządzenie (root cause IDOR)
- **Severity:** High
- **Pliki:** wszystkie `/device/*`, np. `device/conversations/route.ts:9-16`, `account-status:16`, `notes:14-22`, `tests:13-20`, `solve:230-241`
- **Opis:** Każdy endpoint device autoryzuje jednym współdzielonym `CALCULATOR_API_KEY` (do wyciągnięcia z flasha dowolnego urządzenia), a „tożsamość" to `x-device-id` (MAC — publiczny, enumerowalny po OUI Espressif) lub `x-license-key` w nagłówku, bez kryptograficznego powiązania z żądającym.
```ts
const apiKey = request.headers.get("x-api-key");
if (!apiKey || apiKey !== process.env.CALCULATOR_API_KEY) { /* 401 */ }
const deviceId = request.headers.get("x-device-id");   // kontrolowane przez atakującego
const where: any = { deviceId };                       // zaufane bez weryfikacji
```
- **Exploit:** Z wyciekniętym kluczem + zgadniętym MAC: odczyt cudzych notatek/testów/konwersacji oraz **emaila użytkownika** i kodu licencji (`account-status:99-100`).
- **Fix:** Sekret per-urządzenie przy provisioningu (losowy ≥128-bit), hash po stronie serwera, każde żądanie uwierzytelniane tokenem/HMAC urządzenia. Wszystkie zapytania scope'owane do uwierzytelnionego urządzenia, nie do nagłówka.

### H2 — `/sync/*` przyjmuje dowolne `userId` (IDOR odczyt + zapis)
- **Severity:** High
- **Pliki:** `sync/subscription/route.ts:21-53`, `sync/messages/route.ts:21-130`
- **Opis:** Endpointy biorą surowy `userId` z query/body, gated tylko współdzielonym kluczem.
  - `GET /api/sync/subscription?userId=...` → status subskrypcji dowolnego użytkownika.
  - `POST /api/sync/messages` → zapis dowolnych `messages[]` do konwersacji dowolnego usera (stored XSS do panelu web).
  - `GET /api/sync/messages?userId=...` → pełna historia czatu.
- **Fix:** Wyprowadzać `userId` z uwierzytelnionego credentiala urządzenia; nigdy nie przyjmować jako wolny parametr. Walidować/enkodować treść, limitować rozmiar tablicy.

### H3 — `/device/register` nadpisuje `unlockCode` dowolnego urządzenia
- **Severity:** High
- **Plik:** `device/register/route.ts:37-54`
- **Opis:** Upsert kluczowany wyłącznie po `deviceId` z żądania; na istniejącym rekordzie nadpisuje `unlockCode` bez sprawdzenia własności. Ponieważ web-pairing (`POST /api/user/devices`) porównuje `unlockCode` z tą wartością, atakujący ustawia znany kod dla cudzego `deviceId` i paruje je do swojego konta → przejęcie. Omija to lockout brute-force w `user/devices`.
- **Fix:** Powiązać rejestrację z sekretem per-device z produkcji; odrzucać zmianę `unlockCode` na urządzeniach już sparowanych (`userId` ustawione).

### H4 — 7 admin route'ów bez własnego sprawdzenia auth
- **Severity:** High
- **Pliki:** `admin/orders/route.ts`, `admin/orders/[id]/route.ts:10,73`, `admin/orders/[id]/invoice:35`, `admin/orders/[id]/furgonetka:31,179`, `admin/analytics:4`, `admin/captures/route.ts:7`, `admin/captures/[filename]:6`
- **Opis:** Te route'y nie mają guardu w kodzie i polegają wyłącznie na `middleware.ts`. Brak defense-in-depth dokładnie tam, gdzie jest najwięcej PII (pełne zamówienia z emailem/telefonem/adresem, przychód, zdjęcia uczniów). Jedna pomyłka w matcherze/refaktor = wszystko otwarte.
- **Uwaga:** middleware *aktualnie* pokrywa `/api/admin/*` (jawny blok `middleware.ts:17-26` + matcher `:55`). To realne, ale pojedyncze zabezpieczenie.
- **Fix:** Dodać `isAdmin(req)` na początku każdej metody, jak w `devices/route.ts:5-8`, używając wspólnego `COOKIE_NAME` z `@/lib/admin-auth`.

### H5 — `dev.db` z prawdziwym PII w repozytorium
- **Severity:** High
- **Pliki:** `website/prisma/dev.db` (1.24 MB), `website/prisma/prisma/dev.db` (196 KB)
- **Opis:** Dwa pliki SQLite trackowane w gicie, zawierają żywy schemat i prawdziwe dane: User `gordulek@gmail.com` z hashem bcrypt (do złamania offline). `.gitignore` nie wyklucza `*.db`.
- **Fix:** `git rm --cached` oba pliki, dodać `*.db`/`prisma/*.db` do `.gitignore`, wyczyścić historię, zrotować hasło konta.

### H6 — Brak rate-limitu na `/chat` i `/device/solve` + nieatomowe tokeny
- **Severity:** High
- **Pliki:** `chat/route.ts:1221,1436-1438`, `device/solve/route.ts:378-389,262-332,84-86`
- **Opis:** Płatny LLM wołany przy każdym żądaniu (`max_tokens` 4096–16000, model Claude Opus = costMultiplier 10). Brak `rateLimit()` (helper `src/lib/rate-limit.ts` istnieje, ale nie jest importowany w tych route'ach). Odliczanie salda tokenów jest fire-and-forget/post-response → TOCTOU: wiele równoległych żądań czyta saldo przed odjęciem. Licencja „device-only" (unclaimed, `ownerUserId == null`) całkowicie pomija sprawdzenie salda.
- **Exploit:** Z współdzielonym kluczem + dowolnym nieprzejętym kodem licencji spamować `POST /device/solve` z dużym tekstem/obrazem → niekontrolowany rachunek OpenRouter (financial DoS).
- **Fix:** `rateLimit()` per device/IP/user; atomowe odliczanie (`UPDATE ... WHERE tokenBalance >= estimate` w transakcji); wymuszać quotę także w trybie license-only; obniżyć `max_tokens`.

### H7 — Brak rate-limitu na login/register/reset/2FA
- **Severity:** High
- **Pliki:** `lib/auth.ts:73`, `auth/register:42`, `auth/forgot-password:9`, `auth/resend-verification:9`, `admin/auth/route.ts:4`
- **Opis:** Żaden endpoint auth nie woła `rateLimit()` (helper importowany tylko w `license/claim` i `subscription/redeem`). Umożliwia brute-force loginu, password-spraying, mail-bombing arbitralnych adresów oraz brute-force 6-cyfrowego TOTP admina (bez lockoutu, okno akceptuje 3 kody — patrz M-2FA).
- **Fix:** `rateLimit()` keyed na IP + email/route na każdym endpoincie auth (login 5/15min, forgot/resend 3/h, admin TOTP 5/15min + lockout).

### H8 — Klucz API w firmware tylko XOR-obfuskowany
- **Severity:** High
- **Plik:** `src/key_obfuscate.h:22,36-54,65-72`
- **Opis:** `<CALCULATOR_API_KEY-REDACTED>` jako statyczny XOR statycznego 16-bajtowego klucza, oba jako `constexpr` w binarce. Komentarz pliku sam przyznaje „NIE kryptografia… 5-10 minut". Plaintext klucza jest w komentarzu źródła; klucz wygląda na współdzielony default (`_dev_12345`) — prawdopodobnie identyczny na każdej sztuce.
- **Exploit:** Zrzut flasha (brak Flash Encryption — H9) → odczyt rutyny XOR → odzyskanie klucza → bezpośrednie wołanie backendu AI na koszt operatora.
- **Fix:** Nie wysyłać współdzielonego sekretu w firmware. Uwierzytelniać urządzenia tożsamością per-device (H1). Jeśli globalny klucz konieczny — Flash Encryption + Secure Boot v2 + rotacja (obecny skompromitowany przez obecność w repo).

### H9 — Brak Flash Encryption / Secure Boot
- **Severity:** High (wymaga potwierdzenia stanu eFuse na produkcji)
- **Pliki:** `src/wifi_persist.h:18-19,148,166`, `main.cpp:1008-1018`
- **Opis:** Sekrety w NVS przez `Preferences` bez warstwy szyfrowania w kodzie: hasła WiFi, kod licencji, kod odblokowania AI. Komentarze wspominają flash encryption, ale nic w firmware go nie włącza. Bez Flash Encryption odczyt SPI flash ujawnia hasło WiFi domu/szkoły, licencję i (obfuskowany) klucz API plaintextem.
- **Fix:** Włączyć Flash Encryption (release) + Secure Boot v2 przed wysyłką. Potwierdzić wypalone eFuse na produkcji.

### H10 — `shippingCents` z klienta zaufane serwerowo
- **Severity:** High
- **Plik:** `create-payment-intent/route.ts:42,62,76` (klient: `components/BuyNow.tsx:265,418`)
- **Opis:** Końcowa kwota Stripe częściowo z niezweryfikowanej wartości klienta. Brak walidacji: akceptuje `0` (ominięcie wysyłki międzynarodowej) lub **wartość ujemną** (zaniżenie totalu poniżej `productAmount - discount`).
```ts
const resolvedShipping = typeof shippingCents === "number" ? shippingCents : 0;
const totalAmount = (productAmount - discountAmount) + resolvedShipping;
```
- **Exploit:** `shippingCents: -69700` → total ~2 zł, webhook tworzy zamówienie `paid` + upgrade 30 dni.
- **Fix:** Wyliczać wysyłkę serwerowo z `resolvedCountry`/`resolvedCurrency`, nigdy z body. Klamrować `totalAmount >= MIN_CHARGE_CENTS`.

### H11 — Kupony jednorazowe wielokrotnego użytku
- **Severity:** High
- **Pliki:** `lib/coupons.ts:92,122-128`, `webhooks/stripe/route.ts:182-189`
- **Opis:** `maxUses` sprawdzane przy tworzeniu PI, a `usedCount` inkrementowane dopiero w webhooku po sukcesie. Brak rezerwacji i limitu per-user → między utworzeniem PI a webhookiem można utworzyć N intentów, wszystkie czytają `usedCount < maxUses`. Kupon `maxUses: 1` użyty wielokrotnie.
- **Fix:** Egzekwować unikalność w warstwie trwałej: rekord `CouponRedemption(couponCode,userId)` UNIQUE i/lub atomowa rezerwacja `UPDATE Coupon SET usedCount=usedCount+1 WHERE code=? AND (maxUses IS NULL OR usedCount<maxUses)` przy tworzeniu PI, z cofnięciem przy niepowodzeniu.

---

## MEDIUM

### M1 — Statyczny token admina, porównanie nie-constant-time
- **Severity:** Medium
- **Pliki:** `middleware.ts:11,23`, `admin/coupons/route.ts:11-14`, `admin/licenses/route.ts:104-108`, oraz pozostałe in-route checki (`stats:9`, `devices:6-7`, `users/[id]:16,73`, …)
- **Opis:** Dostęp admina gated pojedynczym statycznym `ADMIN_SESSION_TOKEN` w cookie, porównywanym `===`/`!==` (nie constant-time, timing side-channel). Token nie rotuje i nie wygasa server-side; wyciek = stały dostęp bez rewokacji. W `admin/licenses` GET token akceptowany dodatkowo w nagłówku `Authorization` (powierzchnia nie chroniona przez SameSite, łatwiej w logach i do timing-ataku) — podczas gdy POST w tym samym pliku używa cookie (niespójność).
- **Fix:** Sesje admina jako losowy token per-sesja (hash w DB + `expiresAt`), walidacja przez lookup po hashu, `crypto.timingSafeEqual`. Usunąć auth nagłówkowy z `licenses` GET. Scentralizować w jednym `isAdmin()`.

### M2 — Niespójność nazwy cookie admina
- **Severity:** Medium
- **Pliki:** `admin/auth/route.ts:15` (ustawia `admin_session`), `admin/users/[id]/route.ts:5` i `admin/licenses/list/route.ts:5` (czytają `__Secure-admin_session` w produkcji), `lib/admin-auth.ts:3`, `middleware.ts:10,22`
- **Opis:** Login zawsze ustawia cookie `admin_session` (ustawia flagę `secure`, ale nie prefiks nazwy `__Secure-`). Dwa route'y czytają w produkcji cookie, które nigdy nie jest ustawiane → zawsze 401 (fail-closed, zepsuta funkcja). Ryzyko: „naprawa" przez zmianę nazwy set-cookie sprawi, że in-route przejdzie, a middleware (czyta `admin_session`) przestanie — bug zamieni się w bypass. Root cause: trzy różne definicje nazwy cookie.
- **Fix:** Używać jednego eksportowanego `COOKIE_NAME` z `@/lib/admin-auth` w route'ach i middleware. Jeśli prefiks `__Secure-` — ustawiać i czytać dokładnie tę nazwę wszędzie.

### M3 — Webhook nie weryfikuje zapłaconej kwoty vs cena serwerowa
- **Severity:** Medium
- **Plik:** `webhooks/stripe/route.ts:139-177`
- **Opis:** `handlePaymentIntentSucceeded` zapisuje zamówienie i przyznaje 30-dniową subskrypcję na podstawie `pi.amount` bez cross-checku z oczekiwaną ceną. W połączeniu z H10 (kwota z klienta) webhook jest ostatnią linią obrony i ufa kwocie ślepo — nawet 2 zł daje `paid` + upgrade. *Weryfikacja podpisu webhooka jest poprawna (raw body + `constructEvent`).* 
- **Fix:** Przeliczyć oczekiwane minimum (cena produktu dla `pi.currency` + wysyłka serwerowa − zwalidowany kupon) i odrzucać/flagować `pi.amount` poniżej oczekiwania. Upgrade tylko gdy cena produktu spełniona.

### M4 — `/api/cron/tracking` fail-open + PII w odpowiedzi
- **Severity:** Medium
- **Plik:** `cron/tracking/route.ts:104-107,147,161`
- **Opis:** Guard działa tylko gdy `CRON_SECRET` jest truthy; przy nieustawionym sekrecie endpoint jest otwarty. Nie pokryty middleware. Po sukcesie zwraca `results[]` z **emailami klientów** i Stripe PaymentIntent ID. Sekret przyjmowany też z query (`?secret=`) → ryzyko w logach.
```ts
if (CRON_SECRET && secret !== CRON_SECRET) { /* 401 */ }   // brak CRON_SECRET => otwarte
```
- **Fix:** Fail-closed (odrzucać gdy `CRON_SECRET` nieustawiony). Tylko nagłówek, nie query. Usunąć emaile/PI ID z body (logować server-side).

### M5 — Plan `second_month` (-98%) dostępny dla każdego zalogowanego
- **Severity:** Medium
- **Plik:** `subscription/purchase/route.ts:24-31,84-86`
- **Opis:** Cena jest serwerowa (dobrze), ale uprawnienie nie. Każdy może wysłać `plan:"second_month"` i dostać stałą subskrypcję 1 zł/mc (98% poniżej 44.99 zł), niezależnie od tego czy zapłacił pierwszy miesiąc/kupił kalkulator.
- **Fix:** Gate `second_month` serwerowo — wymagać aktywnego opłaconego miesiąca/zamówienia kalkulatora i braku wykorzystania promo.

### M6 — License redeem TOCTOU
- **Severity:** Medium
- **Plik:** `subscription/redeem/route.ts:65-113`
- **Opis:** Sprawdzenie `license.isUsed` i oznaczenie jako użyte to osobne, nieatomowe statementy. Dwa równoległe POSTy z tym samym kodem oba przechodzą check i oba przedłużają subskrypcję. Rate-limit IP (5/min) nie zapobiega.
- **Fix:** Atomowo: `UPDATE License SET isUsed=1,... WHERE id=? AND isUsed=0`; przyznać przedłużenie tylko gdy affected-rows === 1, w tej samej transakcji.

### M7 — Brak nagłówków bezpieczeństwa
- **Severity:** Medium
- **Plik:** `website/next.config.ts:1-13` (brak bloku `headers()`)
- **Opis:** Brak CSP, Strict-Transport-Security, X-Frame-Options/`frame-ancestors`, X-Content-Type-Options, Referrer-Policy. Clickjacking na `/panel` i `/admin`, brak HSTS na stronie z płatnościami i loginem, brak defense-in-depth dla renderowania `react-markdown`/KaTeX treści AI/użytkownika.
- **Fix:** Dodać `async headers()` z min. HSTS, `X-Frame-Options: DENY` (lub CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy` i CSP.

### M8 — Dane użytkownika: captures, change-email, role w `/chat`
- **Severity:** Medium
- **Pliki:** `user/captures/[filename]/route.ts:26-34` (+`lib/captures.ts:21-23,67-78`), `user/account/change-email/route.ts:44`, `chat/route.ts:1308-1330`
- **Opis:**
  - **Captures IDOR:** własność wyprowadzana z `parts[1]` nazwy pliku, nie z rekordu DB wiążącego plik z urządzeniem/userem. *Path traversal jest poprawnie blokowany* (allowlist regex + `path.resolve().startsWith`), to wada modelu autoryzacji.
  - **Change-email:** nowy adres ustawiany bez weryfikacji własności i bez resetu `emailVerified`; tożsamość keyowana po emailu → możliwy przejęcie/przepięcie.
  - **`/chat` forgeable role:** klient w pełni kontroluje `messages[]` i `role` (`user`/`assistant`) oraz dane obrazów → fałszowanie wcześniejszej „zgody" modelu, ominięcie system promptu.
- **Fix:** Captures — autoryzować po rekordzie DB (filename↔deviceId↔userId). Change-email — token potwierdzający na nowy adres przed przełączeniem, powiadomienie starego. `/chat` — rekonstruować historię z DB po `conversationId`, wymuszać role tylko `user`, walidować/limitować załączniki.

### M9 — Sekrety w logu serial firmware
- **Severity:** Medium
- **Pliki:** `device_account.h:171` (licencja), `main.cpp:1077` / `power.h:116` (SSID), `wifi_persist.h:229` (BSSID), `ota_update.h:124` (body OTA)
- **Opis:** Produkcyjne buildy emitują wrażliwe dane przez UART 115200. Każdy z dostępem do CH340 (eksponowany do flashowania) je odczyta. (Sam klucz API nie jest logowany — dobrze.)
- **Fix:** Wycinać wrażliwe logi w release (`KALK_RELEASE`/`CORE_DEBUG_LEVEL`). Nigdy nie logować credentiali.

---

## LOW / Informational

- **L1 — Słabe tokeny reset/verification (defense-in-depth):** tokeny same w sobie silne (`randomBytes(32)`), ale przechowywane plaintextem w DB, a `id` wierszy bazowany na `Date.now()+Math.random()`. Fix: przechowywać `sha256(token)`, `crypto.randomUUID()` dla id. (`forgot-password:22,24`, `register:11,13`)
- **L2 — Słaba polityka haseł:** min. 6 znaków, bcrypt cost 10, brak kontroli złożoności/breach. Fix: ≥10–12 znaków, cost 12/argon2id, + rate-limit. (`register:50,63`, `reset-password:22`, `change-password:22`)
- **L3 — User enumeration:** `register` i `change-email` zwracają różne odpowiedzi dla istniejącego konta. Fix: generyczna odpowiedź. (`register:56-60`, `change-email:39-42`)
- **L4 — Admin 2FA okno + brak replay-protection:** `window:1` akceptuje 3 kody (~90s), brak śledzenia zużytego kodu. Fix: `window:0` lub zapis zużytego `delta`. (`lib/admin-auth.ts:21`)
- **L5 — `/api/contact` rate-limit obchodzalny:** in-memory per-proces, `x-forwarded-for` spoofowalny; sprawdzić CRLF w `mailer.ts` (`replyTo`/`subject`). (`contact/route.ts:16-19,69`)
- **L6 — `/api/user/orders` over-fetch:** `findMany` bez `select` → wszystkie kolumny `Order` do klienta. Fix: whitelist `select`. (`user/orders/route.ts:24-32`)
- **L7 — Firmware drobne:** brownout detector wyłączony globalnie (`main.cpp:886`); `_otaVerCmp` bez guardu przepełnienia int (`ota_update.h:54-70`); parsowanie odpowiedzi — truncacja UTF-8 mid-codepoint i `strncpy` bez jawnego NUL-terminate (`solve_screen.h:606,620-633`). Memory-safe (bufory mają capy), ale warto utwardzić.
- **L8 — `visits` GET faktycznie publiczny** mimo komentarza „admin only" (cały prefiks `/api/admin/visits` wyłączony z guardu middleware). Niska wrażliwość (agregat), ale poprawić komentarz/decyzję. (`middleware.ts:20`)

---

## Zweryfikowane jako BEZPIECZNE

- **SQL injection:** brak. Wszystkie ~50 `$queryRaw`/`$executeRaw` parametryzowane (tagged-template). Jedyny `$executeRawUnsafe` (`coupons.ts:29`) to statyczny `CREATE TABLE` bez interpolacji.
- **Path traversal** (captures admin/user, firmware download `[version]`, invoice): blokowane (allowlist regex + `path.resolve().startsWith`, dla firmware dodatkowo regex `^\d+\.\d+\.\d+$`).
- **Weryfikacja podpisu webhooka Stripe:** poprawna (raw body via `request.text()` + `constructEvent` + `STRIPE_WEBHOOK_SECRET`).
- **Krypto OTA:** ECDSA P-256 + streaming SHA-256 + `mbedtls_pk_verify` zaimplementowane poprawnie; pętla `Update.write` bounds-checked. Problem to opcjonalność (C4), nie implementacja.
- **Sekrety w kodzie:** brak hardcoded. Stripe/Resend/Gemini/OpenRouter/NextAuth/Furgonetka czytane z `process.env`. `NEXTAUTH_SECRET` bez fallbacku.
- **`.env.local`, `update.tar.gz`, `deploy.ps1/.bat`:** poprawnie gitignored, nigdy w historii.
- **IDOR na danych użytkownika (web):** `conversations`/`notes`/`tests`/`orders` filtrowane po `userId`; `subscription/cancel`/`status` resolved po userze sesji (brak IDOR); `license/claim` rate-limited + anti-enumeration + jedna licencja/usera.
- **`change-password`:** wymaga re-auth (`bcrypt.compare`) ✓.
- **Wymuszenie weryfikacji emaila przy logowaniu:** `auth.ts:99` ✓.
- **Walidacja modelu AI:** `aiModel` sprawdzany względem allowlisty `AI_MODEL_IDS` (brak model-injection/SSRF).
- **`computeDiscount`:** klamruje percent 0–100, odrzuca fixed dla nie-PLN, floor zniżki do `productCents - MIN_CHARGE_CENTS` (brak ujemnych/>100%/overflow).
- **`next.config.ts`:** brak `ignoreBuildErrors`/`ignoreDuringBuilds`, brak wildcardów w `images.remotePatterns`.
- **Bufory WiFi firmware:** `pass[64]`/`ssid[33]` z poprawnym `strncpy`+terminacja — brak overflow.

---

## Rekomendowana kolejność napraw

1. **Zrotuj i usuń z historii gita** `firmware_signing.pem` + `flash_encryption_key.bin` (nowy keypair signing; klucz flash traktuj jako wypalony na istniejących sztukach). `git filter-repo`.
2. **Firmware C3+C4+C5:** cert pinning (`setCACert`) + bezwarunkowy wymóg podpisu OTA + wymóg `https://kalkmate.pl/` dla URL binarki.
3. **`git rm --cached` oba `dev.db`**, dodać `*.db` do `.gitignore`, scrub historii, zrotować hasło `gordulek@gmail.com`.
4. **Tożsamość per-urządzenie** (sekret losowy przy provisioningu, HMAC na żądaniach) — zamyka H1, H2, H3 i większość H6/H8.
5. **Cron fail-closed** + usunąć PII z odpowiedzi.
6. **Rate-limit** na `/chat`, `/device/solve`, endpointach auth (helper `lib/rate-limit.ts` już istnieje); atomowe odliczanie tokenów.
7. **Płatności:** walidacja `shippingCents` serwerowo + weryfikacja kwoty w webhooku; naprawa modelu kuponów (atomowa rezerwacja); gate `second_month`; atomowy redeem licencji.
8. **Config/admin:** nagłówki bezpieczeństwa w `next.config.ts`; ujednolicić admin auth (signed/expiring session, constant-time, jedna nazwa cookie), dodać in-route guardy do 7 odsłoniętych route'ów.
9. **Deploy:** klucze SSH zamiast `-pw`, rotacja hasła serwera i `CALCULATOR_API_KEY`.
10. **Firmware utwardzenie:** Flash Encryption + Secure Boot v2; wyciąć sekrety z logów serial.

---

## Wymaga ręcznego potwierdzenia

- Zachowanie firmware przy pustym `sig` w odpowiedzi OTA (czy klient ≥1.4.1 odrzuca).
- Czy `CRON_SECRET` jest faktycznie ustawiony w produkcji.
- Czy legacy publiczna ścieżka `/firmware/*.bin` istnieje/serwowana przez nginx.
- Stan eFuse (Flash Encryption/Secure Boot) na sztukach produkcyjnych.
- CRLF sanitization w `lib/mailer.ts` (`replyTo`/`subject`).
- Wrażliwe kolumny w modelu `Order` (Prisma schema) dla over-fetch L6.
- `npm audit` względem lockfile (transitive CVE).
- Czy jakiś klient maszynowy polega na auth nagłówkowym `licenses` GET (przed usunięciem).

---

*Audyt wygenerowany przez 7 równoległych agentów bezpieczeństwa. Wszystkie findingi zweryfikowane w kodzie; pozycje niepewne oznaczone „wymaga potwierdzenia".*
