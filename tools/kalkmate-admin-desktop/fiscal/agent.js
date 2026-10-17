'use strict';

// Agent fiskalny w aplikacji KalkMate Admin — port fiscal_agent/service.py + store.py.
//
// Co POLL_MS: odeślij wyniki na serwer -> pobierz zlecenie (claim) -> drukuj po
// kolei. Kolejka jest trwała (plik JSON w userData, zapis z fsync + kopia
// zapasowa), więc paragon pobrany z serwera nie zginie po zamknięciu aplikacji.
//
// Zasady bezpieczeństwa jak w agencie Python:
// - to samo id zlecenia nigdy nie drukuje się drugi raz,
// - zlecenie przerwane w trakcie druku (zamknięcie aplikacji, awaria) po starcie
//   dostaje stan „uncertain” i NIE jest ponawiane automatycznie,
// - uszkodzony plik kolejki NIE oznacza pustej kolejki: plik jest odkładany na
//   bok, a drukowanie wstrzymane do potwierdzenia przez człowieka.
//
// Protokół z serwerem (website/src/lib/fiscal.ts, kontrakt K6):
// - claim i raporty niosą trwały agentId (body.agentId + nagłówek x-fiscal-agent-id),
// - odpowiedź raportu {ok, state, accepted}: accepted=false albo stan
//   cancelled/cancel_requested/superseded = porzuć zlecenie BEZ drukowania (jeśli
//   mogło się wydrukować — zachowaj i oznacz konflikt); 404 = osierocone,
// - przed drukiem agent potwierdza zlecenie raportem 'printing' — tak dowiaduje
//   się o anulowaniu zlecenia, które czekało w kolejce.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PosnetClient, PrinterError, Category, persistentTokens } = require('./posnet');
const { Printer, Mutex, DEFAULT_LIMITS } = require('./printer');

const POLL_MS = 10_000;
const STATUS_MAX_AGE_MS = 60_000;
const MAX_BACKOFF_MS = 300_000;
const CONFIRM_RETRY_MS = 30_000;
const KEEP_FINISHED = 500;
const JOB_STATES = new Set(['queued', 'printing', 'printed', 'failed', 'uncertain']);
const REJECTED_STATES = new Set(['cancelled', 'cancel_requested', 'superseded']);

// --- trwały zapis plików ---------------------------------------------------------------

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function fsyncDir(dir) {
  // Windows nie pozwala otworzyć katalogu do fsync (EISDIR/EPERM) — pomijamy;
  // NTFS i tak zapisuje rename w dzienniku metadanych. Na Linux/macOS fsync
  // katalogu utrwala samo przemianowanie pliku.
  if (process.platform === 'win32') return;
  let fd;
  try {
    fd = fs.openSync(dir, 'r');
    fs.fsyncSync(fd);
  } catch (_) {
    /* nie każdy system plików to wspiera */
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (_) { /* nic */ }
  }
}

/** Atomowy i trwały zapis: plik tymczasowy -> fsync -> rename -> fsync katalogu. */
function writeFileDurable(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(tmp, file);
      break;
    } catch (e) {
      // Windows: antywirus / indeksowanie potrafi chwilę trzymać plik docelowy.
      if (i >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) throw e;
      sleepSync(20 * (i + 1));
    }
  }
  fsyncDir(path.dirname(file));
}

/** JSON z pliku; null TYLKO gdy pliku nie ma (ENOENT). Każdy inny problem rzuca. */
function readJson(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  return JSON.parse(raw);
}

/** Odkłada uszkodzony plik na bok (*.corrupt-<ts>). Zwraca nową ścieżkę albo null. */
function quarantine(file) {
  const dest = `${file}.corrupt-${Date.now()}`;
  try {
    fs.renameSync(file, dest);
    return dest;
  } catch (_) {
    try { fs.copyFileSync(file, dest); return dest; } catch (__) { return null; }
  }
}

function validJobs(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { jobs } = data;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) return null;
  for (const [id, j] of Object.entries(jobs)) {
    if (!j || typeof j !== 'object' || j.id !== id || !JOB_STATES.has(j.state)) return null;
  }
  return jobs;
}

// --- kolejka ----------------------------------------------------------------------------

class JobStore {
  constructor(file, { log = () => {} } = {}) {
    this.file = file;
    this.backup = `${file}.bak`;
    this.log = log;
    this.jobs = {};
    // Ustawione = kolejka była uszkodzona; drukowanie i synchronizacja wstrzymane
    // do potwierdzenia (menu Narzędzia w aplikacji).
    this.alert = null;
    this._load();
  }

  get blocked() { return !!this.alert; }

  _load() {
    let problem = null;
    try {
      const data = readJson(this.file);
      if (data === null) {
        if (!fs.existsSync(this.backup)) return; // pierwszy start: pusta kolejka
        problem = 'brak pliku kolejki, choć jest jego kopia zapasowa';
      } else {
        const jobs = validJobs(data);
        if (jobs) { this.jobs = jobs; return; }
        problem = 'nieprawidłowa struktura pliku kolejki';
      }
    } catch (e) {
      problem = `nie da się odczytać pliku kolejki: ${e.code || e.message}`;
    }

    const moved = fs.existsSync(this.file) ? quarantine(this.file) : null;
    let restored = null;
    try { restored = validJobs(readJson(this.backup)); } catch (_) { restored = null; }
    if (restored) {
      // Kopia mogła być o jeden zapis starsza od uszkodzonego pliku: każde
      // niezakończone zlecenie mogło już trafić do drukarki.
      for (const j of Object.values(restored)) {
        if (j.state === 'queued' || j.state === 'printing') {
          Object.assign(j, {
            state: 'uncertain', category: Category.UNCERTAIN, reported: false, updatedAt: Date.now(),
            error: 'Kolejka odtworzona z kopii zapasowej po uszkodzeniu pliku — sprawdź na drukarce, czy paragon się wydrukował.',
          });
        }
      }
      this.jobs = restored;
    }
    this.alert = `Kolejka paragonów była uszkodzona (${problem})`
      + (moved ? `; plik odłożono jako ${path.basename(moved)}` : '')
      + (restored ? '; odtworzono ją z kopii zapasowej (niedokończone zlecenia oznaczone jako niepewne)' : '; kopii zapasowej brak')
      + '. Drukowanie wstrzymane — sprawdź drukarkę i panel, potem odblokuj: menu Narzędzia → Odblokuj kolejkę paragonów.';
  }

  save() {
    // Najstarsze zakończone zlecenia wylatują, żeby plik nie rósł bez końca
    // (zlecenia z ostrzeżeniem zostają, dopóki człowiek ich nie zobaczy).
    const done = Object.values(this.jobs).filter((j) => ['printed', 'failed', 'uncertain'].includes(j.state)
      && j.reported && !j.conflict && !j.orphaned);
    if (done.length > KEEP_FINISHED) {
      done.sort((a, b) => a.updatedAt - b.updatedAt).slice(0, done.length - KEEP_FINISHED).forEach((j) => delete this.jobs[j.id]);
    }
    const data = JSON.stringify({ jobs: this.jobs });
    writeFileDurable(this.file, data); // najpierw główny plik — atomowo, z fsync
    try {
      writeFileDurable(this.backup, data);
    } catch (e) {
      this.log('[fiscal] zapis kopii zapasowej kolejki:', e.message || e);
    }
  }

  acknowledgeAlert() {
    if (!this.alert) return false;
    this.alert = null;
    this.save();
    return true;
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
    if (!this.jobs[id]) return;
    Object.assign(this.jobs[id], patch, { updatedAt: Date.now() });
    this.save();
  }

  /** Raport przyjęty — bez ruszania updatedAt (zmiana w trakcie wysyłki nie zginie). */
  markReported(id, stamp) {
    const j = this.jobs[id];
    if (!j || j.updatedAt !== stamp) return;
    j.reported = true;
    this.save();
  }

  remove(id) {
    if (!this.jobs[id]) return;
    delete this.jobs[id];
    this.save();
  }

  nextDue() {
    const now = Date.now();
    return Object.values(this.jobs)
      .filter((j) => j.state === 'queued' && !j.orphaned && j.nextAttemptAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt)[0] || null;
  }

  /** Zlecenia czekające na ponowienie po błędzie (albo w trakcie druku). */
  pendingWithError() {
    return Object.values(this.jobs).filter((j) => !j.orphaned
      && (j.state === 'printing' || (j.state === 'queued' && (j.attempts > 0 || j.error)))).length;
  }

  alerts() {
    return Object.values(this.jobs).filter((j) => j.orphaned || j.conflict)
      .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20)
      .map((j) => ({ id: j.id, state: j.state, receipt_number: j.receipt_number, orphaned: !!j.orphaned, note: j.conflict }));
  }

  counts() {
    const out = {};
    for (const j of Object.values(this.jobs)) {
      const k = j.orphaned ? 'orphaned' : j.state;
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  }
}

// --- trwały stan agenta (agentId, licznik tokenów) --------------------------------------

class AgentState {
  constructor(file, { log = () => {} } = {}) {
    this.file = file;
    this.log = log;
    this.data = {};
    this.alert = null;
    try {
      const d = readJson(file);
      if (d !== null) {
        if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('nieprawidłowa struktura');
        this.data = d;
      }
    } catch (e) {
      const moved = fs.existsSync(file) ? quarantine(file) : null;
      this.alert = `Plik stanu agenta był uszkodzony (${e.code || e.message}) — aplikacja dostała nowy identyfikator agenta`
        + (moved ? ` (stary plik: ${path.basename(moved)})` : '')
        + '. Zlecenia pobrane wcześniej przez ten komputer trzeba przekazać w panelu (Przekaż ponownie).';
      this.data = {};
    }
    if (typeof this.data.agentId !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(this.data.agentId) || this.data.agentId === 'default') {
      this.data.agentId = `desktop-${crypto.randomUUID()}`;
      this._save();
    }
  }

  get agentId() { return this.data.agentId; }

  loadToken() { return Number.isInteger(this.data.nextToken) ? this.data.nextToken : null; }

  saveToken(v) {
    this.data.nextToken = v;
    this._save(true);
  }

  _save(rethrow = false) {
    try {
      writeFileDurable(this.file, JSON.stringify(this.data));
    } catch (e) {
      this.log('[fiscal] zapis stanu agenta:', e.message || e);
      if (rethrow) throw e;
    }
  }
}

const result = (j) => ({ id: j.id, state: j.state, receipt_number: j.receipt_number, error: j.error,
                         error_code: j.error_code, category: j.category, attempts: j.attempts });

/** 'ok' | 'orphan' | 'rejected' — jak potraktować odpowiedź serwera na raport. */
function reportVerdict(resp) {
  if (!resp || typeof resp !== 'object') return 'ok'; // stary serwer / brak treści
  if (resp.found === false || resp.state === 'unknown') return 'orphan';
  if (resp.accepted === false || REJECTED_STATES.has(resp.state)) return 'rejected';
  return 'ok';
}

class FiscalAgent {
  /**
   * @param {object} o
   * @param {string} o.dataDir     katalog na kolejkę i stan agenta
   * @param {object} o.platform    { claim(printerStatus, {agentId}) -> job|null,
   *                                 report(result, {agentId}) -> {ok, state, accepted} | {found:false, state:'unknown'} }
   * @param {object} o.config      { enabled, host, port, encoding, allowFiscal }
   * @param {object} [o.limits]    { maxTotal, maxItems, requireReference } — NIE z panelu WWW
   * @param {function} [o.log]
   */
  constructor({ dataDir, platform, config, log = console.log, pollMs = POLL_MS, limits = {} }) {
    this.log = log;
    this.store = new JobStore(path.join(dataDir, 'fiscal-jobs.json'), { log });
    this.state = new AgentState(path.join(dataDir, 'fiscal-agent-state.json'), { log });
    this.agentId = this.state.agentId;
    // Tokeny ramek rosną także między restartami (licznik w pliku stanu).
    this.tokens = persistentTokens({ load: () => this.state.loadToken(), save: (v) => this.state.saveToken(v), log });
    this.mutex = new Mutex(); // jedna operacja na drukarce naraz, także po zmianie ustawień
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.platform = platform;
    this.pollMs = pollMs;
    this.timer = null;
    this.running = false;
    this.lastPlatformError = null;
    this.lastLoopError = null;
    this.claimBlocked = null;
    this.lastStatus = null;
    this.lastStatusAt = 0;
    if (this.store.alert) this.log(`[fiscal] ${this.store.alert}`);
    if (this.state.alert) this.log(`[fiscal] ${this.state.alert}`);
    this.setConfig(config);
  }

  setConfig(config) {
    this.config = { enabled: false, host: '', port: 6666, encoding: 'cp1250', allowFiscal: false, ...config };
    const { host, port, encoding, allowFiscal } = this.config;
    this.printer = host
      ? new Printer(new PosnetClient({ host, port: Number(port), encoding, tokenSource: this.tokens }),
        { allowFiscal, limits: this.limits, mutex: this.mutex })
      : null;
    this.lastStatus = null;
    this.lastStatusAt = 0;
  }

  _meta() { return { agentId: this.agentId }; }

  start() {
    const n = this.store.blocked ? 0 : this.store.recover();
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

  /** Po ręcznym sprawdzeniu drukarki (menu Narzędzia): zdejmij blokadę uszkodzonej kolejki. */
  acknowledgeQueueAlert() {
    const ok = this.store.acknowledgeAlert();
    if (ok) {
      this.log('[fiscal] blokada kolejki zdjęta przez użytkownika');
      this.wake();
    }
    return ok;
  }

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
      this.lastLoopError = null;
    } catch (e) {
      this.lastLoopError = e.message || String(e);
      this.log('[fiscal] błąd pętli:', e);
    } finally {
      this.running = false;
    }
  }

  async _claimBlockReason() {
    if (!this.printer) return 'nie ustawiono adresu drukarki';
    const pending = this.store.pendingWithError();
    if (pending) return `${pending} zleceń czeka na ponowienie po błędzie — nowe nie są pobierane`;
    // Niegotowa drukarka: sprawdzaj częściej, żeby szybko wznowić pobieranie.
    const notReady = this.lastStatus && !this.lastStatus.ready;
    const st = await this.printerStatus(notReady ? this.pollMs : STATUS_MAX_AGE_MS);
    if (!st.online) return `drukarka niedostępna (${st.description || st.error || 'brak połączenia'})`;
    if (!st.ready) return `drukarka nie jest gotowa (${st.description})`;
    if (st.fiscal && !this.config.allowFiscal) return 'drukarka w trybie FISKALNYM, a druk fiskalny jest wyłączony w ustawieniach';
    return null;
  }

  async syncPlatform() {
    if (this.store.blocked) {
      this.claimBlocked = 'kolejka uszkodzona — drukowanie wstrzymane';
      return;
    }
    const errors = [];
    for (const j of Object.values(this.store.jobs).filter((x) => !x.reported && !x.orphaned)) {
      const stamp = j.updatedAt;
      const sent = j.state;
      try {
        const resp = await this.platform.report(result(j), this._meta());
        this._handleReport(j.id, sent, resp, stamp);
      } catch (e) {
        // Błąd jednego raportu nie blokuje pozostałych ani pobierania zleceń.
        errors.push(`raport ${j.id}: ${e.message || e}`);
      }
    }

    // Nie pobieramy nowych zleceń, których i tak nie da się wydrukować. UWAGA:
    // claim jest też heartbeatem — przy niegotowej drukarce serwer przestaje
    // widzieć agenta jako online (przyczyna widoczna w karcie aplikacji).
    try {
      this.claimBlocked = await this._claimBlockReason();
      if (!this.claimBlocked) {
        const job = await this.platform.claim(this.lastStatus, this._meta());
        if (job && job.id) {
          // Znane zlecenie — tylko odeślij stan (serwer je zna, więc nie jest osierocone;
          // notatkę 404 kasujemy, notatkę o konflikcie zostawiamy).
          if (!this.store.add(job.id, job.receipt)) {
            const known = this.store.jobs[job.id];
            this.store.update(job.id, known.orphaned ? { reported: false, orphaned: false, conflict: null } : { reported: false });
          }
          this.lastStatusAt = 0;
        }
      }
    } catch (e) {
      errors.push(`claim: ${e.message || e}`);
    }
    this.lastPlatformError = errors.length ? errors.join('; ') : null;
    if (errors.length) this.log('[fiscal] synchronizacja z serwerem:', this.lastPlatformError);
  }

  _handleReport(id, sentState, resp, stamp) {
    const j = this.store.jobs[id];
    if (!j) return;
    const verdict = reportVerdict(resp);
    if (verdict === 'ok') {
      if (sentState !== 'printing') this.store.markReported(id, stamp);
      return;
    }
    if (verdict === 'orphan') {
      const note = j.state === 'printed'
        ? `Paragon nr ${j.receipt_number} wydrukowany, ale serwer nie zna zlecenia (404) — wpisz go ręcznie.`
        : 'Serwer nie zna tego zlecenia (404) — aplikacja go nie drukuje i nie raportuje; sprawdź w panelu.';
      this.store.update(id, { orphaned: true, reported: true, conflict: note });
      this.log(`[fiscal] ${id}: ${note}`);
      return;
    }
    // Odrzucone (anulowane / zastąpione / cudze): porzuć, jeśli na pewno nic nie wydrukowano.
    if (j.state === 'queued' || j.state === 'failed') {
      this.store.remove(id);
      this.log(`[fiscal] ${id}: porzucone bez drukowania (serwer: ${resp.state}, accepted=${resp.accepted})`);
      return;
    }
    const note = `KONFLIKT: serwer odrzucił raport '${sentState}' (stan na serwerze: ${resp.state}), a lokalnie zlecenie jest '${j.state}'`
      + (j.receipt_number ? ` z paragonem nr ${j.receipt_number}` : '')
      + ' — możliwy niechciany lub podwójny paragon, sprawdź w panelu.';
    if (j.updatedAt === stamp) this.store.update(id, { conflict: note, reported: true });
    this.log(`[fiscal] ${id}: ${note}`);
  }

  // Tuż przed drukiem pytamy serwer, czy zlecenie wciąż jest nasze (anulowanie w międzyczasie).
  async _confirmBeforePrint(job) {
    let resp;
    try {
      resp = await this.platform.report({ ...result(job), state: 'printing' }, this._meta());
    } catch (e) {
      const msg = e.message || String(e);
      this.store.update(job.id, { error: `Brak potwierdzenia zlecenia z serwera przed drukiem (${msg}) — ponowię.`,
                                  nextAttemptAt: Date.now() + CONFIRM_RETRY_MS, reported: false });
      this.log(`[fiscal] ${job.id}: brak potwierdzenia z serwera (${msg}) — czeka`);
      return false;
    }
    if (reportVerdict(resp) === 'ok') return true;
    this._handleReport(job.id, 'printing', resp, this.store.jobs[job.id].updatedAt);
    return false;
  }

  async processOne() {
    if (this.store.blocked || !this.printer) return false;
    const job = this.store.nextDue();
    if (!job) return false;
    if (!(await this._confirmBeforePrint(job))) return true;
    const cur = this.store.jobs[job.id];
    if (!cur || cur.state !== 'queued' || cur.orphaned) return true; // stan zmienił się w międzyczasie
    // 'printing' trafia na dysk (fsync) PRZED wysłaniem czegokolwiek do drukarki.
    this.store.update(cur.id, { state: 'printing', attempts: cur.attempts + 1 });
    try {
      const number = await this.printer.printReceipt(cur.receipt);
      this.store.update(cur.id, { state: 'printed', receipt_number: number, error: null, error_code: null, category: null, reported: false });
      this.log(`[fiscal] ${cur.id}: paragon nr ${number}`);
    } catch (e) {
      // Nie-PrinterError (np. AmbiguousCommand, który się przecisnął) = błąd w kodzie -> niepewne.
      const err = e instanceof PrinterError ? e : new PrinterError(Category.INTERNAL, `Nieoczekiwany błąd: ${e.message}`);
      if (err.retryable) {
        const delay = Math.min(MAX_BACKOFF_MS, 5000 * 2 ** Math.max(0, cur.attempts - 1));
        this.store.update(cur.id, { state: 'queued', error: err.message, error_code: err.code, category: err.category,
                                    nextAttemptAt: Date.now() + delay, reported: false });
        this.log(`[fiscal] ${cur.id}: ${err.message} — ponowienie za ${Math.round(delay / 1000)} s`);
      } else {
        // Bezpiecznik trybu fiskalnego: zlecenie czeka (co 5 min), aż włączysz druk fiskalny.
        const state = err.safetyBlock ? 'queued'
          : [Category.UNCERTAIN, Category.INTERNAL].includes(err.category) ? 'uncertain' : 'failed';
        this.store.update(cur.id, { state, error: err.message, error_code: err.code, category: err.category,
                                    nextAttemptAt: Date.now() + MAX_BACKOFF_MS, reported: false });
        this.log(`[fiscal] ${cur.id}: ${err.message}`);
      }
    }
    this.lastStatusAt = 0;
    return true;
  }

  alerts() {
    const out = [];
    if (this.store.alert) out.push(this.store.alert);
    if (this.state.alert) out.push(this.state.alert);
    if (this.lastLoopError) out.push(`Błąd pętli agenta: ${this.lastLoopError}`);
    for (const a of this.store.alerts()) out.push(`${a.id}: ${a.note}`);
    return out;
  }

  async info(refresh = false) {
    const alerts = this.alerts();
    const problems = [...alerts, ...(this.lastPlatformError ? [this.lastPlatformError] : [])];
    return {
      config: this.config,
      agentId: this.agentId,
      limits: this.limits,
      printer: this.config.host ? await this.printerStatus(refresh ? 0 : STATUS_MAX_AGE_MS) : null,
      queue: this.store.counts(),
      blocked: this.store.blocked,
      claimBlocked: this.claimBlocked,
      alerts,
      // Panel WWW (DesktopFiscalCard) pokazuje tylko platformError — alerty idą na początek.
      platformError: problems.length ? problems.join(' | ') : null,
      recent: Object.values(this.store.jobs).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10).map(result),
    };
  }
}

module.exports = { FiscalAgent, JobStore, AgentState, reportVerdict, writeFileDurable };
