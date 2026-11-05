"""Runtime smoke without a database connection: route/auth guards only.

The Neon DB is intentionally never contacted here. True Neon integration tests
require a private TEST DSN, which must not be embedded in these artifacts.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def test_asgi_route_registration_and_tonconnect_proof_payload_offline():
    root = Path(__file__).resolve().parents[2]
    env = {
        **os.environ,
        "PYTHONPATH": f"{root}:{root / 'backend'}",
        "EFHC_DEMO_ENABLED": "1",
        "DEMO_DATABASE_URL": "postgresql+asyncpg://efhc_test:fake@ep-fragrant-feather-zaribpm5.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require",
        "DEMO_NEON_HOST": "ep-fragrant-feather-zaribpm5.c-2.eu-west-2.aws.neon.tech",
        "DEMO_OPERATOR_PASSWORD": "smoke-test-operator-password-12345",
        "DEMO_INITIAL_GLOBAL_ID": "0000000002",
        "SECRET_KEY": "EFHC-smoke-only-secret-0123456789-not-for-prod",
        "ENV": "local",
        "ALLOW_REAL_FUNDS": "false",
        "RUN_EMBEDDED_TON_AGENT": "false",
    }
    script = r'''
import asyncio
import httpx
from demo_backend.asgi import app, SESSIONS
from app.identity.auth_dependencies import get_auth_session_service
from app.identity.auth_runtime_services import AuthSessionService
# The fake DSN is never used: stub out only the DB-backed factory. The real
# authenticate implementation + DEMO operator-session bridge still runs.
app.dependency_overrides[get_auth_session_service] = lambda: AuthSessionService.__new__(AuthSessionService)
async def main():
    session = SESSIONS.issue("0000000002")
    headers = {"Authorization": "Bearer " + session.token, "Origin": "https://gly-efhc.github.io"}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
        docs = await client.get("/openapi.json")
        assert docs.status_code == 200
        paths = docs.json()["paths"]
        for p in ("/api/sync/me", "/api/panels/activate", "/api/exchange/convert",
                  "/api/admin/reports/overview", "/api/wallets/tonconnect/proof-payload",
                  "/api/wallets/tonconnect/check-proof", "/api/wallets/connect",
                  "/api/staging/login", "/api/staging/select-global-id"):
            assert p in paths, p
        auth = await client.get("/api/auth/session", headers=headers)
        assert auth.status_code == 200, auth.text
        assert auth.json()["global_id"] == "0000000002"
        proof = await client.get("/api/wallets/tonconnect/proof-payload", headers=headers)
        assert proof.status_code == 200, proof.text
        assert proof.json()["ton_proof_payload"]
        assert proof.json()["domain"] == "gly-efhc.github.io"
        forbidden = await client.post("/api/staging/topup", headers=headers, json={"amount_efhc":"1.00000000"})
        assert forbidden.status_code == 403, forbidden.text
        unauth = await client.get("/api/staging/routes")
        assert unauth.status_code == 401, unauth.text
        print("ASGI_ROUTE_AND_TONCONNECT_SMOKE_PASS", len(paths))
asyncio.run(main())
'''
    p = subprocess.run([sys.executable, "-c", script], cwd=root, env=env, text=True,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=35)
    assert p.returncode == 0, (p.stdout[-3000:] + "\n" + p.stderr[-3500:])
    assert "ASGI_ROUTE_AND_TONCONNECT_SMOKE_PASS" in p.stdout
