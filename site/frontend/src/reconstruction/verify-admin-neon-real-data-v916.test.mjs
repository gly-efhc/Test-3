import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const src = readFileSync(resolve(import.meta.dirname,"../pages/admin/index.tsx"),"utf8");
test("ADMIN home uses actual Neon test API when explicitly selected, not invented demo zero values",()=>{
 assert.match(src,/const IS_PUBLIC_PAGES_DEMO\s*=\s*process\.env\.NEXT_PUBLIC_EFHC_PAGES_PREVIEW\s*===\s*"1"\s*&&\s*process\.env\.NEXT_PUBLIC_EFHC_TEST_MODE\s*!==\s*"neon"/);
 assert.match(src,/adminApiRequest<Overview>\(ADMIN_REPORTS_OVERVIEW_PATH, "GET"\)/);
 assert.match(src,/setOverview\(DEMO_ADMIN_OVERVIEW\)/);
 assert.match(src,/adminUiErrorMessage\(error, t\)/);
});
