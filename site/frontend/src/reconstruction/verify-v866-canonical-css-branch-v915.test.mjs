import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(import.meta.dirname, "../pages/_app.tsx"), "utf8");

test("OWNER v866 canonical stylesheet Head has a locally bound router in App", () => {
  const outer = app.slice(app.indexOf("export default function App("), app.indexOf("function AppInner("));
  const firstHead = outer.indexOf("<Head>");
  assert.ok(firstHead > 0, "canonical HEAD must be inside App");
  const preHead = outer.slice(0, firstHead);
  assert.match(preHead, /const router\s*=\s*useRouter\(\)/);
  assert.match(preHead, /const isBrowserShop\s*=\s*router\.pathname/);
  assert.match(outer.slice(firstHead), /FRONTEND_v866\.css/);
});
