"""Lokalne API agenta (FastAPI).

POST /receipts            — przyjmuje JSON paragonu, kolejkuje (opcjonalnie czeka na wynik)
GET  /receipts/{id}       — stan zlecenia (numer paragonu / błąd)
POST /receipts/{id}/retry — ponowienie zlecenia failed/uncertain (po sprawdzeniu drukarki!)
GET  /status              — status drukarki, kolejki i połączenia z platformą

Uruchomienie: uvicorn fiscal_agent.app:create_app --factory --host 127.0.0.1 --port 8765
"""

from __future__ import annotations

import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from .config import Config
from .models import ReceiptRequest, ReceiptResult
from .posnet.client import PosnetClient
from .printer import Printer
from .service import FiscalService, PlatformClient
from .store import Store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def build_service(cfg: Config) -> FiscalService:
    client = PosnetClient(cfg.printer_host, cfg.printer_port, timeout=cfg.printer_timeout,
                          encoding=cfg.printer_encoding)
    return FiscalService(cfg, Store(cfg.db_path), Printer(client, allow_fiscal=cfg.allow_fiscal),
                         PlatformClient(cfg) if cfg.platform_enabled else None)


def create_app(service: FiscalService | None = None, cfg: Config | None = None) -> FastAPI:
    cfg = cfg or Config()
    svc = service or build_service(cfg)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if not cfg.api_token:
            raise RuntimeError("Ustaw AGENT_API_TOKEN (Bearer token dla lokalnego API).")
        svc.start()
        yield
        svc.stop()

    app = FastAPI(title="KalkMate fiscal agent", lifespan=lifespan)

    def auth(authorization: str = Header(default="")) -> None:
        token = authorization.removeprefix("Bearer ").strip()
        if not cfg.api_token or not hmac.compare_digest(token, cfg.api_token):
            raise HTTPException(401, "Unauthorized")

    @app.post("/receipts", response_model=ReceiptResult, status_code=202, dependencies=[Depends(auth)])
    async def create_receipt(req: ReceiptRequest, wait: float = Query(0, ge=0, le=60)) -> ReceiptResult:
        res = svc.submit(req, "local")
        if wait:
            res = await run_in_threadpool(svc.wait, req.id, wait) or res
        return res

    @app.get("/receipts/{job_id}", response_model=ReceiptResult, dependencies=[Depends(auth)])
    def get_receipt(job_id: str) -> ReceiptResult:
        res = svc.store.get(job_id)
        if not res:
            raise HTTPException(404, "Nie ma takiego zlecenia")
        return res

    @app.post("/receipts/{job_id}/retry", response_model=ReceiptResult, dependencies=[Depends(auth)])
    def retry_receipt(job_id: str, confirm_not_printed: bool = False) -> ReceiptResult:
        res = svc.store.get(job_id)
        if not res:
            raise HTTPException(404, "Nie ma takiego zlecenia")
        if res.state == "printed":
            raise HTTPException(409, "Paragon już wydrukowany")
        if res.state == "uncertain" and not confirm_not_printed:
            raise HTTPException(409, "Stan niepewny: sprawdź drukarkę i potwierdź confirm_not_printed=true")
        return svc.retry(job_id)  # type: ignore[return-value]

    @app.get("/status", dependencies=[Depends(auth)])
    async def status(refresh: bool = False) -> dict:
        st = await run_in_threadpool(svc.printer_status, 0 if refresh else None)
        return {"printer": st.as_dict(), "queue": svc.store.counts(),
                "platform": {"enabled": svc.platform is not None, "error": svc.last_platform_error},
                "fiscal_allowed": cfg.allow_fiscal}

    return app

