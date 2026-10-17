'use strict';

// Status drukarki i wystawienie paragonu — port fiscal_agent/printer.py + models.py.
// Paragon: trinit -> trline… -> trpayment… -> trend; numer z licznika scnt.bn.
//
// NIEZMIENNIK (paragonu fiskalnego nie da się cofnąć): od chwili wysłania trend
// każdy wyjątek — także zły CRC odpowiedzi — kończy się numerem paragonu (licznik
// bn wzrósł dokładnie o 1) albo kategorią UNCERTAIN. Ponowienie (CONNECTION) albo
// błąd danych wolno zgłosić tylko po dowodzie, że paragon nie powstał:
// transakcja była otwarta -> prncancel -> to=0 i bn == przed.

const { PrinterError, AmbiguousCommand, Category, printerText, MECH_TEXT, DEVICE_TEXT } = require('./posnet');

const VAT_FIELDS = ['va', 'vb', 'vc', 'vd', 've', 'vf', 'vg']; // stawki A..G = indeksy 0..6
const VAT_RATES = new Set(['23', '8', '5', '0', 'zw']);
// trpayment.ty: 0 gotówka, 2 karta, 5 kredyt, 6 inna, 7 voucher (przelew/online = „inna”)
const PAYMENT_TY = { cash: 0, card: 2, voucher: 7, credit: 5, transfer: 6, other: 6 };
const PAYMENT_DEFAULT_NAME = { transfer: 'Przelew', other: 'Inna' };
// Bezpiecznik kwot w agencie — niezależny od walidacji na serwerze.
const DEFAULT_LIMITS = Object.freeze({ maxTotal: 400000, maxItems: 5, requireReference: true });

// --- walidacja zlecenia (jak pydantic w agencie Python) ----------------------------

function invalid(msg) {
  return new PrinterError(Category.INVALID, `Błędne dane paragonu: ${msg}`);
}

function qtyMilli(q) {
  const s = String(q ?? '1');
  if (!/^\d+(\.\d{1,3})?$/.test(s)) throw invalid(`ilość "${s}"`);
  const [i, f = ''] = s.split('.');
  const v = parseInt(i, 10) * 1000 + parseInt(f.padEnd(3, '0'), 10);
  if (v <= 0) throw invalid('ilość musi być > 0');
  return v;
}

/** Walidacja + teksty w stronie kodowej drukarki (transliteracja, bez cichych '?'). */
function normalizeReceipt(r, { encoding = 'cp1250' } = {}) {
  if (!r || !Array.isArray(r.items) || !r.items.length || r.items.length > 100) throw invalid('brak pozycji');
  if (!Array.isArray(r.payments) || !r.payments.length) throw invalid('brak płatności');
  const items = r.items.map((it) => {
    const name = printerText(it.name || '', 40, encoding);
    if (!name) throw invalid('pusta nazwa');
    if (!Number.isInteger(it.unit_price) || it.unit_price <= 0) throw invalid(`cena pozycji "${name}"`);
    if (!VAT_RATES.has(String(it.vat))) throw invalid(`stawka VAT "${it.vat}"`);
    const milli = qtyMilli(it.quantity);
    const gross = Math.floor((milli * it.unit_price + 500) / 1000); // ROUND_HALF_UP
    const discount = it.discount || 0;
    if (!Number.isInteger(discount) || discount < 0 || discount >= gross) throw invalid(`rabat pozycji "${name}"`);
    return { name, vat: String(it.vat), unit_price: it.unit_price, quantity: String(it.quantity ?? '1'), gross, discount,
             description: it.description ? printerText(it.description, 35, encoding) : null };
  });
  const payments = r.payments.map((p) => {
    if (!(p.type in PAYMENT_TY)) throw invalid(`forma płatności "${p.type}"`);
    if (!Number.isInteger(p.amount) || p.amount <= 0) throw invalid('kwota płatności');
    const name = p.name || PAYMENT_DEFAULT_NAME[p.type] || null;
    return { type: p.type, amount: p.amount, name: name ? printerText(name, 25, encoding) : null };
  });
  const total = items.reduce((s, i) => s + i.gross - i.discount, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (paid < total) throw invalid(`płatności (${paid}) nie pokrywają sumy (${total})`);
  if (payments.filter((p) => p.type !== 'cash').reduce((s, p) => s + p.amount, 0) > total) {
    throw invalid('nadpłata możliwa tylko gotówką');
  }
  return { items, payments, total, paid, reference: r.reference == null ? null : String(r.reference) };
}

function checkLimits(rec, limits = DEFAULT_LIMITS) {
  const l = { ...DEFAULT_LIMITS, ...limits };
  const amount = Math.max(rec.total, rec.paid);
  if (amount > l.maxTotal) {
    throw new PrinterError(Category.INVALID, `Kwota paragonu (${(amount / 100).toFixed(2)} zł) przekracza limit agenta ${(l.maxTotal / 100).toFixed(2)} zł — nie drukuję.`);
  }
  if (rec.items.length > l.maxItems) {
    throw new PrinterError(Category.INVALID, `Paragon ma ${rec.items.length} pozycji, limit agenta to ${l.maxItems} — nie drukuję.`);
  }
  if (l.requireReference && !String(rec.reference ?? '').trim()) {
    throw new PrinterError(Category.INVALID, 'Zlecenie bez pola reference (np. numeru zamówienia) — nie drukuję.');
  }
}

function buildCommands(rec, vat) {
  const cmds = [['trinit', [['bm', '1']]]];
  for (const it of rec.items) {
    if (!(it.vat in vat)) {
      throw new PrinterError(Category.INVALID, `Drukarka nie ma aktywnej stawki VAT ${it.vat}${it.vat === 'zw' ? '' : '%'} (dostępne: ${Object.keys(vat).join(', ') || 'brak'})`);
    }
    const p = [['na', it.name], ['vt', String(vat[it.vat])], ['pr', String(it.unit_price)],
               ['il', it.quantity], ['wa', String(it.gross)]];
    if (it.discount) p.push(['rw', String(it.discount)], ['rn', 'Rabat']);
    if (it.description) p.push(['op', it.description]);
    cmds.push(['trline', p]);
  }
  const change = rec.paid - rec.total;
  for (const pay of rec.payments) {
    const p = [['ty', String(PAYMENT_TY[pay.type])], ['wa', String(pay.amount)]];
    if (pay.name) p.push(['na', pay.name]);
    cmds.push(['trpayment', p]);
  }
  if (change) cmds.push(['trpayment', [['ty', '0'], ['wa', String(change)], ['re', '1']]]);
  const end = [['to', String(rec.total)], ['fp', String(rec.paid)]];
  if (change) end.push(['re', String(change)]);
  cmds.push(['trend', end]);
  return cmds;
}

// --- parsowanie odpowiedzi ------------------------------------------------------------

const TRUE = new Set(['1', 'T', 'Y', 'TRUE']);
const FALSE = new Set(['0', 'N', 'F', 'FALSE']);

/** Jedyny parser flag POSNET (scomm.fs, strns.to): true/false, null = brak/nieznana wartość. */
function parseFlag(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (TRUE.has(s)) return true;
  if (FALSE.has(s)) return false;
  return null;
}

function flag(resp, name, command) {
  const v = parseFlag(resp.fields[name]);
  if (v == null) throw new PrinterError(Category.PROTOCOL, `Nieznana wartość pola ${name} w odpowiedzi na ${command}: ${JSON.stringify(resp.fields[name] ?? null)}`, null, command);
  return v;
}

const asInt = (v) => (/^\d+$/.test(String(v ?? '').trim()) ? parseInt(String(v).trim(), 10) : null);

function intField(resp, name, command, dflt = null) {
  const raw = resp.fields[name];
  if (raw == null || String(raw).trim() === '') {
    if (dflt != null) return dflt;
    throw new PrinterError(Category.PROTOCOL, `Brak pola ${name} w odpowiedzi na ${command}`, null, command);
  }
  const v = asInt(raw);
  if (v == null) throw new PrinterError(Category.PROTOCOL, `Nieczytelne pole ${name} w odpowiedzi na ${command}: ${JSON.stringify(raw)}`, null, command);
  return v;
}

const uncertain = (msg) => new PrinterError(Category.UNCERTAIN, `${msg} Sprawdź drukarkę i kopię elektroniczną, potem rozstrzygnij ręcznie.`);

// --- drukarka ---------------------------------------------------------------------

/** Jedna operacja na drukarce naraz — wspólna dla kolejnych instancji Printer (zmiana ustawień w trakcie druku). */
class Mutex {
  constructor() { this._last = Promise.resolve(); }
  run(fn) {
    const run = this._last.then(fn, fn);
    this._last = run.catch(() => {});
    return run;
  }
}

class Printer {
  constructor(client, { allowFiscal = false, limits = DEFAULT_LIMITS, mutex = null } = {}) {
    this.client = client;
    this.allowFiscal = allowFiscal;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.mutex = mutex || new Mutex();
  }

  // Jedna operacja na drukarce naraz (status z panelu vs. druk z kolejki).
  _exclusive(fn) {
    return this.mutex.run(fn);
  }

  status() {
    return this._exclusive(async () => {
      try {
        return await this._status();
      } catch (e) {
        return { online: false, ready: false, error: e.message, description: e.message };
      } finally {
        this.client.close();
      }
    });
  }

  async _status() {
    const c = this.client;
    const sid = await c.call('sid');
    const dev = await c.call('sdev');
    const prn = await c.call('sprn');
    const comm = await c.call('scomm');
    const trns = await c.call('strns');
    const cnt = await c.call('scnt');
    const fiscal = parseFlag(comm.fields.fs);
    const st = {
      online: true,
      model: sid.fields.nm || null,
      version: sid.fields.vr || null,
      // Bezpiecznik: brak/nieznana wartość fs = drukarka FISKALNA.
      fiscal: fiscal == null ? true : fiscal,
      fiscal_unknown: fiscal == null,
      device_state: intField(dev, 'ds', 'sdev', 0),
      mechanism: intField(prn, 'pr', 'sprn', 0),
      transaction_open: flag(trns, 'to', 'strns'),
      last_receipt: asInt(cnt.fields.bn),
      error: null,
    };
    st.ready = st.device_state === 0 && st.mechanism === 0;
    const mode = st.fiscal_unknown ? 'tryb nieznany (traktowany jak FISKALNY)' : st.fiscal ? 'tryb FISKALNY' : 'tryb niefiskalny (szkoleniowy)';
    const parts = [`${st.model || '?'} ${st.version || ''}`.trim(), mode];
    if (st.device_state) parts.push(DEVICE_TEXT[st.device_state] || `stan ${st.device_state}`);
    if (st.mechanism) parts.push(MECH_TEXT[st.mechanism] || `mechanizm ${st.mechanism}`);
    st.description = parts.join(', ');
    return st;
  }

  async _vatMap() {
    const resp = await this.client.call('vatget');
    const out = {};
    VAT_FIELDS.forEach((fld, idx) => {
      if (!(fld in resp.fields)) return;
      const rate = parseFloat(resp.fields[fld].replace(',', '.'));
      if (rate === 101) return; // nieaktywna
      const key = rate === 100 ? 'zw' : String(rate);
      if (!(key in out)) out[key] = idx;
    });
    return out;
  }

  async _readBn() {
    return intField(await this.client.call('scnt'), 'bn', 'scnt');
  }

  /** { open, bn } — ścisłe parsowanie, bez wartości domyślnych. */
  async _readState() {
    const open = flag(await this.client.call('strns'), 'to', 'strns');
    return { open, bn: await this._readBn() };
  }

  /** Drukuje paragon, zwraca numer. Rzuca PrinterError. */
  printReceipt(receipt) {
    return this._exclusive(async () => {
      try {
        // Walidacja PRZED połączeniem z drukarką: dane, teksty w stronie kodowej, limity.
        const rec = normalizeReceipt(receipt, { encoding: this.client.encoding });
        checkLimits(rec, this.limits);
        return await this._print(rec);
      } finally {
        this.client.close();
      }
    });
  }

  // Przed trinit nic nie zostało wydrukowane: zerwane łącze / nieczytelna odpowiedź = ponowienie.
  async _beforeTrinit(fn) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof AmbiguousCommand) {
        throw new PrinterError(Category.CONNECTION, `Brak odpowiedzi drukarki przed rozpoczęciem paragonu (${e.message}); nic nie wydrukowano, zlecenie zostanie ponowione.`);
      }
      if (e instanceof PrinterError && e.garbled) {
        throw new PrinterError(Category.CONNECTION, `${e.message} — przed rozpoczęciem paragonu, zlecenie zostanie ponowione.`, null, e.command);
      }
      throw e;
    }
  }

  // Status, bezpieczniki, sprzątanie po przerwanej próbie. Zwraca licznik bn przed paragonem.
  async _prepare() {
    const c = this.client;
    const st = await this._status();
    if (st.mechanism) throw new PrinterError(Category.PAPER, 'Drukarka: ' + (MECH_TEXT[st.mechanism] || st.mechanism));
    if (st.device_state) throw new PrinterError(Category.BUSY, 'Drukarka zajęta: ' + (DEVICE_TEXT[st.device_state] || st.device_state));
    if (st.fiscal && !this.allowFiscal) {
      const why = st.fiscal_unknown ? 'nie zgłasza trybu pracy (traktuję jak FISKALNĄ)' : 'jest w trybie FISKALNYM';
      const err = new PrinterError(Category.FISCAL, `Drukarka ${why}, a druk fiskalny jest wyłączony w ustawieniach aplikacji (włącz go dopiero po testach na urządzeniu niefiskalnym).`);
      err.safetyBlock = true; // zlecenie czeka, aż włączysz druk fiskalny
      throw err;
    }
    if (st.transaction_open) {
      await c.call('prncancel'); // otwarta transakcja z poprzedniej, przerwanej próby (trend nie wykonany)
      const { open, bn } = await this._readState();
      if (open) throw new PrinterError(Category.BUSY, 'Nie udało się anulować otwartej transakcji w drukarce.');
      return bn;
    }
    if (st.last_receipt == null) {
      throw new PrinterError(Category.PROTOCOL, 'Drukarka nie podała licznika paragonów (scnt.bn) — bez niego nie da się potwierdzić wydruku, nie drukuję.', null, 'scnt');
    }
    return st.last_receipt;
  }

  async _print(rec) {
    const before = await this._beforeTrinit(() => this._prepare());
    const vat = await this._beforeTrinit(() => this._vatMap());
    const cmds = buildCommands(rec, vat);
    await this._sendBody(cmds.slice(0, -1));
    return this._end(cmds[cmds.length - 1], before);
  }

  // trinit, trline…, trpayment… — bez trend nie ma paragonu, więc każdy błąd = anuluj.
  async _sendBody(body) {
    try {
      for (const [cmd, params] of body) await this.client.call(cmd, params);
    } catch (e) {
      await this._cancelQuietly();
      if (e instanceof AmbiguousCommand || (e instanceof PrinterError && e.garbled)) {
        throw new PrinterError(Category.CONNECTION, `Zerwane połączenie w trakcie paragonu (${e.message}); transakcja anulowana, zlecenie zostanie ponowione.`);
      }
      if (e instanceof PrinterError) throw e;
      throw new PrinterError(Category.INTERNAL, `Nieoczekiwany błąd przed zakończeniem paragonu: ${e.message}; transakcja anulowana.`);
    }
  }

  async _end([cmd, params], before) {
    try {
      await this.client.call(cmd, params);
    } catch (e) {
      return this._resolveAfterEnd(before, e); // także zły CRC odpowiedzi i zerwane łącze
    }
    // Drukarka potwierdziła trend: paragon jest. Zostaje tylko jego numer.
    let number;
    try {
      number = await this._readBn();
    } catch (e) {
      try {
        await this.client.connect();
        number = await this._readBn();
      } catch (e2) {
        throw uncertain(`Drukarka potwierdziła zakończenie paragonu, ale nie udało się odczytać jego numeru (${e.message}; ${e2.message}). Paragon NAJPRAWDOPODOBNIEJ jest wydrukowany.`);
      }
    }
    if (number !== before + 1) {
      throw uncertain(`Licznik paragonów po trend: ${number}, oczekiwano ${before + 1} (przed: ${before}) — nie wiadomo, który paragon należy do zlecenia.`);
    }
    return number;
  }

  async _cancelQuietly() {
    try {
      if (parseFlag((await this.client.call('strns')).fields.to) !== false) await this.client.call('prncancel');
    } catch (_) { /* anulowanie to najlepsza próba */ }
  }

  // trend wysłany, odpowiedzi brak albo jest błędna — sprawdzamy, czy paragon powstał.
  async _resolveAfterEnd(before, err) {
    // Drukarka czytelnie odpowiedziała błędem na NASZ trend (kod w poprawnej ramce).
    const explicit = err instanceof PrinterError && err.code != null;
    let proven = false;
    let bn = null;
    try {
      await this.client.connect(); // świeże połączenie: po błędzie ramki strumień mógł się rozjechać
      let st = await this._readState();
      bn = st.bn;
      if (st.bn === before + 1) return st.bn;
      if (st.open && st.bn === before) {
        // Transakcja dalej otwarta = trend nie został wykonany. Anulujemy i sprawdzamy.
        await this.client.call('prncancel');
        st = await this._readState();
        bn = st.bn;
        proven = !st.open && st.bn === before;
      }
    } catch (e) {
      throw uncertain(`Nie wiadomo, czy paragon został wydrukowany (po wysłaniu trend: ${err.message}; sprawdzenie stanu nie powiodło się: ${e.message}).`);
    }
    if (proven) {
      if (explicit) throw err; // np. błąd sumy — dane do poprawy, nic nie wydrukowano
      throw new PrinterError(Category.CONNECTION, 'trend nie został wykonany (transakcja była otwarta, anulowana, licznik bez zmian); zlecenie zostanie ponowione.');
    }
    throw uncertain(`Po błędzie trend (${err.message}) licznik paragonów = ${bn} (przed: ${before}), a transakcji nie dało się jednoznacznie rozstrzygnąć.`);
  }
}

module.exports = { Printer, Mutex, normalizeReceipt, checkLimits, buildCommands, parseFlag, DEFAULT_LIMITS };
