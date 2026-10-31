# Serwer pośredniczący KalkMate (Kanada: `ca.kalkmate.pl`)

Kalkulator z firmware **2.0.7+** sam mierzy, czy szybciej łączy się z
`kalkmate.pl` (Mediolan), czy z `ca.kalkmate.pl`, i wysyła zadania (`/api/device/solve`)
przez szybszy (`src/server_select.h`). Serwer w Kanadzie to sam nginx: przekazuje
zadanie do Mediolanu po stałym połączeniu. Nie ma na nim aplikacji ani bazy.
Rejestracja, notatki, OTA i strona zostają na `kalkmate.pl`.

```
Kalkulator (USA/Kanada) ──TLS + zdjęcie, krótko──▶ ca.kalkmate.pl (nginx)
                                                         │ keep-alive
                                                         ▼
                                       kalkmate.pl — Mediolan (Next.js + baza + AI)
```

Kalkulator w Europie dalej łączy się prosto z Mediolanem. Kanada wygrywa tylko,
gdy jest szybsza o co najmniej 40 ms. Gdy `ca.kalkmate.pl` nie odpowiada, druga próba
tego samego zadania idzie do Mediolanu, a Kanada jest pomijana przez 30 minut.

## Instalacja (raz)

1. **DNS**: u dostawcy domeny dodaj rekord `A`: `ca` → IP serwera w Kanadzie
   (i `AAAA`, jeśli VPS ma IPv6). Bez proxy/„pomarańczowej chmurki”.
   Sprawdź: `ping ca.kalkmate.pl` pokazuje IP Kanady.

2. **Serwer w Kanadzie** (Ubuntu 22.04+/Debian 12, jako root):

   Skopiuj katalog `tools/edge` na serwer (repo jest prywatne, więc najprościej scp
   z komputera), np. `scp -r tools/edge root@<IP_KANADY>:/opt/kalkmate-edge`, a potem na serwerze:

   ```bash
   bash /opt/kalkmate-edge/install-edge.sh ca.kalkmate.pl <IP_MEDIOLANU> kontakt@kalkmate.pl
   ```

   Skrypt instaluje nginx i certbota, bierze certyfikat Let's Encrypt (sam się
   odnawia) i na końcu robi test. Oczekiwany wynik: `HTTP 401`/`403`/`400`
   (Mediolan odpowiedział, tylko brak kluczy kalkulatora w teście). `502` = Kanada nie może
   połączyć się z Mediolanem (zły IP albo firewall w Mediolanie).

3. **Mediolan: prawdziwe IP kalkulatorów.** Bez tego wszystkie kalkulatory
   z Ameryki miałyby dla serwera jedno IP (Kanady) i blokowałyby się nawzajem
   limitami zapytań. W pliku konfiguracji nginx dla `kalkmate.pl` w Mediolanie
   (zwykle `/etc/nginx/sites-available/kalkmate`), w bloku `server { listen 443 ... }`
   dopisz:

   ```nginx
   # Serwer posredniczacy w Kanadzie (tools/edge) podaje prawdziwe IP kalkulatora.
   # Ufamy temu naglowkowi TYLKO od jego IP.
   set_real_ip_from <IP_KANADY>;
   real_ip_header X-Real-IP;
   ```

   i `sudo nginx -t && sudo systemctl reload nginx`. Istniejące
   `proxy_set_header X-Real-IP $remote_addr;` zostaje: po tej zmianie `$remote_addr`
   to już IP kalkulatora.

   Nie wpisuj tam żadnych innych adresów: komuś spoza listy serwer nie uwierzy
   w podany `X-Real-IP`, więc nie podszyje się pod cudze IP.

4. **Firmware 2.0.7** zbuduj i wgraj przez OTA. Działa od razu: w logach
   kalkulatora (`[SRV] pomiar: ...`) i w zdarzeniach urządzenia w panelu admina
   (`SRV rtt ... -> ca.kalkmate.pl`) widać, który serwer wybrał.

## Kolejny serwer (np. Australia)

1. DNS `au.kalkmate.pl` → nowy VPS, `install-edge.sh au.kalkmate.pl <IP_MEDIOLANU> ...`.
2. W Mediolanie kolejna linia `set_real_ip_from <IP_AUSTRALII>;`.
3. W `src/server_select.h` dopisz `"au.kalkmate.pl"` do `_SRV_HOSTS`, podbij
   `FW_VERSION`, OTA.

## Co serwer przepuszcza

Tylko `POST /api/device/solve` (do 2 MB). Wszystko inne przekierowuje na
`https://kalkmate.pl`: strona, panel i admin działają tylko przez Mediolan.
Połączenie Kanada → Mediolan jest szyfrowane, a certyfikat Mediolanu sprawdzany
(`proxy_ssl_verify on`), więc nikt po drodze nie podstawi się za Mediolan.
