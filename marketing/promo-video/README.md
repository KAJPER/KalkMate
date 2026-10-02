# Film promocyjny KalkMate

`kalkmate-promo-1080x1920.mp4` — gotowy film: 34 s, pionowo 1080×1920 (TikTok / Reels / Shorts), 30 fps, bez dźwięku.

Sceny: obrót produktu → zwykłe liczenie → kod AI i menu → zdjęcie zadania kamerą → rozwiązanie krok po kroku na OLED → przedmioty → cechy → kalkmate.pl.

## Jak zmienić i wyrenderować ponownie

Animacja to zwykła strona HTML (`index.html`) z funkcją `render(t)` — każda klatka jest liczona z czasu `t`, więc render jest powtarzalny.

- Teksty podpisów: tablica `CAPS` w `index.html`
- Co widać na ekranie OLED: funkcja `drawOled(t)` (kroki rozwiązania: `STEPS`, przedmioty: `SUBJECTS`)
- Naciskane klawisze: `PRESS`, ruch kamery: `CAM`
- Zdjęcia i klatki obrotu są brane z `website/public` (`KalkMate.png`, `frames/`, `kalkulator-kalkmate-kamera-odkryta.png`)
- Fonty (Geist, Fraunces, JetBrains Mono, VT323 — licencja OFL) są lokalnie w `fonts/`

Wymagane: Node, Playwright z Chromium, ffmpeg.

```bash
cd marketing/promo-video
node snap.js 5.9 20.6 33.5      # podgląd wybranych momentów -> snap_<t>.png
node render.js                  # pełny film -> kalkmate-promo-1080x1920.mp4 (kilka minut)
```

Jeśli Chromium nie jest w domyślnym miejscu, zmień `executablePath` w `render.js` / `snap.js`.

## Dźwięk: lektor, efekty, muzyka (ElevenLabs)

`audio/soundtrack.json` to scenariusz dźwięku: kwestie lektora z czasami (zgrane ze scenami), efekty (klawisze, migawka, przejścia, „ding” przy rozwiązaniu, uderzenie na logo) i opis muzyki. `audio/make-audio.mjs` pobiera to z ElevenLabs i miksuje z filmem:

```bash
cd marketing/promo-video
ELEVENLABS_API_KEY=... node audio/make-audio.mjs      # -> kalkmate-promo-1080x1920-dzwiek.mp4
node audio/make-audio.mjs --placeholder               # test miksu bez API (sztuczne dźwięki)
```

- Lektor: model `eleven_multilingual_v2` (polski), głos `voice.voiceId` (zmień na inny z biblioteki ElevenLabs). Za długa kwestia jest lekko przyspieszana (max 1,2×), a skrypt ostrzega, gdy i tak się nie mieści.
- Muzyka: `/v1/music` (wymaga płatnego planu ElevenLabs). Bez niej film dostaje lektora i efekty. Pod lektorem muzyka jest automatycznie ściszana.
- Głośność końcowa −14 LUFS (standard TikTok/YouTube/Instagram). Obraz nie jest ponownie kodowany.
- Wygenerowane pliki trafiają do `audio/cache/` — ponowne uruchomienie po zmianie jednej kwestii płaci tylko za nią.
- Za proxy (np. kontener w chmurze) uruchom z `NODE_USE_ENV_PROXY=1`.
