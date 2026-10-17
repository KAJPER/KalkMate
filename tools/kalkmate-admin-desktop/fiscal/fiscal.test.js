'use strict';

// Testy agenta fiskalnego (Node) na symulatorze drukarki z fiscal-agent/
// (ten sam symulator co testy wersji Python). Uruchom: npm run test:fiscal
// Wymaga Pythona 3 (tylko stdlib). Na Windows domyślnie `python` (alias
// `python3` ze Sklepu Microsoft zwykle nie działa); inny interpreter:
// FISCAL_SIM_PYTHON=py npm run test:fiscal

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { crc16, encode, decode, FrameReader, PosnetClient, PrinterError, AmbiguousCommand, Category, printerText,
        memoryTokens, persistentTokens } = require('./posnet');
const { Printer, normalizeReceipt, checkLimits, parseFlag } = require('./printer');
const { FiscalAgent, AgentState } = require('./agent');

const SIM_DIR = path.resolve(__dirname, '..', '..', '..', 'fiscal-agent');
const PYTHON = process.env.FISCAL_SIM_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

function startSim(extra = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(PYTHON, ['-m', 'fiscal_agent.simulator', '--port', '0', ...extra],
      { cwd: SIM_DIR, env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' } });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { p.kill(); reject(new Error(`symulator nie wystartował (${PYTHON}): ${err}`)); }, 10000);
    p.stdout.on('data', (d) => {
      out += d.toString();
      const m = /:(\d+) \(/.exec(out);
      if (m) { clearTimeout(timer); resolve({ port: Number(m[1]), proc: p }); }
    });
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', (e) => { clearTimeout(timer); reject(new Error(`nie da się uruchomić ${PYTHON}: ${e.message}`)); });
    p.on('exit', (code) => { clearTimeout(timer); reject(new Error(`symulator zakończył się (kod ${code}): ${err}`)); });
  });
}

// Komenda sterująca symulatora (simset) — osobne połączenie.
function simset(port, params) {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ port, host: '127.0.0.1' }, () => s.write(encode('simset', params)));
    s.on('data', (d) => { s.destroy(); resolve(decode(d).fields); });
    s.on('error', reject);
  });
}
const simInfo = () => simset(sim.port, []);
const commands = async () => (await simInfo()).cl.split(',').filter(Boolean);

const RECEIPT = {
  items: [
    { name: 'KalkMate v3 – kalkulator AI', unit_price: 69900, vat: '23', discount: 7000 },
    { name: 'Wysyłka', unit_price: 1599, vat: '23' },
  ],
  payments: [{ type: 'transfer', amount: 64499, name: 'Przelewy24' }],
  reference: 'KM-1001',
};

let sim;
test.beforeEach(async () => { sim = await startSim(); });
test.afterEach(() => sim.proc.kill());

const client = (o = {}) => new PosnetClient({ host: '127.0.0.1', port: sim.port, timeout: 2000, connectTimeout: 1000, ...o });
const printer = (opts = {}) => new Printer(client(), opts);
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fiscal-'));

/** Atrapa serwera: odpowiedzi raportów wg (id, stan); domyślnie accepted=true. */
function fakePlatform(jobs = [], answers = {}) {
  const p = {
    jobs: [...jobs], reports: [], claims: 0, metas: [],
    claim: async (_status, meta) => { p.claims++; p.metas.push(meta); return p.jobs.shift() || null; },
    report: async (r, meta) => {
      p.reports.push(r); p.metas.push(meta);
      const a = answers[`${r.id}:${r.state}`];
      if (a instanceof Error) throw a;
      return a || { ok: true, state: 'sent', accepted: true };
    },
  };
  return p;
}

function agent(dir, platform, extra = {}) {
  return new FiscalAgent({ dataDir: dir, platform, log: () => {},
    config: { enabled: true, host: '127.0.0.1', port: sim.port, ...extra } });
}

// --- protokół ------------------------------------------------------------------------

test('CRC zgodne z wektorem XMODEM i ramką z Pythona', () => {
  assert.strictEqual(crc16(Buffer.from('123456789')), 0x31c3);
  const f = encode('trline', [['na', 'Żółć'], ['vt', '2']], 12);
  const body = Buffer.concat([Buffer.from('trline\tna'), Buffer.from([0xaf, 0xf3, 0xb3, 0xe6]), Buffer.from('\tvt2\t@0012\t')]);
  assert.strictEqual(f.toString('latin1'), '\x02' + body.toString('latin1') + '#' + crc16(body).toString(16).toUpperCase().padStart(4, '0') + '\x03');
  assert.deepStrictEqual(decode(f).fields, { na: 'Żółć', vt: '2' });
});

test('walidacja i zaokrąglenie ilości', () => {
  const r = normalizeReceipt({ items: [{ name: 'Papier', unit_price: 333, quantity: '1.5', vat: '8' }], payments: [{ type: 'cash', amount: 1000 }] });
  assert.strictEqual(r.total, 500);
  assert.throws(() => normalizeReceipt({ ...RECEIPT, payments: [{ type: 'card', amount: 1 }] }), PrinterError);
  assert.throws(() => normalizeReceipt({ ...RECEIPT, payments: [{ type: 'card', amount: 99999 }] }), /gotówką/);
  assert.throws(() => normalizeReceipt({ ...RECEIPT, items: [{ name: 'X', unit_price: 100, vat: '22' }] }), /stawka/);
});

test('status i paragon', async () => {
  const p = printer();
  const st = await p.status();
  assert.ok(st.online && st.ready && st.fiscal === false);
  assert.strictEqual(st.last_receipt, 100);
  assert.strictEqual(await p.printReceipt(RECEIPT), 101);
  assert.strictEqual((await simInfo()).np, '1');
});

test('brak papieru i kasa zajęta = ponawialne', async () => {
  await simset(sim.port, [['pr', '5']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.PAPER && e.retryable);
  await simset(sim.port, [['pr', '0'], ['ds', '1']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.BUSY);
});

test('bezpiecznik trybu fiskalnego', async () => {
  await simset(sim.port, [['fs', '1']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.safetyBlock === true);
  assert.strictEqual(await printer({ allowFiscal: true }).printReceipt(RECEIPT), 101);
});

test('błąd w trakcie paragonu = anulowanie', async () => {
  await simset(sim.port, [['er', 'trpayment:2705']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.code === 2705 && !e.retryable);
  const s = await simInfo();
  assert.strictEqual(s.nc, '1');
  assert.strictEqual(s.np, '0');
});

test('zerwane WiFi po trend — odzysk przez rpt, jeden paragon', async () => {
  await simset(sim.port, [['da', 'trend']]);
  assert.strictEqual(await printer().printReceipt(RECEIPT), 101);
  assert.strictEqual((await simInfo()).np, '1');
});

test('trend nie dotarł — anulowanie i ponowienie dopiero po dowodzie (to=0, bn bez zmian)', async () => {
  await simset(sim.port, [['db', 'trend'], ['cc', '1']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.CONNECTION && e.retryable);
  const s = await simInfo();
  assert.strictEqual(s.np, '0');
  assert.strictEqual(s.nc, '1');
  const cl = s.cl.split(',');
  assert.deepStrictEqual(cl.slice(cl.lastIndexOf('prncancel') + 1), ['strns', 'scnt']);
});

test('drukarka offline', async () => {
  const p = new Printer(new PosnetClient({ host: '127.0.0.1', port: 1, connectTimeout: 500 }));
  await assert.rejects(p.printReceipt(RECEIPT), (e) => e.category === Category.CONNECTION);
  assert.strictEqual((await p.status()).online, false);
});

// --- 1. po trend: printed albo uncertain, nigdy ponowienie ----------------------------

test('po trend: zerwany odczyt scnt -> printed, bez drugiego paragonu (także przez agenta)', async () => {
  const dir = tmpDir();
  const a = agent(dir, fakePlatform([{ id: 'fj_1', receipt: RECEIPT }]));
  await a.syncPlatform(); // pobiera zlecenie (status drukarki też woła scnt)
  await simset(sim.port, [['db', 'scnt:2']]); // 1. scnt = status przed paragonem, 2. = numer po trend
  assert.strictEqual(await a.processOne(), true);
  await a.tick();
  assert.strictEqual(a.store.jobs.fj_1.state, 'printed');
  assert.strictEqual(a.store.jobs.fj_1.receipt_number, 101);
  assert.strictEqual((await simInfo()).np, '1');
});

test('po trend: BUSY na scnt -> printed, nie ponowienie', async () => {
  await simset(sim.port, [['er', 'scnt:14:2']]);
  assert.strictEqual(await printer().printReceipt(RECEIPT), 101);
  assert.strictEqual((await simInfo()).np, '1');
});

test('po trend: odczyt numeru niemożliwy -> uncertain', async () => {
  await simset(sim.port, [['db', 'scnt:2']]);
  await simset(sim.port, [['db', 'scnt:3']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.UNCERTAIN && /NAJPRAWDOPODOBNIEJ/.test(e.message));
  assert.strictEqual((await simInfo()).np, '1');
});

test('zły CRC odpowiedzi na trend -> printed (nie failed)', async () => {
  await simset(sim.port, [['bc', 'trend']]);
  assert.strictEqual(await printer().printReceipt(RECEIPT), 101);
  const s = await simInfo();
  assert.strictEqual(s.np, '1');
  assert.strictEqual(s.nc, '0');
});

test('licznik po trend skacze o 2 -> uncertain (nie numer cudzego paragonu)', async () => {
  await simset(sim.port, [['tj', '1']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.UNCERTAIN && /102/.test(e.message));
});

test('drukarka czytelnie odrzuca trend -> anulowanie, potem błąd danych', async () => {
  await simset(sim.port, [['er', 'trend:2805']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.code === 2805 && e.category === Category.INVALID);
  const s = await simInfo();
  assert.strictEqual(s.np, '0');
  assert.strictEqual(s.nc, '1');
  assert.strictEqual(s.to, '0');
});

test('trend nie dotarł i prncancel się nie udaje -> uncertain', async () => {
  await simset(sim.port, [['db', 'trend'], ['er', 'prncancel:2060']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.UNCERTAIN);
  assert.strictEqual((await simInfo()).np, '0');
});

// --- 6. AmbiguousCommand przed trinit = CONNECTION --------------------------------------

test('brak odpowiedzi na prncancel / vatget przed trinit -> CONNECTION (ponawialne)', async () => {
  await simset(sim.port, [['op', '1'], ['db', 'prncancel'], ['cc', '1']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.CONNECTION && e.retryable);
  assert.ok(!(await commands()).includes('trinit'));
  await simset(sim.port, [['op', '0'], ['db', 'vatget']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.CONNECTION && e.retryable);
  assert.strictEqual((await simInfo()).np, '0');
});

test('zły CRC odpowiedzi przed trinit -> CONNECTION', async () => {
  await simset(sim.port, [['bc', 'sid']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.CONNECTION);
});

// --- 7. bezpieczniki protokołu -----------------------------------------------------------

test('parser flag: 1/T/Y/true, 0/N/F/false, reszta = nieznane', () => {
  for (const v of ['1', 'T', 'y', 'true', ' TRUE ']) assert.strictEqual(parseFlag(v), true);
  for (const v of ['0', 'N', 'f', 'false']) assert.strictEqual(parseFlag(v), false);
  for (const v of ['', '2', 'X', null, undefined]) assert.strictEqual(parseFlag(v), null);
});

test('brak / nieznane scomm.fs = drukarka FISKALNA', async () => {
  for (const fv of ['-', 'X']) {
    await simset(sim.port, [['fv', fv]]);
    const st = await printer().status();
    assert.ok(st.fiscal === true && st.fiscal_unknown === true, fv);
    await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.FISCAL && e.safetyBlock);
  }
  assert.strictEqual((await simInfo()).np, '0');
  assert.strictEqual(await printer({ allowFiscal: true }).printReceipt(RECEIPT), 101);
});

test('nieznane strns.to = błąd PROTOCOL, bez trinit', async () => {
  await simset(sim.port, [['tv', '?'], ['cc', '1']]);
  assert.strictEqual((await printer().status()).online, false);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.PROTOCOL);
  assert.ok(!(await commands()).includes('trinit'));
});

test('rpt oddaje odpowiedź innego rozkazu -> AmbiguousCommand', async () => {
  // Atrapa drukarki: 1. połączenie zrywa po rozkazie, 2. odpowiada na rpt ramką „sid” z tym samym tokenem.
  let conn = 0;
  const srv = net.createServer((s) => {
    const n = ++conn;
    const reader = new FrameReader();
    s.on('data', (d) => {
      for (const f of reader.feed(d)) {
        const req = decode(f);
        if (n === 1) { s.destroy(); return; }
        if (req.command === 'rpt') s.write(encode('sid', [['nm', 'Obca']], req.token));
      }
    });
    s.on('error', () => {});
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const c = new PosnetClient({ host: '127.0.0.1', port: srv.address().port, timeout: 1000, connectTimeout: 1000 });
    await assert.rejects(c.call('scnt'), (e) => e instanceof AmbiguousCommand);
    c.close();
  } finally {
    srv.close();
  }
});

test('tokeny: trwały licznik, bez powtórek po restarcie', () => {
  let stored = null;
  const store = { load: () => stored, save: (v) => { stored = v; } };
  const a = persistentTokens({ ...store, block: 8 });
  const used = [a(), a(), a()];
  const b = persistentTokens({ ...store, block: 8 });
  const next = b();
  assert.ok(!used.includes(next));
  assert.strictEqual(next, ((used[0] + 8 - 1) % 9999) + 1);
  const m = memoryTokens(9999);
  assert.deepStrictEqual([m(), m()], [9999, 1]);
});

test('agentId i licznik tokenów przetrwają restart aplikacji', async () => {
  const dir = tmpDir();
  const p = fakePlatform([{ id: 'fj_1', receipt: RECEIPT }]);
  const a = agent(dir, p);
  await a.tick();
  assert.match(a.agentId, /^desktop-[0-9a-f-]{36}$/);
  assert.ok(p.metas.length && p.metas.every((m) => m.agentId === a.agentId));
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'fiscal-agent-state.json'), 'utf8'));
  assert.ok(Number.isInteger(saved.nextToken));
  const b = agent(dir, fakePlatform());
  assert.strictEqual(b.agentId, a.agentId);
  assert.strictEqual(new AgentState(path.join(dir, 'fiscal-agent-state.json')).loadToken(), saved.nextToken);
});

// --- 7. teksty spoza strony kodowej -------------------------------------------------------

test('emoji w nazwie -> INVALID przed połączeniem z drukarką', async () => {
  await simset(sim.port, [['cc', '1']]);
  const r = { ...RECEIPT, items: [{ name: 'Kalkulator 🚀', unit_price: 100, vat: '23' }], payments: [{ type: 'card', amount: 100 }] };
  await assert.rejects(printer().printReceipt(r), (e) => e.category === Category.INVALID && /U\+1F680/.test(e.message));
  assert.deepStrictEqual(await commands(), []);
  assert.throws(() => encode('trline', [['na', 'a🚀']]), (e) => e.category === Category.INVALID); // bez cichego '?'
});

test('transliteracja dla ISO-8859-2', async () => {
  assert.strictEqual(printerText('KalkMate v3 – „AI”', 40, 'iso-8859-2'), 'KalkMate v3 - "AI"');
  assert.strictEqual(printerText('Żółć – ok', 40, 'cp1250'), 'Żółć – ok');
  assert.strictEqual(printerText('Piñata', 40, 'iso-8859-2'), 'Pinata');
  const r = { ...RECEIPT, items: [{ name: 'Kalkulator – AI', unit_price: 100, vat: '23' }], payments: [{ type: 'card', amount: 100 }] };
  assert.strictEqual(await new Printer(client({ encoding: 'iso-8859-2' })).printReceipt(r), 101);
});

// --- 8. limity kwot ---------------------------------------------------------------------------

test('limity: suma > 4000 zł, > 5 pozycji, brak reference -> INVALID bez druku', async () => {
  await simset(sim.port, [['cc', '1']]);
  const cases = [
    { ...RECEIPT, items: [{ name: 'Drogie', unit_price: 400001, vat: '23' }], payments: [{ type: 'card', amount: 400001 }] },
    { ...RECEIPT, items: Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, unit_price: 100, vat: '23' })), payments: [{ type: 'card', amount: 600 }] },
    { ...RECEIPT, reference: undefined },
    { ...RECEIPT, reference: '  ' },
  ];
  for (const r of cases) await assert.rejects(printer().printReceipt(r), (e) => e.category === Category.INVALID);
  assert.deepStrictEqual(await commands(), []);
  assert.throws(() => checkLimits(normalizeReceipt(RECEIPT), { maxTotal: 1000 }), /10\.00/);
  assert.strictEqual(await printer({ limits: { maxTotal: 100000 } }).printReceipt(RECEIPT), 101);
});

test('zamówienie 5 sztuk: wartość = ilość × cena − rabat, mieści się w domyślnym limicie', () => {
  const r = normalizeReceipt({
    ...RECEIPT,
    items: [
      { name: 'KalkMate v3 kalkulator AI', quantity: '5', unit_price: 69900, vat: '23', discount: 7000 },
      { name: 'Wysyłka', unit_price: 3500, vat: '23' },
    ],
    payments: [{ type: 'transfer', amount: 349500 - 7000 + 3500, name: 'Przelewy24' }],
  });
  assert.strictEqual(r.items[0].gross, 349500);
  assert.strictEqual(r.total, 349500 - 7000 + 3500);
  checkLimits(r); // DEFAULT_LIMITS.maxTotal = 400000
});

// --- 5. trwała kolejka ---------------------------------------------------------------------------

test('kolejka: zapis z kopią zapasową; brak pliku = pusta kolejka', () => {
  const dir = tmpDir();
  const a = agent(dir, fakePlatform());
  assert.strictEqual(a.store.blocked, false);
  a.store.add('fj_1', RECEIPT);
  const main = JSON.parse(fs.readFileSync(path.join(dir, 'fiscal-jobs.json'), 'utf8'));
  const bak = JSON.parse(fs.readFileSync(path.join(dir, 'fiscal-jobs.json.bak'), 'utf8'));
  assert.deepStrictEqual(main, bak);
  assert.ok(main.jobs.fj_1);
  assert.ok(!fs.existsSync(path.join(dir, 'fiscal-jobs.json.tmp')));
});

test('kolejka: uszkodzony plik -> odłożony na bok, druk zablokowany, alert; odblokowanie ręczne', async () => {
  const dir = tmpDir();
  const first = agent(dir, fakePlatform());
  first.store.add('fj_old', RECEIPT); // kopia zapasowa ma fj_old w stanie queued
  fs.writeFileSync(path.join(dir, 'fiscal-jobs.json'), '{"jobs": {"fj_old": {"id": "fj_old", "sta');
  const p = fakePlatform([{ id: 'fj_new', receipt: RECEIPT }]);
  const a = agent(dir, p);
  assert.strictEqual(a.store.blocked, true);
  assert.ok(fs.readdirSync(dir).some((f) => /^fiscal-jobs\.json\.corrupt-\d+$/.test(f)));
  assert.strictEqual(a.store.jobs.fj_old.state, 'uncertain'); // odtworzone z kopii, ale NIE do druku
  await a.tick();
  assert.strictEqual(p.claims, 0);
  assert.strictEqual(await a.processOne(), false);
  const info = await a.info();
  assert.ok(info.blocked && /uszkodzona/.test(info.platformError));
  assert.strictEqual((await simInfo()).np, '0');
  assert.strictEqual(a.acknowledgeQueueAlert(), true);
  a.stop();
  await a.tick();
  assert.ok(p.claims >= 1);
  assert.strictEqual(a.store.jobs.fj_new.state, 'printed');
  assert.strictEqual(a.store.jobs.fj_old.state, 'uncertain'); // odtworzone niedokończone NIE drukuje się samo
  assert.strictEqual((await simInfo()).np, '1');
});

test('kolejka: nieczytelny plik bez kopii -> blokada (nie pusta kolejka)', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'fiscal-jobs.json'), 'nie-json');
  const a = agent(dir, fakePlatform());
  assert.strictEqual(a.store.blocked, true);
  assert.match(a.store.alert, /kopii zapasowej brak/);
});

// --- 2-4. protokół z serwerem ----------------------------------------------------------------------

for (const answer of [{ ok: true, state: 'cancelled', accepted: false }, { ok: true, state: 'cancel_requested', accepted: true },
  { ok: true, state: 'superseded', accepted: false }]) {
  test(`serwer: ${answer.state} przed drukiem -> porzucone bez drukowania`, async () => {
    const p = fakePlatform([{ id: 'fj_1', receipt: RECEIPT }], { 'fj_1:printing': answer });
    const a = agent(tmpDir(), p);
    await a.tick();
    assert.strictEqual(a.store.jobs.fj_1, undefined);
    assert.strictEqual((await simInfo()).np, '0');
  });
}

test('serwer: anulowane, gdy zlecenie czekało po błędzie papieru', async () => {
  const p = fakePlatform([{ id: 'fj_1', receipt: RECEIPT }]);
  const a = agent(tmpDir(), p);
  await a.syncPlatform();               // pobiera, drukarka gotowa
  await simset(sim.port, [['pr', '5']]);
  await a.processOne();                 // brak papieru -> czeka
  assert.strictEqual(a.store.jobs.fj_1.state, 'queued');
  await simset(sim.port, [['pr', '0']]);
  p.report = async (r) => (r.state === 'queued' ? { ok: true, state: 'cancelled', accepted: false } : { ok: true, accepted: true });
  await a.syncPlatform();
  assert.strictEqual(a.store.jobs.fj_1, undefined);
  assert.strictEqual((await simInfo()).np, '0');
});

test('serwer odrzuca raport wydrukowanego -> zostaje printed, konflikt w statusie, bez pętli raportów', async () => {
  const p = fakePlatform([{ id: 'fj_1', receipt: RECEIPT }], { 'fj_1:printed': { ok: true, state: 'superseded', accepted: false } });
  const a = agent(tmpDir(), p);
  await a.tick();
  await a.tick();
  assert.strictEqual(a.store.jobs.fj_1.state, 'printed');
  const info = await a.info();
  assert.match(info.platformError, /KONFLIKT.*101/);
  const n = p.reports.length;
  await a.tick();
  assert.strictEqual(p.reports.filter((r) => r.state === 'printed').length, p.reports.slice(0, n).filter((r) => r.state === 'printed').length);
});

test('serwer: 404 -> osierocone, nie drukuje, ostrzeżenie, claim dalej działa', async () => {
  const p = fakePlatform([{ id: 'fj_1', receipt: RECEIPT }], { 'fj_1:printing': { found: false, state: 'unknown', accepted: false } });
  const a = agent(tmpDir(), p);
  await a.tick();
  assert.strictEqual(a.store.jobs.fj_1.orphaned, true);
  assert.strictEqual((await simInfo()).np, '0');
  assert.match((await a.info()).platformError, /404/);
  const before = p.claims;
  await a.tick();
  assert.ok(p.claims > before);
  assert.strictEqual(a.store.nextDue(), null);
});

test('serwer niedostępny tuż przed drukiem -> zlecenie czeka', async () => {
  const p = fakePlatform([{ id: 'fj_1', receipt: RECEIPT }], { 'fj_1:printing': new Error('offline') });
  const a = agent(tmpDir(), p);
  await a.tick();
  assert.strictEqual(a.store.jobs.fj_1.state, 'queued');
  assert.strictEqual(a.store.jobs.fj_1.attempts, 0);
  assert.match(a.store.jobs.fj_1.error, /potwierdzenia/);
  assert.strictEqual((await simInfo()).np, '0');
});

test('błąd jednego raportu nie blokuje pozostałych ani claim', async () => {
  const p = fakePlatform([], { 'fj_a:failed': new Error('zerwane') });
  const a = agent(tmpDir(), p);
  for (const id of ['fj_a', 'fj_b']) { a.store.add(id, RECEIPT); a.store.update(id, { state: 'failed', error: 'x' }); }
  await a.syncPlatform();
  assert.strictEqual(p.claims, 1);
  assert.deepStrictEqual(p.reports.map((r) => r.id).sort(), ['fj_a', 'fj_b']);
  assert.strictEqual(a.store.jobs.fj_a.reported, false);
  assert.strictEqual(a.store.jobs.fj_b.reported, true);
  assert.match(a.lastPlatformError, /fj_a/);
});

test('brak claim: drukarka offline / niegotowa / tryb fiskalny zablokowany / czeka zlecenie z błędem', async () => {
  const p = fakePlatform();
  const off = new FiscalAgent({ dataDir: tmpDir(), platform: p, log: () => {}, config: { enabled: true, host: '127.0.0.1', port: 1 } });
  await off.syncPlatform();
  assert.strictEqual(p.claims, 0);
  assert.match(off.claimBlocked, /niedostępna/);

  const a = agent(tmpDir(), p);
  await simset(sim.port, [['pr', '5']]);
  await a.syncPlatform();
  assert.strictEqual(p.claims, 0);
  assert.match(a.claimBlocked, /nie jest gotowa/);

  await simset(sim.port, [['pr', '0'], ['fs', '1']]);
  a.lastStatusAt = 0;
  await a.syncPlatform();
  assert.strictEqual(p.claims, 0);
  assert.match(a.claimBlocked, /FISKALNYM/);

  await simset(sim.port, [['fs', '0']]);
  a.lastStatusAt = 0;
  a.store.add('fj_wait', RECEIPT);
  a.store.update('fj_wait', { error: 'Drukarka: brak papieru', attempts: 1, nextAttemptAt: Date.now() + 60_000 });
  await a.syncPlatform();
  assert.strictEqual(p.claims, 0);
  assert.match(a.claimBlocked, /czeka/);
});

test('agent: pobiera z serwera, drukuje raz, raportuje; restart w trakcie = niepewne', async () => {
  const dir = tmpDir();
  const jobs = [{ id: 'fj_1', receipt: RECEIPT }, { id: 'fj_1', receipt: RECEIPT }];
  const p = fakePlatform(jobs);
  const a = agent(dir, p);
  await a.tick();          // pobiera fj_1 i drukuje
  await a.tick();          // raportuje; fj_1 drugi raz — tylko ponowny raport
  await a.tick();
  assert.strictEqual((await simInfo()).np, '1');
  assert.ok(p.reports.some((r) => r.id === 'fj_1' && r.state === 'printed' && r.receipt_number === 101));

  a.store.add('fj_2', RECEIPT);
  a.store.update('fj_2', { state: 'printing' });  // „zamknięcie aplikacji w trakcie druku”
  const again = agent(dir, p);
  again.start();
  again.stop();
  assert.strictEqual(again.store.jobs.fj_2.state, 'uncertain');
  assert.strictEqual(await again.processOne(), false); // nie drukuje ponownie
});
