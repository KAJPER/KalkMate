# KalkMate fiscal agent

Lokalny serwis (Python 3.10+, FastAPI) uruchamiany obok drukarki fiskalnej POSNET. Odbiera zlecenia paragonów z platformy kalkmate.pl albo z lokalnego endpointu i drukuje je po TCP (LAN lub WiFi). Używa protokołu POSNET opisanego w specyfikacji DBC-I-DEV-45.

**Kasa Posnet Ergo Online nie jest obsługiwana.** Jej publicznie dostępny protokół nie ma komend wystawienia paragonu z PC. Szczegóły, prawo i plan testów: [`docs/fiskalizacja/README.md`](../docs/fiskalizacja/README.md).

```
fiscal_agent/
├── posnet/frame.py    # ramka STX…#CRC16 ETX, CRC16-XMODEM, parser odpowiedzi
├── posnet/client.py   # klient TCP: tokeny, timeouty, odzyskiwanie odpowiedzi przez `rpt`
├── posnet/errors.py   # kody błędów drukarki → kategorie (ponów / człowiek)
├── printer.py         # status (sid/sdev/sprn/scomm/strns/scnt) i paragon (trinit…trend)
├── models.py          # JSON zlecenia (pydantic), kwoty w groszach
├── store.py           # trwała kolejka SQLite, idempotencja po id
├── service.py         # worker: druk po kolei, backoff, synchronizacja z platformą
├── app.py             # FastAPI: POST /receipts, GET /receipts/{id}, POST …/retry, GET /status
└── simulator.py       # symulator drukarki wg specyfikacji (tylko do testów)
```

## Uruchomienie

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
pytest                                   # 30 testów, bez urządzenia (symulator)

cp .env.example .env                     # ustaw drukarkę i tokeny
set -a; . ./.env; set +a
uvicorn fiscal_agent.app:create_app --factory --host 127.0.0.1 --port 8765
```

Serwis systemd: [`deploy/kalkmate-fiscal-agent.service`](deploy/kalkmate-fiscal-agent.service). Kod kopiujesz do `/opt/kalkmate-fiscal-agent`, a venv tworzysz w `.venv`.

Do testów bez drukarki służy `posnet-simulator --port 6666`, a do testu trybu fiskalnego dodaj `--fiscal`. Symulator odwzorowuje specyfikację, nie firmware — nie zastępuje testu na urządzeniu.

## Lokalny endpoint

```bash
curl -s -X POST "http://127.0.0.1:8765/receipts?wait=20" \
  -H "Authorization: Bearer $AGENT_API_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "id": "TEST-0001",
    "items": [
      {"name": "KalkMate v3 kalkulator AI", "unit_price": 69900, "vat": "23", "discount": 7000},
      {"name": "Wysyłka", "unit_price": 1599, "vat": "23"},
      {"name": "Papier", "quantity": "1.5", "unit_price": 333, "vat": "8"}
    ],
    "payments": [{"type": "card", "amount": 64999}]
  }'
# -> {"id":"TEST-0001","state":"printed","receipt_number":101,...}
```

| Pole | Format |
|---|---|
| `id` | Klucz idempotencji. To samo `id` nigdy nie drukuje się drugi raz |
| `items[].unit_price`, `discount`, `payments[].amount` | Grosze brutto (int) |
| `items[].quantity` | Liczba dziesiętna jako string (maks. 3 miejsca); wartość pozycji zaokrąglana ROUND_HALF_UP |
| `items[].vat` | `"23" \| "8" \| "5" \| "0" \| "zw"`. Agent mapuje stawkę na literę A–G na podstawie `vatget` z drukarki |
| `payments[].type` | `cash \| card \| transfer \| voucher \| credit \| other`. Przelew i płatność online idą jako „inna” (ty=6) z nazwą |

Nadpłata jest dozwolona tylko gotówką — agent dolicza wtedy resztę.

**Stany zlecenia:**

| Stan | Znaczenie |
|---|---|
| `queued` | Czeka w kolejce; po błędzie przejściowym (papier, zajęta, brak połączenia) ponawiane automatycznie |
| `printing` | W trakcie druku |
| `printed` | Wydrukowany; `receipt_number` = numer z licznika drukarki |
| `failed` | Błąd danych lub stanu urządzenia — wymaga poprawy |
| `uncertain` | Nie wiadomo, czy paragon powstał — sprawdź drukarkę, potem `POST /receipts/{id}/retry?confirm_not_printed=true` |

## Bezpieczniki

- `FISCAL_ALLOW_REAL=0` (domyślnie): agent odmawia druku, gdy drukarka zgłasza tryb fiskalny (`scomm.fs`).
- Po restarcie agenta zlecenie przerwane w trakcie druku dostaje stan `uncertain` i **nie** jest ponawiane automatycznie.
- Lokalne API nasłuchuje na `127.0.0.1` i wymaga tokenu Bearer. Drukarka nie ma uwierzytelniania, więc trzymaj ją w zaufanej sieci lub VLAN.
