import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
test("Pages preview records route changes without enabling the production hash guard", () => {
  const src = read("../lib/appBackNavigation.ts");
  const observe = src.indexOf('router.events.on("routeChangeComplete", onRouteChange)');
  const skip = src.indexOf('if (process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1") {');
  assert.ok(observe > 0 && skip > observe);
  assert.ok(src.includes('return () => router.events.off("routeChangeComplete", onRouteChange);'));
  assert.ok(src.includes('navigateBackWithinApp'));
});
test("Modal portal stands above onboarding and can be scrolled entirely within viewport", () => {
  const css = read("../styles/reconstruction-dialog-navigation-v877.css");
  assert.match(css, /z-index:\s*2147483100\s*!important/);
  assert.match(css, /height:\s*100dvh\s*!important/);
  assert.match(css, /max-height:\s*calc\(100dvh - 32px\)/);
  assert.match(css, /overflow-y:\s*auto/);
  const globals = read("../styles/globals.css");
  assert.match(globals, /z-index:\s*2147483000/);
  const app = read("../pages/_app.tsx");
  assert.match(app, /import "\.\.\/styles\/reconstruction-dialog-navigation-v877\.css";/);
});
test("Modal header supports pointer dragging, viewport clamp and keeps close action", () => {
  const src = read("../components/ui/Modal.tsx");
  for (const value of ['onPointerDown={onDragStart}', 'onPointerMove={onDragMove}',
    'onPointerUp={onDragEnd}', 'data-modal-drag-handle="true"',
    'window.innerWidth - rect.right', 'window.innerHeight - rect.bottom',
    'onClick={props.onClose}', 'if (!props.closeDisabled) props.onClose()',
  ]) assert.ok(src.includes(value), value);
});
