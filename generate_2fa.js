const OTPAuth = require('otpauth');
const qrcode = require('qrcode');

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

// Generate a QR code to the scratch directory
qrcode.toFile('./qr_code.png', uri, {
  color: {
    dark: '#000',  // Blue dots
    light: '#0000' // Transparent background
  }
}, function (err) {
  if (err) throw err;
  console.log('QR Code generated at ./qr_code.png');
});
