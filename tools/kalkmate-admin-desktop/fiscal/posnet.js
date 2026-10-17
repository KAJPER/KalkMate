'use strict';

// Protokół POSNET dla drukarek fiskalnych — port fiscal-agent/fiscal_agent/posnet
// (Python) do Node, żeby agent działał w aplikacji bez instalowania Pythona.
// Źródło: „Specyfikacja protokołu POSNET” DBC-I-DEV-45 v021 (opis w
// docs/fiskalizacja/README.md).
//
//   STX cmd TAB pp<wartość> TAB … [@TOKEN TAB] #CRC16 ETX
//   CRC16-CCITT (XMODEM: poly 0x1021, init 0) z bajtów między STX a '#', hex.

const net = require('net');
const iconv = require('iconv-lite');

const STX = 0x02;
const ETX = 0x03;
const FORBIDDEN = /[\x02\x03\t\r\n]/;

function crc16(buf) {
  let crc = 0;
  for (const b of buf) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

// Usuwa znaki sterujące ramki z tekstu; '#' zamieniamy, bo drukarka szuka po nim sumy.
function cleanText(value, maxLen) {
  const out = String(value).replace(/[\x02\x03\t\r\n]/g, ' ').replace(/#/g, 'nr ').split(/\s+/).filter(Boolean).join(' ');
  return maxLen ? out.slice(0, maxLen) : out;
}

// Znaki typograficzne, których często nie ma w stronie kodowej drukarki
// (ISO-8859-2 nie ma półpauzy ani cudzysłowów „”). Ta sama tabela co TRANSLIT
// w fiscal-agent/fiscal_agent/posnet/frame.py.
const TRANSLIT = {
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-', '−': '-',
  '„': '"', '“': '"', '”': '"', '«': '"', '»': '"',
  '‘': "'", '’': "'", '‚': "'", '‹': "'", '›': "'",
  '…': '...', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
  '€': 'EUR', '×': 'x', '•': '*', '·': '*',
};

// iconv-lite po cichu wstawia '?' w miejsce znaku spoza strony kodowej —
// bezstratność sprawdzamy kodując i dekodując z powrotem.
function encodable(text, encoding) {
  return iconv.decode(iconv.encode(text, encoding), encoding) === text;
}

/**
 * Tekst do pola drukarki (nazwa towaru, płatności): bez znaków sterujących, w
 * stronie kodowej drukarki. Znaki spoza niej transliterujemy (– → -, ñ → n);
 * jeśli się nie da (np. emoji) — PrinterError INVALID, zanim cokolwiek pójdzie
 * do drukarki.
 */
function printerText(value, maxLen, encoding = 'cp1250') {
  if (!iconv.encodingExists(encoding)) {
    throw new PrinterError(Category.INVALID, `Nieznana strona kodowa drukarki "${encoding}"`);
  }
  let out = '';
  for (const ch of cleanText(value)) {
    if (encodable(ch, encoding)) { out += ch; continue; }
    let alt = TRANSLIT[ch];
    if (alt == null) alt = ch.normalize('NFKD').replace(/\p{M}/gu, '');
    if (alt && encodable(alt, encoding)) { out += alt; continue; }
    const cp = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    throw new PrinterError(Category.INVALID, `Błędne dane paragonu: znak "${ch}" (U+${cp}) w tekście "${value}" `
      + `nie istnieje w stronie kodowej drukarki ${encoding} i nie ma zamiennika`);
  }
  out = out.split(/\s+/).filter(Boolean).join(' ');
  return maxLen ? out.slice(0, maxLen) : out;
}

function encode(command, params = [], token = null, encoding = 'cp1250') {
  const parts = [command];
  for (const [name, value] of params) {
    if (name.length !== 2) throw new Error(`mnemonik parametru musi mieć 2 znaki: ${name}`);
    if (FORBIDDEN.test(value)) throw new Error(`niedozwolony znak w polu ${name}`);
    parts.push(name + value);
  }
  if (token != null) parts.push('@' + String(token).padStart(4, '0'));
  const text = parts.join('\t') + '\t';
  const body = iconv.encode(text, encoding);
  if (iconv.decode(body, encoding) !== text) {
    // Ostatnia linia obrony: bez tego iconv wysłałby '?' zamiast znaku.
    throw new PrinterError(Category.INVALID, `Rozkaz ${command} zawiera znak spoza strony kodowej ${encoding}`, null, command);
  }
  const crc = crc16(body).toString(16).toUpperCase().padStart(4, '0');
  return Buffer.concat([Buffer.from([STX]), body, Buffer.from('#' + crc, 'ascii'), Buffer.from([ETX])]);
}

class FrameError extends Error {}

function decode(frame, encoding = 'cp1250') {
  if (frame.length < 8 || frame[0] !== STX || frame[frame.length - 1] !== ETX) throw new FrameError('brak STX/ETX');
  const hashPos = frame.lastIndexOf(0x23); // '#'
  if (hashPos < 1) throw new FrameError('brak sumy kontrolnej');
  const body = frame.subarray(1, hashPos);
  const crcRx = parseInt(frame.subarray(hashPos + 1, frame.length - 1).toString('ascii'), 16);
  if (Number.isNaN(crcRx) || crcRx !== crc16(body)) throw new FrameError('zła suma kontrolna');
  const items = iconv.decode(body, encoding).split('\t').filter((p) => p !== '');
  if (!items.length) throw new FrameError('pusta ramka');
  const resp = { command: items[0], fields: {}, token: null, error: null, frameError: items[0] === 'ERR' };
  for (const item of items.slice(1)) {
    if (/^@\d+$/.test(item)) resp.token = parseInt(item.slice(1), 10);
    else if (/^\?\d+$/.test(item)) resp.error = parseInt(item.slice(1), 10);
    else if (resp.frameError && /^er\d+$/.test(item)) resp.error = parseInt(item.slice(2), 10);
    else if (item.length >= 2) resp.fields[item.slice(0, 2)] = item.slice(2);
  }
  resp.ok = resp.error == null && !resp.frameError;
  return resp;
}

class FrameReader {
  constructor() { this.buf = Buffer.alloc(0); }
  feed(data) {
    this.buf = Buffer.concat([this.buf, data]);
    const frames = [];
    for (;;) {
      const start = this.buf.indexOf(STX);
      if (start < 0) { this.buf = Buffer.alloc(0); return frames; }
      const end = this.buf.indexOf(ETX, start + 1);
      if (end < 0) { this.buf = this.buf.subarray(start); return frames; }
      frames.push(Buffer.from(this.buf.subarray(start, end + 1)));
      this.buf = this.buf.subarray(end + 1);
    }
  }
}

// --- błędy --------------------------------------------------------------------
// Kody: DBC-I-DEV-45 „Opisy błędów”. Kategorie (ponów / człowiek) są nasze.
const Category = {
  CONNECTION: 'connection', BUSY: 'busy', PAPER: 'paper', FISCAL: 'fiscal',
  INVALID: 'invalid', PROTOCOL: 'protocol', UNCERTAIN: 'uncertain', INTERNAL: 'internal',
};
const RETRYABLE = new Set([Category.CONNECTION, Category.BUSY, Category.PAPER]);

const ERROR_TEXT = {
  1: 'Nierozpoznana komenda', 2: 'Brak obowiązkowego pola', 3: 'Błąd konwersji pola', 5: 'Zła suma kontrolna',
  11: 'Zapełniony bufor odbiorczy', 13: 'Nie znaleziono rozkazu o podanym tokenie', 14: 'Zapełniona kolejka wejściowa',
  15: 'Błąd budowy ramki', 323: 'Funkcja zablokowana w konfiguracji', 383: 'Brak raportu dobowego',
  484: 'Minął czas pracy kasy, sprzedaż zablokowana', 1950: 'Przekroczony zakres totalizerów paragonu',
  2000: 'Błąd pola VAT', 2002: 'Brak nagłówka', 2004: 'Brak aktywnych stawek VAT', 2005: 'Brak trybu transakcji',
  2006: 'Błąd pola cena (cena <= 0)', 2007: 'Błąd pola ilość (ilość <= 0)', 2008: 'Błąd kwoty total',
  2010: 'Przekroczony zakres totalizerów dobowych', 2034: 'Urządzenie w trybie niefiskalnym',
  2036: 'Urządzenie w stanie tylko do odczytu', 2038: 'Urządzenie w trybie transakcji',
  2041: 'Próba zakończenia paragonu z wartością 0', 2052: 'Brak pamięci w buforze transakcji',
  2054: 'Formy płatności nie pokrywają kwoty do zapłaty lub reszty', 2055: 'Błędna linia',
  2060: 'Błędny stan transakcji', 2062: 'Jest wydrukowana część jakiegoś dokumentu', 2063: 'Błąd parametru',
  2103: 'Nieprawidłowa stawka VAT', 2104: 'Błąd nazwy', 2106: 'Towar zablokowany w bazie drukarkowej',
  2701: 'Błąd identyfikatora stawki podatkowej', 2704: 'Zbyt słaby akumulator',
  2705: 'Błędny identyfikator typu formy płatności', 2802: 'Błąd weryfikacji wartości linii sprzedaży',
  2805: 'Błąd weryfikacji wartości fiskalnej', 2808: 'Błąd weryfikacji wartości form płatności',
  2900: 'Stan kopii elektronicznej nie pozwala na wydruk', 2901: 'Brak nośnika kopii elektronicznej lub operacja trwa',
};
const BUSY_CODES = new Set([11, 14, 2038, 2062, 2901]);
const FISCAL_CODES = new Set([323, 383, 484, 1950, 2002, 2004, 2010, 2036, 2052, 2704, 2900]);
const PROTOCOL_CODES = new Set([1, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15]);

const MECH_TEXT = {
  0: 'brak błędu', 1: 'podniesiona dźwignia', 2: 'brak dostępu do mechanizmu', 3: 'podniesiona pokrywa',
  4: 'brak papieru – kopia', 5: 'brak papieru – oryginał', 6: 'nieodpowiednia temperatura lub zasilanie',
  7: 'chwilowy zanik zasilania', 8: 'błąd obcinacza', 9: 'błąd zasilacza', 10: 'podniesiona pokrywa przy obcinaniu',
};
const DEVICE_TEXT = {
  0: 'gotowość', 1: 'w menu', 2: 'oczekiwanie na klawisz', 3: 'oczekiwanie na reakcję użytkownika (wystąpił błąd)',
};

function classifyCode(code, frameError) {
  if (frameError || PROTOCOL_CODES.has(code)) return Category.PROTOCOL;
  if (BUSY_CODES.has(code)) return Category.BUSY;
  if (FISCAL_CODES.has(code) || (code >= 1000 && code < 1100)) return Category.FISCAL;
  return Category.INVALID;
}

class PrinterError extends Error {
  constructor(category, message, code = null, command = null, { garbled = false } = {}) {
    super(message);
    this.category = category;
    this.code = code;
    this.command = command;
    // Odpowiedź nieczytelna (zły CRC / rozjechana ramka) — błąd łącza, a nie
    // odpowiedź drukarki. Przed trend = ponowienie, po trend = sprawdzenie licznika.
    this.garbled = garbled;
  }
  get retryable() { return RETRYABLE.has(this.category); }
  static fromCode(code, command, frameError = false) {
    const text = ERROR_TEXT[code] || 'błąd drukarki';
    return new PrinterError(classifyCode(code, frameError), `${frameError ? 'Błąd ramki' : 'Błąd'} ${code} (${command}): ${text}`, code, command);
  }
}

class AmbiguousCommand extends Error {
  constructor(command, token) {
    super(`brak odpowiedzi na ${command} (token ${token})`);
    this.command = command;
    this.token = token;
  }
}

class ConnectionLost extends Error {}

// --- tokeny ------------------------------------------------------------------------
const TOKEN_MAX = 9999; // token to 4 cyfry; 0 pomijamy
const wrapToken = (n) => ((((Math.trunc(n) - 1) % TOKEN_MAX) + TOKEN_MAX) % TOKEN_MAX) + 1;
const randomToken = () => 1 + Math.floor(Math.random() * TOKEN_MAX);

/** Tokeny w pamięci (testy, narzędzia jednorazowe). */
function memoryTokens(start) {
  let next = wrapToken(start || randomToken());
  return () => { const t = next; next = wrapToken(t + 1); return t; };
}

/**
 * Tokeny rosnące także między restartami aplikacji. Losowy początek po restarcie
 * mógł trafić na token, którego odpowiedź na INNY rozkaz wciąż leży w buforze
 * drukarki — wtedy rpt oddałby cudzą odpowiedź. Rezerwujemy bloki tokenów i
 * zapisujemy koniec bloku; po restarcie zaczynamy za nim. Błąd zapisu nie
 * blokuje druku (tylko log) — weryfikacja resp.command w rpt łapie resztę.
 */
function persistentTokens({ load, save, block = 32, log = () => {} }) {
  let start = null;
  try { start = load(); } catch (e) { log('[fiscal] odczyt licznika tokenów:', e.message || e); }
  let next = Number.isInteger(start) && start > 0 ? wrapToken(start) : randomToken();
  let left = 0;
  return () => {
    if (left <= 0) {
      try { save(wrapToken(next + block)); } catch (e) { log('[fiscal] zapis licznika tokenów:', e.message || e); }
      left = block;
    }
    const t = next;
    next = wrapToken(t + 1);
    left -= 1;
    return t;
  };
}

// --- klient TCP ------------------------------------------------------------------
// Każdy rozkaz ma token. Gdy połączenie zerwie się po wysłaniu, łączymy się
// ponownie i prosimy drukarkę rozkazem `rpt` o powtórzenie odpowiedzi.
class PosnetClient {
  constructor({ host, port, timeout = 15000, connectTimeout = 5000, encoding = 'cp1250', tokenSource = null }) {
    Object.assign(this, { host, port, timeout, connectTimeout, encoding });
    this.sock = null;
    this.frames = [];
    this.waiter = null;
    this.tokenSource = tokenSource || memoryTokens();
  }

  connect() {
    this.close();
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port });
      const reader = new FrameReader();
      const timer = setTimeout(() => {
        sock.destroy();
        reject(new PrinterError(Category.CONNECTION, `Brak połączenia z drukarką ${this.host}:${this.port} (timeout)`));
      }, this.connectTimeout);
      sock.once('connect', () => {
        clearTimeout(timer);
        sock.setKeepAlive(true, 10000);
        this.sock = sock;
        this.frames = [];
        resolve();
      });
      sock.on('data', (d) => { this.frames.push(...reader.feed(d)); this._wake(); });
      sock.on('close', () => { if (this.sock === sock) this.sock = null; this._wake(); });
      sock.on('error', (e) => {
        clearTimeout(timer);
        if (!this.sock) reject(new PrinterError(Category.CONNECTION, `Brak połączenia z drukarką ${this.host}:${this.port} (${e.code || e.message})`));
      });
    });
  }

  close() {
    if (this.sock) { this.sock.destroy(); this.sock = null; }
  }

  _wake() {
    if (this.waiter) { const w = this.waiter; this.waiter = null; w(); }
  }

  async _readFrame(sock) {
    const deadline = Date.now() + this.timeout;
    while (!this.frames.length) {
      if (sock.destroyed) throw new ConnectionLost('drukarka zamknęła połączenie');
      const left = deadline - Date.now();
      if (left <= 0) throw new ConnectionLost('timeout odpowiedzi');
      await new Promise((resolve) => {
        const t = setTimeout(resolve, left);
        this.waiter = () => { clearTimeout(t); resolve(); };
      });
    }
    return decode(this.frames.shift(), this.encoding);
  }

  async _exchange(frame, token) {
    if (!this.sock) await this.connect();
    const sock = this.sock;
    sock.write(frame);
    for (;;) {
      const resp = await this._readFrame(sock);
      if (resp.token == null || resp.token === token) return resp;
      // spóźniona odpowiedź z innym tokenem (np. po poprzednim zerwaniu) — pomijamy
    }
  }

  _token() {
    return wrapToken(Number(this.tokenSource()));
  }

  async raw(command, params = []) {
    const token = this._token();
    let frame;
    try {
      // Kodowanie PRZED wysłaniem: znak spoza strony kodowej nie może przerwać
      // transakcji w połowie (nic jeszcze nie wyszło do drukarki).
      frame = encode(command, params, token, this.encoding);
    } catch (e) {
      if (e instanceof PrinterError) throw e;
      throw new PrinterError(Category.INVALID, `Nie da się zakodować rozkazu ${command}: ${e.message}`, null, command);
    }
    try {
      return await this._exchange(frame, token);
    } catch (e) {
      if (e instanceof FrameError) {
        throw new PrinterError(Category.PROTOCOL, `Nieczytelna odpowiedź na ${command}: ${e.message}`, null, command, { garbled: true });
      }
      if (e instanceof PrinterError) throw e; // nie udało się połączyć — rozkaz nie wyszedł
      // Zerwane po wysłaniu: rozkaz mógł dojść. Pytamy drukarkę o odpowiedź.
      let resp;
      try {
        await this.connect();
        resp = await this._exchange(encode('rpt', [], token, this.encoding), token);
      } catch (_) {
        throw new AmbiguousCommand(command, token);
      }
      if (resp.frameError) {
        // 13: drukarka nie zna tokenu; inny błąd ramki bez naszego cm dotyczy samego rpt.
        if (resp.error === 13 || resp.fields.cm !== command) throw new AmbiguousCommand(command, token);
        return resp; // błąd ramki zgłoszony dla NASZEGO rozkazu — nie został wykonany
      }
      const bare = (c) => String(c || '').replace(/^!/, '');
      // Token trafił na odpowiedź innego rozkazu — nie wolno jej użyć.
      if (bare(resp.command) !== bare(command)) throw new AmbiguousCommand(command, token);
      return resp;
    }
  }

  async call(command, params = []) {
    const resp = await this.raw(command, params);
    if (!resp.ok) throw PrinterError.fromCode(resp.error || 0, command, resp.frameError);
    return resp;
  }
}

module.exports = {
  crc16, cleanText, printerText, TRANSLIT, encode, decode, FrameReader, FrameError, PosnetClient, PrinterError,
  AmbiguousCommand, Category, MECH_TEXT, DEVICE_TEXT, memoryTokens, persistentTokens, wrapToken,
};
