// Generuje nowy sekret TOTP dla panelu admina (ADMIN_2FA_SECRET) + kod QR.
//
// Uzycie:  node tools/generate_2fa.js [sciezka/do/qr.png]
//
// Audyt 2026-10-16: QR (= pelny sekret 2FA) zapisywal sie jako ./qr_code.png
// w katalogu repo i trafil do commita. Teraz plik idzie ZAWSZE poza repo:
// domyslnie do katalogu tymczasowego systemu, albo pod sciezke z argumentu
// (odrzucana, jesli wskazuje do wnetrza repozytorium).
const fs = require('fs');
const os = require('os');
const path = require('path');
const OTPAuth = require('otpauth');
const qrcode = require('qrcode');

const REPO_ROOT = path.resolve(__dirname, '..');

function insideRepo(p) {
  const rel = path.relative(REPO_ROOT, path.resolve(p));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

const outArg = process.argv[2];
const outFile = outArg
  ? path.resolve(outArg)
  : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kalkmate-2fa-')), 'qr_code.png');

if (insideRepo(outFile)) {
  console.error(`ODMOWA: ${outFile} jest wewnatrz repozytorium (${REPO_ROOT}).`);
  console.error('Kod QR zawiera sekret 2FA — zapisz go poza repo (np. bez argumentu -> katalog tymczasowy).');
  process.exit(1);
}

// Generate a random 2FA secret (base32)
const secret = new OTPAuth.Secret({ size: 20 });
const secretBase32 = secret.base32;

console.log("Your new ADMIN_2FA_SECRET is:");
console.log(secretBase32);

// Create a TOTP instance
let totp = new OTPAuth.TOTP({
  issuer: "KalkMate",
  label: "Admin",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  secret: secret,
});

// Get the otpauth:// URI
const uri = totp.toString();

qrcode.toFile(outFile, uri, {
  color: {
    dark: '#000',
    light: '#0000' // Transparent background
  }
}, function (err) {
  if (err) throw err;
  console.log(`QR Code generated at ${outFile}`);
  console.warn('');
  console.warn('UWAGA: sekret i kod QR daja pelny dostep do 2FA panelu admina.');
  console.warn('  - wpisz sekret tylko do .env.production.local na serwerze (nie do repo),');
  console.warn('  - zeskanuj QR w aplikacji uwierzytelniajacej i USUN plik:');
  console.warn(`      ${outFile}`);
  console.warn('  - nigdy nie commituj qr_code.png ani sekretu.');
});
