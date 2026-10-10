# Buduje KalkMate Admin z podpisem code-signing (self-signed cert w certs/,
# zaufany lokalnie w Cert:\CurrentUser\Root + TrustedPublisher).
# Haslo do pfx nie jest w repo - certs/ jest w .gitignore.
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$pfx = Join-Path $here "certs\kalkmate-selfsigned.pfx"
$pwdFile = Join-Path $here "certs\pfx-password.txt"

if (-not (Test-Path $pfx) -or -not (Test-Path $pwdFile)) {
    throw "Brak certyfikatu w certs/ - uruchom setup certyfikatu najpierw."
}

$env:CSC_LINK = $pfx
$env:CSC_KEY_PASSWORD = (Get-Content $pwdFile -Raw).Trim()

Push-Location $here
try {
    npm run dist
} finally {
    Pop-Location
    Remove-Item Env:\CSC_LINK -ErrorAction SilentlyContinue
    Remove-Item Env:\CSC_KEY_PASSWORD -ErrorAction SilentlyContinue
}
