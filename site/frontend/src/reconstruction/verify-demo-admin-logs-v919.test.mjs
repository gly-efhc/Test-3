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
  readDemoAccount:()=>({global_id:'0000657667',wallets:[],ledger:[{id:'DEMO-LEDGER-1',amount_efhc:'10.00000000',direction:'credit',balance_type:'main',reason:'demo_task_bonus',created_at:'2026-10-31T00:00:00.000Z'}],completed_tasks:[]}),
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

test('public Admin journal reads local account-scoped ledger without remote API',async()=>{
 const out=await request('/admin/logs/transfers?limit=20&global_id=0000657667','GET');
 assert.equal(out.ok,true);
 assert.equal(out.items.length,1);
 assert.equal(out.items[0].global_id,'0000657667');
 assert.equal(out.items[0].amount,'10.00000000');
 assert.equal(out.items[0].direction,'user_credit');
 assert.equal(out.items[0].reason,'demo_task_bonus');
 assert.equal(out.next_cursor,null);
});
test('Admin journal isolates other Global ID and blocks write',async()=>{
 const out=await request('/admin/logs/transfers?global_id=0000000002','GET');
 assert.equal(out.items.length,0);
 await assert.rejects(request('/admin/logs/transfers','POST',{}),
  e=>e.code==='ADMIN_PUBLIC_DEMO_READ_ONLY' && e.status===403);
});
