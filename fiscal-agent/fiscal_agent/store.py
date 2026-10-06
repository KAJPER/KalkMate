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
"""

FINAL = {"printed", "failed", "uncertain"}


class Store:
    def __init__(self, path: str) -> None:
        self._db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.executescript(SCHEMA)
        self._lock = threading.Lock()

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
            "SELECT id FROM jobs WHERE state='queued' AND next_attempt_at<=? ORDER BY created_at LIMIT 1",
            (time.time(),)).fetchone()
        return row["id"] if row else None

    def mark_printing(self, job_id: str) -> None:
        with self._lock:
            self._db.execute("UPDATE jobs SET state='printing', attempts=attempts+1, updated_at=? WHERE id=?",
                             (time.time(), job_id))

    def finish(self, job_id: str, state: str, *, receipt_number: int | None = None, error: str | None = None,
               error_code: int | None = None, category: str | None = None, retry_in: float = 0) -> None:
        with self._lock:
            self._db.execute(
                "UPDATE jobs SET state=?, receipt_number=?, error=?, error_code=?, category=?, "
                "next_attempt_at=?, updated_at=?, reported=CASE WHEN source='platform' THEN 0 ELSE 1 END "
                "WHERE id=?",
                (state, receipt_number, error, error_code, category, time.time() + retry_in, time.time(), job_id))

    def requeue(self, job_id: str) -> None:
        with self._lock:
            self._db.execute("UPDATE jobs SET state='queued', next_attempt_at=0, error=NULL, error_code=NULL, "
                             "category=NULL, updated_at=?, reported=CASE WHEN source='platform' THEN 0 ELSE 1 END "
                             "WHERE id=?", (time.time(), job_id))

    def mark_unreported(self, job_id: str) -> None:
        with self._lock:
            self._db.execute("UPDATE jobs SET reported=0 WHERE id=?", (job_id,))

    def unreported(self) -> list[ReceiptResult]:
        rows = self._db.execute("SELECT * FROM jobs WHERE reported=0 AND source='platform'").fetchall()
        return [self._result(r) for r in rows]

    def mark_reported(self, job_id: str, updated_at: float) -> None:
        with self._lock:
            # Nie gubimy zmiany, która zaszła w trakcie wysyłania raportu.
            self._db.execute("UPDATE jobs SET reported=1 WHERE id=? AND updated_at<=?", (job_id, updated_at))

    def updated_at(self, job_id: str) -> float:
        row = self._db.execute("SELECT updated_at FROM jobs WHERE id=?", (job_id,)).fetchone()
        return row["updated_at"] if row else 0.0

    def counts(self) -> dict[str, int]:
        rows = self._db.execute("SELECT state, COUNT(*) n FROM jobs GROUP BY state").fetchall()
        return {r["state"]: r["n"] for r in rows}

    @staticmethod
    def _result(row: sqlite3.Row) -> ReceiptResult:
        return ReceiptResult(id=row["id"], state=row["state"], receipt_number=row["receipt_number"],
                             error=row["error"], error_code=row["error_code"], category=row["category"],
                             attempts=row["attempts"])
