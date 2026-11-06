"""Explicit, fail-closed configuration of an isolated EFHC demo API process."""
from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlsplit, parse_qs, parse_qsl, urlencode, urlunsplit


# Neon TEST is restricted to the exact existing TEST branch endpoint.
# This is independent of DEMO_NEON_HOST (which is operator-supplied).
_NEON_TEST_HOST = "ep-fragrant-feather-zaribpm5.c-2.eu-west-2.aws.neon.tech"
_NEON_TEST_POOLER_HOST = _NEON_TEST_HOST.replace(".c-2.", "-pooler.c-2.")
_ALLOWED_NEON_TEST_HOSTS = frozenset({_NEON_TEST_HOST, _NEON_TEST_POOLER_HOST})


class DemoConfigurationError(RuntimeError):
    pass


def _env_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class DemoConfig:
    database_url: str
    neon_host: str
    password: str
    initial_global_id: str
    cors_origins: tuple[str, ...]
    cookie_secure: bool
    cookie_name: str
    scheduler_enabled: bool
    scheduler_period: int
    max_topup_efhc: str

    @classmethod
    def from_env(cls, environ: dict[str, str] | None = None) -> "DemoConfig":
        env = os.environ if environ is None else environ
        if not _env_bool(env.get("EFHC_DEMO_ENABLED", "")):
            raise DemoConfigurationError("EFHC_DEMO_ENABLED=1 is required")
        if env.get("ENV", "").lower() in {"prod", "production", "stage", "staging"}:
            raise DemoConfigurationError("DEMO cannot run in production/staging runtime ENV")
        if _env_bool(env.get("ALLOW_REAL_FUNDS", "")):
            raise DemoConfigurationError("ALLOW_REAL_FUNDS must be disabled")
        url = env.get("DEMO_DATABASE_URL", "").strip()
        expected_host = env.get("DEMO_NEON_HOST", "").strip().lower()
        if not url:
            raise DemoConfigurationError(
                "DEMO_DATABASE_URL is not set or is empty in the running service"
            )
        parsed = urlsplit(url)
        if parsed.scheme not in {"postgresql", "postgresql+asyncpg", "postgres"}:
            raise DemoConfigurationError(
                "DEMO_DATABASE_URL has an unsupported URL scheme; use a PostgreSQL DSN without surrounding quotes"
            )
        if expected_host not in _ALLOWED_NEON_TEST_HOSTS or parsed.hostname != expected_host:
            raise DemoConfigurationError("DEMO_NEON_HOST must match the pinned Neon TEST branch endpoint")
        if not parsed.username or not parsed.password or not parsed.path or parsed.path == "/":
            raise DemoConfigurationError("Neon TEST DSN lacks database or credentials")
        if not any(value.lower() == "require" for value in parse_qs(parsed.query).get("sslmode", [])):
            raise DemoConfigurationError("Neon TEST DSN requires sslmode=require")
        inherited_url = env.get("DATABASE_URL", "").strip()
        if inherited_url and inherited_url != url:
            raise DemoConfigurationError("A different DATABASE_URL is set: refuse cross-environment access")
        password = env.get("DEMO_OPERATOR_PASSWORD", "")
        if len(password) < 16 or password.lower() in {"changeme", "demo", "password", "1234567890123456"}:
            raise DemoConfigurationError("Set a distinct DEMO_OPERATOR_PASSWORD (>=16 characters)")
        initial = env.get("DEMO_INITIAL_GLOBAL_ID", "").strip()
        if len(initial) != 10 or not initial.isascii() or not initial.isdigit() or initial == "0000000000":
            raise DemoConfigurationError("DEMO_INITIAL_GLOBAL_ID must be a real 10-digit TEST account")
        raw_origins = env.get("DEMO_CORS_ORIGINS", "https://gly-efhc.github.io").strip()
        origins = tuple(sorted(set(v.strip() for v in raw_origins.split(",") if v.strip())))
        if not origins or any(v == "*" or (not v.startswith("https://") and not v.startswith("http://localhost:") and not v.startswith("http://127.0.0.1:")) for v in origins):
            raise DemoConfigurationError("DEMO_CORS_ORIGINS must list exact HTTPS/localhost origins")
        period = int(env.get("DEMO_ENERGY_PERIOD_SECONDS", "60"))
        if period < 10 or period > 3600:
            raise DemoConfigurationError("Energy scheduler period must be 10..3600 seconds")
        from decimal import Decimal, InvalidOperation
        max_topup = env.get("DEMO_MAX_TOPUP_EFHC", "10000.00000000")
        try:
            dec = Decimal(max_topup)
            if dec <= 0 or dec.as_tuple().exponent < -8:
                raise ValueError()
        except (InvalidOperation, ValueError):
            raise DemoConfigurationError("DEMO_MAX_TOPUP_EFHC must be positive D8") from None
        return cls(database_url=url, neon_host=expected_host, password=password,
            initial_global_id=initial, cors_origins=origins,
            cookie_secure=_env_bool(env.get("DEMO_COOKIE_SECURE", "1")),
            cookie_name="efhc_demo_sid",
            scheduler_enabled=_env_bool(env.get("DEMO_ENERGY_SCHEDULER", "0")),
            scheduler_period=period,
            max_topup_efhc=max_topup)


def prepare_backend_environment(config: DemoConfig) -> None:
    """Use Neon TEST and disable automatic funds sends; retain TON and ad APIs."""
    # Neon exports libpq-specific channel_binding=require; asyncpg does not
    # accept it as a connection keyword. Keep sslmode=require for the original
    # backend engine normalizer, which enforces TLS via connect_args["ssl"].
    parts = urlsplit(config.database_url)
    query = urlencode([(key, value) for key, value in
                       parse_qsl(parts.query, keep_blank_values=True)
                       if key.lower() != "channel_binding"])
    asyncpg_url = urlunsplit((parts.scheme, parts.netloc, parts.path,
                             query, parts.fragment))
    os.environ.update({
        "ENV": "local", "DATABASE_URL": asyncpg_url,
        "ALLOW_REAL_FUNDS": "false", "RUN_EMBEDDED_TON_AGENT": "false",
        "ALLOW_INSECURE_USER_HEADERS": "false",
        "CORS_ALLOW_ORIGINS": ",".join(config.cors_origins),
    })
    # Actual proof verification and TON login must be testable. Provider
    # feature flag is isolated to this DEMO process; ENV can override it.
    os.environ.setdefault("AUTH_PROVIDER_FLAGS", '{"ton":true}')
    # Proof domain must match the Pages frontend (not the API hostname).
    frontend_origin = next((v for v in config.cors_origins
                            if v.startswith("https://") and "github.io" in v),
                           next((v for v in config.cors_origins if v.startswith("https://")), ""))
    if frontend_origin:
        os.environ.setdefault("APP_URL", frontend_origin)
        os.environ.setdefault("FRONTEND_URL", frontend_origin)
