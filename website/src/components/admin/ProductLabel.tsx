// Etykieta produktowa KalkMate 100x150 mm (drukarka termiczna VEVOR, 203 dpi)
// — wierne przeniesienie tools/etykieta-produktowa/kalkmate-etykieta.html do
// Reacta (ten sam CSS, znak CE, WEEE, ikony 8x8, generator EAN-13). Zmiany
// w projekcie etykiety rob W OBU miejscach.
//
// Zasady druku termicznego (z pliku zrodlowego):
//  - tylko czysta czern #000 na bieli — zadnego szarego tekstu ani linii,
//  - linie min. 0.25 mm, tekst min. ~2.1 mm wysokosci,
//  - modul EAN = 0.375 mm = dokladnie 3 punkty termika 203 dpi.
//
// Style sa zawezone do .kmpl (strona dziala wewnatrz aplikacji Next z
// Tailwind preflight + globals.css), stad reset line-height/fontu/svg nizej.

import { useLayoutEffect, useRef } from "react";

// Ikony 8x8 — te same bitmapy co w firmware (src/ui_kit.h, bit 0 = lewy piksel).
const ICO = {
  display: [0xFF, 0x81, 0x81, 0x81, 0xFF, 0x18, 0x3C, 0x00],
  camera: [0x1C, 0xFF, 0x99, 0xA5, 0xA5, 0x99, 0xFF, 0x00],
  globe: [0x3C, 0x5A, 0x99, 0xFF, 0x99, 0x5A, 0x3C, 0x00],
  wifi: [0x7E, 0x81, 0x3C, 0x42, 0x18, 0x24, 0x00, 0x18],
  battery: [0x00, 0x7F, 0x41, 0xDD, 0xDD, 0x41, 0x7F, 0x00],
  gear: [0x18, 0x7E, 0x66, 0xC3, 0xC3, 0x66, 0x7E, 0x18],
  info: [0x3C, 0x66, 0xFF, 0xE7, 0xE7, 0xE7, 0x7E, 0x3C],
  notes: [0x7E, 0x42, 0x5A, 0x42, 0x5A, 0x42, 0x7E, 0x00],
  check: [0x00, 0xC0, 0xE0, 0x70, 0x3B, 0x1F, 0x0E, 0x04],
  cloud: [0x00, 0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x00],
} as const;
type IcoName = keyof typeof ICO;

function Px({ ico }: { ico: IcoName }) {
  const rects: { x: number; y: number }[] = [];
  ICO[ico].forEach((row, y) => {
    for (let x = 0; x < 8; x++) if ((row >> x) & 1) rects.push({ x, y });
  });
  return (
    <span className="px">
      <svg viewBox="0 0 8 8" width="100%" height="100%" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
        {rects.map((r) => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width="1.02" height="1.02" />)}
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------
// EAN-13 (czysty SVG, offline). Strefy ciszy 11/7 modulow po bokach.
// ---------------------------------------------------------------------
export const PRODUCT_GTIN = "5908202546201";
const L_CODE: Record<string, string> = { "0": "0001101", "1": "0011001", "2": "0010011", "3": "0111101", "4": "0100011", "5": "0110001", "6": "0101111", "7": "0111011", "8": "0110111", "9": "0001011" };
const G_CODE: Record<string, string> = { "0": "0100111", "1": "0110011", "2": "0011011", "3": "0100001", "4": "0011101", "5": "0111001", "6": "0000101", "7": "0010001", "8": "0001001", "9": "0010111" };
const R_CODE: Record<string, string> = { "0": "1110010", "1": "1100110", "2": "1101100", "3": "1000010", "4": "1011100", "5": "1001110", "6": "1010000", "7": "1000100", "8": "1001000", "9": "1110100" };
const PARITY: Record<string, string> = { "0": "LLLLLL", "1": "LLGLGG", "2": "LLGGLG", "3": "LLGGGL", "4": "LGLLGG", "5": "LGGLLG", "6": "LGGGLL", "7": "LGLGLG", "8": "LGLGGL", "9": "LGGLGL" };
function ean13Bits(d: string): string {
  let bits = "101";
  d.slice(1, 7).split("").forEach((c, i) => (bits += PARITY[d[0]][i] === "L" ? L_CODE[c] : G_CODE[c]));
  bits += "01010";
  d.slice(7, 13).split("").forEach((c) => (bits += R_CODE[c]));
  return bits + "101";
}

function Ean13({ digits, h }: { digits: string; h: number }) {
  const bits = ean13Bits(digits), qL = 11, qR = 7, W = bits.length + qL + qR;
  const guard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  const bars: number[] = [];
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") bars.push(i);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} shapeRendering="crispEdges" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      {bars.map((i) => <rect key={i} x={qL + i} y="0" width="1" height={guard(i) ? h : h - 5} fill="#000" />)}
    </svg>
  );
}

// Prawdziwy ekran urzadzenia: rozwiazanie zadania (fonty U8g2 z firmware).
const SCREEN_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAABAAQAAAADdJpQTAAACL0lEQVR4nMWUP2/TQBjGf3c2xKFRYtIMHazKCRKKOlUMnSrXwMDOzGD4AkSdOiBhoUhEfIZKRHwCPkCFrAiJSuwINm9kLKhCTqhjdHFC/tg0DCm8w/mk+93z+N7nbLj6khWQgJG3qGugG/6fd5dqSB1reNsafNxq5QDRJsJMNs/MsGw94ijHwt2X0U9M37p5Qp4CLvrFNWx02/U6Oes3nsdI43jwYHvQP85VWEeJ5KqUp1VQMVxaq4H99KmFqNBcNbcXgE9p0vF4aQyl1Mzi8ENNBA42uxVf+LQq/gJAdaPZUaIBpzB06SxaFCRPC5FS8AgqfrFLVFm6QNVXTUPayFtKgftZhZ2zpJYEJK/pA4kaPy8f1VCDzmycV1jVp8IqQK4jC9FW7a8HaYuNXZjO06oyBh6OmwlbLjyZzCfv0NqwtLC0B+KlpYWmCw6OmLWz2mlLuEPgSPcNGG8rvh0gpxaSatTe1sKGAO1rVwuNU6jjaOHMokM7tk0B8WMZ28pc0Iu936fY+XbwDIYihGQIe334Mt3+NyXX0EnWAPhwFwqmEYD/LgsI4B6II+EieJ8BGgJHvIDooogj1GwJ+D6ih06k+WbQG4nM/1Seq/Su+4ag7jnIHxmgBL3k0EfXD5SUnQHKmje+HoVO0kXzhtmDRqvacHn9m7BEMJ9FHuCpLOxJFlmgMZrPIsejRoAoEml6I89CynPhqiyaaRY5FiUxn0UOUFZfREA4ySIH+f9Z/AIAjJVs/f19RwAAAABJRU5ErkJggg==";

// CSS 1:1 z kalkmate-etykieta.html, kazda regula poprzedzona .kmpl.
// Reguly html/body (tlo, marginesy, kolor druku) sa na poziomie strony.
export const PRODUCT_LABEL_CSS = `
  @page { size: 100mm 150mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; }
  /* globals.css: ziarno (body.km-grain::before) — na termiku wyszloby jako szum */
  body::before, body::after { display: none !important; content: none !important; }

  .kmpl, .kmpl * { box-sizing: border-box; }
  .kmpl { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: "Arial", "Helvetica Neue", Helvetica, sans-serif;
    line-height: normal; letter-spacing: normal; font-feature-settings: normal; }
  .kmpl b, .kmpl strong { font-weight: 700; }
  /* Tailwind preflight daje svg display:block — przywracamy domyslne */
  .kmpl svg { display: inline; vertical-align: baseline; }

  .kmpl .label {
    width: 100mm; height: 150mm;
    padding: 4mm 4.5mm;
    display: flex; flex-direction: column;
    page-break-after: always; break-after: page; overflow: hidden;
  }
  .kmpl .label:last-child { page-break-after: auto; break-after: auto; }

  /* Pikselowe ikony (bitmapy 8x8) */
  .kmpl .px { display: inline-block; vertical-align: middle; image-rendering: pixelated; }
  .kmpl .px rect { fill: #000; }

  /* ---------- naglowek: czarny pasek jak naglowek ekranu ---------- */
  .kmpl .bar {
    display: flex; align-items: center; justify-content: space-between;
    background: #000; color: #fff;
    border-radius: 1.6mm;
    padding: 2.2mm 3mm;
  }
  .kmpl .bar .word { font-size: 7mm; font-weight: 800; letter-spacing: -0.2mm; line-height: 1; }
  .kmpl .bar .tag { font-size: 2.5mm; font-weight: 700; letter-spacing: 0.5mm; text-transform: uppercase; text-align: right; line-height: 1.25; }

  .kmpl .section-title {
    display: flex; align-items: center; gap: 1.6mm;
    font-size: 2.6mm; font-weight: 800; letter-spacing: 0.35mm; text-transform: uppercase;
    border-bottom: 0.35mm solid #000; padding-bottom: 0.8mm; margin: 2.4mm 0 1.4mm;
  }
  .kmpl .section-title .px { width: 3mm; height: 3mm; }

  /* ---------- opis w 3 jezykach ---------- */
  .kmpl .desc { font-size: 2.6mm; line-height: 1.26; font-weight: 700; letter-spacing: 0.02mm; }
  .kmpl .desc .row { display: flex; gap: 2mm; margin-bottom: 0.9mm; }
  .kmpl .desc .lang {
    flex: 0 0 auto; width: 6mm; height: 3.3mm;
    border: 0.3mm solid #000; border-radius: 0.8mm;
    font-size: 2mm; font-weight: 800; line-height: 2.8mm; text-align: center;
  }

  /* ---------- dane techniczne ---------- */
  .kmpl .spec { font-size: 2.6mm; font-weight: 700; }
  .kmpl .spec .r { display: flex; justify-content: space-between; align-items: center;
    padding: 0.6mm 0; border-bottom: 0.25mm solid #000; }
  .kmpl .spec .r:last-child { border-bottom: none; }
  .kmpl .spec .r span { display: flex; align-items: center; gap: 1.6mm; }
  .kmpl .spec .r .px { width: 2.8mm; height: 2.8mm; }
  .kmpl .spec .r b { text-align: right; }

  /* ---------- EAN ---------- */
  .kmpl .ean { display: flex; flex-direction: column; align-items: center; margin-top: 2mm; }
  /* Modul = 0.375 mm = dokladnie 3 punkty termika 203 dpi (rowne slupki).
     113 modulow z marginesami ciszy = 42.375 mm. */
  .kmpl .ean svg { display: block; width: 42.375mm; height: 17mm; }
  .kmpl .ean .digits { font-size: 3mm; font-weight: 700; letter-spacing: 0.9mm; margin-top: 0.6mm; font-family: "Courier New", monospace; }

  /* ---------- zgodnosc ---------- */
  .kmpl .comp {
    margin-top: auto;
    border: 0.4mm solid #000; border-radius: 1.6mm;
    padding: 2.2mm 2.6mm;
    display: flex; gap: 2.6mm; align-items: stretch;
  }
  .kmpl .comp .marks { display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 1.4mm; flex: 0 0 auto; }
  .kmpl .comp .ce { width: 9.8mm; height: 7mm; }
  .kmpl .comp .rohs { font-size: 2.6mm; font-weight: 800; border: 0.3mm solid #000; border-radius: 0.8mm; padding: 0.2mm 1mm; }
  .kmpl .comp .weee { width: 8mm; height: 8.8mm; }
  .kmpl .comp .info { flex: 1 1 auto; font-size: 2.35mm; line-height: 1.34; font-weight: 700; }
  .kmpl .comp .info .model { font-size: 3.1mm; font-weight: 800; line-height: 1.2; margin-bottom: 0.6mm; }
  .kmpl .comp .tags { display: flex; gap: 1.4mm; flex-wrap: wrap; margin-top: 1.2mm; }
  .kmpl .chip { display: inline-block; background: #000; color: #fff; border-radius: 0.8mm;
    font-size: 2.4mm; font-weight: 800; padding: 0.35mm 1.6mm; letter-spacing: 0.2mm; }
  .kmpl .chip.out { background: #fff; color: #000; border: 0.3mm solid #000; }

  .kmpl .foot { display: flex; justify-content: space-between; font-size: 2.4mm; font-weight: 700; margin-top: 2mm; }

  /* ---------- PRZOD ---------- */
  .kmpl .front { align-items: stretch; }
  .kmpl .front .hero { text-align: center; margin-top: 2mm; }
  .kmpl .front .hero .word { font-size: 15mm; font-weight: 800; letter-spacing: -0.6mm; line-height: 0.95; }
  .kmpl .front .hero .tag { font-size: 3mm; font-weight: 800; letter-spacing: 0.9mm; text-transform: uppercase; margin-top: 1.8mm; }

  .kmpl .device {
    margin: 4mm auto 0; width: 86mm;
    background: #000; border-radius: 2.4mm; padding: 2.2mm;
  }
  .kmpl .device img { display: block; width: 100%; max-width: none; height: auto; image-rendering: pixelated; }

  .kmpl .steps { display: flex; align-items: center; justify-content: center; gap: 2mm; margin-top: 4mm; }
  .kmpl .step { display: flex; flex-direction: column; align-items: center; gap: 1.2mm; width: 20mm; }
  .kmpl .step .ic { width: 11mm; height: 11mm; background: #000; border-radius: 2mm; display: flex; align-items: center; justify-content: center; }
  .kmpl .step .ic .px { width: 6.4mm; height: 6.4mm; }
  .kmpl .step .ic .px rect { fill: #fff; }
  .kmpl .step .t { font-size: 2.5mm; font-weight: 800; text-transform: uppercase; letter-spacing: 0.25mm; text-align: center; }
  .kmpl .chev { font-size: 5mm; font-weight: 800; line-height: 1; margin-bottom: 3.6mm; }

  .kmpl .headline { text-align: center; font-size: 6.2mm; font-weight: 800; line-height: 1.15; margin-top: 4mm; letter-spacing: -0.15mm; }

  .kmpl .feats { margin-top: 3.4mm; border-top: 0.35mm solid #000; }
  .kmpl .feat { display: flex; align-items: center; gap: 2.4mm; padding: 1.5mm 0; border-bottom: 0.25mm solid #000; font-size: 2.7mm; font-weight: 700; }
  .kmpl .feat .px { width: 4mm; height: 4mm; flex: 0 0 auto; }
  .kmpl .feat b { font-size: 2.9mm; }

  .kmpl .persona { margin-top: 3mm; border: 0.5mm solid #000; border-radius: 1.6mm; text-align: center; padding: 1.8mm 2mm; }
  .kmpl .persona .l { font-size: 2.3mm; font-weight: 800; letter-spacing: 0.5mm; text-transform: uppercase; }
  .kmpl .persona .n { font-size: 5.4mm; font-weight: 800; margin-top: 0.4mm; }

  /* ---------- DOPASOWANIE (tylko w adminie, nie ma w pliku zrodlowym) ----------
     W pliku zrodlowym przod z ramka personalizacji wychodzi ~6 mm poza 150 mm
     (dolny wiersz ucinany przy druku), a tyl przepelnia sie juz przy imieniu
     ~20 znakow (chip "Dla:" zawija sie do 2.-3. wiersza). useFit() wlacza po
     kolei poziomy data-fit="1 2 ..." (kumulatywnie) az etykieta sie zmiesci.
     Poziom 0 = wyglad 1:1 z plikiem zrodlowym. */
  .kmpl .persona .n, .kmpl .chip.name { overflow-wrap: anywhere; } /* imie bez spacji nie ucieka w bok */
  .kmpl .front[data-fit~="1"] .device { margin-top: 2.5mm; }
  .kmpl .front[data-fit~="1"] .steps { margin-top: 2.5mm; }
  .kmpl .front[data-fit~="1"] .headline { margin-top: 2.5mm; }
  .kmpl .front[data-fit~="1"] .feat { padding: 0.9mm 0; }
  .kmpl .front[data-fit~="2"] .persona .n { font-size: 4.4mm; }
  .kmpl .front[data-fit~="3"] .persona .n { font-size: 3.6mm; }
  .kmpl .front[data-fit~="4"] .persona { padding: 1.2mm 2mm; }
  .kmpl .front[data-fit~="4"] .persona .n { font-size: 3mm; }

  .kmpl .label[data-fit~="1"] .section-title { margin: 1.6mm 0 1mm; }
  .kmpl .label[data-fit~="1"] .desc .row { margin-bottom: 0.5mm; }
  .kmpl .label[data-fit~="1"] .spec .r { padding: 0.35mm 0; }
  .kmpl .label[data-fit~="1"] .ean { margin-top: 1mm; }
  .kmpl .label[data-fit~="1"] .foot { margin-top: 1.2mm; }
  .kmpl .label[data-fit~="2"] .desc { font-size: 2.4mm; line-height: 1.2; }
  .kmpl .label[data-fit~="3"] .comp .tags { gap: 1mm; }
  .kmpl .label[data-fit~="3"] .chip { font-size: 2.2mm; padding: 0.3mm 1.2mm; }
  .kmpl .label[data-fit~="4"] .chip.name { font-size: 2.1mm; letter-spacing: 0; }

  .kmpl .front .bottom { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; }
  .kmpl .front .bottom .m { font-size: 3mm; font-weight: 800; }
  .kmpl .front .bottom .s { font-size: 3.4mm; font-weight: 800; text-align: right; line-height: 1.2; }

  @media screen {
    html, body { background: #e8e8e8 !important; }
    .kmpl { background: #e8e8e8; padding: 6mm 0; min-height: 100vh; }
    .kmpl .label { background: #fff; margin: 0 auto 6mm; box-shadow: 0 1px 6px rgba(0,0,0,.25); }
  }
  @media print {
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .kmpl-noprint { display: none !important; }
    /* Tylko etykiety — nic z reszty aplikacji (toasty, szuflady itp.) */
    body > *:not(.kmpl):not(:has(.kmpl)) { display: none !important; }
  }
`;

const GTIN_TEXT = PRODUCT_GTIN[0] + " " + PRODUCT_GTIN.slice(1, 7) + " " + PRODUCT_GTIN.slice(7, 13);

const FIT_LEVELS = 4;

/** Najnizszy poziom data-fit, przy ktorym tresc miesci sie w 100x150 mm
 *  (wymiary w mm — uklad na ekranie = uklad wydruku). Eksport dla testow. */
export function fitLabel(el: HTMLElement): void {
  for (let level = 0; level <= FIT_LEVELS; level++) {
    el.setAttribute("data-fit", Array.from({ length: level }, (_, i) => String(i + 1)).join(" "));
    if (el.scrollHeight <= el.clientHeight + 1) return;
  }
}

function useFit(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) fitLabel(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Tyl etykiety: opis, dane techniczne, EAN, zgodnosc CE/WEEE, SN. */
export function ProductLabelBack({ sn, name }: { sn: string; name: string }) {
  const hasName = name.trim() !== "";
  const ref = useFit([sn, name]);
  return (
    <div className="label" ref={ref}>
      <div className="bar">
        <div className="word">KalkMate</div>
        <div className="tag">Kalkulator AI<br />z kamerą</div>
      </div>

      <div className="section-title"><Px ico="info" />Opis produktu</div>
      <div className="desc">
        <div className="row"><div className="lang">PL</div><div>Kalkulator edukacyjny z kamerą i AI — fotografuje zadanie i pokazuje pełne rozwiązanie krok po kroku na ekranie OLED. Matematyka, fizyka, chemia, biologia.</div></div>
        <div className="row"><div className="lang">EN</div><div>Educational calculator with a camera and AI — photographs the problem and shows the full step-by-step solution on the OLED screen. Math, physics, chemistry, biology.</div></div>
        <div className="row"><div className="lang">DE</div><div>Lernrechner mit Kamera und KI — fotografiert die Aufgabe und zeigt die vollständige Lösung Schritt für Schritt auf dem OLED-Display. Mathe, Physik, Chemie, Biologie.</div></div>
      </div>

      <div className="section-title"><Px ico="gear" />Dane techniczne</div>
      <div className="spec">
        <div className="r"><span><Px ico="display" />Ekran / Display</span><b>OLED 256×64 px</b></div>
        <div className="r"><span><Px ico="camera" />Kamera / Camera</span><b>OV2640</b></div>
        <div className="r"><span><Px ico="battery" />Zasilanie / Power</span><b>Li-Po 3,7 V 1500 mAh · USB-C 5 V</b></div>
        <div className="r"><span><Px ico="wifi" />Łączność / Connectivity</span><b>WiFi 2,4 GHz</b></div>
        <div className="r"><span><Px ico="globe" />Języki / Languages</span><b>11 (PL EN DE CS SK LT…)</b></div>
      </div>

      <div className="ean">
        <Ean13 digits={PRODUCT_GTIN} h={60} />
        <div className="digits">{GTIN_TEXT}</div>
      </div>

      <div className="comp">
        <div className="marks">
          {/* Oficjalny znak CE (geometria z Conformite_Europeenne_(logo).svg, viewBox 280x200) */}
          <svg className="ce" viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
            <path d="M110,199.498744A100,100 0 0 1 100,200A100,100 0 0 1 100,0A100,100 0 0 1 110,0.501256L110,30.501256A70,70 0 0 0 100,30A70,70 0 0 0 100,170A70,70 0 0 0 110,169.498744Z" fill="#000" />
            <path d="M280,199.498744A100,100 0 0 1 270,200A100,100 0 0 1 270,0A100,100 0 0 1 280,0.501256L280,30.501256A70,70 0 0 0 270,30A70,70 0 0 0 201.620283,85L260,85L260,115L201.620283,115A70,70 0 0 0 270,170A70,70 0 0 0 280,169.498744Z" fill="#000" />
          </svg>
          <div className="rohs">RoHS</div>
          {/* Symbol WEEE (EN 50419): przekreslony kosz na kolkach z belka */}
          <svg className="weee" viewBox="0 0 40 44" xmlns="http://www.w3.org/2000/svg">
            <line x1="8.2" y1="6.4" x2="31.8" y2="6.4" stroke="#000" strokeWidth="2.4" />
            <rect x="17.4" y="3.6" width="5.2" height="2.4" fill="#000" />
            <path d="M10.2,7.6 L12.2,29.6 L27.8,29.6 L29.8,7.6" fill="none" stroke="#000" strokeWidth="2" />
            <circle cx="14.6" cy="31.6" r="2" fill="#000" />
            <circle cx="25.4" cy="31.6" r="2" fill="#000" />
            <line x1="4.8" y1="1.6" x2="35.2" y2="34.4" stroke="#000" strokeWidth="2.2" />
            <line x1="35.2" y1="1.6" x2="4.8" y2="34.4" stroke="#000" strokeWidth="2.2" />
            <rect x="5.6" y="38" width="28.8" height="4" fill="#000" />
          </svg>
        </div>
        <div className="info">
          <div className="model">KalkMate-ESP32S3-v1</div>
          <div>Seria / Batch: <b>PCB-v4-2026</b></div>
          <div>Producent / Manufacturer:</div>
          <div><b>KAJPA Kacper Popko</b></div>
          <div>ul. Zastawie I 37, 16-070 Choroszcz, PL</div>
          <div className="tags">
            <span className="chip">SN <span>{sn}</span></span>
            {hasName && <span className="chip out name">Dla: <span>{name}</span></span>}
            <span className="chip out">Made in Poland</span>
          </div>
        </div>
      </div>

      <div className="foot"><span>kalkmate.pl · kalkmate.eu</span><span>kontakt@kalkmate.pl</span></div>
    </div>
  );
}

/** Przod etykiety: hero, ekran urzadzenia, kroki, cechy, personalizacja.
 *  Bez zdjec produktu (po sprawie z Esperanza): tylko wlasna ikonografia,
 *  branding i zrzut ekranu z wlasnego firmware. */
export function ProductLabelFront({ name }: { name: string }) {
  const hasName = name.trim() !== "";
  const ref = useFit([name]);
  return (
    <div className="label front" ref={ref}>
      <div className="hero">
        <div className="word">KalkMate</div>
        <div className="tag">Kalkulator AI z kamerą</div>
      </div>

      <div className="device">
        {/* eslint-disable-next-line @next/next/no-img-element -- inline base64, bez optymalizacji */}
        <img alt="" src={SCREEN_PNG} />
      </div>

      <div className="steps">
        <div className="step"><div className="ic"><Px ico="camera" /></div><div className="t">Zdjęcie</div></div>
        <div className="chev">›</div>
        <div className="step"><div className="ic"><Px ico="cloud" /></div><div className="t">AI</div></div>
        <div className="chev">›</div>
        <div className="step"><div className="ic"><Px ico="check" /></div><div className="t">Rozwiązanie</div></div>
      </div>

      <div className="headline">Zrób zdjęcie.<br />Otrzymaj rozwiązanie.</div>

      {hasName && (
        <div className="persona">
          <div className="l">Personalizowany egzemplarz dla</div>
          <div className="n">{name}</div>
        </div>
      )}

      <div className="feats">
        <div className="feat"><Px ico="camera" /><div><b>Kamera + AI</b> — sfotografuj zadanie, reszta dzieje się sama</div></div>
        <div className="feat"><Px ico="display" /><div><b>Ekran OLED</b> — pełne rozwiązanie krok po kroku</div></div>
        <div className="feat"><Px ico="notes" /><div><b>Matematyka · Fizyka · Chemia · Biologia</b></div></div>
        <div className="feat"><Px ico="battery" /><div><b>Bateria 1500 mAh</b> — ładowanie USB-C</div></div>
      </div>

      <div className="bottom">
        <div className="m">11 języków · bez abonamentu</div>
        <div className="s">kalkmate.pl<br />kalkmate.eu</div>
      </div>
    </div>
  );
}
