'use strict';

const { app, BrowserWindow, Menu, shell, session, screen, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ADMIN_URL = 'https://kalkmate.pl/admin';
const PARTITION = 'persist:kalkmate';
const ICON_PATH = path.join(__dirname, 'assets', 'icon.ico');
const ERROR_PAGE = path.join(__dirname, 'error.html');
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');
const DEFAULT_BOUNDS = { width: 1400, height: 900 };

// Domeny, do których linki otwierają się WEWNĄTRZ okna aplikacji (tylko https).
// Wszystko inne leci do domyślnej przeglądarki systemowej.
const ALLOWED_INAPP_DOMAINS = ['kalkmate.pl', 'basecourier.com', 'inpost.pl'];

// === Bezpieczeństwo Electrona ===
// Jedyne originy, z których wolno wołać most window.kalkmateDesktop (IPC):
// programator, cichy druk, agent fiskalny. Okno pokazuje też strony kurierów —
// one NIE mogą sterować aplikacją.
const TRUSTED_ORIGINS = new Set(['https://kalkmate.pl', 'https://www.kalkmate.pl']);
// Uprawnienia przeglądarki dla panelu (kopiowanie do schowka). Reszta: odmowa —
// strona nie dostanie kamery, mikrofonu, lokalizacji, powiadomień itd.
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen']);
// Schematy, które wolno oddać systemowi (shell.openExternal). Bez file:, ms-msdt:,
// search-ms: i innych protokołów Windows — to znany wektor zdalnego wykonania kodu.
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

// Sandbox dla wszystkich rendererów, także okien otwieranych przez window.open.
app.enableSandbox();

function isTrustedUrl(urlString) {
  try {
    return TRUSTED_ORIGINS.has(new URL(String(urlString)).origin);
  } catch (_) {
    return false;
  }
}

// Wywołanie IPC tylko z ramki kalkmate.pl (https) — nie ze strony kuriera ani error.html.
function fromKalkmate(event) {
  return !!(event && event.senderFrame) && isTrustedUrl(event.senderFrame.url);
}

function safeOpenExternal(urlString) {
  let parsed;
  try {
    parsed = new URL(String(urlString));
  } catch (_) {
    return;
  }
  if (!EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    console.warn(`[security] zablokowano otwarcie adresu ze schematem ${parsed.protocol}`);
    return;
  }
  shell.openExternal(parsed.toString()).catch(() => { /* brak przeglądarki — nic nie robimy */ });
}

let mainWindow = null;
let flasherChild = null;

// Uznajemy poprzedni proces za wciąż działający, jeśli mamy uchwyt do niego
// i nie zdążył jeszcze ustawić exitCode (czyli nie zdążyliśmy dostać 'exit').
function isFlasherRunning() {
  return !!flasherChild && flasherChild.exitCode === null;
}

function launchFlasher() {
  if (isFlasherRunning()) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Programator',
      message: 'Programator jest już uruchomiony',
    });
    return;
  }

  let exe;
  let args;
  let cwd;

  if (app.isPackaged) {
    exe = path.join(process.resourcesPath, 'flasher', 'KalkMateFlasher.exe');
    if (!fs.existsSync(exe)) {
      dialog.showErrorBox(
        'Programator',
        'Nie znaleziono KalkMateFlasher.exe w zasobach aplikacji (resources/flasher). Zainstaluj aplikację ponownie.'
      );
      return;
    }
    args = [];
    cwd = path.dirname(exe);
  } else {
    exe = 'python';
    args = [path.resolve(__dirname, '..', 'flasher', 'flasher.py')];
    cwd = path.resolve(__dirname, '..', 'flasher');
  }

  const child = spawn(exe, args, { detached: true, stdio: 'ignore', cwd });
  flasherChild = child;

  child.on('error', (err) => {
    dialog.showErrorBox('Programator', `Nie udało się uruchomić programatora: ${err.message}`);
  });

  child.unref();
}

// Mostek z panelu WWW: preload.js wystawia window.kalkmateDesktop.openFlasher(),
// a AdminShell pokazuje przycisk "Programator" tylko gdy ten obiekt istnieje.
ipcMain.on('kalkmate:open-flasher', (event) => {
  if (fromKalkmate(event)) launchFlasher();
});

// === Ustawienia aplikacji (drukarka etykiet) — userData/settings.json ===
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_SETTINGS = {
  labelPrinter: 'VEVOR Y486',
  // Druk fiskalny domyślnie wyłączony; allowFiscal = bezpiecznik trybu fiskalnego.
  fiscal: { enabled: false, host: '', port: 6666, encoding: 'cp1250', allowFiscal: false },
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try {
    // Atomowo (tmp + fsync + rename): urwany zapis nie zostawi pół pliku.
    require('./fiscal/agent').writeFileDurable(SETTINGS_FILE, JSON.stringify(next, null, 2));
  } catch (_) { /* nieistotne */ }
  return next;
}

// === Cichy druk etykiety PDF ===
// Panel WWW woła window.kalkmateDesktop.printLabel('/api/admin/orders/<id>/basecourier/label').
// Pobieramy PDF sesją aplikacji (cookie admina), zapisujemy do temp i drukujemy
// przez pdf-to-printer (SumatraPDF w srodku) bez okna dialogu, z ustawieniami
// jak w oknie systemowym: drukarka etykiet, pionowo, 1 kopia, monochromatycznie,
// dopasowanie do etykiety 100x150 (PDF z serwera jest juz przyciety do etykiety).
// Tylko endpointy etykiet zamówień (sesja admina pobiera je bez pytania).
const LABEL_PATH = /^\/api\/admin\/orders\/[A-Za-z0-9_-]{1,100}\/[a-z0-9-]{1,40}\/label$/;

ipcMain.handle('kalkmate:print-label', async (event, urlPath) => {
  if (!fromKalkmate(event)) return { ok: false, error: 'Niedostępne' };
  const { print } = require('pdf-to-printer');
  const settings = loadSettings();
  let url;
  try {
    url = new URL(String(urlPath), ADMIN_URL);
  } catch (_) {
    return { ok: false, error: 'Nieprawidlowy adres etykiety' };
  }
  if (!isTrustedUrl(url.toString()) || !LABEL_PATH.test(url.pathname)) {
    return { ok: false, error: 'Etykiete mozna drukowac tylko z kalkmate.pl (/api/admin/orders/<id>/<kurier>/label)' };
  }

  let tmpFile = null;
  try {
    const res = await session.fromPartition(PARTITION).fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (_) { /* nie JSON */ }
      return { ok: false, error: `Nie udalo sie pobrac etykiety: ${msg}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 4).toString() !== '%PDF') {
      return { ok: false, error: 'Serwer nie zwrocil pliku PDF' };
    }
    tmpFile = path.join(app.getPath('temp'), `kalkmate-etykieta-${Date.now()}.pdf`);
    fs.writeFileSync(tmpFile, buf);

    await print(tmpFile, {
      printer: settings.labelPrinter,
      copies: 1,
      orientation: 'portrait',
      monochrome: true,
      scale: 'fit',
      silent: true,
    });
    return { ok: true, printer: settings.labelPrinter };
  } catch (err) {
    return { ok: false, error: `Blad drukowania (${settings.labelPrinter}): ${err && err.message ? err.message : err}`, printer: settings.labelPrinter };
  } finally {
    if (tmpFile) setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) { /* juz usuniete */ } }, 60_000);
  }
});

// === Cichy druk etykiety PRODUKTOWEJ (100x150, tyl + przod na sztuke) ===
// Etykieta produktowa to strona HTML (/admin/orders/<id>/etykieta), nie PDF z
// serwera. Otwieramy ja w ukrytym oknie z sesja aplikacji (cookie admina),
// czekamy az strona przydzieli numery seryjne i ustawi window.__kalkLabelReady,
// robimy printToPDF w rozmiarze z CSS (@page 100x150) i drukujemy dokladnie
// jak etykiete wysylkowa (pdf-to-printer, zapamietana drukarka etykiet).
const ORDER_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

ipcMain.handle('kalkmate:print-product-label', async (event, orderId, units) => {
  if (!fromKalkmate(event)) return { ok: false, error: 'Niedostępne' };
  const id = String(orderId || '');
  if (!ORDER_ID_RE.test(id)) return { ok: false, error: 'Nieprawidlowe ID zamowienia' };
  const unitList = Array.isArray(units)
    ? units.map((u) => Number(u)).filter((u) => Number.isInteger(u) && u >= 0 && u < 50)
    : [];
  const { print } = require('pdf-to-printer');
  const settings = loadSettings();
  const url = new URL(`${ADMIN_URL}/orders/${encodeURIComponent(id)}/etykieta`);
  if (unitList.length) url.searchParams.set('units', unitList.join(','));
  if (!isTrustedUrl(url.toString())) return { ok: false, error: 'Niedozwolony adres' };

  let win = null;
  let tmpFile = null;
  try {
    win = new BrowserWindow({
      show: false,
      width: 600,
      height: 900,
      webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    await win.loadURL(url.toString());
    // Czekaj na gotowosc strony (zamowienie + numery seryjne), max 25 s.
    const t0 = Date.now();
    let state = 0;
    while (Date.now() - t0 < 25000) {
      state = await win.webContents.executeJavaScript(
        'window.__kalkLabelError ? "err:" + window.__kalkLabelError : (window.__kalkLabelReady === true ? 1 : 0)', true);
      if (state !== 0) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (typeof state === 'string') return { ok: false, error: `Etykieta: ${state.slice(4)}` };
    if (state !== 1) return { ok: false, error: 'Etykieta nie zaladowala sie w 25 s (zaloguj sie ponownie?)' };
    await win.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(() => 1) : 1', true);

    const pdf = await win.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
      margins: { marginType: 'none' },
    });
    tmpFile = path.join(app.getPath('temp'), `kalkmate-etykieta-produktowa-${Date.now()}.pdf`);
    fs.writeFileSync(tmpFile, pdf);

    await print(tmpFile, {
      printer: settings.labelPrinter,
      copies: 1,
      orientation: 'portrait',
      monochrome: true,
      scale: 'fit',
      silent: true,
    });
    return { ok: true, printer: settings.labelPrinter };
  } catch (err) {
    return { ok: false, error: `Blad drukowania (${settings.labelPrinter}): ${err && err.message ? err.message : err}`, printer: settings.labelPrinter };
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    if (tmpFile) setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) { /* juz usuniete */ } }, 60_000);
  }
});

// === Agent fiskalny (drukarka fiskalna POSNET w sieci lokalnej) ===
// Logika w fiscal/ (port fiscal-agent/ z Pythona). Agent pobiera zlecenia
// paragonów z kalkmate.pl SESJĄ ADMINA tej aplikacji (bez osobnego tokenu)
// i drukuje je po TCP. Konfiguracja (IP, port, włączenie) z panelu WWW:
// /admin/fiscal -> window.kalkmateDesktop.fiscal. Opis: docs/fiskalizacja/README.md.
const { FiscalAgent } = require('./fiscal/agent');
const { DEFAULT_LIMITS } = require('./fiscal/printer');
const ORIGIN = new URL(ADMIN_URL).origin;
let fiscalAgent = null;

/**
 * POST do API agenta sesją admina. Zwraca { status, body }. Przy allow404
 * odpowiedź API „nie znam zlecenia” ({ state: 'unknown' }) nie jest błędem —
 * 404 z innego źródła (proxy, zły adres) nadal rzuca.
 */
async function platformPost(urlPath, body, meta = {}, { allow404 = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (meta.agentId) headers['x-fiscal-agent-id'] = meta.agentId;
  const res = await session.fromPartition(PARTITION).fetch(ORIGIN + urlPath, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('Zaloguj się do panelu w aplikacji (brak sesji admina)');
  if (res.status === 404 && allow404) {
    const j = await res.json().catch(() => null);
    if (j && j.state === 'unknown') return { status: 404, body: j };
  }
  if (!res.ok) throw new Error(`Serwer odpowiedział HTTP ${res.status}`);
  return { status: res.status, body: await res.json() };
}

// Limity kwot agenta — TYLKO z lokalnego settings.json (klucz fiscalLimits) albo
// zmiennych środowiska, nigdy z panelu WWW (skrypt na stronie nie może ich podnieść).
function fiscalLimits() {
  const s = loadSettings().fiscalLimits || {};
  const posInt = (...vals) => {
    for (const v of vals) {
      const n = Number(v);
      if (v !== undefined && v !== null && v !== '' && Number.isInteger(n) && n > 0) return n;
    }
    return undefined;
  };
  const env = process.env;
  const out = {
    maxTotal: posInt(env.KALKMATE_FISCAL_MAX_TOTAL, s.maxTotal) ?? DEFAULT_LIMITS.maxTotal,
    maxItems: posInt(env.KALKMATE_FISCAL_MAX_ITEMS, s.maxItems) ?? DEFAULT_LIMITS.maxItems,
    requireReference: DEFAULT_LIMITS.requireReference,
  };
  if (s.requireReference === false || env.KALKMATE_FISCAL_REQUIRE_REFERENCE === '0') out.requireReference = false;
  return out;
}

function startFiscalAgent() {
  fiscalAgent = new FiscalAgent({
    dataDir: app.getPath('userData'),
    config: loadSettings().fiscal,
    limits: fiscalLimits(),
    log: (...a) => console.log(...a),
    platform: {
      claim: async (printer, meta = {}) => (await platformPost('/api/fiscal/agent/claim',
        { version: `desktop-${app.getVersion()}`, printer, agentId: meta.agentId }, meta)).body.job,
      report: async (result, meta = {}) => {
        const r = await platformPost(`/api/fiscal/agent/jobs/${encodeURIComponent(result.id)}`,
          { ...result, agentId: meta.agentId }, meta, { allow404: true });
        return r.status === 404 ? { found: false, state: 'unknown', accepted: false } : r.body;
      },
    },
  });
  fiscalAgent.start();
}

// Adres prywatny (RFC 1918, link-local, loopback) albo nazwa w sieci lokalnej.
function isLanHost(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  return !host.includes('.') || /\.(local|lan|home|internal|home\.arpa)$/i.test(host);
}

ipcMain.handle('kalkmate:fiscal-info', async (event, refresh) => {
  if (!fromKalkmate(event) || !fiscalAgent) return { ok: false, error: 'Niedostępne' };
  return { ok: true, ...(await fiscalAgent.info(!!refresh)) };
});

ipcMain.handle('kalkmate:fiscal-config', async (event, patch) => {
  if (!fromKalkmate(event) || !fiscalAgent) return { ok: false, error: 'Niedostępne' };
  const p = patch && typeof patch === 'object' ? patch : {};
  const next = { ...fiscalAgent.config };
  if ('enabled' in p) next.enabled = !!p.enabled;
  if ('allowFiscal' in p) {
    const want = !!p.allowFiscal;
    if (want && !fiscalAgent.config.allowFiscal) {
      // Odblokowanie PRAWDZIWYCH paragonów potwierdza człowiek w natywnym oknie
      // aplikacji — skrypt na stronie (np. XSS) nie może go włączyć po cichu.
      const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Druk fiskalny',
        message: 'Włączyć druk PRAWDZIWYCH paragonów fiskalnych na tym komputerze?',
        detail: 'Każdy paragon trafi do pamięci fiskalnej i do CRK — nie da się go cofnąć. '
          + 'Włącz dopiero po testach na drukarce niefiskalnej.',
        buttons: ['Anuluj', 'Włącz druk fiskalny'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response !== 1) return { ok: false, error: 'Anulowano — druk fiskalny pozostaje zablokowany.' };
    }
    next.allowFiscal = want;
  }
  if ('host' in p) {
    const host = String(p.host).trim();
    if (host && !/^[a-zA-Z0-9.-]{1,253}$/.test(host)) return { ok: false, error: 'Nieprawidłowy adres drukarki' };
    if (host && host !== fiscalAgent.config.host && !isLanHost(host)) {
      // Drukarka fiskalna stoi w sieci lokalnej. Adres spoza niej potwierdza człowiek —
      // fałszywa „drukarka” w internecie mogłaby zwracać zmyślone numery paragonów.
      const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Drukarka fiskalna',
        message: `Adres ${host} nie wygląda na adres w sieci lokalnej. Na pewno tam stoi drukarka fiskalna?`,
        buttons: ['Anuluj', 'Tak, zapisz'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response !== 1) return { ok: false, error: 'Anulowano zmianę adresu drukarki.' };
    }
    next.host = host;
  }
  if ('port' in p) {
    const port = Number(p.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: 'Nieprawidłowy port' };
    next.port = port;
  }
  if ('encoding' in p) {
    if (!['cp1250', 'iso-8859-2'].includes(p.encoding)) return { ok: false, error: 'Nieobsługiwana strona kodowa' };
    next.encoding = p.encoding;
  }
  saveSettings({ fiscal: next });
  fiscalAgent.setConfig(next);
  fiscalAgent.wake();
  return { ok: true, ...(await fiscalAgent.info(true)) };
});

// Wybor drukarki etykiet z listy drukarek systemowych (menu Narzedzia).
async function chooseLabelPrinter(win) {
  const { getPrinters } = require('pdf-to-printer');
  let names = [];
  try { names = (await getPrinters()).map((p) => p.name); } catch (_) { /* fallback nizej */ }
  if (names.length === 0) {
    try { names = (await win.webContents.getPrintersAsync()).map((p) => p.name); } catch (_) { /* brak */ }
  }
  if (names.length === 0) {
    dialog.showErrorBox('Drukarka etykiet', 'Nie znaleziono zadnych drukarek w systemie.');
    return;
  }
  const current = loadSettings().labelPrinter;
  const buttons = names.slice(0, 8);
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Drukarka etykiet',
    message: `Wybierz drukarke do cichego druku etykiet.\nObecnie: ${current}`,
    buttons: [...buttons, 'Anuluj'],
    defaultId: Math.max(0, buttons.indexOf(current)),
    cancelId: buttons.length,
    noLink: true,
  });
  if (response >= 0 && response < buttons.length) {
    saveSettings({ labelPrinter: buttons[response] });
  }
}

function hostMatchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith('.' + domain);
}

function isAllowedInApp(urlString) {
  try {
    const parsed = new URL(urlString);
    // Tylko https: okno ma cookie sesji admina, a http dałoby się podmienić w sieci.
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_INAPP_DOMAINS.some((domain) => hostMatchesDomain(parsed.hostname, domain));
  } catch (err) {
    return false;
  }
}

// Strażnicy nawigacji dla KAŻDEGO webContents (główne okno i okna z window.open):
// obce adresy idą do przeglądarki systemowej (tylko bezpieczne schematy),
// <webview> zablokowany, okna potomne bez Node i z sandboxem.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());

  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInApp(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false },
        },
      };
    }
    safeOpenExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (!isAllowedInApp(url)) {
      event.preventDefault();
      safeOpenExternal(url);
    }
  });

  // Przekierowanie serwera (3xx) w ramce głównej — ta sama lista co dla nawigacji.
  contents.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
    const mainFrame = typeof event.isMainFrame === 'boolean' ? event.isMainFrame : isMainFrame;
    if (mainFrame && !isAllowedInApp(url)) {
      event.preventDefault();
      safeOpenExternal(url);
    }
  });
});

function setupPermissions(ses) {
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(details && details.requestingUrl));
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => (
    ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(requestingOrigin)
  ));
}

// Kolejka paragonów była uszkodzona — agent wstrzymał druk. Odblokowanie tylko
// tutaj (natywne okno), nie z panelu WWW.
async function unlockFiscalQueue(win) {
  if (!fiscalAgent || !fiscalAgent.store.blocked) {
    dialog.showMessageBox(win, { type: 'info', title: 'Kolejka paragonów', message: 'Kolejka paragonów działa normalnie — nie ma czego odblokowywać.' });
    return;
  }
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'Kolejka paragonów',
    message: 'Odblokować drukowanie paragonów?',
    detail: `${fiscalAgent.store.alert}\n\nOdblokuj dopiero po sprawdzeniu na drukarce i w panelu Fiskalizacja, `
      + 'które paragony już się wydrukowały.',
    buttons: ['Anuluj', 'Odblokuj'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (response === 1) fiscalAgent.acknowledgeQueueAlert();
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (typeof data.width === 'number' && typeof data.height === 'number') {
      return data;
    }
  } catch (err) {
    // Brak pliku przy pierwszym uruchomieniu albo uszkodzony JSON — użyj domyślnych.
  }
  return { ...DEFAULT_BOUNDS };
}

function saveWindowState(win) {
  try {
    if (win.isDestroyed()) return;
    const isMaximized = win.isMaximized();
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...bounds, isMaximized }));
  } catch (err) {
    // Zapis stanu okna nie jest krytyczny — ignoruj błędy (np. brak uprawnień).
  }
}

// Jeśli zapisana pozycja wypada całkowicie poza widocznymi ekranami
// (np. odłączono drugi monitor), porzuć x/y i wyśrodkuj okno.
function ensureVisibleOnDisplay(bounds) {
  if (typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return bounds;
  const displays = screen.getAllDisplays();
  const fitsSomeDisplay = displays.some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
  if (!fitsSomeDisplay) {
    const { x, y, ...rest } = bounds;
    return rest;
  }
  return bounds;
}

function buildMenu(win) {
  const template = [
    {
      label: 'Plik',
      submenu: [
        { label: 'Przeładuj', accelerator: 'CmdOrCtrl+R', click: () => win.webContents.reload() },
        { type: 'separator' },
        {
          label: 'Wyloguj i wyczyść sesję',
          click: async () => {
            // Najpierw uniewaznij sesje po stronie serwera (tabela AdminSession),
            // dopiero potem wyczysc lokalne cookies — inaczej skopiowane cookie
            // zostawaloby wazne az do wygasniecia.
            try {
              await win.webContents.executeJavaScript(
                'fetch("/api/admin/auth", { method: "DELETE" }).catch(() => {})',
                true
              );
            } catch (_) { /* offline / strona nie zaladowana — i tak czyscimy lokalnie */ }
            await session.fromPartition(PARTITION).clearStorageData();
            win.loadURL(ADMIN_URL);
          },
        },
        { type: 'separator' },
        { label: 'Zamknij', role: 'quit' },
      ],
    },
    {
      label: 'Widok',
      submenu: [
        {
          label: 'Wstecz',
          accelerator: 'Alt+Left',
          click: () => { if (win.webContents.canGoBack()) win.webContents.goBack(); },
        },
        {
          label: 'Dalej',
          accelerator: 'Alt+Right',
          click: () => { if (win.webContents.canGoForward()) win.webContents.goForward(); },
        },
        { type: 'separator' },
        { label: 'Powiększ', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: 'Pomniejsz', role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { label: 'Resetuj powiększenie', role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { type: 'separator' },
        {
          label: 'Narzędzia deweloperskie',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => win.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Narzędzia',
      submenu: [
        {
          label: 'Programator kalkulatorów',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => launchFlasher(),
        },
        { type: 'separator' },
        {
          label: 'Drukarka etykiet…',
          click: () => chooseLabelPrinter(win),
        },
        {
          label: 'Odblokuj kolejkę paragonów…',
          click: () => unlockFiscalQueue(win),
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

function createWindow() {
  const savedState = loadWindowState();
  const bounds = ensureVisibleOnDisplay({ ...DEFAULT_BOUNDS, ...savedState });

  const win = new BrowserWindow({
    width: bounds.width || DEFAULT_BOUNDS.width,
    height: bounds.height || DEFAULT_BOUNDS.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 960,
    minHeight: 600,
    // Pasek menu widoczny na stale — ukryty (Alt) byl nieodkrywalny,
    // wlasciciel nie znalazl "Narzedzia -> Programator".
    autoHideMenuBar: false,
    backgroundColor: '#f6f7f9',
    icon: ICON_PATH,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      // Tylko contextBridge + ipcRenderer (bezpieczne z sandbox: true) —
      // wystawia window.kalkmateDesktop dla panelu WWW.
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (bounds.isMaximized) win.maximize();

  win.loadURL(ADMIN_URL);

  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 400);
  };
  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('close', () => {
    clearTimeout(saveTimer);
    saveWindowState(win);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (errorCode === -3) return; // ERR_ABORTED — zwykle nieszkodliwe (przekierowanie/nawigacja)
    const target = validatedURL && /^https?:\/\//i.test(validatedURL) ? validatedURL : ADMIN_URL;
    win.loadFile(ERROR_PAGE, {
      query: { url: target, reason: `${errorDescription} (${errorCode})` },
    });
  });

  // window.open / will-navigate / will-redirect: app.on('web-contents-created') wyżej.
  return win;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    setupPermissions(session.fromPartition(PARTITION));
    setupPermissions(session.defaultSession);
    startFiscalAgent();
    mainWindow = createWindow();
    Menu.setApplicationMenu(buildMenu(mainWindow));

    // Ręczny hak testowy — pozwala zweryfikować spawn programatora bez klikania
    // w menu (headless). Tylko w trybie deweloperskim (npm start), nie w paczce.
    if (!app.isPackaged && process.env.KALKMATE_TEST_FLASHER === '1') {
      setTimeout(() => {
        try {
          launchFlasher();
          console.log('flasher spawn ok');
        } catch (err) {
          console.log('flasher spawn error', err && err.message);
        }
      }, 2000);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
        Menu.setApplicationMenu(buildMenu(mainWindow));
      }
    });
  });

  // Nie zamykamy aplikacji w trakcie drukowania paragonu (max 30 s czekania) —
  // przerwany druk kończy się stanem „niepewny” do ręcznego sprawdzenia.
  let quitWaitStarted = false;
  app.on('before-quit', (event) => {
    if (!fiscalAgent) return;
    if (fiscalAgent.running && !quitWaitStarted) {
      quitWaitStarted = true;
      event.preventDefault();
      const until = Date.now() + 30_000;
      const wait = setInterval(() => {
        if (!fiscalAgent.running || Date.now() > until) {
          clearInterval(wait);
          fiscalAgent.stop();
          app.quit();
        }
      }, 200);
      return;
    }
    fiscalAgent.stop();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
