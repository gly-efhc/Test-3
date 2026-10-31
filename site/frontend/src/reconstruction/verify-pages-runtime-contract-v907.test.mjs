import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const source=(name)=>fs.readFileSync(path.join(here,name),'utf8');

test('v907: IndexedDB opens through versioned shared schema, not premature read-only open',()=>{
 const s=source('demoUnifiedStore.ts');
 assert.match(s,/DEMO_DB_VERSION\s*=\s*3/);
 assert.match(s,/async function openDemoDatabase\(/);
 assert.match(s,/indexedDB\.open\(DEMO_DB_NAME,DEMO_DB_VERSION\)/);
 assert.equal((s.match(/indexedDB\.open\(/g)||[]).length,1);
 assert.match(s,/databaseBootstrap=bootstrapDemoDatabaseContents\(\)/);
 assert.match(s,/await bootstrapDemoIndexedDb\(\)/);
 assert.match(s,/lastMirroredGlobalId/);
 assert.match(s,/demoIndexedHistoryPage\(/);
 assert.match(s,/IDBKeyRange\.only\(globalId\)/);
});
test('v907: 1000 users and 27,500 frozen ledger transactions exist',()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'public/demo/frozen-admin-1000-v866.json'),'utf8'));
 assert.equal(fixture.users.length,1000);
 assert.equal(fixture.transactions.length,27500);
 assert.ok(fixture.transactions.some(x=>x.global_id==='0000657667'));
 const s=source('demoApi.ts');
 assert.match(s,/readDemoCombinedHistory/);
 assert.match(s,/demoIndexedHistoryPage\(a\.global_id/);
 assert.match(s,/p==="\/profile\/history"/);
 assert.match(s,/p==="\/wallets\/balance-history"/);
});
test('v907: table laboratory initializes verified counts without manual setup',()=>{
 const s=fs.readFileSync(path.join(root,'src/pages/demo-lab.tsx'),'utf8');
 assert.match(s,/await bootstrapDemoIndexedDb\(\)/);
 assert.match(s,/if\(ready&&!remote\)void loadDatabase\(\)/);
 assert.match(s,/for\(const name of DEMO_TABLE_NAMES\)result\[name\]=await demoTableCount\(name\)/);
});
test('v907: template surfaces are keyboard focusable only in edit mode',()=>{
 const s=fs.readFileSync(path.join(root,'src/hooks/useInterfaceVariantSurface.ts'),'utf8');
 assert.match(s,/tabIndex:\s*active\s*\?\s*0/);
 assert.match(s,/role:\s*active\s*\?\s*"button"/);
 assert.match(s,/"aria-label":\s*active/);
 assert.match(s,/event\.target !== ref\.current/);
});
test('v908: actual TONConnect transport remains available in Pages with server-authoritative identity',()=>{
 const layout=fs.readFileSync(path.join(root,'src/components/Layout.tsx'),'utf8');
 const adapter=fs.readFileSync(path.join(root,'src/lib/wallet-provider/adapters/TonConnectAdapter.ts'),'utf8');
 const app=fs.readFileSync(path.join(root,'src/services/appShell.service.ts'),'utf8');
 assert.doesNotMatch(layout,/__EFHC_TONCONNECT_USER_ACTIVATED_UNTIL__/);
 assert.doesNotMatch(layout,/подключение только для просмотра адреса/);
 assert.match(layout,/await prepareProof\(\)\.catch/);
 assert.match(layout,/setWalletHint\(t\("wallet.restore_requires_proof"\)\)/);
 assert.doesNotMatch(adapter,/public-demo-transaction-disabled/);
 assert.doesNotMatch(adapter,/NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1"/);
 assert.match(adapter,/bindVerifiedTonConnectWallet/);
 assert.match(adapter,/sendTonConnectTransaction\(requireUi\(\), tx\)/);
 assert.match(app,/tonconnect-manifest\.json/);
 assert.match(app,/new URL\(pages \?/);
});
test('v907: Pages diagnostics use genuine portable executable tests',()=>{
 const py=source('ci_predeploy_diagnostics.py');
 const support=path.join(here,'pages_ci');
 for(const name of ['tonconnect-public.test.mjs','budgets.mjs','verify-production-assets.mjs'])
  assert.ok(fs.statSync(path.join(support,name)).size>100,name);
 assert.match(py,/frontend-tonconnect-public-regression/);
 assert.match(py,/frontend-tonconnect-private-acceptance/);
 assert.match(py,/frontend-performance-budgets/);
 assert.match(py,/frontend-release-assets/);
 assert.match(py,/NOT_AVAILABLE/);
});
test('v907: lockfile pins patched follow-redirects package with registry integrity',()=>{
 const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 assert.equal(lock.packages['node_modules/follow-redirects'].version,'1.16.2');
 assert.match(lock.packages['node_modules/follow-redirects'].integrity,/^sha512-/);
 assert.equal(pkg.overrides['follow-redirects'],'^1.16.2');
});
