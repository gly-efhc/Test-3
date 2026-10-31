import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(import.meta.dirname, "../features/hub/HubPage.tsx"), "utf8");
const css = readFileSync(resolve(import.meta.dirname, "../../public/FRONTEND_v866.css"), "utf8");

test("HUB React uses original v866 DOM identity and canonical grid/card classes", () => {
  assert.match(src, /id="hubPage"/);
  assert.match(src, /className="efhc-hub-page source-route-page unified-route-page"/);
  assert.match(src, /className="efhc-hub-choice-grid release-route-grid efhc-hub-standalone-actions"/);
  assert.match(src, /className="efhc-hub-choice release-route-card"/);
  assert.doesNotMatch(src, /efhc-hub-page efhc-hub-actions/);
  assert.match(css, /#hubPage\[data-hu="HU-01"\]/);
  assert.match(css, /\.release-route-grid\{/);
  assert.match(css, /\.release-route-card\{/);
});
