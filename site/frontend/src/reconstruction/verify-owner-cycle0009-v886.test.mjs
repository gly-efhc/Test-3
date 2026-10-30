import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("theme template selection is never mislabeled aria-disabled", () => {
  for (const name of ["useInterfaceVariantSurface", "useGlobalThemeSurface"]) {
    const text = read(`../${name === "useGlobalThemeSurface" ? "hooks" : "hooks"}/${name}.ts`);
    assert.doesNotMatch(text, /"aria-disabled":\s*active/);
    assert.match(text, /"data-interface-selection-active": active \? "true" : undefined/);
    assert.match(text, /customization\.(next|nextGlobalTheme)\(/);
  }
});
test("the historical theme disabled rule stays available ONLY for disabled elements", () => {
  const css = read("../styles/globals.css");
  assert.match(css, /:disabled,\[aria-disabled="true"\],\[data-disabled="true"\]/);
  const hooks = ["../hooks/useInterfaceVariantSurface.ts", "../hooks/useGlobalThemeSurface.ts"];
  for (const path of hooks) assert.doesNotMatch(read(path), /"aria-disabled"/);
});
test("PWA status is mounted headless; runtime registration remains", () => {
  const app = read("../pages/_app.tsx");
  const pwa = read("../components/PwaRuntimeStatus.tsx");
  assert.match(app, /<PwaRuntimeStatus t=\{t\} enabled=\{browserSupportsServiceWorker\(\)\} headless \/>/);
  assert.match(pwa, /if \(props\.headless\) return null/);
  assert.match(pwa, /navigator\.serviceWorker\.register/);
  assert.match(pwa, /type: "SET_CACHE_POLICY"/);
});
test("Back routing removes stale repeated Pages path prefixes", () => {
  const src = read("../lib/appBackNavigation.ts");
  assert.match(src, /NEXT_PUBLIC_EFHC_PAGES_PREVIEW/);
  assert.match(src, /while \(canonical === "\/Test-3"/);
  assert.match(src, /rememberRoute\(routerRef\.current/);
  assert.match(src, /router\.events\.on\("routeChangeComplete"/);
  assert.match(src, /router\.push\(target, undefined, \{ scroll: false \}\)/);
});
test("modal pointer dragging clamps to visual viewport with keyboard", () => {
  const src = read("../components/ui/Modal.tsx");
  assert.match(src, /window\.visualViewport\?\.offsetTop/);
  assert.match(src, /viewportBottom - rect\.bottom/);
  assert.match(src, /onPointerCancel=\{onDragEnd\}/);
  assert.match(src, /onClick=\{props\.onClose\}/);
});
test("OWNER approved Energy page and financial MAX CTA retained", () => {
  assert.match(read("../pages/index.tsx"), /efhc-energy/);
  assert.match(read("../components/ExchangePanel.tsx"), /data-exchange-max-action="true"/);
  assert.match(read("../pages/withdraw.tsx"), /efhc-withdraw-max-cta/);
  assert.match(read("../pages/panels.tsx"), /panels/);
  assert.match(read("../pages/referrals.tsx"), /referrals/);
});
test("no direct production finances or admin authorization mutation", () => {
  const pwa = read("../components/PwaRuntimeStatus.tsx");
  assert.doesNotMatch(pwa, /tonProof\s*=|sendTransaction\s*\(/);
  assert.match(read("../lib/appBackNavigation.ts"), /APP_BACK_NAVIGATION_CONTRACT/);
});
