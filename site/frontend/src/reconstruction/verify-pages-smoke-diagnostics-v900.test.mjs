import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const here=path.resolve(import.meta.dirname);
const root=path.resolve(here,'../../..');
const src=fs.readFileSync(path.join(here,'demoUnifiedStore.ts'),'utf8');
const canon=JSON.parse(fs.readFileSync(path.join(here,'frozen-v866-home-fixture.json'),'utf8'));
const table=JSON.parse(fs.readFileSync(path.join(here,'demo-tables-v866.json'),'utf8'));
const yaml=fs.readFileSync(path.join(root,'ci/efhc-pages.yml'),'utf8');
const compiled=ts.transpileModule(src,{compilerOptions:{
 target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true,resolveJsonModule:true
}}).outputText;
const local=new Map();
const win={localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},dispatchEvent:()=>{}};
const mod={exports:{}};
new Function('require','module','exports','window','process',compiled)(target=>{
 if(target==='./demo-tables-v866.json')return table;
 if(target==='./demo-admin-seed-v866.json')return {};
 if(target==='./frozen-v866-home-fixture.json')return canon;
 throw new Error('unexpected module '+target);
},mod,mod.exports,win,process);
const store=mod.exports;
test('v900 canonical public header equals EFHCm + EFHCb from two frozen fixtures',()=>{
 const s=store.seedDemoState().accounts[store.DEMO_GLOBAL_ID];
 assert.equal(s.bonus_balance,table.tasks.bonus_balance_d8);
 assert.equal(store.formatD8(store.d8(s.main_balance)+store.d8(s.bonus_balance)),canon.source_dom_ids.balanceValue);
 assert.equal(s.main_balance,'12345600.12345678');
});
test('v900 only untouched legacy primary sample is migrated',()=>{
 const original=store.seedDemoState();
 const legacy={...original,accounts:{...original.accounts,[store.DEMO_GLOBAL_ID]:{
  ...original.accounts[store.DEMO_GLOBAL_ID],main_balance:'12345.00000000'
 }}};
 local.set(store.DEMO_STORAGE_KEY,JSON.stringify(legacy));
 assert.equal(store.readDemoAccount().main_balance,'12345600.12345678');
 assert.equal(JSON.parse(local.get(store.DEMO_STORAGE_KEY)).accounts[store.DEMO_GLOBAL_ID].main_balance,'12345600.12345678');
 // Verify guarded migration predicate by reading exported source: no mutation if ledger exists.
 assert.match(src,/old\.ledger\.length\|\|old\.withdrawals\.length/);
 assert.match(src,/old\.completed_tasks\.length/);
});
test('v900 versioned Pages YAML emits bounded JSON diagnostics on failure and preserves strict hard gate',()=>{
 assert.match(yaml,/EFHC_CI_DIAGNOSTIC_JSON=/);
 assert.match(yaml,/Runtime\.exceptionThrown/);
 assert.match(yaml,/Network\.responseReceived/);
 assert.match(yaml,/PAGES_FROZEN_BALANCE_FIXTURE_MISSING expected=12345678\.12345678/);
 assert.match(yaml,/EFHC_PAGES_CHROME_RUNTIME_SMOKE=FAIL/);
 assert.match(yaml,/EFHC_CI_DIAGNOSTICS_WRITE_FAIL/);
 assert.match(yaml,/actions\/upload-artifact@v4/);
 assert.match(yaml,/ACTIVE AFTER EXPLICIT OWNER WORKFLOW BOOTSTRAP ONLY/);
 assert.match(yaml,/^          cat > "\$RUNNER_TEMP\/efhc-pages-tools\/browser-smoke\.mjs"/m);
});
