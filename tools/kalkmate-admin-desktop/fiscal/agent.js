'use strict';

// Agent fiskalny w aplikacji KalkMate Admin — port fiscal_agent/service.py + store.py.
//
// Co POLL_MS: odeślij wyniki na serwer -> pobierz zlecenie (claim) -> drukuj po
// kolei. Kolejka jest trwała (plik JSON w userData), więc paragon pobrany z
// serwera nie zginie po zamknięciu aplikacji.
//
// Zasady bezpieczeństwa jak w agencie Python:
// - to samo id zlecenia nigdy nie drukuje się drugi raz,
// - zlecenie przerwane w trakcie druku (zamknięcie aplikacji, awaria) po starcie
//   dostaje stan „uncertain” i NIE jest ponawiane automatycznie.

const fs = require('fs');
const path = require('path');
const { PosnetClient, PrinterError, Category } = require('./posnet');
const { Printer } = require('./printer');

const POLL_MS = 10_000;
const STATUS_MAX_AGE_MS = 60_000;
const MAX_BACKOFF_MS = 300_000;
const KEEP_FINISHED = 500;

class JobStore {
  constructor(file) {
    this.file = file;
    this.jobs = {};
    try { this.jobs = JSON.parse(fs.readFileSync(file, 'utf8')).jobs || {}; } catch (_) { /* pierwszy start */ }
  }

  save() {
    // Najstarsze zakończone zlecenia wylatują, żeby plik nie rósł bez końca.
    const done = Object.values(this.jobs).filter((j) => ['printed', 'failed', 'uncertain'].includes(j.state) && j.reported);
    if (done.length > KEEP_FINISHED) {
      done.sort((a, b) => a.updatedAt - b.updatedAt).slice(0, done.length - KEEP_FINISHED).forEach((j) => delete this.jobs[j.id]);
    }
    const tmp = this.file + '.tmp';
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify({ jobs: this.jobs }));
    fs.renameSync(tmp, this.file); // atomowo — awaria w trakcie zapisu nie psuje kolejki
  }

  recover() {
    let n = 0;
    for (const j of Object.values(this.jobs)) {
      if (j.state === 'printing') {
        Object.assign(j, {
          state: 'uncertain', category: Category.UNCERTAIN, reported: false, updatedAt: Date.now(),
          error: 'Aplikacja została zamknięta w trakcie drukowania — sprawdź, czy paragon się wydrukował.',
        });
        n++;
      }
    }
    if (n) this.save();
    return n;
  }

  add(id, receipt) {
    if (this.jobs[id]) return false;
    const now = Date.now();
    this.jobs[id] = { id, receipt, state: 'queued', receipt_number: null, error: null, error_code: null, category: null,
                      attempts: 0, nextAttemptAt: 0, createdAt: now, updatedAt: now, reported: false };
    this.save();
    return true;
  }

  update(id, patch) {
    Object.assign(this.jobs[id], patch, { updatedAt: Date.now() });
    this.save();
  }

  nextDue() {
    const now = Date.now();
    return Object.values(this.jobs)
      .filter((j) => j.state === 'queued' && j.nextAttemptAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt)[0] || null;
  }

  counts() {
    const out = {};
    for (const j of Object.values(this.jobs)) out[j.state] = (out[j.state] || 0) + 1;
    return out;
  }
}

const result = (j) => ({ id: j.id, state: j.state, receipt_number: j.receipt_number, error: j.error,
                         error_code: j.error_code, category: j.category, attempts: j.attempts });

class FiscalAgent {
  /**
   * @param {object} o
   * @param {string} o.dataDir     katalog na kolejkę
   * @param {object} o.platform    { claim(printerStatus) -> job|null, report(result) }
   * @param {object} o.config      { enabled, host, port, encoding, allowFiscal }
   * @param {function} [o.log]
   */
  constructor({ dataDir, platform, config, log = console.log, pollMs = POLL_MS }) {
    this.store = new JobStore(path.join(dataDir, 'fiscal-jobs.json'));
    this.platform = platform;
    this.log = log;
    this.pollMs = pollMs;
    this.timer = null;
    this.running = false;
    this.lastPlatformError = null;
    this.lastStatus = null;
    this.lastStatusAt = 0;
    this.setConfig(config);
  }

  setConfig(config) {
    this.config = { enabled: false, host: '', port: 6666, encoding: 'cp1250', allowFiscal: false, ...config };
    const { host, port, encoding, allowFiscal } = this.config;
    this.printer = host ? new Printer(new PosnetClient({ host, port: Number(port), encoding }), { allowFiscal }) : null;
    this.lastStatusAt = 0;
  }

  start() {
    const n = this.store.recover();
    if (n) this.log(`[fiscal] ${n} zleceń przerwanych w trakcie druku oznaczono jako niepewne`);
    this._schedule(500);
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
  }

  _schedule(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick().finally(() => this._schedule(this.pollMs)), ms);
  }

  wake() { if (!this.running) this._schedule(0); }

  async printerStatus(maxAge = STATUS_MAX_AGE_MS) {
    if (!this.printer) return { online: false, ready: false, description: 'Nie ustawiono adresu drukarki' };
    if (!this.lastStatus || Date.now() - this.lastStatusAt > maxAge) {
      this.lastStatus = await this.printer.status();
      this.lastStatusAt = Date.now();
    }
    return this.lastStatus;
  }

  async tick() {
    if (this.running || !this.config.enabled) return;
    this.running = true;
    try {
      await this.syncPlatform();
      while (this.config.enabled && (await this.processOne())) await this.syncPlatform();
    } catch (e) {
      this.log('[fiscal] błąd pętli:', e);
    } finally {
      this.running = false;
    }
  }

  async syncPlatform() {
    try {
      for (const j of Object.values(this.store.jobs).filter((x) => !x.reported)) {
        const stamp = j.updatedAt;
        await this.platform.report(result(j));
        if (this.store.jobs[j.id] && this.store.jobs[j.id].updatedAt === stamp) this.store.update(j.id, { reported: true, updatedAt: stamp });
      }
      const job = await this.platform.claim(await this.printerStatus());
      if (job && job.id) {
        if (!this.store.add(job.id, job.receipt)) this.store.update(job.id, { reported: false }); // znane — odeślij stan
      }
      this.lastPlatformError = null;
    } catch (e) {
      this.lastPlatformError = e.message || String(e);
      this.log('[fiscal] synchronizacja z serwerem:', this.lastPlatformError);
    }
  }

  async processOne() {
    const job = this.store.nextDue();
    if (!job || !this.printer) return false;
    this.store.update(job.id, { state: 'printing', attempts: job.attempts + 1 });
    try {
      const number = await this.printer.printReceipt(job.receipt);
      this.store.update(job.id, { state: 'printed', receipt_number: number, error: null, error_code: null, category: null, reported: false });
      this.log(`[fiscal] ${job.id}: paragon nr ${number}`);
    } catch (e) {
      const err = e instanceof PrinterError ? e : new PrinterError(Category.INTERNAL, `Nieoczekiwany błąd: ${e.message}`);
      if (err.retryable) {
        const delay = Math.min(MAX_BACKOFF_MS, 5000 * 2 ** Math.max(0, job.attempts));
        this.store.update(job.id, { state: 'queued', error: err.message, error_code: err.code, category: err.category,
                                    nextAttemptAt: Date.now() + delay, reported: false });
        this.log(`[fiscal] ${job.id}: ${err.message} — ponowienie za ${Math.round(delay / 1000)} s`);
      } else {
        // Bezpiecznik trybu fiskalnego: zlecenie czeka (co 5 min), aż włączysz druk fiskalny.
        const state = err.safetyBlock ? 'queued'
          : [Category.UNCERTAIN, Category.INTERNAL].includes(err.category) ? 'uncertain' : 'failed';
        this.store.update(job.id, { state, error: err.message, error_code: err.code, category: err.category,
                                    nextAttemptAt: Date.now() + MAX_BACKOFF_MS, reported: false });
        this.log(`[fiscal] ${job.id}: ${err.message}`);
      }
    }
    this.lastStatusAt = 0;
    return true;
  }

  async info(refresh = false) {
    return {
      config: this.config,
      printer: this.config.host ? await this.printerStatus(refresh ? 0 : STATUS_MAX_AGE_MS) : null,
      queue: this.store.counts(),
      platformError: this.lastPlatformError,
      recent: Object.values(this.store.jobs).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10).map(result),
    };
  }
}

module.exports = { FiscalAgent, JobStore };
