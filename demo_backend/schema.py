"""Read-only compatibility inventory of existing Neon TEST objects."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Baseline read directly from existing Neon TEST branch (2026-11-05).
# Do not create new tables or views here. Report exactly which objects are absent.
REQUIRED_TABLES = {
    "efhc_admin": {
        "admin_action_log", "admin_nft_whitelist", "admin_notifications",
        "admin_role", "admin_whitelist", "efhc_sale_packages", "idempotency_key",
    },
    "efhc_core": {
        "achievements", "ad_admin_audit_log", "ad_daily_counters", "ad_events",
        "ad_provider_claims", "ad_provider_configs", "ad_provider_daily_metrics",
        "ad_sessions", "ads", "alembic_version", "app_settings", "auth_challenges",
        "auth_sessions", "bank_balance", "bank_metrics_snapshot", "efhc_transfers_log",
        "hub_links", "outcome_fallback_promos", "panels", "payment_intents",
        "processed_external_events", "referral_bonus_ledger", "referral_codes",
        "referral_links", "scheduler_task_log", "shop_items", "shop_orders",
        "system_templates", "task_bonus_log", "task_complete_lock", "task_submissions",
        "tasks", "ton_inbox_logs", "tx_hash_locks", "unmatched_incoming",
        "user_cosmetics", "user_identities", "user_roles", "user_skins",
        "user_tasks_status", "users", "wallet_bindings", "wallet_connect_idempotency",
        "wallet_proof_token_uses", "withdraw_outcome_events", "withdraw_requests",
        "withdrawals",
    },
}
REQUIRED_VIEWS = {
    "accounts", "bank_overview", "bootstrap_snapshot", "catalog_rows",
    "economic_events", "ledger", "panels", "payment_intents", "table_counts", "transfers_all",
}


async def inspect_schema(db: AsyncSession) -> dict:
    sql = text("""SELECT table_schema, table_name, table_type FROM information_schema.tables
        WHERE table_schema IN ('efhc_core','efhc_admin','efhc_demo_public')
        ORDER BY table_schema, table_name""")
    result = (await db.execute(sql)).mappings().all()
    objects = [{"schema": str(r["table_schema"]), "name": str(r["table_name"]),
                "type": str(r["table_type"])} for r in result]
    physical = {(r["schema"], r["name"]) for r in objects if r["type"] == "BASE TABLE"}
    views = {(r["schema"], r["name"]) for r in objects if r["type"] == "VIEW"}
    missing = sorted(
        [f"{schema}.{table}" for schema, names in REQUIRED_TABLES.items()
         for table in names if (schema, table) not in physical]
        + [f"efhc_demo_public.{view}" for view in REQUIRED_VIEWS
           if ("efhc_demo_public", view) not in views]
    )
    return {"ok": not missing, "total": len(objects), "tables": objects,
            "physical_tables": len(physical),
            "views": sum(r["type"] == "VIEW" for r in objects), "missing": missing}


async def check_user(db: AsyncSession, global_id: str) -> bool:
    if not isinstance(global_id, str) or len(global_id) != 10 or not global_id.isascii() or not global_id.isdigit() or global_id == "0000000000":
        return False
    result = await db.execute(text("SELECT 1 FROM efhc_core.users WHERE global_id=:gid AND is_active IS TRUE LIMIT 1"), {"gid": int(global_id)})
    return result.scalar_one_or_none() == 1
