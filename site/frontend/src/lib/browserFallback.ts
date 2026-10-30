import type { SyncSnapshot } from "../services/snapshot.service";
import { parseGlobalId } from "../types/identity";
import frozenHome from "../reconstruction/frozen-v866-home-fixture.json";

export function getBrowserFallbackSnapshot(): SyncSnapshot {
  // The frozen owner HTML only seeds data in the isolated public Pages preview.
  // Production / standalone preview retains its existing zero-state snapshot.
  const pagePreview = process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1";
  const canon = pagePreview ? frozenHome.pages_preview : null;
  return {
    profile: {
      // Значение только для browser preview; оно не owner.
      // live ownership приходит только из AuthSessionProvider.
      global_id: parseGlobalId("0000000001"),
      tg_id: 0,
      username: "EFHC Player",
      is_vip: canon?.is_vip ?? false,
      has_activ: canon?.has_activ ?? false,
      main_balance: canon?.main_balance ?? "0.00000000",
      bonus_balance: canon?.bonus_balance ?? "0.00000000",
      available_kwh: canon?.available_kwh ?? "0.00000000",
      total_generated_kwh: canon?.total_generated_kwh ?? "0.00000000",
      gen_per_sec_base: "0.00000000",
      gen_per_sec_vip: "0.00000000",
    },
    panels: {
      active_count: canon?.active_panels ?? 0,
      total_generated_by_panels: "0.00000000",
      nearest_expire_at: null,
    },
    exchange_preview: {
      ok: true,
      available_kwh: canon?.available_kwh ?? "0.00000000",
      max_exchangeable_kwh: "0.00000000",
      rate_kwh_to_efhc: "1.00000000",
      detail: "Browser preview mode",
    },
    meta: {
      server_now_iso: new Date(0).toISOString(),
      gen_per_sec_effective: canon?.gen_per_sec_effective ?? "0.00000000",
      next_scheduler_eta_sec: 0,
      fallback_task_id: null,
    },
  };
}
