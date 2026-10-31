/** Single source of truth for Next logical routes.
 * Keep physical src/pages entries in sync when renaming a route;
 * changing an ENV value never renames a statically exported Next page.
 * External Browser Shop host is configured separately in shopDestination.ts.
 */
export const APP_ROUTES = Object.freeze({
  home: "/",
  hub: "/hub",
  hubShopHandoff: "/hub/efhc-handoff",
  browserShop: "/browser-shop",
  browserShopOrders: "/browser-shop/orders",
  browserShopProfile: "/browser-shop/profile",
  webProfile: "/web-profile",
} as const);

export type BrowserShopViewRoute = "shop" | "orders" | "profile";

export function browserShopRouteFor(view: BrowserShopViewRoute): string {
  switch (view) {
    case "orders": return APP_ROUTES.browserShopOrders;
    case "profile": return APP_ROUTES.browserShopProfile;
    default: return APP_ROUTES.browserShop;
  }
}

export function isBrowserShopRoute(pathname: string): boolean {
  return pathname === APP_ROUTES.browserShop
    || pathname.startsWith(`${APP_ROUTES.browserShop}/`);
}
