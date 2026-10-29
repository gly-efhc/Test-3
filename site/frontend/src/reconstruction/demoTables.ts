/** Source data copied from frozen FRONTEND_v866.html seed generators. */
import fixtures from "./demo-tables-v866.json";
import type {
  PanelsPageResponse,
  PanelsSummaryResponse,
} from "../lib/api/generated/economicUserSeams";
import type { PanelTab } from "../services/panels.service";
import { dbIdFromApi } from "../types/db-id";
import type { MyPlusTop, TopPage } from "../services/ranks.service";
import type { TaskCatalogItem, MyTaskItem, TaskEarningsResponse } from "../services/tasks.service";

export const sourceCanonSha256 = fixtures.source_sha256;

const dayMs = 86_400_000;
const lifetimeMs = 180 * dayMs;
function demoPanelRows(tab: PanelTab): PanelsPageResponse["items"] {
  const now = Date.now();
  return fixtures.panels[tab].map((row, index) => {
    const activatedMs = tab === "active"
      ? now - (index + 1) * dayMs
      : now - (index + 1) * dayMs - lifetimeMs;
    const expiresMs = activatedMs + lifetimeMs;
    return {
      ...row,
      id: dbIdFromApi(row.id),
      activated_at: new Date(activatedMs).toISOString(),
      created_at: new Date(activatedMs).toISOString(),
      expires_at: new Date(expiresMs).toISOString(),
      archived_at: tab === "archive" ? new Date(expiresMs).toISOString() : null,
    };
  });
}

export function demoPanelsSummary(): PanelsSummaryResponse {
  return {
    ...fixtures.panels.summary,
    nearest_expire_at: demoPanelRows("active")[59].expires_at,
  };
}

export function demoPanelsPage(tab: PanelTab, cursor: string | null): PanelsPageResponse {
  const rows = demoPanelRows(tab);
  const offset = cursor === null ? 0 : Number(cursor);
  if (!Number.isInteger(offset) || offset < 0 || offset > rows.length) {
    throw new Error("Invalid DEMO cursor");
  }
  const end = offset + fixtures.panels.batch_size;
  return {
    items: rows.slice(offset, end),
    next_cursor: end < rows.length ? String(end) : null,
    server_now_utc: new Date().toISOString(),
  };
}

export function demoMyRankWithTop(): MyPlusTop {
  return {
    snapshot_at: new Date().toISOString(),
    me: fixtures.ranks.me,
    top: fixtures.ranks.users.slice(0, fixtures.ranks.top_limit),
    next_cursor: fixtures.ranks.users.length > fixtures.ranks.top_limit ? String(fixtures.ranks.top_limit) : null,
  };
}

export function demoRankTopPage(cursor: string): TopPage {
  const offset = Number(cursor);
  if (!Number.isInteger(offset) || offset < 0 || offset > fixtures.ranks.users.length) {
    throw new Error("Invalid DEMO rank cursor");
  }
  const end = offset + fixtures.ranks.more_limit;
  return {
    snapshot_at: new Date().toISOString(),
    items: fixtures.ranks.users.slice(offset, end),
    next_cursor: end < fixtures.ranks.users.length ? String(end) : null,
  };
}

export function demoRankContext(): TopPage {
  const all = [...fixtures.ranks.users, fixtures.ranks.me].sort((a,b) => a.rank_pos - b.rank_pos);
  return {
    snapshot_at: new Date().toISOString(),
    items: all.filter(row => Math.abs(row.rank_pos - fixtures.ranks.me.rank_pos) <= 2),
    next_cursor: null,
  };
}

export function demoTasksCatalog(): TaskCatalogItem[] {
  return fixtures.tasks.catalog.map((item) => ({
    ...item, id: dbIdFromApi(item.id),
  })) as TaskCatalogItem[];
}
export function demoMyTasks(): MyTaskItem[] { return []; }
export function demoTaskEarnings(): TaskEarningsResponse {
  return {
    total_bonus_earned: fixtures.tasks.earnings.total_bonus_earned,
    bonus_asset: "EFHCb",
    includes_ads: fixtures.tasks.earnings.includes_ads,
  };
}
