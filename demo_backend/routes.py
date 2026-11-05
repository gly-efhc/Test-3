"""Operator-only DEMO control plane; does not create or migrate tables."""
from __future__ import annotations

import hashlib
import secrets
import time
from collections import deque
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from demo_backend.config import DemoConfig
from demo_backend.schema import check_user, inspect_schema
from demo_backend.session_store import DemoSession, DemoSessionStore


class LoginRequest(BaseModel):
    password: str = Field(min_length=1)


class SelectGlobalIdRequest(BaseModel):
    global_id: str = Field(pattern=r"^[0-9]{10}$")


class DemoTopUpRequest(BaseModel):
    amount_efhc: str = Field(pattern=r"^\d+(?:\.\d{1,8})?$")


class DemoRoutes:
    def __init__(self, config: DemoConfig, sessions: DemoSessionStore):
        self.config = config
        self.sessions = sessions
        self.router = APIRouter(prefix="/api/staging", tags=["EFHC-DEMO-TEST-ONLY"])
        self._failures: dict[str, deque[float]] = {}
        self._register()

    def _dependency(self):
        from app.core.database_core import fastapi_db_dependency
        return fastapi_db_dependency

    def _current_session(self, request: Request) -> DemoSession:
        raw = request.headers.get("Authorization", "")
        raw_token = raw[7:] if raw.startswith("Bearer ") else ""
        cookie_token = request.cookies.get(self.config.cookie_name, "")
        token = raw_token or cookie_token
        session = self.sessions.get(token)
        if session is None:
            raise HTTPException(status_code=401, detail="DEMO_SESSION_REQUIRED")
        return session

    def _write_session_cookie(self, response: Response, session: DemoSession) -> None:
        response.set_cookie(
            key=self.config.cookie_name, value=session.token,
            httponly=True, secure=self.config.cookie_secure,
            samesite="none" if self.config.cookie_secure else "lax",
            max_age=8 * 3600, path="/",
        )
        response.headers["Cache-Control"] = "no-store"

    def _require_csrf(self, request: Request, session: DemoSession) -> None:
        candidate = request.headers.get("X-EFHC-Test-CSRF", "")
        if not candidate or not secrets.compare_digest(candidate, session.csrf):
            raise HTTPException(status_code=403, detail="DEMO_CSRF_REQUIRED")

    def _register(self) -> None:
        get_db = self._dependency()
        router = self.router

        @router.post("/login")
        async def login(body: LoginRequest, request: Request, response: Response,
                        db: AsyncSession = Depends(get_db)):
            ip = request.client.host if request.client else "unknown"
            attempts = self._failures.setdefault(ip, deque())
            now = time.monotonic()
            while attempts and attempts[0] < now - 60:
                attempts.popleft()
            if len(attempts) >= 6:
                raise HTTPException(status_code=429, detail="DEMO_LOGIN_RATE_LIMIT")
            if not secrets.compare_digest(body.password, self.config.password):
                attempts.append(now)
                raise HTTPException(status_code=401, detail="DEMO_BAD_CREDENTIALS")
            if not await check_user(db, self.config.initial_global_id):
                raise HTTPException(status_code=409, detail="DEMO_INITIAL_USER_NOT_ACTIVE_IN_NEON")
            attempts.clear()
            session = self.sessions.issue(self.config.initial_global_id)
            self._write_session_cookie(response, session)
            return {"ok": True, "global_id": session.global_id, "csrf": session.csrf,
                    "mode": "neon-test", "expires_at_epoch": int(session.expires_at), "demo_bearer_token": session.token}

        @router.get("/session")
        async def session(request: Request, response: Response):
            s = self._current_session(request)
            response.headers["Cache-Control"] = "no-store"
            return {"ok": True, "global_id": s.global_id, "csrf": s.csrf,
                    "mode": "neon-test", "expires_at_epoch": int(s.expires_at)}

        @router.post("/select-global-id")
        async def select_global_id(body: SelectGlobalIdRequest, request: Request,
                                   response: Response, db: AsyncSession = Depends(get_db)):
            old = self._current_session(request)
            self._require_csrf(request, old)
            if not await check_user(db, body.global_id):
                raise HTTPException(status_code=404, detail="GLOBAL_ID_NOT_FOUND_IN_NEON_TEST")
            fresh = self.sessions.replace(old.token, body.global_id)
            if fresh is None:
                raise HTTPException(status_code=401, detail="DEMO_SESSION_EXPIRED")
            self._write_session_cookie(response, fresh)
            return {"ok": True, "global_id": fresh.global_id, "csrf": fresh.csrf,
                    "mode": "neon-test", "expires_at_epoch": int(fresh.expires_at), "demo_bearer_token": fresh.token}

        @router.post("/logout")
        async def logout(request: Request, response: Response):
            s = self._current_session(request)
            self._require_csrf(request, s)
            self.sessions.revoke(s.token)
            response.delete_cookie(self.config.cookie_name, path="/",
                                   secure=self.config.cookie_secure,
                                   samesite="none" if self.config.cookie_secure else "lax")
            response.headers["Cache-Control"] = "no-store"
            return {"ok": True}

        @router.get("/schema")
        async def schema(request: Request, db: AsyncSession = Depends(get_db)):
            self._current_session(request)
            return await inspect_schema(db)

        @router.get("/routes")
        async def routes(request: Request):
            self._current_session(request)
            from fastapi.routing import APIRoute
            items = []
            for r in request.app.routes:
                if isinstance(r, APIRoute):
                    items.append({"path": r.path, "methods": sorted(r.methods or [])})
            return {"ok": True, "count": len(items), "routes": items}

        @router.get("/health")
        async def health(db: AsyncSession = Depends(get_db)):
            from sqlalchemy import text
            from sqlalchemy.exc import SQLAlchemyError
            try:
                ok = (await db.execute(text("SELECT 1"))).scalar_one_or_none() == 1
            except SQLAlchemyError:
                raise HTTPException(status_code=503, detail="NEON_TEST_UNAVAILABLE") from None
            return {"ok": ok, "mode": "neon-test", "database": "connected" if ok else "unavailable"}

        @router.get("/bank-snapshot")
        async def bank_snapshot(request: Request, db: AsyncSession = Depends(get_db)):
            self._current_session(request)
            from app.services.bank_metrics_snapshot_service import (
                refresh_bank_metrics_snapshot, snapshot_to_facts,
            )
            try:
                snapshot = await refresh_bank_metrics_snapshot(db)
                facts = snapshot_to_facts(snapshot)
                await db.commit()
            except Exception:
                await db.rollback()
                raise
            return {"ok": True, "source": "efhc_core.bank_metrics_snapshot",
                    "facts": facts}

        @router.post("/topup")
        async def topup(body: DemoTopUpRequest, request: Request,
                        idem_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
                        db: AsyncSession = Depends(get_db)):
            """Test bank transfer through exact production ledger, never a fake chain receipt."""
            s = self._current_session(request)
            self._require_csrf(request, s)
            if not idem_key or not (8 <= len(idem_key) <= 128):
                raise HTTPException(status_code=400, detail="IDEMPOTENCY_KEY_REQUIRED")
            amount = Decimal(body.amount_efhc)
            if amount <= 0 or amount > Decimal(self.config.max_topup_efhc):
                raise HTTPException(status_code=422, detail="DEMO_TOPUP_AMOUNT_OUT_OF_RANGE")
            from app.services.admin.admin_rbac import RBAC, AdminAuthError
            from app.services.admin.admin_logging import AdminLogger
            from app.services.transactions_service import credit_user_from_bank_nocommit
            from app.services.transactions_service import IdempotencyPayloadConflictError
            actor = int(self.config.initial_global_id)
            try:
                admin = await RBAC.resolve_admin(db, actor)
            except AdminAuthError:
                raise HTTPException(status_code=409, detail="DEMO_OPERATOR_ADMIN_NOT_CONFIGURED_IN_NEON") from None
            hashed = hashlib.sha256(("efhc-demo-topup-v1:" + idem_key).encode()).hexdigest()
            try:
                result = await credit_user_from_bank_nocommit(db,
                    global_id=int(s.global_id), amount=amount,
                    reason="demo_simulated_external_deposit", idempotency_key=hashed,
                    meta={"simulation": True, "external_transfer": False, "source": "demo_backend"})
                if result.detail != "idempotent":
                    await AdminLogger.write(db, actor_global_id=actor, admin_id=admin.id,
                        action="DEMO_EXTERNAL_TOPUP", entity="users", entity_id=int(s.global_id),
                        details=f"DEMO amount={amount}; idk_sha256={hashed}", required=True)
                await db.commit()
            except IdempotencyPayloadConflictError:
                await db.rollback()
                raise HTTPException(status_code=409, detail="DEMO_IDEMPOTENCY_CONFLICT") from None
            except Exception:
                await db.rollback()
                raise
            return {"ok": True, "global_id": s.global_id, "amount_efhc": str(amount),
                    "main_balance": str(result.user__main__balance),
                    "bank_balance": str(result.bank__main__balance),
                    "reused": result.detail == "idempotent", "real_funds": False}

        @router.post("/energy/tick")
        async def energy_tick(request: Request):
            s = self._current_session(request)
            self._require_csrf(request, s)
            from app.scheduler.generate_energy import run_once
            return {"ok": True, "result": await run_once(), "real_funds": False}
