// Dzwiek do filmu: lektor + efekty + muzyka z ElevenLabs, zmiksowane ffmpegiem
// z kalkmate-promo-1080x1920.mp4 -> kalkmate-promo-1080x1920-dzwiek.mp4.
//
//   ELEVENLABS_API_KEY=... node audio/make-audio.mjs           (z katalogu marketing/promo-video)
//   node audio/make-audio.mjs --placeholder                     (bez API: sztuczne dzwieki, test miksu)
//
// Scenariusz (teksty, czasy, efekty, opis muzyki): audio/soundtrack.json.
// Wygenerowane pliki ida do audio/cache/ (nazwa = hash zapytania), wiec
// ponowne uruchomienie po zmianie jednej kwestii placi tylko za te kwestie.
// W kontenerze z proxy uruchom z NODE_USE_ENV_PROXY=1 (wbudowany fetch Node).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CACHE = join(HERE, "cache");
const VIDEO_IN = join(ROOT, "kalkmate-promo-1080x1920.mp4");
const VIDEO_OUT = join(ROOT, "kalkmate-promo-1080x1920-dzwiek.mp4");
const API = "https://api.elevenlabs.io";
const PLACEHOLDER = process.argv.includes("--placeholder");
const KEY = process.env.ELEVENLABS_API_KEY;

const cfg = JSON.parse(readFileSync(join(HERE, "soundtrack.json"), "utf8"));
mkdirSync(CACHE, { recursive: true });

if (!PLACEHOLDER && !KEY) {
  console.error("Brak ELEVENLABS_API_KEY. Ustaw zmienna srodowiskowa albo uruchom z --placeholder (test miksu).");
  process.exit(1);
}

const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const duration = (file) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
const hash = (o) => createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16);

// POST do ElevenLabs -> plik mp3 w cache (pomijane, jesli juz jest).
async function fetchAudio(kind, path, body, placeholderArgs) {
  // previous_text/next_text (kontekst intonacji) nie wchodza do klucza cache —
  // zmiana sasiedniej kwestii nie wymusza ponownego (platnego) generowania tej.
  const { previous_text: _p, next_text: _n, ...keyBody } = body;
  void _p; void _n;
  const file = join(CACHE, `${kind}-${hash({ path, body: keyBody, ph: PLACEHOLDER })}.mp3`);
  if (existsSync(file)) return file;
  if (PLACEHOLDER) {
    ff([...placeholderArgs, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-q:a", "4", file]);
    return file;
  }
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${kind}: ElevenLabs ${res.status} ${(await res.text()).slice(0, 300)}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`  pobrano ${kind}: ${file.split("/").pop()}`);
  return file;
}

const V = cfg.voice;
const lines = [];
console.log("Lektor…");
for (const [i, l] of cfg.lines.entries()) {
  const body = {
    text: l.text,
    model_id: V.modelId,
    voice_settings: V.settings,
    // multilingual_v2 nie przyjmuje language_code (patrz OpenAPI ElevenLabs).
    ...(V.languageCode && !V.modelId.includes("multilingual_v2") ? { language_code: V.languageCode } : {}),
    previous_text: cfg.lines[i - 1]?.text,
    next_text: cfg.lines[i + 1]?.text,
  };
  const est = Math.min(l.maxEnd - l.start, 0.075 * l.text.length);
  const file = await fetchAudio(`voice${i}`, `/v1/text-to-speech/${V.voiceId}?output_format=mp3_44100_128`, body,
    ["-f", "lavfi", "-i", `sine=frequency=${220 + i * 30}:duration=${est.toFixed(2)}`]);
  // Cisza na poczatku/koncu z TTS (zwykle 0,2-0,4 s) zabiera miejsce w scenie.
  const trimmed = file.replace(/\.mp3$/, "-trim.wav");
  if (!existsSync(trimmed)) {
    ff(["-i", file, "-af",
      "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.05",
      trimmed]);
  }
  const d = duration(trimmed);
  const room = l.maxEnd - l.start;
  // Za dluga kwestia: lekkie przyspieszenie (max 1.2x), zeby zmiescila sie w scenie.
  const tempo = d > room ? Math.min(1.2, d / room) : 1;
  if (d / tempo > room + 0.05) console.warn(`  UWAGA: kwestia ${i + 1} ma ${d.toFixed(2)} s, scena ${room.toFixed(2)} s — skróć tekst w soundtrack.json`);
  lines.push({ file: trimmed, start: l.start, tempo });
  console.log(`  kwestia ${i + 1}: ${d.toFixed(2)} s / ${room.toFixed(2)} s${tempo > 1 ? ` (przyspieszona ${tempo.toFixed(2)}x)` : ""}`);
}

console.log("Efekty…");
const sfx = [];
for (const s of cfg.sfx) {
  const body = { text: s.prompt, duration_seconds: s.duration, prompt_influence: 0.5 };
  const file = await fetchAudio(`sfx-${s.id}`, "/v1/sound-generation?output_format=mp3_44100_128", body,
    ["-f", "lavfi", "-i", `anoisesrc=d=${Math.min(s.duration, 0.25)}:c=pink:a=0.5`]);
  sfx.push({ ...s, file });
}

console.log("Muzyka…");
const musicLen = Math.ceil(cfg.durationSec + 1) * 1000;
let music = null;
try {
  music = await fetchAudio("music", "/v1/music?output_format=mp3_44100_128",
    { prompt: cfg.music.prompt, music_length_ms: musicLen, force_instrumental: true, model_id: "music_v1" },
    ["-f", "lavfi", "-i", `sine=frequency=110:duration=${musicLen / 1000}`, "-af", "tremolo=f=3.7:d=0.6"]);
} catch (e) {
  // Music API wymaga platnego planu ElevenLabs (402). Zapas: zapetlony podklad
  // z generatora efektow (max 30 s, loop), przedluzany do dlugosci filmu.
  console.warn(`  Music API niedostępne (${e.message.slice(0, 120)}).`);
  if (cfg.music.fallbackLoopPrompt) {
    try {
      const loop = await fetchAudio("music-loop", "/v1/sound-generation?output_format=mp3_44100_128",
        { text: cfg.music.fallbackLoopPrompt, duration_seconds: 30, loop: true, prompt_influence: 0.6, model_id: "eleven_text_to_sound_v2" },
        ["-f", "lavfi", "-i", "sine=frequency=110:duration=30", "-af", "tremolo=f=3.7:d=0.6"]);
      music = join(CACHE, "music-loop-extended.wav");
      ff(["-stream_loop", "2", "-i", loop, "-t", String(musicLen / 1000), music]);
      console.log("  Użyto zapętlonego podkładu z generatora efektów.");
    } catch (e2) {
      console.warn(`  Podkład też niedostępny (${e2.message.slice(0, 120)}). Miksuję bez muzyki.`);
    }
  }
}

// === Miks ===
const inputs = ["-i", VIDEO_IN];
const parts = [];
let idx = 1;
const ms = (t) => Math.round(t * 1000);

const voxLabels = lines.map((l) => {
  inputs.push("-i", l.file);
  const lab = `v${idx}`;
  parts.push(`[${idx}:a]${l.tempo !== 1 ? `atempo=${l.tempo.toFixed(3)},` : ""}adelay=${ms(l.start)}:all=1,volume=${V.volume}[${lab}]`);
  idx++;
  return `[${lab}]`;
});
parts.push(`${voxLabels.join("")}amix=inputs=${voxLabels.length}:normalize=0:dropout_transition=0,asplit=2[vox][voxsc]`);

const fxLabels = [];
for (const s of sfx) {
  inputs.push("-i", s.file);
  const n = s.at.length;
  const split = s.at.map((_, k) => `[s${idx}_${k}]`).join("");
  parts.push(`[${idx}:a]asplit=${n}${split}`);
  s.at.forEach((t, k) => {
    parts.push(`[s${idx}_${k}]adelay=${ms(t)}:all=1,volume=${s.volume}[f${idx}_${k}]`);
    fxLabels.push(`[f${idx}_${k}]`);
  });
  idx++;
}
parts.push(`${fxLabels.join("")}amix=inputs=${fxLabels.length}:normalize=0:dropout_transition=0[fx]`);

const D = cfg.durationSec;
const mixInputs = ["[vox]", "[fx]"];
if (music) {
  inputs.push("-i", music);
  parts.push(`[${idx}:a]atrim=0:${D},afade=t=in:d=0.4,afade=t=out:st=${D - 1.8}:d=1.8,volume=${cfg.music.volume}[mraw]`);
  // Muzyka sciszana pod lektorem (sidechain), zeby glos byl czytelny.
  parts.push(cfg.music.duckUnderVoice
    ? `[mraw][voxsc]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=350[mus]`
    : `[mraw]anull[mus]`);
  if (!cfg.music.duckUnderVoice) parts.push(`[voxsc]anullsink`);
  mixInputs.push("[mus]");
} else {
  parts.push(`[voxsc]anullsink`);
}
parts.push(`${mixInputs.join("")}amix=inputs=${mixInputs.length}:normalize=0:dropout_transition=0,` +
  `atrim=0:${D},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[aout]`);

console.log("Miksuję…");
ff([...inputs, "-filter_complex", parts.join(";"), "-map", "0:v", "-map", "[aout]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", VIDEO_OUT]);
console.log(`Gotowe: ${VIDEO_OUT}`);
