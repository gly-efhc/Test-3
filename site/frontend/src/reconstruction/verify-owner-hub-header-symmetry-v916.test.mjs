import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const header=readFileSync(resolve(root,"components/GlobalHeader.tsx"),"utf8");
const hub=readFileSync(resolve(root,"features/hub/HubPage.tsx"),"utf8");
const css=readFileSync(resolve(root,"../public/FRONTEND_v866.css"),"utf8");

test("owner-approved Header uses two equal top regions and four equal actions",()=>{
 assert.match(header,/data-header-action-layout="balanced-grid"/);
 assert.match(header,/data-action-count="4"/);
 assert.doesNotMatch(header,/data-action="Admin"/);
 assert.match(css,/\.efhc-game-header\s*\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.efhc-game-header_actions\s*\{\s*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
});

test("HUB displays every active Admin link in two equal columns without a row cap",()=>{
 assert.match(hub,/data-hub-link-slot-grid="two-per-row-active-only"/);
 assert.match(hub,/links\.map\(\(link\)/);
 assert.doesNotMatch(hub,/links\.slice\(/);
 assert.match(css,/\.release-route-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(hub,/efhc_admin/);
});
