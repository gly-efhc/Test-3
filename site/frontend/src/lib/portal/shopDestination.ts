import { publicRuntimeValue } from "../public-runtime";

/** OWNER canonical browser storefront. One env/runtime setting changes its address everywhere.
 * This does not replace internal /browser-shop Next routes or backend contract paths.
 */
export const DEFAULT_EXTERNAL_SHOP_URL = "https://gly-efhc.github.io/shop";

export function externalShopUrl(): string {
  const configured = publicRuntimeValue("NEXT_PUBLIC_EFHC_SHOP_URL").trim();
  if (!configured) return DEFAULT_EXTERNAL_SHOP_URL;
  try {
    const url = new URL(configured);
    if (url.protocol === "https:" && !url.username && !url.password) {
      return url.href.replace(/\/$/, "");
    }
  } catch { /* invalid operator config uses the canonical safe default */ }
  return DEFAULT_EXTERNAL_SHOP_URL;
}

/** Maintain signed server-issued absolute handoffs verbatim. They can be host-
 * and path-bound. Legacy internal Shop links are migrated to the public address
 * with the query/hash preserved; do not reinterpret auth/payment tokens.
 */
export function resolveShopDestination(redirectUrl?: string | null): string {
  const base = externalShopUrl();
  const raw = typeof redirectUrl === "string" ? redirectUrl.trim() : "";
  if (!raw) return base;
  if (/^https:\/\//i.test(raw)) {
    try {
      const target = new URL(raw);
      if (!target.username && !target.password) return target.href;
    } catch { /* use default */ }
    return base;
  }
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    const legacy = raw.split(/[?#]/, 1)[0].replace(/\/$/, "");
    if (legacy === "/browser-shop" || legacy === "/shop") {
      const target = new URL(base);
      const parsed = new URL(raw, "https://example.invalid");
      target.search = parsed.search;
      target.hash = parsed.hash;
      return target.href;
    }
  }
  return base;
}
