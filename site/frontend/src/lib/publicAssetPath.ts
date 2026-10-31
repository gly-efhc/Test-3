/** Resolve checked-in public assets under the exact GitHub Pages repository
 * basePath. Production Next.js remains rooted at /; no runtime proxy or
 * artificial read-only restriction is introduced. */
export function publicAssetPath(path: `/${string}`): string {
  if (typeof window === "undefined") return path;
  const pages = process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1";
  const location = window.location.pathname;
  const base = pages && (location === "/Test-3" || location.startsWith("/Test-3/"))
    ? "/Test-3" : "";
  return `${base}${path}`;
}
