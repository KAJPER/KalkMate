'use strict';

// Preload: jedyny most miedzy panelem WWW (kalkmate.pl/admin) a Electronem.
// Dziala z sandbox: true + contextIsolation: true — wystawiamy TYLKO waskie,
// jawnie nazwane funkcje przez contextBridge; strona nie ma dostepu do Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kalkmateDesktop', {
  isDesktop: true,
  // Otwiera programator kalkulatorow (KalkMateFlasher.exe z zasobow aplikacji).
  openFlasher: () => ipcRenderer.send('kalkmate:open-flasher'),
  // Cichy druk etykiety PDF (bez okna dialogu) na zapamietanej drukarce
  // etykiet. url = sciezka na kalkmate.pl (np. /api/admin/orders/<id>/basecourier/label).
  // Zwraca { ok, printer, error? }.
  printLabel: (url) => ipcRenderer.invoke('kalkmate:print-label', String(url)),
});
