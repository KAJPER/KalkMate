# KalkMate — Raport wiarygodności strony

**Data analizy:** 2026-06-25  
**Analizowane pliki:** `website/src/components/`, `website/src/app/`

---

## Werdykt

> **Produkt jest prawdziwy. Strona wygląda scamowo — bo używa klasycznych dark patterns.**

Firma istnieje, sprzęt jest realny, płatności działają przez Stripe, dane firmy są prawdziwe. Jednak strona celowo stosuje manipulacyjne techniki sprzedażowe, które są na tyle agresywne, że wzbudzają słuszne podejrzenia.

---

## Problemy — co wygląda scamowo (i dlaczego)

### 1. Fałszywy "social proof" — fikcyjne powiadomienia o zakupach

**Plik:** `SocialProof.tsx`

Strona wyświetla wyskakujące powiadomienia w stylu:
> *"Michał K. z Warszawy kupił KalkMate — 2 minuty temu"*
> *"Anna S. z Krakowa właśnie dokonuje płatności"*

**Problem:** Lista 12 powiadomień jest w 100% hardkodowana w kodzie. To nie są prawdziwe zdarzenia — to animacja kręcąca się w pętli. Znaczek "Zweryfikowany zakup" to dekoracja, nie prawdziwa weryfikacja.

```tsx
// HARDKODOWANE — nie ma połączenia z żadną bazą danych
const notifications: Notification[] = [
  { name: "Michał K.", city: "Warszawa", time: "2 minuty temu", type: "purchase" },
  { name: "Anna S.", city: "Kraków", time: "teraz", type: "checkout" },
  // ...itd.
];
```

---

### 2. Fałszywy licznik "X osób ogląda teraz"

**Plik:** `StickyBanner.tsx`

Na przyklejonym pasku na dole strony widnieje:
> *"34 osób ogląda teraz"*

**Problem:** Liczba "34" jest dosłownie wpisana na sztywno w kodzie. Nie ma żadnej analityki real-time. Zawsze wyświetla dokładnie 34.

```tsx
// Hardkodowane "34" — nigdy się nie zmienia
<span>Wysokie zainteresowanie - 34 osób ogląda teraz</span>
```

---

### 3. Fałszywy licznik zamówień (auto-inkrement)

**Plik:** `UrgencyBanner.tsx`

Baner pokazuje:
> *"12 osób kupiło w ciągu ostatnich 24h"*

**Problem:** Liczba zaczyna się od 12, a potem **automatycznie się inkrementuje co 2–3 minuty** przez `setInterval`, niezależnie od tego czy ktokolwiek cokolwiek kupił.

```tsx
const [recentOrders, setRecentOrders] = useState(12); // startuje od 12

// Inkrementuje co 2-3 minuty bez żadnych real danych
setInterval(() => {
  setRecentOrders((prev) => prev + 1);
}, 120000 + Math.random() * 60000);
```

---

### 4. Wieczny "Flash Sale" z timerem do północy

**Pliki:** `FlashSale.tsx`, `StickyCountdown.tsx`

Strona wyświetla agresywny timer odliczający czas do końca promocji -77%.

**Problem:** Timer odlicza do **każdej doby o północy** i resetuje się następnego dnia. "Oferta wygasa o północy" jest zawsze prawdziwa — ale tylko dlatego, że następnego ranka wraca od nowa. Promotion nigdy się nie kończy.

```tsx
// Zawsze liczy do dzisiejszej północy — i jutro znowu
const midnight = new Date();
midnight.setHours(23, 59, 59, 999);
const diff = Math.max(0, midnight.getTime() - now.getTime());
```

---

### 5. Fałszywa niedoborliwość — zapas magazynowy

**Pliki:** `FlashSale.tsx`, `StickyBanner.tsx`, `BuyNow.tsx`

Wszystkie trzy komponenty pokazują "Zostało tylko X sztuk!" gdzie X maleje z czasem.

**Problem:** Liczba jest obliczana z **daty** (deterministyczny hash) i automatycznie dekrementuje co 90–150 sekund niezależnie od rzeczywistej sprzedaży. Nigdy nie spadnie poniżej 3. Jeśli nie ma żadnych zamówień, licznik i tak spada.

```tsx
// "Zapas" oparty na dacie, nie na prawdziwych danych
let seed = 0;
for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i) * (i + 1);
const baseStock = (seed % 6) + 7; // 7–12 sztuk — zawsze

// Auto-dekrementuje niezależnie od sprzedaży
setInterval(() => {
  setStockLeft((prev) => Math.max(3, prev - 1)); // minimum 3, zawsze
}, 90000 + Math.random() * 60000);
```

---

### 6. Sprzeczne ceny na tej samej stronie

Na stronie jednocześnie widnieją **trzy różne ceny** produktu:

| Komponent | Cena | "Przekreślona" cena |
|-----------|------|---------------------|
| `Hero.tsx` CTA | **699 zł** | — |
| `FlashSale.tsx` | **499 zł** | ~~2199 zł~~ (-77%) |
| `BuyNow.tsx` | **699 zł** | ~~2199 zł~~ |
| `PriceComparison.tsx` | **499 zł** | — |

**Problem:** Klient widzi 499 zł w FlashSale, ale w koszyku płaci 699 zł. Oryginalna cena "2199 zł" wygląda na wymyśloną — produkt nigdy nie był sprzedawany po tej cenie (to prototyp). Rabat -77% liczony od ceny, która prawdopodobnie nigdy nie obowiązywała, to klasyczna technika fake anchor pricing.

---

### 7. Produkt wciąż w fazie prototypu

**Źródło:** `CLAUDE.md` (wewnętrzna dokumentacja projektu)

W dokumentacji projektowej widnieje:
> *"Pierwsza płytka zlutowana, trwa bring-up i debugowanie."*

Strona sprzedaje produkt jako gotowy do wysyłki "max. do 3 maja" (przedsprzedaż), podczas gdy faktycznie jest to wciąż sprzęt na etapie debugowania. Klient tego nie wie. Strona wspomina co prawda o "przedsprzedaży" i "ręcznym składaniu", ale nie komunikuje jasno że produkt jest na etapie R&D.

---

## Co działa poprawnie — sygnały wiarygodności

### Rzeczywiste dane firmowe w stopce
Firma jest zarejestrowana i podaje pełne dane:
- **Sprzedawca:** KAJPA Kacper Popko
- **NIP:** 9662222951
- **REGON:** 545011444  
- **Adres:** ul. Zastawie I 37, 16-070 Choroszcz
- **Telefon:** 600 580 888
- **E-mail:** kontakt@kajpa.pl

To są weryfikowalne dane publiczne. Firma istnieje.

### Prawdziwa infrastruktura płatności
- Płatności przez **Stripe** (lider rynku, nie losowy procesor)
- Pełny formularz checkout z InPost Geowidgetem
- Integracja z systemem kuponów

### Dokumenty prawne
- Regulamin sklepu (`/regulamin`) — zawiera prawidłowe klauzule prawne
- Polityka prywatności (`/polityka-prywatnosci`)
- **Deklaracja zgodności CE** (`/docs/ce-declaration.pdf`) — poważny dokument

### Uczciwe warunki
- 14 dni na zwrot (zgodnie z prawem UE)
- Gwarancja 24 miesiące
- Jasno komunikowana przedsprzedaż z terminem dostawy

### Prawdziwy sprzęt techniczny
Specyfikacja na stronie (kamera OV2640, OLED 256×64, ESP32-WROVER) zgadza się z prawdziwą dokumentacją hardwarową projektu. Produkt jest realny.

---

## Podsumowanie problemów według wagi

| Problem | Waga | Plik |
|---------|------|------|
| Fałszywe powiadomienia zakupów | **Krytyczna** | `SocialProof.tsx` |
| Timer promocji resetuje się każdą dobę | **Wysoka** | `FlashSale.tsx`, `StickyCountdown.tsx` |
| Auto-inkrementujący licznik zamówień | **Wysoka** | `UrgencyBanner.tsx` |
| Hardkodowane "34 osób ogląda" | **Wysoka** | `StickyBanner.tsx` |
| Zapas oparty na dacie, nie sprzedaży | **Wysoka** | `FlashSale.tsx`, `StickyBanner.tsx` |
| Dwie różne ceny (499 vs 699 zł) | **Wysoka** | `FlashSale.tsx` vs `BuyNow.tsx` |
| Fikcyjna cena oryginalna 2199 zł | **Średnia** | `FlashSale.tsx`, `BuyNow.tsx` |
| Brak transparentności o fazie prototypu | **Średnia** | `Hero.tsx`, `BuyNow.tsx` |

---

## Rekomendacje naprawcze

1. **Usuń lub zastąp `SocialProof.tsx`** — fikcyjne powiadomienia zakupów to najpoważniejszy problem. Można go zastąpić prawdziwymi danymi z bazy lub usunąć komponent.

2. **Usuń `FlashSale.tsx`** lub zastąp prawdziwą, jednorazową promocją. Wieczny timer to deceptive pattern.

3. **Usuń `StickyCountdown.tsx`** — countdown do północy który się resetuje to manipulacja.

4. **Usuń fałszywy licznik w `UrgencyBanner.tsx`** — albo podłącz pod prawdziwe dane z bazy zamówień.

5. **Usuń "34 osób ogląda" z `StickyBanner.tsx`** — albo zaimplementuj prawdziwy tracker.

6. **Ujednolicić cenę:** wybierz jedną cenę (699 zł lub 499 zł) i stosuj ją spójnie na całej stronie.

7. **Usuń lub weryfikuj cenę 2199 zł** — jeśli produkt nigdy nie był sprzedawany po tej cenie, jej używanie jako "przekreślonej" to nieuczciwa praktyka handlowa (potencjalnie naruszenie art. 3 Ustawy o przeciwdziałaniu nieuczciwym praktykom rynkowym).

8. **Dodaj szczery opis statusu produktu** — komunikat w stylu "Prototyp w produkcji — jesteś wśród pierwszych 500 klientów" byłby bardziej uczciwy i niekoniecznie odstraszający.

---

## Konkluzja dla użytkownika

Strona wygląda scamowo **nie dlatego, że firma lub produkt jest fałszywy**, ale dlatego że używa technik sprzedażowych (dark patterns) kojarzonych ze scamami: fikcyjnych powiadomień, fałszywych timerów, naciągniętych liczników. To zaszkadza wiarygodności realnego produktu. Usunięcie wymienionych komponentów i ujednolicenie ceny znacząco poprawiłoby odbiór strony.
