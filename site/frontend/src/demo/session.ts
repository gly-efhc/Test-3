/** Operator DEMO session is held by HttpOnly cookie, not browser fixtures. */
import { demoApiOrigin } from "./config";
let csrf: string | null = null;

type SessionInfo = { ok: boolean; global_id: string; csrf: string; mode: string };

export function clearDemoSession(): void { csrf = null; }
export function isDemoBackendMode(): boolean {
  return process.env.NEXT_PUBLIC_EFHC_DATA_SOURCE === "demo_backend";
}
export async function sessionInfo(): Promise<SessionInfo> {
  const response = await fetch(`${demoApiOrigin()}/api/staging/session`, {
    credentials: "include", cache: "no-store",
  });
  if (response.status === 401) { clearDemoSession(); throw new Error("EFHC_DEMO_SESSION_REQUIRED"); }
  if (!response.ok) throw new Error(`EFHC_DEMO_SESSION_HTTP_${response.status}`);
  const result = await response.json() as SessionInfo;
  csrf = result.csrf;
  return result;
}
export async function sessionCsrf(): Promise<string> {
  if (!csrf) await sessionInfo();
  if (!csrf) throw new Error("EFHC_DEMO_CSRF_UNAVAILABLE");
  return csrf;
}
async function writeControl<T>(route: string, body?: unknown, login = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!login) headers["X-EFHC-Test-CSRF"] = await sessionCsrf();
  const response = await fetch(`${demoApiOrigin()}/api/staging/${route}`, {
    method: "POST", credentials: "include", cache: "no-store", headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) clearDemoSession();
  if (!response.ok) throw new Error(`EFHC_DEMO_${route.toUpperCase()}_HTTP_${response.status}`);
  const value = await response.json() as T;
  if (value && typeof value === "object" && "csrf" in value && typeof value.csrf === "string") csrf = value.csrf;
  return value;
}
export async function loginDemo(password: string): Promise<SessionInfo> {
  return await writeControl<SessionInfo>("login", {password}, true);
}
export async function selectDemoGlobalId(global_id: string): Promise<SessionInfo> {
  if (!/^\d{10}$/.test(global_id) || global_id === "0000000000") throw new Error("INVALID_GLOBAL_ID");
  return await writeControl<SessionInfo>("select-global-id", {global_id});
}
export async function logoutDemo(): Promise<void> {
  try { await writeControl("logout"); } finally { clearDemoSession(); }
}
