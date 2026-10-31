import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const srcRoot = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(srcRoot, "lib/publicAssetPath.ts"), "utf8");
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function evaluate(preview, base, pathname) {
  const module = { exports: {} };
  const env = { NEXT_PUBLIC_EFHC_PAGES_PREVIEW: preview ? "1" : "0" };
  if(base!==undefined) env.NEXT_PUBLIC_EFHC_PAGES_BASE_PATH=base;
  new Function("module","exports","process","window", js)(module,module.exports,{env},{location:{pathname}});
  return module.exports;
}

test("default GitHub Pages route retains the exact established /Test-3 path",()=>{
 const app=evaluate(true,undefined,"/Test-3/hub/");
 assert.equal(app.pagesBasePath(), "/Test-3");
 assert.equal(app.publicAssetPath("/SHOP_v866.html"), "/Test-3/SHOP_v866.html");
 assert.equal(app.stripPagesBasePath("/Test-3/Test-3/hub/"), "/hub/");
});
test("one ENV value moves all asset and stored navigation paths",()=>{
 const app=evaluate(true,"/New-Project/","/New-Project/browser-shop/");
 assert.equal(app.pagesBasePath(), "/New-Project");
 assert.equal(app.publicAssetPath("/SHOP_v866.html"), "/New-Project/SHOP_v866.html");
 assert.equal(app.stripPagesBasePath("/New-Project/New-Project/browser-shop/orders"), "/browser-shop/orders");
});
test("root mode and invalid base paths do not create unsafe or duplicated prefixes",()=>{
 const root=evaluate(true,"/","/browser-shop/");
 assert.equal(root.pagesBasePath(), "");
 assert.equal(root.publicAssetPath("/pwa-build.json"), "/pwa-build.json");
 const prod=evaluate(false,"/New-Project","/browser-shop/");
 assert.equal(prod.pagesBasePath(), "");
 assert.equal(prod.publicAssetPath("/pwa-build.json"), "/pwa-build.json");
 const invalid=evaluate(true,"/../../unsafe","/Test-3/hub/");
 assert.equal(invalid.pagesBasePath(),"/Test-3");
 assert.ok(existsSync(resolve(srcRoot,"pages/browser-shop.tsx")));
 assert.ok(existsSync(resolve(srcRoot,"pages/browser-shop/orders.tsx")));
 assert.ok(existsSync(resolve(srcRoot,"pages/browser-shop/profile.tsx")));
});
