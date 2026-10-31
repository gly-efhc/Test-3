/** RECON_CYCLE_0014: permanent focused guards for OWNER log 111666933666.
 * These guards do not replace Next build or Chromium parity. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('active bottom navigation retains route state but has no active point',()=>{
 const src=read('components/Layout.tsx');
 assert.match(src,/aria-current=\{props\.active \? "page" : undefined\}/);
 assert.match(src,/data-active=\{props\.active \? "true" : "false"\}/);
 assert.doesNotMatch(src,/className="efhc-game-nav_active-indicator"/);
 const css=fs.readFileSync(path.resolve(root,'../public/owner-bottom-nav-no-active-dot.css'),'utf8');
 assert.match(css,/data-bn="BN-20"/);
 assert.match(css,/content: none !important/);
 assert.match(css,/efhc-game-nav_active-indicator/);
 assert.match(read('pages/_app.tsx'),/owner-bottom-nav-no-active-dot\.css/);
});
test('Pages demo tasks and panel pagination depend on preview, never wallet mock',()=>{
 const hook=read('reconstruction/useFrozenDemoTables.ts');
 assert.match(hook,/NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1"/);
 assert.match(hook,/NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF === "1"/);
 assert.match(hook,/__EFHC_DEMO_READ_ONLY__ === true/);
 assert.doesNotMatch(hook,/NEXT_PUBLIC_EFHC_E2E_TONCONNECT_MOCK/);
 assert.match(read('queries/usePanels.ts'),/demoPanelsPage\(tab, pageParam, sortDirection\)/);
 assert.match(read('pages/tasks.tsx'),/data-demo-task-mode=\{isDemoPreview/);
});
test('Ranks D8 remains atomic and narrow stat gets the whole width',()=>{
 const css=read('styles/reconstruction-ranks-hero-cycle0012-v891.css');
 assert.match(css,/\[data-ranks-hero-energy-d8="true"\]/);
 assert.match(css,/white-space: nowrap/);
 assert.match(css,/grid-template-columns: minmax\(0, 1fr\);/);
 assert.doesNotMatch(css,/\.efhc-rank-card/);
});
test('public static assets resolve Pages prefix, production keeps root',()=>{
 const src=read('lib/publicAssetPath.ts');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const compile=(pages,pathname)=>{
   const module={exports:{}};
   new Function('module','exports','process','window',js)(module,module.exports,
    {env:{NEXT_PUBLIC_EFHC_PAGES_PREVIEW:pages?'1':'0'}},{location:{pathname}});
   return module.exports.publicAssetPath('/pwa-build.json');
 };
 assert.equal(compile(true,'/Test-3/ranks/'),'/Test-3/pwa-build.json');
 assert.equal(compile(false,'/ranks/'),'/pwa-build.json');
 assert.equal(compile(true,'/ranks/'),'/pwa-build.json');
 assert.match(read('hooks/faq/useFaqCatalog.ts'),/publicAssetPath\(`\/faq\/\$\{lang\}\.json`\)/);
 assert.ok(fs.existsSync(path.join(root,'../public/favicon.ico')));
});
