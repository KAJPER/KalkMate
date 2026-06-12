const OTPAuth = require('otpauth');
const qrcode = require('qrcode');

const secret = new OTPAuth.Secret({ size: 20 });
const secretBase32 = secret.base32;

console.log("Your new ADMIN_2FA_SECRET is: " + secretBase32);

let totp = new OTPAuth.TOTP({
  issuer: "KalkMate",
  label: "Admin",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  secret: secret,
});

const uri = totp.toString();

qrcode.toFile('./qr_code.png', uri, {
  color: {
    dark: '#000000',
    light: '#ffffff'
  }
}, function (err) {
  if (err) throw err;
  console.log('QR Code generated at ./qr_code.png');
});
