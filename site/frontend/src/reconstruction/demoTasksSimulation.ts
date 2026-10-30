/** Isolated browser-preview simulator. NEVER a financial ledger or proof of real task completion. */
import { format8, sumScaledDown } from "../lib/format";

export const DEMO_TASK_STORAGE_KEY = "efhc:public-tasks-demo:v892";
export const DEMO_AD_LIMIT = 10;
export const DEMO_AD_SECONDS = 5;
export type DemoTaskState = {
  dayUTC: string;
  completed: string[];
  adViews: number;
};

export function demoTaskDayUTC(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}
export function freshDemoTaskState(dayUTC: string = demoTaskDayUTC()): DemoTaskState {
  return { dayUTC, completed: [], adViews: 0 };
}
export function normalizeDemoTaskState(raw: unknown, dayUTC: string = demoTaskDayUTC()): DemoTaskState {
  if (!raw || typeof raw !== "object") return freshDemoTaskState(dayUTC);
  const data = raw as Record<string, unknown>;
  const known = new Set(["demo_join_telegram", "demo_partner_webapp", "demo_website_visit", "demo_partner_bot"]);
  const completed = Array.isArray(data.completed)
    ? [...new Set(data.completed.filter((code): code is string => typeof code === "string" && known.has(code)))].slice(0, 4)
    : [];
  return {
    dayUTC,
    completed,
    adViews: data.dayUTC === dayUTC && Number.isInteger(data.adViews)
      ? Math.max(0, Math.min(DEMO_AD_LIMIT, data.adViews as number)) : 0,
  };
}
export function applyDemoTaskAction(
  state: DemoTaskState,
  code: string,
  dayUTC: string = demoTaskDayUTC(),
): DemoTaskState {
  const base = normalizeDemoTaskState(state, dayUTC);
  if (code === "demo_watch_builtin") {
    return { ...base, adViews: Math.min(DEMO_AD_LIMIT, base.adViews + 1) };
  }
  if (!["demo_join_telegram", "demo_partner_webapp", "demo_website_visit", "demo_partner_bot"].includes(code)) return base;
  if (base.completed.includes(code)) return base;
  return { ...base, completed: [...base.completed, code] };
}
export function demoTaskBonusDeltaD8(state: DemoTaskState): string {
  const rewards: Record<string, string> = {
    demo_join_telegram: "0.10000000",
    demo_partner_webapp: "0.05000000",
    demo_website_visit: "0.02000000",
    demo_partner_bot: "0.03000000",
  };
  let bonus = "0.00000000";
  for (const code of state.completed) bonus = sumScaledDown(bonus, rewards[code] || "0.00000000", 8);
  for (let i = 0; i < state.adViews; i += 1) bonus = sumScaledDown(bonus, "0.01000000", 8);
  return format8(bonus);
}
export function demoTaskTotalsD8(state: DemoTaskState, baseEarned: string, baseBalance: string): {
  earned: string; remaining: string;
} {
  const delta = demoTaskBonusDeltaD8(state);
  return { earned: sumScaledDown(baseEarned, delta, 8), remaining: sumScaledDown(baseBalance, delta, 8) };
}
