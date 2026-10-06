'use strict';

// Testy agenta fiskalnego (Node) na symulatorze drukarki z fiscal-agent/
// (ten sam symulator co testy wersji Python). Uruchom: npm run test:fiscal
// Wymaga python3 (tylko stdlib).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { crc16, encode, decode, PosnetClient, PrinterError, Category } = require('./posnet');
const { Printer, normalizeReceipt } = require('./printer');
const { FiscalAgent } = require('./agent');

const SIM_DIR = path.resolve(__dirname, '..', '..', '..', 'fiscal-agent');

function startSim(extra = []) {
  return new Promise((resolve, reject) => {
    const p = spawn('python3', ['-m', 'fiscal_agent.simulator', '--port', '0', ...extra], { cwd: SIM_DIR });
    p.stdout.on('data', (d) => {
      const m = /:(\d+) \(/.exec(d.toString());
      if (m) resolve({ port: Number(m[1]), proc: p });
    });
    p.on('error', reject);
    setTimeout(() => reject(new Error('symulator nie wystartował')), 5000);
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

const RECEIPT = {
  items: [
    { name: 'KalkMate v3 – kalkulator AI', unit_price: 69900, vat: '23', discount: 7000 },
    { name: 'Wysyłka', unit_price: 1599, vat: '23' },
  ],
  payments: [{ type: 'transfer', amount: 64499, name: 'Przelewy24' }],
};

let sim;
test.beforeEach(async () => { sim = await startSim(); });
test.afterEach(() => sim.proc.kill());

const printer = (opts = {}) => new Printer(new PosnetClient({ host: '127.0.0.1', port: sim.port, timeout: 2000, connectTimeout: 1000 }), opts);

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
  assert.strictEqual((await simset(sim.port, [])).np, '1');
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
  const s = await simset(sim.port, []);
  assert.strictEqual(s.nc, '1');
  assert.strictEqual(s.np, '0');
});

test('zerwane WiFi po trend — odzysk przez rpt, jeden paragon', async () => {
  await simset(sim.port, [['da', 'trend']]);
  assert.strictEqual(await printer().printReceipt(RECEIPT), 101);
  assert.strictEqual((await simset(sim.port, [])).np, '1');
});

test('trend nie dotarł — anulowanie i ponowienie', async () => {
  await simset(sim.port, [['db', 'trend']]);
  await assert.rejects(printer().printReceipt(RECEIPT), (e) => e.category === Category.CONNECTION && e.retryable);
  const s = await simset(sim.port, []);
  assert.strictEqual(s.np, '0');
  assert.strictEqual(s.nc, '1');
});

test('drukarka offline', async () => {
  const p = new Printer(new PosnetClient({ host: '127.0.0.1', port: 1, connectTimeout: 500 }));
  await assert.rejects(p.printReceipt(RECEIPT), (e) => e.category === Category.CONNECTION);
  assert.strictEqual((await p.status()).online, false);
});

test('agent: pobiera z serwera, drukuje raz, raportuje; restart w trakcie = niepewne', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiscal-'));
  const jobs = [{ id: 'fj_1', receipt: RECEIPT }, { id: 'fj_1', receipt: RECEIPT }];
  const reports = [];
  const platform = { claim: async () => jobs.shift() || null, report: async (r) => { reports.push(r); } };
  const agent = new FiscalAgent({ dataDir: dir, platform, log: () => {},
    config: { enabled: true, host: '127.0.0.1', port: sim.port } });
  await agent.tick();          // pobiera fj_1 i drukuje
  await agent.tick();          // raportuje; fj_1 drugi raz — tylko ponowny raport
  await agent.tick();
  assert.strictEqual((await simset(sim.port, [])).np, '1');
  assert.ok(reports.some((r) => r.id === 'fj_1' && r.state === 'printed' && r.receipt_number === 101));

  agent.store.add('fj_2', RECEIPT);
  agent.store.update('fj_2', { state: 'printing' });  // „zamknięcie aplikacji w trakcie druku”
  const again = new FiscalAgent({ dataDir: dir, platform, log: () => {}, config: { enabled: true, host: '127.0.0.1', port: sim.port } });
  again.start();
  again.stop();
  assert.strictEqual(again.store.jobs.fj_2.state, 'uncertain');
  assert.strictEqual(await again.processOne(), false); // nie drukuje ponownie
});
