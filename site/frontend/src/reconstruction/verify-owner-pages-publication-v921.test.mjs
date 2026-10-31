import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../pages/_app.tsx',import.meta.url),'utf8');
const dot=readFileSync(new URL('../styles/reconstruction-cycle0014-bottom-nav-dot-owner.css',import.meta.url),'utf8');
const rules=readFileSync(new URL('../../../docs/NORM/OWNER_COMMUNICATION_REPORTING_CANON_2026-10-31.md',import.meta.url),'utf8');

test('OWNER CSS corrections are imported by the real React entrypoint in strict order',()=>{
 const names=['globals.css','reconstruction-canon-v866-user-shell.css','reconstruction-dialog-navigation-v877.css','reconstruction-canon-v866-frames-header-v878.css','reconstruction-v866-header-cycle0007.css','reconstruction-v866-energy-header-cycle0008.css','reconstruction-v866-panels-cycle0010.css','reconstruction-ranks-hero-cycle0012-v891.css','reconstruction-tasks-cycle0013-v892.css','reconstruction-regression-recovery-v888.css','reconstruction-cycle0014-bottom-nav-dot-owner.css'];
 let last=-1;
 for(const name of names){const i=app.indexOf(`import "../styles/${name}";`);assert.ok(i>last,`${name}: missing or wrong import order`);last=i;}
});

test('BN-20 has a loadable strong dot suppression scoped to USER only',()=>{
 assert.match(dot,/data-interface-app-mode="user"/);
 assert.match(dot,/data-bn="BN-20"/);
 assert.match(dot,/content: none !important/);
 assert.match(dot,/display: none !important/);
 assert.doesNotMatch(dot,/data-interface-app-mode="admin"/);
});

test('New OWNER instructions are written to an active law',()=>{
 for(const term of ['Каждая завершённая проверка обязана заканчиваться','каждое новое прямое указание','все ошибки из доступных текущих логов']){
  assert.ok(rules.toLowerCase().includes(term.toLowerCase()),term);
 }
});

test('Main Pages historical TypeScript errors have local source fixes, without false deployed marker',()=>{
 assert.match(app,/const router = useRouter\(\)/);
 assert.match(app,/const isBrowserShop = router\.pathname/);
 assert.doesNotMatch(app,/data-efhc-pages-deploy-success="true"/);
});
