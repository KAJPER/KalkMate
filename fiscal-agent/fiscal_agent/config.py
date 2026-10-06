from __future__ import annotations

import os
from dataclasses import dataclass, field


def _bool(name: str, default: bool = False) -> bool:
    v = os.environ.get(name)
    return default if v is None else v.strip().lower() in {"1", "true", "yes", "tak"}


@dataclass(frozen=True)
class Config:
    printer_host: str = field(default_factory=lambda: os.environ.get("PRINTER_HOST", "192.168.1.50"))
    printer_port: int = field(default_factory=lambda: int(os.environ.get("PRINTER_PORT", "6666")))
    printer_encoding: str = field(default_factory=lambda: os.environ.get("PRINTER_ENCODING", "cp1250"))
    printer_timeout: float = field(default_factory=lambda: float(os.environ.get("PRINTER_TIMEOUT", "15")))
    # Bezpiecznik: dopóki 0, agent odmawia druku na drukarce w trybie fiskalnym.
    allow_fiscal: bool = field(default_factory=lambda: _bool("FISCAL_ALLOW_REAL"))

    api_token: str = field(default_factory=lambda: os.environ.get("AGENT_API_TOKEN", ""))
    db_path: str = field(default_factory=lambda: os.environ.get("AGENT_DB", "fiscal-agent.db"))

    platform_url: str = field(default_factory=lambda: os.environ.get("PLATFORM_URL", "").rstrip("/"))
    platform_token: str = field(default_factory=lambda: os.environ.get("PLATFORM_AGENT_TOKEN", ""))
    poll_interval: float = field(default_factory=lambda: float(os.environ.get("POLL_INTERVAL", "10")))
    status_interval: float = field(default_factory=lambda: float(os.environ.get("STATUS_INTERVAL", "60")))
    max_backoff: float = field(default_factory=lambda: float(os.environ.get("MAX_BACKOFF", "300")))

    @property
    def platform_enabled(self) -> bool:
        return bool(self.platform_url and self.platform_token)
