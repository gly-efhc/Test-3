"""Ephemeral DEMO operator sessions; credentials never enter Neon."""
from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class DemoSession:
    token: str
    csrf: str
    global_id: str
    expires_at: float


class DemoSessionStore:
    def __init__(self, lifetime_seconds: int = 8 * 3600):
        self._sessions: dict[str, DemoSession] = {}
        self._lock = threading.RLock()
        self._ttl = lifetime_seconds

    def issue(self, global_id: str) -> DemoSession:
        with self._lock:
            self._purge()
            token = secrets.token_urlsafe(48)
            session = DemoSession(token, secrets.token_urlsafe(32), global_id, time.time() + self._ttl)
            self._sessions[token] = session
            return session

    def get(self, token: str | None) -> DemoSession | None:
        if not token or not isinstance(token, str):
            return None
        with self._lock:
            session = self._sessions.get(token)
            if session is not None and session.expires_at <= time.time():
                self._sessions.pop(token, None)
                return None
            return session

    def replace(self, token: str, global_id: str) -> DemoSession | None:
        with self._lock:
            if self.get(token) is None:
                return None
            fresh = self.issue(global_id)
            self._sessions.pop(token, None)
            return fresh

    def revoke(self, token: str | None) -> bool:
        if not token:
            return False
        with self._lock:
            return self._sessions.pop(token, None) is not None

    def _purge(self) -> None:
        now = time.time()
        for token, session in list(self._sessions.items()):
            if session.expires_at <= now:
                self._sessions.pop(token, None)
