/** Resolve exported public assets under a configurable Pages deployment prefix.
 * Logical Next routes are separate from the deployment prefix. Production
 * remains root by default. NEXT_PUBLIC_EFHC_PAGES_BASE_PATH can override
 * the GitHub Pages default /Test-3, including '/' to target the root.
 */
export const DEFAULT_PAGES_BASE_PATH = "/Test-3";

export function pagesBasePath(): string {
  if (process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW !== "1") return "";
  const configured = process.env.NEXT_PUBLIC_EFHC_PAGES_BASE_PATH;
  if (configured === undefined || configured === "") return DEFAULT_PAGES_BASE_PATH;
  const candidate = configured.trim();
  if (candidate === "/") return "";
  if (!/^\/[A-Za-z0-9._~/-]+$/.test(candidate) || candidate.includes("//") || candidate.includes("..")) {
    return DEFAULT_PAGES_BASE_PATH;
  }
  return candidate.replace(/\/+$/, "") || "";
}

/** Recover logical routes from historical or repeated Pages prefixes.
 * Never treat the deployment folder as a Next route segment.
 */
export function stripPagesBasePath(route: string): string {
  const base = pagesBasePath();
  if (!base) return route;
  let path = route;
  while (path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`)) {
    path = path.slice(base.length) || "/";
  }
  return path;
}

export function publicAssetPath(path: `/${string}`): string {
  if (typeof window === "undefined") return path;
  const base = pagesBasePath();
  const location = window.location.pathname;
  return base && (location === base || location.startsWith(`${base}/`))
    ? `${base}${path}`
    : path;
}
