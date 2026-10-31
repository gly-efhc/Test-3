import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const src=readFileSync(resolve(import.meta.dirname,"../components/Layout.tsx"),"utf8");

test("Canonical v866 theme color variables are bound on documentElement, not only the React shell",()=>{
  assert.match(src,/document\.documentElement\.dataset\.interfaceAppMode\s*=\s*appMode/);
  assert.match(src,/document\.documentElement\.dataset\.colorThemeId\s*=\s*customization\.colorThemeId/);
  assert.match(src,/document\.documentElement\.dataset\.globalThemeId\s*=\s*customization\.globalThemeId/);
  assert.match(src,/delete document\.documentElement\.dataset\.colorThemeId/);
  assert.match(src,/delete document\.documentElement\.dataset\.globalThemeId/);
});
