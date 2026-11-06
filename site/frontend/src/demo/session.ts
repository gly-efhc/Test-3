/** DEMO operator session is server-authoritative. The bearer returned by the
 * TEST server is retained using the existing tab-scoped auth credential store.
 * This avoids depending solely on third-party cookies across Pages → Render.
 * No password, cookie, or bearer token is put in the public build or logs. */
import { clearAuthSession, getAuthAuthorizationHeader, storeAuthSession } from "../lib/auth-session";
import { demoApiOrigin } from "./config";
let csrf: string | null = null;
const DEMO_SCOPE_KEY = "efhc.demo.session.scope.v1";
type DemoScope = "guest" | "operator";

export function currentDemoSessionScope(): DemoScope | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(DEMO_SCOPE_KEY);
    return value === "guest" || value === "operator" ? value : null;
  } catch { return null; }
}

function setDemoSessionScope(scope: DemoScope | null): void {
  if (typeof window === "undefined") return;
  try {
    if (scope) window.sessionStorage.setItem(DEMO_SCOPE_KEY, scope);
    else window.sessionStorage.removeItem(DEMO_SCOPE_KEY);
  } catch { /* Server validation is authoritative; client hint is optional. */ }
}

export function isDemoGuestSession(): boolean {
  return isDemoBackendMode() && currentDemoSessionScope() === "guest";
}

type SessionInfo = { ok: boolean; global_id: string; csrf: string; mode: string };
type IssuedDemoSession = SessionInfo & {
  demo_bearer_token: string;
  expires_at_epoch: number;
  scope?: DemoScope;
};

export function clearDemoSession(): void { csrf = null; setDemoSessionScope(null); }
export function isDemoBackendMode(): boolean {
  return process.env.NEXT_PUBLIC_EFHC_DATA_SOURCE === "demo_backend";
}

function authorizationHeaders(): Record<string, string> {
  const bearer = getAuthAuthorizationHeader();
  return bearer ? { Authorization: bearer } : {};
}

function acceptIssuedDemoSession(value: IssuedDemoSession): SessionInfo {
  if (!value || typeof value.demo_bearer_token !== "string" ||
      !Number.isFinite(value.expires_at_epoch)) {
    throw new Error("DEMO_SESSION_CREDENTIAL_MISSING");
  }
  storeAuthSession({
    access_token: value.demo_bearer_token,
    token_type: "Bearer",
    expires_at: new Date(value.expires_at_epoch * 1000).toISOString(),
  });
  // Scope is only a UI hint; the TEST server checks session.scope and owner.
  setDemoSessionScope(value.scope === "guest" ? "guest" : "operator");
  // Never return the secret to the UI or console; the backend owns the identity.
  return {ok: value.ok, global_id: value.global_id, csrf: value.csrf, mode: value.mode};
}

export async function sessionInfo(): Promise<SessionInfo> {
  const response = await fetch(`${demoApiOrigin()}/api/staging/session`, {
    credentials: "include", cache: "no-store", headers: authorizationHeaders(),
  });
  if (response.status === 401) {
    clearDemoSession();
    clearAuthSession();
    throw new Error("EFHC_DEMO_SESSION_REQUIRED");
  }
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(!login ? authorizationHeaders() : {}),
  };
  if (!login) headers["X-EFHC-Test-CSRF"] = await sessionCsrf();
  const response = await fetch(`${demoApiOrigin()}/api/staging/${route}`, {
    method: "POST", credentials: "include", cache: "no-store", headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) {
    clearDemoSession();
    clearAuthSession();
  }
  if (!response.ok) throw new Error(`EFHC_DEMO_${route.toUpperCase()}_HTTP_${response.status}`);
  const value = await response.json() as T;
  if (value && typeof value === "object" && "csrf" in value &&
      typeof value.csrf === "string") csrf = value.csrf;
  return value;
}

export async function loginDemoGuest(): Promise<SessionInfo> {
  const result = await writeControl<IssuedDemoSession>("guest", undefined, true);
  if (result.scope !== "guest") throw new Error("DEMO_GUEST_SCOPE_INVALID");
  return acceptIssuedDemoSession(result);
}

export async function loginDemo(password: string): Promise<SessionInfo> {
  const result = await writeControl<IssuedDemoSession>("login", {password}, true);
  return acceptIssuedDemoSession(result);
}
export async function selectDemoGlobalId(global_id: string): Promise<SessionInfo> {
  if (!/^\d{10}$/.test(global_id) || global_id === "0000000000") throw new Error("INVALID_GLOBAL_ID");
  const result = await writeControl<IssuedDemoSession>("select-global-id", {global_id});
  return acceptIssuedDemoSession(result);
}
export async function logoutDemo(): Promise<void> {
  try { await writeControl("logout"); }
  finally { clearDemoSession(); clearAuthSession(); }
}
