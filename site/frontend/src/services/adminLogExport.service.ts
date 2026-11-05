import { getAuthAuthorizationHeader } from "../lib/auth-session";
import {
  ADMIN_LOGS_EXPORT_CSV_PATH,
  ADMIN_LOGS_EXPORT_XLSX_PATH,
} from "../lib/api/generated/adminSeams";
import { isLocalDemoActive } from "../reconstruction/demoPreviewGate";
import { buildJsonBlobFromTable, buildSimpleXlsx, downloadBlob } from "../lib/export/simpleXlsx";

export type AdminLogExportScope = "bank" | "panels";
export type AdminLogExportFormat = "json" | "csv" | "txt" | "xlsx";
export type AdminLogExportRows = "100" | "1000" | "100000" | "1000000" | "all";

function parseCsvTable(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

export async function downloadAdminLogExport(
  scope: AdminLogExportScope,
  format: AdminLogExportFormat,
  rows: AdminLogExportRows = "100000",
  globalId?: string | null,
): Promise<void> {
  if (isLocalDemoActive()) {
    const selectedGlobalId = String(globalId || "").trim();
    if (selectedGlobalId && !/^\d{10}$/.test(selectedGlobalId)) throw new Error("admin_log_export_invalid_global_id");
    const {demoApiRequest} = await import("../reconstruction/demoApi");
    await demoApiRequest("/admin/reports/overview", "GET");
    const {readDemoState}=await import("../reconstruction/demoUnifiedStore");
    const state = readDemoState();
    const entries = scope === "bank" ? state.server?.audit || []
      : Object.values(state.accounts).flatMap(a => a.panels || []);
    const filtered = entries.filter(row => !selectedGlobalId || row.global_id === selectedGlobalId);
    const limit = rows === "all" ? filtered.length : Number(rows);
    const fields = scope === "bank"
      ? ["id", "global_id", "amount_efhc", "direction", "balance_type", "reason", "created_at"]
      : ["id", "global_id", "public_id", "generated_kwh", "is_active", "activated_at", "expires_at"];
    const table = [fields, ...filtered.slice(0, limit).map(row => fields.map(key => String((row as Record<string, unknown>)[key] ?? "")))];
    const filename = `EFHC_demo_${scope}_${selectedGlobalId || 'all'}_${new Date().toISOString().slice(0,10)}.${format}`;
    if (format === "xlsx") downloadBlob(buildSimpleXlsx(table), filename);
    else if (format === "json") downloadBlob(buildJsonBlobFromTable(table, {mode: "demo", scope, global_id: selectedGlobalId || null}), filename);
    else {
      const cell = (value: string) => {
        const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
        return '"' + safe.replace(/"/g, '""') + '"';
      };
      const separator = format === "csv" ? "," : "\t";
      const text = table.map(row => row.map(cell).join(separator)).join("\r\n");
      downloadBlob(new Blob([text], {type: format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8"}), filename);
    }
    return;
  }
  const authorization = getAuthAuthorizationHeader();
  const headers: Record<string, string> = {};
  if (authorization) headers.Authorization = authorization;
  const transportFormat = format === "json" || format === "txt" ? "csv" : format;
  const path = transportFormat === "csv"
    ? ADMIN_LOGS_EXPORT_CSV_PATH
    : ADMIN_LOGS_EXPORT_XLSX_PATH;
  const selectedGlobalId = String(globalId || "").trim();
  if (selectedGlobalId && !/^\d{10}$/.test(selectedGlobalId)) {
    throw new Error("admin_log_export_invalid_global_id");
  }
  const params = new URLSearchParams({ scope, rows });
  if (selectedGlobalId) params.set("global_id", selectedGlobalId);
  const response = await fetch(
    `/api${path}?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
      headers,
    },
  );
  if (!response.ok) throw new Error("admin_log_export_failed");
  const disposition = String(response.headers.get("content-disposition") || "");
  if (selectedGlobalId && !disposition.includes(selectedGlobalId)) {
    throw new Error("admin_log_export_scope_unproven");
  }
  const day = new Date().toISOString().slice(0, 10);
  const filename = selectedGlobalId
    ? `EFHC_${scope}_global_${selectedGlobalId}_${day}.${format}`
    : `EFHC_${scope}_log_${day}.${format}`;
  if (format === "json" || format === "txt") {
    const table = parseCsvTable(await response.text());
    if (format === "json") {
      downloadBlob(buildJsonBlobFromTable(table, {
        kind: "efhc_admin_log_export",
        generated_at: new Date().toISOString(),
        scope,
        rows,
        global_id: selectedGlobalId || null,
        source_format: "server_csv",
      }), filename);
    } else {
      const body = table.map((row) => row.map((value) => String(value ?? "")).join("\t")).join("\n");
      downloadBlob(new Blob([body], { type: "text/plain;charset=utf-8" }), filename);
    }
    return;
  }
  downloadBlob(await response.blob(), filename);
}
