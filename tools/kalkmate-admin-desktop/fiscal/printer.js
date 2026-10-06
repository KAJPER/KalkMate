'use strict';

// Status drukarki i wystawienie paragonu — port fiscal_agent/printer.py + models.py.
// Paragon: trinit -> trline… -> trpayment… -> trend; numer z licznika scnt.bn.

const { PrinterError, AmbiguousCommand, Category, cleanText, MECH_TEXT, DEVICE_TEXT } = require('./posnet');

const VAT_FIELDS = ['va', 'vb', 'vc', 'vd', 've', 'vf', 'vg']; // stawki A..G = indeksy 0..6
const VAT_RATES = new Set(['23', '8', '5', '0', 'zw']);
// trpayment.ty: 0 gotówka, 2 karta, 5 kredyt, 6 inna, 7 voucher (przelew/online = „inna”)
const PAYMENT_TY = { cash: 0, card: 2, voucher: 7, credit: 5, transfer: 6, other: 6 };
const PAYMENT_DEFAULT_NAME = { transfer: 'Przelew', other: 'Inna' };

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

function normalizeReceipt(r) {
  if (!r || !Array.isArray(r.items) || !r.items.length || r.items.length > 100) throw invalid('brak pozycji');
  if (!Array.isArray(r.payments) || !r.payments.length) throw invalid('brak płatności');
  const items = r.items.map((it) => {
    const name = cleanText(it.name || '', 40);
    if (!name) throw invalid('pusta nazwa');
    if (!Number.isInteger(it.unit_price) || it.unit_price <= 0) throw invalid(`cena pozycji "${name}"`);
    if (!VAT_RATES.has(String(it.vat))) throw invalid(`stawka VAT "${it.vat}"`);
    const milli = qtyMilli(it.quantity);
    const gross = Math.floor((milli * it.unit_price + 500) / 1000); // ROUND_HALF_UP
    const discount = it.discount || 0;
    if (!Number.isInteger(discount) || discount < 0 || discount >= gross) throw invalid(`rabat pozycji "${name}"`);
    return { name, vat: String(it.vat), unit_price: it.unit_price, quantity: String(it.quantity ?? '1'), gross, discount,
             description: it.description ? cleanText(it.description, 35) : null };
  });
  const payments = r.payments.map((p) => {
    if (!(p.type in PAYMENT_TY)) throw invalid(`forma płatności "${p.type}"`);
    if (!Number.isInteger(p.amount) || p.amount <= 0) throw invalid('kwota płatności');
    return { type: p.type, amount: p.amount, name: p.name ? cleanText(p.name, 25) : PAYMENT_DEFAULT_NAME[p.type] || null };
  });
  const total = items.reduce((s, i) => s + i.gross - i.discount, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (paid < total) throw invalid(`płatności (${paid}) nie pokrywają sumy (${total})`);
  if (payments.filter((p) => p.type !== 'cash').reduce((s, p) => s + p.amount, 0) > total) {
    throw invalid('nadpłata możliwa tylko gotówką');
  }
  return { items, payments, total, paid };
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

// --- drukarka ---------------------------------------------------------------------

const asBool = (v) => ['1', 'T', 'Y'].includes(String(v || '').trim().toUpperCase());
const asInt = (v) => (/^\d+$/.test(String(v || '')) ? parseInt(v, 10) : null);

class Printer {
  constructor(client, { allowFiscal = false } = {}) {
    this.client = client;
    this.allowFiscal = allowFiscal;
    this._lock = Promise.resolve();
  }

  // Jedna operacja na drukarce naraz (status z panelu vs. druk z kolejki).
  _exclusive(fn) {
    const run = this._lock.then(fn, fn);
    this._lock = run.catch(() => {});
    return run;
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
    const st = {
      online: true,
      model: sid.fields.nm || null,
      version: sid.fields.vr || null,
      fiscal: asBool(comm.fields.fs),
      device_state: asInt(dev.fields.ds) ?? 0,
      mechanism: asInt(prn.fields.pr) ?? 0,
      transaction_open: trns.fields.to === '1',
      last_receipt: asInt(cnt.fields.bn),
      error: null,
    };
    st.ready = st.device_state === 0 && st.mechanism === 0;
    const parts = [`${st.model || '?'} ${st.version || ''}`.trim(), st.fiscal ? 'tryb FISKALNY' : 'tryb niefiskalny (szkoleniowy)'];
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

  /** Drukuje paragon, zwraca numer. Rzuca PrinterError. */
  printReceipt(receipt) {
    return this._exclusive(async () => {
      try {
        return await this._print(normalizeReceipt(receipt));
      } finally {
        this.client.close();
      }
    });
  }

  async _print(rec) {
    const c = this.client;
    let st;
    try {
      st = await this._status();
    } catch (e) {
      if (e instanceof AmbiguousCommand) throw new PrinterError(Category.CONNECTION, `Brak odpowiedzi drukarki (${e.message})`);
      throw e;
    }
    if (st.mechanism) throw new PrinterError(Category.PAPER, 'Drukarka: ' + (MECH_TEXT[st.mechanism] || st.mechanism));
    if (st.device_state) throw new PrinterError(Category.BUSY, 'Drukarka zajęta: ' + (DEVICE_TEXT[st.device_state] || st.device_state));
    if (st.fiscal && !this.allowFiscal) {
      const err = new PrinterError(Category.FISCAL, 'Drukarka jest w trybie FISKALNYM, a druk fiskalny jest wyłączony w ustawieniach aplikacji (włącz go dopiero po testach na urządzeniu niefiskalnym).');
      err.safetyBlock = true; // zlecenie czeka, aż włączysz druk fiskalny
      throw err;
    }
    let before = st.last_receipt || 0;
    if (st.transaction_open) {
      await c.call('prncancel'); // otwarta transakcja z poprzedniej, przerwanej próby
      before = asInt((await c.call('scnt')).fields.bn) ?? before;
    }

    const cmds = buildCommands(rec, await this._vatMap());
    try {
      for (const [cmd, params] of cmds.slice(0, -1)) await c.call(cmd, params);
    } catch (e) {
      await this._cancelQuietly();
      if (e instanceof AmbiguousCommand) {
        throw new PrinterError(Category.CONNECTION, `Zerwane połączenie w trakcie paragonu (${e.message}); transakcja anulowana, zlecenie zostanie ponowione.`);
      }
      throw e;
    }

    const [endCmd, endParams] = cmds[cmds.length - 1];
    try {
      await c.call(endCmd, endParams);
    } catch (e) {
      if (e instanceof AmbiguousCommand) return this._resolveAfterAmbiguousEnd(before);
      await this._cancelQuietly();
      throw e;
    }
    const bn = asInt((await c.call('scnt')).fields.bn);
    return bn ?? before + 1;
  }

  async _cancelQuietly() {
    try {
      if ((await this.client.call('strns')).fields.to === '1') await this.client.call('prncancel');
    } catch (_) { /* anulowanie to najlepsza próba */ }
  }

  // trend wysłany, odpowiedzi brak — sprawdzamy, czy paragon powstał.
  async _resolveAfterAmbiguousEnd(before) {
    let trns;
    let bn;
    try {
      await this.client.connect();
      trns = await this.client.call('strns');
      bn = asInt((await this.client.call('scnt')).fields.bn);
    } catch (e) {
      throw new PrinterError(Category.UNCERTAIN, `Nie wiadomo, czy paragon został wydrukowany (brak połączenia po wysłaniu trend: ${e.message}). Sprawdź drukarkę.`);
    }
    if (trns.fields.to === '1') {
      await this._cancelQuietly();
      throw new PrinterError(Category.CONNECTION, 'trend nie dotarł do drukarki; transakcja anulowana, zlecenie zostanie ponowione.');
    }
    if (bn != null && bn > before) return bn;
    throw new PrinterError(Category.UNCERTAIN, 'Transakcja zamknięta, ale licznik paragonów się nie zmienił — sprawdź drukarkę i kopię elektroniczną.');
  }
}

module.exports = { Printer, normalizeReceipt, buildCommands };
