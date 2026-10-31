import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(import.meta.dirname,"../pages/_app.tsx"),"utf8");
test("ADMIN access transport failure is distinct from server-authoritative permission denial",()=>{
 assert.match(app, /"checking" \| "allowed" \| "denied" \| "unavailable"/);
 assert.match(app, /setAdminAccessState\("unavailable"\)/);
 assert.match(app, /const adminRouteUnavailable =/);
 assert.match(app, /adminAccessState !== "denied"/);
 assert.match(app, /data-admin-route-guard-state=\{props\.unavailable/);
 assert.match(app, /props\.t\("common\.load_error"\)/);
 assert.match(app, /fetchAdminAccess\(\)/);
});
