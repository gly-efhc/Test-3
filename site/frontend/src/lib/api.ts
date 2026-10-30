import {
  clearAuthSession,
  getAuthAuthorizationHeader,
} from "./auth-session";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function getApiBase(): string {
  return "";
}

function normalizeApiPath(path: string): string {
  const p = String(path || "");
  if (!p.startsWith("/")) return `/api/${p}`;
  if (
    p.startsWith("/api/") ||
    p === "/health" ||
    p === "/openapi.json" ||
    p === "/redoc" ||
    p.startsWith("/docs") ||
    p.startsWith("/meta/")
  ) {
    return p;
  }
  return `/api${p}`;
}

export type ApiRequestOptions = {
  body?: unknown;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  // Prefer request tracing for incident debugging.
  requestId?: string;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  payload?: unknown;
  retryable: boolean;

  constructor(args: {
    status: number;
    code?: string;
    requestId?: string;
    payload?: unknown;
    retryable?: boolean;
  }) {
    super("EFHC_API_REQUEST_FAILED");
    this.name = "ApiError";
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    this.payload = args.payload;
    this.retryable =
      args.retryable ??
      (
        args.status === 408 ||
        args.status === 409 ||
        args.status === 425 ||
        args.status === 429 ||
        args.status >= 500
      );
  }
}

function readPayloadCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const code = record.code || record.error_code || record.type;
  if (typeof code !== "string") return undefined;
  const trimmed = code.trim();
  return trimmed ? trimmed : undefined;
}

function readPayloadRequestId(
  payload: unknown,
  headers: Headers,
): string | undefined {
  const fromHeader =
    headers.get("x-request-id") || headers.get("x-correlation-id");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const requestId = record.request_id || record.requestId;
  return typeof requestId === "string" && requestId.trim()
    ? requestId.trim()
    : undefined;
}

async function readErrorPayload(
  res: Response,
  isJson: boolean,
): Promise<unknown> {
  if (isJson) {
    return await res.json().catch(() => null);
  }
  const text = await res.text().catch(() => "");
  return text ? { body: text } : null;
}

export async function apiRequest<T>(
  path: string,
  method: HttpMethod,
  opts: ApiRequestOptions = {},
): Promise<T> {
  // An explicitly selected TEST backend must never fall through into production
  // if its public-preview gates are absent or disabled.
  if (process.env.NEXT_PUBLIC_EFHC_TEST_MODE === "neon" &&
      !(process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1" &&
        process.env.NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF === "1")) {
    throw new ApiError({status:503,code:"NEON_TEST_REQUIRES_PUBLIC_PREVIEW"});
  }
  // In the frozen public Pages build ALL business requests use isolated DEMO
  // or explicit Neon test API. No request may fall through to production.
  if (process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1" &&
      process.env.NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF === "1") {
    const { isDemoPreviewEnabled } = await import("../reconstruction/demoUnifiedStore");
    if (isDemoPreviewEnabled()) {
      // Explicit real Neon test mode wins over browser-only DEMO. No fallback
      // on auth/network errors; otherwise a failed DB test could look successful.
      const {isNeonStagingRequested,neonStagingApiRequest} = await import("../reconstruction/neonStagingBridge");
      if(isNeonStagingRequested())return await neonStagingApiRequest<T>(path,method,opts.body,opts.idempotencyKey);
      const { demoApiRequest } = await import("../reconstruction/demoApi");
      return await demoApiRequest(path, method, opts.body, opts.idempotencyKey) as T;
    }
    // A missing bootstrap flag is NOT permission to access production.
    throw new ApiError({status:503,code:"PUBLIC_DEMO_NOT_BOOTSTRAPPED"});
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  // Все business API используют только server-side Bearer session.
  // Telegram initData передаётся исключительно login endpoint явно.
  const sessionAuthorization = getAuthAuthorizationHeader();
  if (sessionAuthorization && !headers.Authorization) {
    headers.Authorization = sessionAuthorization;
  }

  if (opts.requestId) headers["X-Request-ID"] = String(opts.requestId);
  if (opts.idempotencyKey) {
    headers["Idempotency-Key"] = String(opts.idempotencyKey);
  }

  const res = await fetch(getApiBase() + normalizeApiPath(path), {
    method,
    headers,
    body:
      opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined,
    credentials: "include",
    signal: opts.signal,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    if (res.status === 401 && sessionAuthorization) {
      clearAuthSession();
    }
    const payload = await readErrorPayload(res, isJson);
    throw new ApiError({
      status: res.status,
      code: readPayloadCode(payload),
      requestId: readPayloadRequestId(payload, res.headers),
      payload,
    });
  }

  if (isJson) return (await res.json()) as T;
  return undefined as T;
}
