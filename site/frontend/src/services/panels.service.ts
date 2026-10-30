import { apiRequest } from "../lib/api";
import {
  PANELS_ACTIVE_PATH,
  PANELS_ACTIVATE_PATH,
  PANELS_ARCHIVE_PATH,
  PANELS_SUMMARY_PATH,
  type PanelActivationResponse,
  type PanelItemResponse,
  type PanelsPageResponse,
  type PanelsSummaryResponse,
} from "../lib/api/generated/economicUserSeams";
import {
  parsePanelActivationResponse,
  parsePanelsPageResponse,
  parsePanelsSummaryResponse,
} from "../lib/api/generated/economicUserSeamValidators";

export type PanelTab = "active" | "archive";
export type PanelItem = PanelItemResponse;
export type { PanelActivationResponse, PanelsPageResponse };

export async function getPanelsSummary(): Promise<
  PanelsSummaryResponse
> {
  const raw = await apiRequest<unknown>(PANELS_SUMMARY_PATH, "GET");
  return parsePanelsSummaryResponse(raw);
}

export async function getPanelsPage(args: {
  tab: PanelTab;
  cursor?: string | null;
  signal?: AbortSignal;
  demoSortDirection?: "oldest" | "newest";
}): Promise<PanelsPageResponse> {
  const base =
    args.tab === "active" ? PANELS_ACTIVE_PATH : PANELS_ARCHIVE_PATH;
  const params = new URLSearchParams();
  params.set("limit", "20");
  if (args.cursor) params.set("cursor", args.cursor);
  if (process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1" && args.demoSortDirection) {
    params.set("demo_sort", args.demoSortDirection);
  }
  const q = `?${params.toString()}`;
  const raw = await apiRequest<unknown>(base + q, "GET", {
    signal: args.signal,
  });
  return parsePanelsPageResponse(raw);
}

export async function activatePanel(
  idempotencyKey: string,
): Promise<PanelActivationResponse> {
  const raw = await apiRequest<unknown>(PANELS_ACTIVATE_PATH, "POST", {
    idempotencyKey,
  });
  return parsePanelActivationResponse(raw);
}
