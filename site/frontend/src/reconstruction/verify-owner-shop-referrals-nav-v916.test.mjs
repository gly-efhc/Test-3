import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const src = (name) => readFileSync(resolve(import.meta.dirname, "..", name), "utf8");

test("Shop external address is configured once and defaults to OWNER canonical URL", () => {
  assert.match(src("lib/public-runtime.ts"), /NEXT_PUBLIC_EFHC_SHOP_URL/);
  const route = src("lib/portal/shopDestination.ts");
  assert.match(route, /https:\/\/gly-efhc\.github\.io\/shop/);
  assert.match(route, /publicRuntimeValue\("NEXT_PUBLIC_EFHC_SHOP_URL"\)/);
  assert.match(src("queries/useShopLauncher.ts"), /resolveShopDestination\(access\.redirect_url\)/);
  assert.match(src("features/hub/HubPage.tsx"), /externalShopUrl\(\)/);
  assert.match(src("reconstruction/demoApi.ts"), /externalShopUrl\(\)/);
  assert.doesNotMatch(src("features/hub/HubPage.tsx"), /router\.push\("\/browser-shop"\)/);
});

test("Referral social SVG icons work beneath GitHub Pages basePath", () => {
  const refs = src("pages/referrals.tsx");
  assert.match(refs, /router\.basePath\}\/brands\/\$\{kind\}\.svg/);
  for(const name of ["telegram","whatsapp","viber","facebook","x"]) {
    assert.ok(existsSync(resolve(import.meta.dirname, "../../public/brands", name+".svg")), name);
  }
});

test("All bottom navigation active dots are suppressed without losing active navigation", () => {
  const style = src("pages/_app.tsx");
  const nav = src("components/Layout.tsx");
  assert.match(style, /owner-bottom-nav-no-active-dot\.css/);
  assert.match(nav, /aria-current=\{props\.active \? "page" : undefined\}/);
  assert.doesNotMatch(nav, /className="efhc-game-nav_active-indicator"/);
  const css = readFileSync(resolve(import.meta.dirname, "../../public/owner-bottom-nav-no-active-dot.css"),"utf8");
  assert.match(css, /data-bn="BN-20"/);
  assert.match(css, /content:\s*none\s*!important/);
  assert.match(css, /efhc-game-nav_active-indicator/);
});

test("Admin pages remain existing authorized routes, no synthetic admin bypass", () => {
  for(const sub of ["index","users","bank","hub","tasks","shop","withdrawals","referrals"]) {
    assert.ok(existsSync(resolve(import.meta.dirname, "../pages/admin", sub+".tsx")), sub);
  }
  const app = src("pages/_app.tsx");
  assert.match(app, /fetchAdminAccess\(\)/);
  assert.match(app, /adminAccessState === "allowed"/);
});
