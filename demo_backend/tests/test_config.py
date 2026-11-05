from __future__ import annotations
import pytest
from demo_backend.config import DemoConfig, DemoConfigurationError


@pytest.fixture
def env():
    return {
        "EFHC_DEMO_ENABLED": "1", "ENV": "local",
        "DEMO_DATABASE_URL": "postgresql+asyncpg://unit:secret@ep-test.eu-central-1.aws.neon.tech/neondb?sslmode=require",
        "DEMO_NEON_HOST": "ep-test.eu-central-1.aws.neon.tech",
        "DEMO_OPERATOR_PASSWORD": "this-is-a-test-only-password",
        "DEMO_INITIAL_GLOBAL_ID": "0000000002",
        "DEMO_CORS_ORIGINS": "https://gly-efhc.github.io",
    }


def test_accepts_only_explicit_demo_neon(env):
    assert DemoConfig.from_env(env).initial_global_id == "0000000002"


@pytest.mark.parametrize("key,value", [
    ("ENV", "prod"), ("ALLOW_REAL_FUNDS", "1"),
    ("DEMO_NEON_HOST", "ep-production.eu-central-1.aws.neon.tech"),
    ("DEMO_OPERATOR_PASSWORD", "password"),
    ("DEMO_INITIAL_GLOBAL_ID", "88"),
    ("DATABASE_URL", "postgresql://prod:secret@ep-prod.aws.neon.tech/neondb"),
    ("DEMO_CORS_ORIGINS", "*"),
])
def test_fails_closed(env, key, value):
    env[key] = value
    with pytest.raises(DemoConfigurationError):
        DemoConfig.from_env(env)


def test_disabled_by_default(env):
    env.pop("EFHC_DEMO_ENABLED")
    with pytest.raises(DemoConfigurationError):
        DemoConfig.from_env(env)
