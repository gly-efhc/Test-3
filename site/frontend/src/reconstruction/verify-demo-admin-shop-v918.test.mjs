/** Isolated execution of the actual TypeScript DEMO API dispatcher.
 * No DOM, wallet, network, backend or external test dependency beyond
 * the project's existing TypeScript dev dependency.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here,'demoApi.ts'),'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    esModuleInterop: true, resolveJsonModule: true },
  fileName: 'demoApi.ts', reportDiagnostics: true,
});
assert.equal((js.diagnostics || []).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const store = {
  DEMO_GLOBAL_ID:'0000657667',
  isDemoPreviewEnabled:()=>true,
  readDemoState:()=>({scenario:'normal'}),
  readDemoAccount:()=>({global_id:'0000657667',wallets:[],ledger:[],completed_tasks:[]}),
};
const module = {exports:{}};
const sandbox = {module,exports:module.exports,URL,console,Date,setTimeout,BigInt, window:undefined,
  require(id){
    if (id.includes('demo-tables-v866.json')) return require('./demo-tables-v866.json');
    if (id.includes('demo-admin-seed-v866.json')) return require('./demo-admin-seed-v866.json');
    if (id.endsWith('demoUnifiedStore')) return store;
    if (id.endsWith('demoTables')) return {};
    throw new Error('UNEXPECTED_DEPENDENCY_'+id);
  }};
vm.runInNewContext(js.outputText,sandbox,{filename:'demoApi.ts',timeout:1000});
const request = module.exports.demoApiRequest;

test('17 DEMO catalog positions available to read-only Admin Shop',async()=>{
  const items=await request('/admin/shop/items','GET');
  assert.equal(items.length,17);
  assert.equal(items.filter(x=>x.item_type==='EFHC_PACKAGE').length,16);
  assert.equal(items.filter(x=>x.item_type==='NFT_VIP').length,1);
  assert.ok(items.every(x=>x.code&&x.is_active===true));
});
test('frozen v866 paid orders paginate 20+6 and filter by Global ID',async()=>{
  const first=await request('/admin/shop/orders?limit=20','GET');
  assert.equal(first.items.length,20);
  assert.equal(first.next_cursor,'20');
  const rest=await request('/admin/shop/orders?limit=20&cursor=20','GET');
  assert.equal(rest.items.length,6);
  assert.equal(rest.next_cursor,null);
  const one=await request('/admin/shop/orders?global_id=0000657667','GET');
  assert.ok(one.items.length>0);
  assert.ok(one.items.every(x=>x.global_id==='0000657667'));
  const detail=await request('/admin/shop/order/4201','GET');
  assert.equal(detail.order_id,'4201');
});
test('Admin Shop counters match frozen orders, no remote authority',async()=>{
  const counts=await request('/admin/shop/orders/status-counters','GET');
  assert.equal(counts.total,26);
  assert.equal(counts.pending_manual>0,true);
});
test('public Admin mutations fail closed without side effects',async()=>{
  await assert.rejects(request('/admin/shop/items/upsert','POST',{}),
    e=>e.code==='ADMIN_PUBLIC_DEMO_READ_ONLY'&&e.status===403);
  await assert.rejects(request('/admin/shop/orders/4201/force-fulfill','POST',{}),
    e=>e.code==='ADMIN_PUBLIC_DEMO_READ_ONLY'&&e.status===403);
});
