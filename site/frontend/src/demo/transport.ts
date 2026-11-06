/** Neon TEST remote API: same route + payload + response schemas as production. */
import { clearAuthSession, getAuthAuthorizationHeader } from "../lib/auth-session";
import { ApiError, normalizeApiPath, type ApiRequestOptions, type HttpMethod } from "../lib/api";
import { type ApiTransport } from "../data/transport";
import { demoApiOrigin } from "./config";
import { clearDemoSession, currentDemoSessionScope, sessionCsrf } from "./session";

export async function demoRawRequest(
  path: string, method: HttpMethod, options: ApiRequestOptions = {},
): Promise<Response> {
  const guest = currentDemoSessionScope() === "guest";
  const normalized = normalizeApiPath(path);
  // C0034 preview writes use canonical TEST APIs, guest scope remains read-only.
  // Both are enforced on the isolated Neon TEST backend.
  const endpoint = guest && method === "POST" && normalized.split("?")[0] === "/api/sync/me"
    ? "/api/sync/me?fresh=0" : normalized;
  const headers: Record<string, string> = { ...(options.headers || {}) };
  const bearer = getAuthAuthorizationHeader();
  if (bearer && !headers.Authorization) headers.Authorization = bearer;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.requestId) headers["X-Request-ID"] = options.requestId;
  if (method !== "GET" && !guest &&
      normalized !== "/api/staging/login" && normalized !== "/api/staging/guest") {
    headers["X-EFHC-Test-CSRF"] = await sessionCsrf().catch(() => "");
  }
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${demoApiOrigin()}${endpoint}`, {
    method, headers, credentials: "include", cache: "no-store", signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 401) { clearDemoSession(); if (bearer) clearAuthSession(); }
  return response;
}

export const demoBackendTransport: ApiTransport = {
  async request<T>(path: string, method: HttpMethod, options: ApiRequestOptions): Promise<T> {
    const response = await demoRawRequest(path, method, options);
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const errorCode = payload && typeof payload === "object"
        ? String((payload as Record<string, unknown>).code || (payload as Record<string, unknown>).detail || "DEMO_API_FAILED")
        : "DEMO_API_FAILED";
      throw new ApiError({ status: response.status, code: errorCode, payload });
    }
    if (response.status === 204) return undefined as T;
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) return undefined as T;
    return await response.json() as T;
  },
  requestRaw: demoRawRequest,
};
