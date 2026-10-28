#!/usr/bin/env python3
# Monitoring kalkmate.pl — cron co 5 min (crontab ubuntu), NIEZALEZNY od Next.js:
# gdy aplikacja lezy, ten skrypt i tak dziala i wysyla maila (SMTP z
# .env.production.local, serwer pocztowy jest poza tym VPS-em).
#
# Sprawdza:
#   - https://kalkmate.pl/ i /en (przez nginx + TLS, jak klient),
#   - /api/health z x-cron-secret: baza, Stripe, Przelewy24,
#   - waznosc certyfikatu TLS (< 14 dni = ostrzezenie),
#   - wolne miejsce na dysku (> 90% = ostrzezenie).
# Alarm po 2 nieudanych sprawdzeniach z rzedu (~10 min — bez alarmow przy
# restarcie po wdrozeniu), przypomnienie co 6 h, mail "wrocilo" po naprawie.
# Stan w uptime_state.json obok skryptu, log w uptime.log.
import json, os, shutil, smtplib, socket, ssl, sys, time, urllib.request
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

BASE = "https://kalkmate.pl"
HERE = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(HERE, "website", ".env.production.local")
STATE_FILE = os.path.join(HERE, "uptime_state.json")
LOG_FILE = os.path.join(HERE, "uptime.log")
FAILS_TO_ALERT = 2
REMIND_EVERY_S = 6 * 3600
CERT_WARN_DAYS = 14
DISK_WARN_PCT = 90


def load_env(path):
    env = {}
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                v = v.strip()
                if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                    v = v[1:-1]
                env[k.strip()] = v
    except OSError:
        pass
    return env


def log(msg):
    line = f"[{time.strftime('%Y-%m-%dT%H:%M:%S')}] {msg}\n"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
        # log w ryzach (ostatnie ~3000 linii)
        if os.path.getsize(LOG_FILE) > 400_000:
            with open(LOG_FILE, encoding="utf-8") as f:
                tail = f.readlines()[-3000:]
            with open(LOG_FILE, "w", encoding="utf-8") as f:
                f.writelines(tail)
    except OSError:
        pass


def http_check(url, expect_text=None, headers=None, timeout=15):
    t0 = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": "KalkMate-Uptime/1.0", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(400_000).decode("utf-8", "replace")
            ms = int((time.time() - t0) * 1000)
            if r.status != 200:
                return False, f"HTTP {r.status} ({ms} ms)", body
            if expect_text and expect_text not in body:
                return False, f"brak tekstu '{expect_text}' ({ms} ms)", body
            if ms > 10_000:
                return False, f"bardzo wolno: {ms} ms", body
            return True, f"{ms} ms", body
    except urllib.error.HTTPError as e:
        body = e.read(20_000).decode("utf-8", "replace") if e.fp else ""
        return False, f"HTTP {e.code}", body
    except Exception as e:  # timeout, DNS, TLS, polaczenie
        return False, f"{type(e).__name__}: {e}"[:200], ""


def cert_days_left(host="kalkmate.pl"):
    ctx = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=10) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as s:
            exp = ssl.cert_time_to_seconds(s.getpeercert()["notAfter"])
    return (exp - time.time()) / 86400


def run_checks(env):
    results = {}
    ok, info, _ = http_check(BASE + "/", "KalkMate")
    results["strona glowna (/)"] = (ok, info)
    ok, info, _ = http_check(BASE + "/en", "KalkMate")
    results["strona /en"] = (ok, info)

    secret = env.get("CRON_SECRET", "")
    ok, info, body = http_check(BASE + "/api/health", headers={"x-cron-secret": secret} if secret else None)
    detail = {}
    try:
        detail = json.loads(body).get("checks", {}) if body else {}
    except ValueError:
        pass
    if detail:
        names = {"db": "baza danych", "stripe": "Stripe (platnosci kartowe)", "p24": "Przelewy24"}
        for k, c in detail.items():
            results[names.get(k, k)] = (bool(c.get("ok")), c.get("error") or f"{c.get('ms')} ms")
    else:
        results["API /api/health"] = (ok, info)

    try:
        days = cert_days_left()
        results["certyfikat TLS"] = (days >= CERT_WARN_DAYS, f"wazny jeszcze {days:.0f} dni")
    except Exception as e:
        results["certyfikat TLS"] = (False, f"{type(e).__name__}: {e}"[:200])

    du = shutil.disk_usage("/")
    pct = du.used / du.total * 100
    results["dysk /"] = (pct < DISK_WARN_PCT, f"zajete {pct:.0f}% (wolne {du.free / 1e9:.1f} GB)")
    return results


def send_mail(env, subject, lines):
    host, port = env.get("MAIL_HOST"), int(env.get("MAIL_PORT") or 465)
    user, pw = env.get("MAIL_USER"), env.get("MAIL_PASS")
    sender = env.get("MAIL_FROM_ADDRESS") or user
    to = env.get("ADMIN_ALERT_EMAIL") or "kontakt@kalkmate.pl"
    if not (host and user and pw and sender):
        log("brak konfiguracji MAIL_* — nie wyslano maila")
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"KalkMate monitoring <{sender}>"
    msg["To"] = to
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="kalkmate.pl")
    msg.set_content("\n".join(lines) + "\n\n-- \nuptime_check.py na serwerze (cron co 5 min), log: /home/ubuntu/kalkulator/uptime.log\n")
    try:
        if str(env.get("MAIL_SECURE", "true")).lower() == "true" or port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context()) as s:
                s.login(user, pw)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=20) as s:
                s.starttls(context=ssl.create_default_context())
                s.login(user, pw)
                s.send_message(msg)
        return True
    except Exception as e:
        log(f"blad wysylki maila: {type(e).__name__}: {e}"[:300])
        return False


def main():
    env = load_env(ENV_FILE)
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            state = json.load(f)
    except (OSError, ValueError):
        state = {}

    results = run_checks(env)
    now = time.time()
    failing, recovered = [], []
    for name, (ok, info) in results.items():
        st = state.setdefault(name, {"fails": 0, "alerted": 0, "since": 0})
        if ok:
            if st.get("alerted"):
                recovered.append((name, info, st.get("since", now)))
            state[name] = {"fails": 0, "alerted": 0, "since": 0}
        else:
            st["fails"] = st.get("fails", 0) + 1
            if not st.get("since"):
                st["since"] = now
            if st["fails"] >= FAILS_TO_ALERT and (not st.get("alerted") or now - st["alerted"] >= REMIND_EVERY_S):
                failing.append((name, info, st))

    # Sprawdzenie, ktorego juz nie ma w wynikach (np. "API /api/health" zastapione
    # szczegolami baza/Stripe/P24 po naprawie) — traktujemy jak naprawione.
    for name in [n for n in state if n not in results]:
        st = state.pop(name)
        if st.get("alerted"):
            recovered.append((name, "sprawdzane teraz szczegolowo", st.get("since", now)))

    bad = [f"{n}: {i}" for n, (ok, i) in results.items() if not ok]
    log("OK" if not bad else "PROBLEM — " + "; ".join(bad))

    if failing:
        lines = ["Problem z kalkmate.pl:", ""]
        for name, info, st in failing:
            mins = int((now - st["since"]) / 60)
            lines.append(f"  ✗ {name} — {info} (od ok. {mins} min)")
        lines += ["", "Pozostale sprawdzenia:"]
        lines += [f"  {'✓' if ok else '✗'} {n} — {i}" for n, (ok, i) in results.items()]
        lines += ["", "Co sprawdzic: `pm2 status`, `pm2 logs kalkmate --lines 100`, `sudo systemctl status nginx`."]
        subj = "[KalkMate] AWARIA: " + ", ".join(n for n, _, _ in failing)
        if send_mail(env, subj, lines):
            for _, _, st in failing:
                st["alerted"] = now
    if recovered:
        lines = ["Znow dziala:", ""]
        for name, info, since in recovered:
            mins = int((now - since) / 60) if since else 0
            lines.append(f"  ✓ {name} — {info} (problem trwal ok. {mins} min)")
        send_mail(env, "[KalkMate] Dziala: " + ", ".join(n for n, _, _ in recovered), lines)

    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f)
    os.replace(tmp, STATE_FILE)


if __name__ == "__main__":
    if "--test-mail" in sys.argv:
        ok = send_mail(load_env(ENV_FILE), "[KalkMate] Test monitoringu", ["Monitoring dziala — to jest mail testowy.", "", *[f"  {'✓' if o else '✗'} {n} — {i}" for n, (o, i) in run_checks(load_env(ENV_FILE)).items()]])
        print("mail wyslany" if ok else "mail NIE wyslany (patrz uptime.log)")
    else:
        main()
