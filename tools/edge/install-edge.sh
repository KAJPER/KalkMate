#!/usr/bin/env bash
# Instalacja serwera posredniczacego KalkMate na czystym VPS (Ubuntu 22.04+/Debian 12).
#
#   sudo bash install-edge.sh <host> <ip-serwera-glownego> <email-do-letsencrypt>
#   np. sudo bash install-edge.sh ca.kalkmate.pl 51.75.12.34 kontakt@kalkmate.pl
#
# PRZED uruchomieniem: rekord DNS A (i AAAA, jesli VPS ma IPv6) <host> -> IP tego VPS-a.
# PO: na serwerze glownym wlacz milan-realip.conf z IP tego VPS-a (README.md).
set -euo pipefail

HOST="${1:?podaj host, np. ca.kalkmate.pl}"
ORIGIN_IP="${2:?podaj IP serwera glownego (Mediolan)}"
EMAIL="${3:?podaj e-mail do Let's Encrypt}"
DIR="$(cd "$(dirname "$0")" && pwd)"
# Bez IPv6 w jadrze (np. czesc VPS-ow OpenVZ) "listen [::]" wywala nginx.
strip_v6() { if [[ -f /proc/net/if_inet6 ]]; then cat; else grep -v 'listen \[::\]'; fi; }

if [[ $EUID -ne 0 ]]; then echo "Uruchom jako root (sudo)."; exit 1; fi

echo "== Pakiety"
apt-get update -y
apt-get install -y nginx certbot ca-certificates curl

echo "== Sprawdzam DNS"
MYIP="$(curl -4 -fsS https://api.ipify.org || true)"
DNSIP="$(getent ahostsv4 "$HOST" | awk 'NR==1{print $1}' || true)"
if [[ -n "$MYIP" && "$DNSIP" != "$MYIP" ]]; then
  echo "UWAGA: $HOST wskazuje na '$DNSIP', a ten VPS ma '$MYIP'. Popraw rekord A i uruchom ponownie."
  exit 1
fi

echo "== Certyfikat Let's Encrypt (HTTP-01)"
mkdir -p /var/www/certbot
cat > /etc/nginx/sites-available/kalkmate-acme <<CONF
server { listen 80; listen [::]:80; server_name $HOST;
  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location / { return 404; } }
CONF
strip_v6 < /etc/nginx/sites-available/kalkmate-acme > /tmp/kalkmate-acme && mv /tmp/kalkmate-acme /etc/nginx/sites-available/kalkmate-acme
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/kalkmate-acme /etc/nginx/sites-enabled/kalkmate-acme
nginx -t && systemctl reload nginx
# RSA jak na serwerze glownym: lancuch od ISRG Root X1 (YR), ktory zna kazdy firmware
# z pakietem rootow (src/kalkmate_certs.h).
certbot certonly --webroot -w /var/www/certbot -d "$HOST" \
  --email "$EMAIL" --agree-tos --non-interactive --key-type rsa

echo "== Konfiguracja nginx"
rm -f /etc/nginx/sites-enabled/kalkmate-acme /etc/nginx/sites-available/kalkmate-acme
sed -e "s/__EDGE_HOST__/$HOST/g" -e "s/__ORIGIN_IP__/$ORIGIN_IP/g" \
  "$DIR/nginx-edge.conf.template" | strip_v6 > /etc/nginx/sites-available/kalkmate-edge
ln -sf /etc/nginx/sites-available/kalkmate-edge /etc/nginx/sites-enabled/kalkmate-edge
nginx -t && systemctl reload nginx

# certbot (pakiet) ma wlasny timer odnawiania; po odnowieniu przeladuj nginx.
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow 80/tcp; ufw allow 443/tcp
fi

echo "== Test"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "https://$HOST/api/device/solve" || true)"
echo "POST https://$HOST/api/device/solve -> HTTP $CODE (oczekiwane 401/403/400 = serwer glowny odpowiada; 502 = brak polaczenia z Mediolanem)"
echo
echo "Gotowe. Teraz na serwerze glownym: set_real_ip_from $MYIP; (tools/edge/README.md, krok 3)."
