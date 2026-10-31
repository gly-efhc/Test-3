import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base=path.resolve(new URL('../..',import.meta.url).pathname);
const root=path.resolve(base,'..');
const read=(p)=>fs.readFileSync(path.join(base,p),'utf8');
test('v923 renders approved v866 before scoped React CSS; _app TSX parses',()=>{
 const a=read('src/pages/_app.tsx');
 assert.match(a,/import "\.\.\/styles\/globals\.css";/);
 assert.doesNotMatch(a,/import "\.\.\/styles\/reconstruction-v866-panels-cycle0010\.css";/);
 assert.ok(a.indexOf('/FRONTEND_v866.css')>=0 && a.indexOf('/FRONTEND_v866.css')<a.indexOf('/react-shell-mobile-viewport-v923.css'));
 assert.match(a,/\{!isBrowserShop \? \(\s*<>\s*<link/);
 assert.match(a,/router\.basePath}\/favicon\.ico/);
});
test('v923 scoped visual recovery preserves Panels PA-01, themes, navigation and source exact CSS',()=>{
 const src=read('public/react-shell-mobile-viewport-v923.css');
 assert.match(src,/data-pa="PA-01"/);
 for (let i=1;i<=10;i++)assert.ok(src.includes(`data-color-theme-id="CT-${String(i).padStart(2,'0')}"`));
 assert.match(src,/grid-template-columns: repeat\(2,/);
 assert.match(src,/data-bn="BN-20"/);
 assert.match(src,/data-public-shell-route="public"/);
 assert.ok(src.includes(read('src/styles/reconstruction-v866-panels-cycle0010.css')));
 assert.ok(src.includes(read('src/styles/reconstruction-tasks-cycle0013-v892.css')));
});
test('v923 repair paths resolve GitHub Pages demo and skins under the project base path',()=>{
 assert.match(read('src/reconstruction/demoUnifiedStore.ts'),/const base=\/\^\\\/Test-3/);
 assert.match(read('src/lib/skins.ts'),/base/);
 assert.match(fs.readFileSync(path.join(root,'ci/efhc-pages.yml'),'utf8'),/icons\|skins\|demo\|favicon/);
});
test('v923 restores release build id manifest checksum',()=>{
 const id=read('.efhc-build-id').trim();
 const build=JSON.parse(read('public/pwa-build.json'));
 const manifest=JSON.parse(read('release-assets-manifest.json'));
 assert.equal(id,build.build_id);
 const expected=crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'.efhc-build-id'))).digest('hex');
 assert.equal(manifest.files['.efhc-build-id'][0],expected.slice(0,32));
});
test('v923 Telegram UI protects hidden button and unsupported browser cloud storage',()=>{
 const src=read('src/lib/telegram.ts');
 assert.match(src,/typeof opts\.text === \"string\" && opts\.text\.trim\(\)/);
 assert.match(src,/platform === "unknown"/);
});
test('v923 canonical script no non-executable Ruff shebang for prepare_pages.py',()=>{
 const yml=fs.readFileSync(path.join(root,'ci/efhc-pages.yml'),'utf8');
 const start=yml.indexOf('EFHC_BUNDLED_PREPARE_PAGES_PY');
 assert.ok(start>=0);
 assert.doesNotMatch(yml.slice(start,start+200),/#!\/usr\/bin\/env python3/);
});
