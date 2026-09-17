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

// Domeny, do których linki otwierają się WEWNĄTRZ okna aplikacji.
// Wszystko inne leci do domyślnej przeglądarki systemowej.
const ALLOWED_INAPP_DOMAINS = ['kalkmate.pl', 'basecourier.com', 'inpost.pl'];

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
ipcMain.on('kalkmate:open-flasher', () => launchFlasher());

// === Ustawienia aplikacji (drukarka etykiet) — userData/settings.json ===
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_SETTINGS = { labelPrinter: 'VEVOR Y486' };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2)); } catch (_) { /* nieistotne */ }
  return next;
}

// === Cichy druk etykiety PDF ===
// Panel WWW woła window.kalkmateDesktop.printLabel('/api/admin/orders/<id>/basecourier/label').
// Pobieramy PDF sesją aplikacji (cookie admina), zapisujemy do temp i drukujemy
// przez pdf-to-printer (SumatraPDF w srodku) bez okna dialogu, z ustawieniami
// jak w oknie systemowym: drukarka etykiet, pionowo, 1 kopia, monochromatycznie,
// dopasowanie do etykiety 100x150 (PDF z serwera jest juz przyciety do etykiety).
ipcMain.handle('kalkmate:print-label', async (_event, urlPath) => {
  const { print } = require('pdf-to-printer');
  const settings = loadSettings();
  let url;
  try {
    url = new URL(String(urlPath), ADMIN_URL);
  } catch (_) {
    return { ok: false, error: 'Nieprawidlowy adres etykiety' };
  }
  if (!isAllowedInApp(url.toString()) || !url.hostname.endsWith('kalkmate.pl')) {
    return { ok: false, error: 'Etykiete mozna drukowac tylko z kalkmate.pl' };
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
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return ALLOWED_INAPP_DOMAINS.some((domain) => hostMatchesDomain(parsed.hostname, domain));
  } catch (err) {
    return false;
  }
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

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInApp(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedInApp(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

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
    mainWindow = createWindow();
    Menu.setApplicationMenu(buildMenu(mainWindow));

    // Ręczny hak testowy — pozwala zweryfikować spawn programatora bez klikania
    // w menu (headless). Nieszkodliwy w normalnym użyciu (zmienna zwykle nieustawiona).
    if (process.env.KALKMATE_TEST_FLASHER === '1') {
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

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
