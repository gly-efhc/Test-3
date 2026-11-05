"""Neon TEST-only TonConnect provider binding for verified DEMO operator.

The canonical wallet routes require a verified Telegram provider subject.
The current Neon TEST users have no such identities. A synthetic, reserved
positive test subject is used *only* for DEMO operator sessions so the exact
canonical ton_proof verifier and wallet-connect ledger can be exercised.
It is not inserted into user_identities, and is never presented as a verified
Telegram user. Native TON/Telegram logins continue to use the original strict
provider resolution. No new tables are introduced.
"""
from __future__ import annotations

from demo_backend.session_store import DemoSessionStore
from fastapi import Request

_TEST_PROVIDER_BASE = 4_000_000_000_000


def demo_proof_subject(global_id: str) -> int:
    """Stable positive ID for TEST proof-token binding, not Telegram identity."""
    if (not isinstance(global_id, str) or len(global_id) != 10
            or not global_id.isascii() or not global_id.isdecimal()
            or global_id == "0000000000"):
        raise ValueError("INVALID_GLOBAL_ID")
    return _TEST_PROVIDER_BASE + int(global_id)


def install_test_tonconnect_binding(app, store: DemoSessionStore) -> None:
    from app.deps import get_current_telegram_subject_id
    native_resolver = get_current_telegram_subject_id

    async def resolve_test_or_verified_subject(request: Request) -> int:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
        session = store.get(token)
        if session is not None:
            return demo_proof_subject(session.global_id)
        # Real provider session uses canonical verified identity mapping.
        return await native_resolver(request)

    app.dependency_overrides[native_resolver] = resolve_test_or_verified_subject
