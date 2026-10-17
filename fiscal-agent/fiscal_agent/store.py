"""Lokalna, trwała kolejka zleceń (SQLite).

Zasada bezpieczeństwa: zlecenie w stanie `printing` po restarcie agenta NIE jest
ponawiane automatycznie — przechodzi w `uncertain`, bo paragon mógł się już
wydrukować. Decyzję podejmuje człowiek (sprawdza drukarkę / kopię elektroniczną).
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid

from .models import ReceiptRequest, ReceiptResult

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT PRIMARY KEY,
  source          TEXT NOT NULL,
  payload         TEXT NOT NULL,
  state           TEXT NOT NULL,
  receipt_number  INTEGER,
  error           TEXT,
  error_code      INTEGER,
  category        TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at REAL NOT NULL DEFAULT 0,
  created_at      REAL NOT NULL,
  updated_at      REAL NOT NULL,
  reported        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS jobs_due ON jobs (state, next_attempt_at);
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""

# Kolumny dodane po pierwszym wydaniu (migracja istniejących baz).
_COLUMNS = {
    "orphaned": "INTEGER NOT NULL DEFAULT 0",   # serwer nie zna zlecenia (404) — nie drukujemy, nie raportujemy
    "conflict": "TEXT",                          # serwer odrzucił raport zlecenia, które mogło się wydrukować
}

FINAL = {"printed", "failed", "uncertain"}
# Porzucić bez drukowania (abandon) wolno tylko 'queued' i 'failed' — w obu
# na pewno nic nie wydrukowano ('failed' tylko po dowodzie, patrz printer.py).


class Store:
    def __init__(self, path: str) -> None:
        self._db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute("PRAGMA synchronous=FULL")  # stan 'printing' musi być na dysku PRZED drukiem
        self._db.executescript(SCHEMA)
        cols = {r["name"] for r in self._db.execute("PRAGMA table_info(jobs)")}
        for name, ddl in _COLUMNS.items():
            if name not in cols:
                self._db.execute(f"ALTER TABLE jobs ADD COLUMN {name} {ddl}")
        self._lock = threading.Lock()

    # --- meta (agent id, licznik tokenów) ------------------------------------
    def get_meta(self, key: str) -> str | None:
        row = self._db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None

    def set_meta(self, key: str, value: str) -> None:
        with self._lock:
            self._db.execute("INSERT INTO meta (key, value) VALUES (?, ?) "
                             "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))

    def agent_id(self) -> str:
        """Trwały identyfikator instancji agenta (serwer oddaje pobrane zlecenia tylko jemu)."""
        with self._lock:
            self._db.execute("INSERT OR IGNORE INTO meta (key, value) VALUES ('agent_id', ?)",
                             (f"py-{uuid.uuid4()}",))
            return self._db.execute("SELECT value FROM meta WHERE key='agent_id'").fetchone()["value"]

    def load_token(self) -> int | None:
        v = self.get_meta("posnet_token")
        return int(v) if v and v.isdigit() else None

    def save_token(self, value: int) -> None:
        self.set_meta("posnet_token", str(int(value)))

    # --- zlecenia --------------------------------------------------------------
    def recover(self) -> int:
        with self._lock:
            cur = self._db.execute(
                "UPDATE jobs SET state='uncertain', category='uncertain', reported=0, updated_at=?, "
                "error='Agent został zatrzymany w trakcie drukowania — sprawdź, czy paragon się wydrukował.' "
                "WHERE state='printing'", (time.time(),))
            return cur.rowcount

    def add(self, req: ReceiptRequest, source: str) -> tuple[ReceiptResult, bool]:
        """Dodaje zlecenie. Ten sam id = to samo zlecenie (idempotencja)."""
        now = time.time()
        with self._lock:
            row = self._db.execute("SELECT * FROM jobs WHERE id=?", (req.id,)).fetchone()
            if row:
                return self._result(row), False
            self._db.execute(
                "INSERT INTO jobs (id, source, payload, state, created_at, updated_at, reported) "
                "VALUES (?, ?, ?, 'queued', ?, ?, ?)",
                (req.id, source, req.model_dump_json(), now, now, 0 if source == "platform" else 1))
            row = self._db.execute("SELECT * FROM jobs WHERE id=?", (req.id,)).fetchone()
            return self._result(row), True

    def get(self, job_id: str) -> ReceiptResult | None:
        row = self._db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        return self._result(row) if row else None

    def source(self, job_id: str) -> str | None:
        row = self._db.execute("SELECT source FROM jobs WHERE id=?", (job_id,)).fetchone()
        return row["source"] if row else None

    def payload(self, job_id: str) -> ReceiptRequest:
        row = self._db.execute("SELECT payload FROM jobs WHERE id=?", (job_id,)).fetchone()
        return ReceiptRequest.model_validate(json.loads(row["payload"]))

    def next_due(self) -> str | None:
        row = self._db.execute(
            "SELECT id FROM jobs WHERE state='queued' AND orphaned=0 AND next_attempt_at<=? "
            "ORDER BY created_at LIMIT 1", (time.time(),)).fetchone()
        return row["id"] if row else None

    def mark_printing(self, job_id: str) -> bool:
        """queued -> printing (compare-and-set). False = ktoś zmienił stan w międzyczasie."""
        with self._lock:
            cur = self._db.execute(
                "UPDATE jobs SET state='printing', attempts=attempts+1, updated_at=? "
                "WHERE id=? AND state='queued' AND orphaned=0", (time.time(), job_id))
            return cur.rowcount == 1

    def finish(self, job_id: str, state: str, *, receipt_number: int | None = None, error: str | None = None,
               error_code: int | None = None, category: str | None = None, retry_in: float = 0) -> None:
        with self._lock:
            self._db.execute(
                "UPDATE jobs SET state=?, receipt_number=?, error=?, error_code=?, category=?, "
                "next_attempt_at=?, updated_at=?, reported=CASE WHEN source='platform' THEN 0 ELSE 1 END "
                "WHERE id=?",
                (state, receipt_number, error, error_code, category, time.time() + retry_in, time.time(), job_id))

    def defer(self, job_id: str, error: str, retry_in: float) -> None:
        """Zlecenie czeka (bez próby druku), np. brak potwierdzenia z serwera."""
        with self._lock:
            self._db.execute("UPDATE jobs SET error=?, next_attempt_at=?, updated_at=? WHERE id=? AND state='queued'",
                             (error, time.time() + retry_in, time.time(), job_id))

    def requeue(self, job_id: str) -> bool:
        """Ręczne ponowienie — tylko z failed/uncertain (compare-and-set)."""
        with self._lock:
            cur = self._db.execute(
                "UPDATE jobs SET state='queued', next_attempt_at=0, error=NULL, error_code=NULL, "
                "category=NULL, conflict=NULL, updated_at=?, reported=CASE WHEN source='platform' THEN 0 ELSE 1 END "
                "WHERE id=? AND state IN ('failed', 'uncertain') AND orphaned=0", (time.time(), job_id))
            return cur.rowcount == 1

    def abandon(self, job_id: str) -> bool:
        """Usuwa zlecenie BEZ drukowania — tylko gdy na pewno nic nie wydrukowano."""
        with self._lock:
            cur = self._db.execute("DELETE FROM jobs WHERE id=? AND state IN ('queued', 'failed')", (job_id,))
            return cur.rowcount == 1

    def mark_orphaned(self, job_id: str, note: str) -> None:
        with self._lock:
            self._db.execute("UPDATE jobs SET orphaned=1, reported=1, conflict=?, updated_at=? WHERE id=?",
                             (note, time.time(), job_id))

    def mark_conflict(self, job_id: str, note: str, updated_at: float) -> None:
        with self._lock:
            self._db.execute("UPDATE jobs SET conflict=?, reported=1 WHERE id=? AND updated_at<=?",
                             (note, job_id, updated_at))

    def mark_unreported(self, job_id: str) -> None:
        with self._lock:
            # Serwer właśnie oddał to zlecenie w claim — zna je, więc nie jest osierocone
            # (notatkę 404 kasujemy, notatkę o konflikcie zostawiamy).
            self._db.execute("UPDATE jobs SET reported=0, conflict=CASE WHEN orphaned=1 THEN NULL ELSE conflict END, "
                             "orphaned=0 WHERE id=?", (job_id,))

    def unreported(self) -> list[ReceiptResult]:
        rows = self._db.execute(
            "SELECT * FROM jobs WHERE reported=0 AND source='platform' AND orphaned=0").fetchall()
        return [self._result(r) for r in rows]

    def mark_reported(self, job_id: str, updated_at: float) -> None:
        with self._lock:
            # Nie gubimy zmiany, która zaszła w trakcie wysyłania raportu.
            self._db.execute("UPDATE jobs SET reported=1 WHERE id=? AND updated_at<=?", (job_id, updated_at))

    def updated_at(self, job_id: str) -> float:
        row = self._db.execute("SELECT updated_at FROM jobs WHERE id=?", (job_id,)).fetchone()
        return row["updated_at"] if row else 0.0

    def pending_with_error(self) -> int:
        """Zlecenia czekające na ponowienie po błędzie (albo w trakcie druku)."""
        row = self._db.execute(
            "SELECT COUNT(*) n FROM jobs WHERE orphaned=0 AND (state='printing' OR "
            "(state='queued' AND (attempts>0 OR error IS NOT NULL)))").fetchone()
        return row["n"]

    def alerts(self) -> list[dict]:
        rows = self._db.execute(
            "SELECT id, state, receipt_number, orphaned, conflict FROM jobs WHERE orphaned=1 OR conflict IS NOT NULL "
            "ORDER BY updated_at DESC LIMIT 20").fetchall()
        return [{"id": r["id"], "state": r["state"], "receipt_number": r["receipt_number"],
                 "orphaned": bool(r["orphaned"]), "note": r["conflict"]} for r in rows]

    def counts(self) -> dict[str, int]:
        rows = self._db.execute("SELECT state, COUNT(*) n FROM jobs GROUP BY state").fetchall()
        return {r["state"]: r["n"] for r in rows}

    @staticmethod
    def _result(row: sqlite3.Row) -> ReceiptResult:
        return ReceiptResult(id=row["id"], state=row["state"], receipt_number=row["receipt_number"],
                             error=row["error"], error_code=row["error_code"], category=row["category"],
                             attempts=row["attempts"])
