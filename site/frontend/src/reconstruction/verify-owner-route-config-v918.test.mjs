import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const read=(path)=>readFileSync(resolve(root,path),"utf8");
test("one app route registry owns Browser Shop paths and navigation variants",()=>{
 const cfg=read("lib/appRoutes.ts");
 assert.match(cfg,/browserShop: "\/browser-shop"/);
 assert.match(cfg,/browserShopOrders: "\/browser-shop\/orders"/);
 assert.match(cfg,/browserShopProfile: "\/browser-shop\/profile"/);
 assert.match(cfg,/function browserShopRouteFor\(/);
 assert.match(read("features/browser-shop/BrowserShopPage.tsx"),/browserShopRouteFor\(/);
 assert.match(read("components/ShopLayout.tsx"),/APP_ROUTES\.browserShopProfile/);
 assert.match(read("pages/_app.tsx"),/isBrowserShopRoute\(/);
});
test("Pages base-path prefix is configured once, with legacy Test-3 preserved",()=>{
 const code=read("lib/publicAssetPath.ts");
 assert.match(code,/NEXT_PUBLIC_EFHC_PAGES_BASE_PATH/);
 assert.match(code,/DEFAULT_PAGES_BASE_PATH\s*=\s*"\/Test-3"/);
 assert.match(code,/export function stripPagesBasePath/);
 assert.match(read("lib/appBackNavigation.ts"),/stripPagesBasePath\(/);
 assert.doesNotMatch(read("lib/appBackNavigation.ts"),/canonical\.slice\("\/Test-3"/);
});
test("Shop URL is controlled by runtime or env without rewriting signed handoffs",()=>{
 const cfg=read("lib/portal/shopDestination.ts");
 assert.match(cfg,/NEXT_PUBLIC_EFHC_SHOP_URL/);
 assert.match(cfg,/if \(\/\^https:/);
 assert.match(cfg,/target\.href/);
 assert.match(read("queries/useShopLauncher.ts"),/resolveShopDestination\(access\.redirect_url\)/);
});
