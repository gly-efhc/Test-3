import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "../pages/_app.tsx"), "utf8");
test("canonical DEMO CSS routing uses variables owned by App", () => {
  const outer = source.slice(source.indexOf("export default function App("), source.indexOf("function AppInner("));
  const firstHead = outer.indexOf("<Head>");
  assert.ok(firstHead > 0, "canonical CSS Head missing in App");
  const preceding = outer.slice(0, firstHead);
  assert.match(preceding, /const router\s*=\s*useRouter\(\)/);
  assert.match(preceding, /const isBrowserShop\s*=\s*router\.pathname/);
  assert.match(outer.slice(firstHead), /FRONTEND_v866\.css/);
});
