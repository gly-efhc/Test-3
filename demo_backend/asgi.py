"""Isolated FastAPI DEMO entrypoint: original EFHC routes, Neon TEST.

Run only as `uvicorn demo_backend.asgi:app` from a tree where unmodified
`backend/` is a sibling of `demo_backend/`. Never run as `app.main:app` for DEMO.
"""
from __future__ import annotations

import asyncio
import logging
import os
import secrets
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from demo_backend.config import DemoConfig, prepare_backend_environment
from demo_backend.session_store import DemoSessionStore

CONFIG = DemoConfig.from_env()
prepare_backend_environment(CONFIG)
_backend_path = Path(__file__).resolve().parent.parent / "backend"
if not (_backend_path / "app" / "main.py").is_file():
    raise RuntimeError("Unmodified EFHC backend/ is required next to demo_backend/")
if str(_backend_path) not in sys.path:
    sys.path.insert(0, str(_backend_path))

from app.main import app  # noqa: E402
from app.core.database_core import db_session  # noqa: E402
from demo_backend.auth_adapter import install_demo_auth, authenticate_native_session  # noqa: E402
from demo_backend.schema import inspect_schema, check_user  # noqa: E402
from demo_backend.routes import DemoRoutes  # noqa: E402
from demo_backend.scheduler import periodic_energy  # noqa: E402
from demo_backend.tonconnect import install_test_tonconnect_binding  # noqa: E402
from fastapi import Request  # noqa: E402
from app.identity.auth_errors import AuthSessionNotActive, InvalidAuthRuntimeInput  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

log = logging.getLogger("efhc.demo_backend")
SESSIONS = DemoSessionStore()
install_demo_auth(SESSIONS)
install_test_tonconnect_binding(app, SESSIONS)
app.include_router(DemoRoutes(CONFIG, SESSIONS).router)

from demo_backend.security import is_external_blocked  # noqa: E402

@app.middleware("http")
async def demo_isolation(request: Request, call_next):
    path = request.url.path.rstrip("/") or "/"
    method = request.method.upper()
    if method == "OPTIONS":
        return await call_next(request)
    origin = request.headers.get("origin")
    if origin and origin not in CONFIG.cors_origins:
        return JSONResponse({"detail": "DEMO_ORIGIN_FORBIDDEN"}, status_code=403)
    # Retain original external integrations (including TON Proof). The real
    # underlying backend verifies proofs, source signatures and credentials.
    if is_external_blocked(method, path):
        return JSONResponse({"detail": "DEMO_UNSUPPORTED_OPERATION"}, status_code=409)
    # TON/Telegram login endpoints are public by contract: they perform their
    # *own* verification, then issue a native Neon TEST auth session.
    public = path in {
        "/api/staging/login", "/api/staging/health", "/meta/health_db",
        "/openapi.json", "/docs", "/redoc",
        "/api/auth/ton/challenge", "/api/auth/ton/proof",
        "/api/auth/telegram/session",
    }
    if path.startswith("/api/") and not public:
        auth = request.headers.get("authorization", "")
        header_token = auth[7:] if auth.startswith("Bearer ") else None
        cookie_token = request.cookies.get(CONFIG.cookie_name)
        token = header_token or cookie_token
        operator_session = SESSIONS.get(token)
        if path.startswith("/api/staging/"):
            # Native user proof must not grant access to test operator controls.
            if operator_session is None:
                return JSONResponse({"detail": "DEMO_OPERATOR_SESSION_REQUIRED"}, status_code=401)
        elif operator_session is None:
            if not header_token:
                return JSONResponse({"detail": "DEMO_SESSION_REQUIRED"}, status_code=401)
            try:
                await authenticate_native_session(header_token)
            except (AuthSessionNotActive, InvalidAuthRuntimeInput, ValueError):
                return JSONResponse({"detail": "DEMO_NATIVE_SESSION_INVALID"}, status_code=401)
        if operator_session is not None:
            # CSRF applies to browser-cookie operator commands; the operator
            # console sends this header for all writes regardless of bearer.
            if method not in {"GET", "HEAD"}:
                received = request.headers.get("X-EFHC-Test-CSRF", "")
                if not received or not secrets.compare_digest(received, operator_session.csrf):
                    return JSONResponse({"detail": "DEMO_CSRF_REQUIRED"}, status_code=403)
            # The production deps expect a Bearer token even when the test
            # operator authenticated through a HttpOnly cookie.
            request.scope["headers"] = [
                (k, v) for k, v in request.scope["headers"]
                if k.lower() != b"authorization"
            ] + [(b"authorization", f"Bearer {token}".encode("ascii"))]
    response = await call_next(request)
    if path.startswith("/api/"):
        response.headers["X-EFHC-Data-Source"] = "neon-test"
        response.headers["Cache-Control"] = "no-store"
    return response

# The original FastAPI CORS list lacks the TEST CSRF header. This additional
# outer middleware allows only exact origins and only the TEST header set.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CONFIG.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key",
                   "X-Request-ID", "X-EFHC-Test-CSRF", "X-EFHC-Handoff",
                   "X-Telegram-Init-Data", "X-Event-Id", "X-Delivery-Id",
                   "X-Telegram-Bot-Api-Secret-Token"],
    expose_headers=["X-EFHC-Data-Source", "Content-Disposition", "X-Request-ID"],
)

_original_lifespan = app.router.lifespan_context


@asynccontextmanager
async def _demo_lifespan(app_instance):
    # Fail before serving if the expected physical Neon schema or initial
    # test account is missing. Never create tables or auto-migrate here.
    async with db_session() as db:
        inventory = await inspect_schema(db)
        if not inventory["ok"]:
            raise RuntimeError("NEON_TEST_SCHEMA_MISSING: " + ", ".join(inventory["missing"]))
        if not await check_user(db, CONFIG.initial_global_id):
            raise RuntimeError("DEMO_INITIAL_GLOBAL_ID does not exist in Neon TEST")
    log.info("EFHC DEMO Neon verified: physical=%d, views=%d",
             inventory["physical_tables"], inventory["views"])
    async with _original_lifespan(app_instance):
        stop = asyncio.Event()
        task = (asyncio.create_task(periodic_energy(stop, CONFIG.scheduler_period))
                if CONFIG.scheduler_enabled else None)
        try:
            yield
        finally:
            stop.set()
            if task is not None:
                await task


app.router.lifespan_context = _demo_lifespan
app.title = "EFHC DEMO backend — Neon TEST, genuine EFHC business API"
