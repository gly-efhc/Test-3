# EFHC / Cycle 0028 — protected generation rate contract

**Authoritative formulas:** one Panel generates `0.00000692 kWh/s` for BASE or `0.00000741 kWh/s` for VIP, up to 180 days. User's effective VIP status is a server-side fact. `kWh -> EFHCm` exchange is one-to-one up to nonnegative available energy.

## Required server-only ENV

```env
GEN_PER_SEC_BASE_KWH=0.00000692
GEN_PER_SEC_VIP_KWH=0.00000741
```

These environment names **must never use the NEXT_PUBLIC_ prefix**. A privileged backend startup guard must reject missing or mismatched values, and the backend generator must use only its trusted ENV after server-side VIP authentication. See `site/ci/efhc_generation_env_guard.py`.

The active backend source was located under the independent authenticated GitHub repository `EFHC-Project/EFHC_cod` and the backend runtime `main/backend/app/core/system_locks.py` was updated at source commit `b92d442a23a760434c5de4cbc775258aaf07a547` to require exact rates at startup and explicit config in prod/stage. The backend is NOT deployed by this action. The frontend `next.config.js` rejects *configured incorrect values* during builds. Missing ENV is allowed only for static Pages (no authoritative generation). `demoGenerationRates.ts` is a deliberately immutable **public** mirror for local simulation and UI; it is not a substitute for backend enforcement. The runtime reads its protected real `GEN_PER_SEC_*` settings from backend `config_core.py`; VPS operators must set them in the actual deployed env before updating backend, and deployment/runtime checks remain outstanding.

The **test** Neon branch enforces CHECK `ck_c28_panels_canonical_base_rate` at `0.00000692`. SQL per-user VIP historical rate is `panels.meta.effective_gen_per_sec`, selected from `users.is_vip`. This cannot authorize new VIP entitlement by browser changes.

## C28 causal data and replay

- Synthetic TEST only: 1000 accounts (900 BASE/100 VIP), 4000 Panels; generated 162572.832 kWh; exchanged 112000 kWh; available 50572.832 kWh.
- 999 referral relationships, 1098 bonus ledger entries for referrals, 3250 task/ad bonus ledger entries, 1000 test ad sessions; 88696 two-sided transfer records; total circulating supply plus bank reserve is exactly 5000000 EFHC, integrity delta zero.
- `bootstrap_snapshot` provides 1000 users, 4000 panels, 1000 intents, 4348 bonus_events, 999 referrals and 7 tasks from the same SQL database.
- Source data `RECON_CYCLE_0027` is causally rebuilt in `RECON_CYCLE_0028`, client revision `RECON_CYCLE_0028_CAUSAL_V1`. Browser caches from C27 are invalidated. D8 metric values are checked against SQL before commit; timestamps are excluded.
- Imported panels are historical as of **2026-10-31 10:00 UTC**: do not add 5 extra days by browser wall-clock. New DEMO panels use canonical rates from their activation.
- Historical exchanges are paged from SQL, not replicated 35000 times in localStorage. Browser-only actions are clearly local and do not modify SQL.
- Synthetic event audit fields are explicitly tagged `simulation_only`; no claim of actual external ad delivery or confirmed referral activity.

## Next production backend integration acceptance

The separate backend already calls `assert_system_locks()` at startup and now rejects an absent/mutated rate in prod/stage. It must derive VIP from its trusted user record, ignore any client-submitted rate, and should test D8 integer remainder, 180-day stop, exchange <= available, mirror transactions, and snapshot parity.
