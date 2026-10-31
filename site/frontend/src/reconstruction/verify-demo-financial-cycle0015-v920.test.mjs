/** Executes real demoApi.ts transpiled at test time, with isolated local-only
 * fake storage. No production, wallet, network, Neon or GitHub side effects. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),ts=require('typescript');
const dir=path.dirname(fileURLToPath(import.meta.url));
const code=ts.transpileModule(fs.readFileSync(path.join(dir,'demoApi.ts'),'utf8'),{fileName:'demoApi.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}});
assert.equal((code.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const factor=100000000n;
const d8=(x)=>{const m=String(x).match(/^(-?)(\d+)(?:\.(\d{1,8}))?$/);if(!m)throw Error('INVALID_D8');return (m[1]==='-'?-1n:1n)*(BigInt(m[2])*factor+BigInt((m[3]||'').padEnd(8,'0')));};
const fmt=x=>`${x<0n?'-':''}${(x<0n?-x:x)/factor}.${String((x<0n?-x:x)%factor).padStart(8,'0')}`;
let id=100,selected='0000657667',scenario='filled';
const makeAccount=gid=>({global_id:gid,main_balance:'100.00000000',bonus_balance:'5.00000000',available_kwh:'22.50000000',total_generated_kwh:'500.00000000',completed_tasks:[],ad_views:0,ad_date_utc:'2026-10-31',activated_panels:0,ledger:[],withdrawals:[],exchanges:[],wallets:[{id:1,wallet_address:'DEMO_NOT_REAL',is_primary:true,is_active:true,proof_verified:true}]});
const accounts={'0000657667':makeAccount('0000657667'),'0000000002':makeAccount('0000000002')};
const store={DEMO_GLOBAL_ID:'0000657667',d8,formatD8:fmt,isDemoPreviewEnabled:()=>true,readDemoState:()=>({scenario}),readDemoAccount:()=>accounts[selected],writeDemoAccount:fn=>(accounts[selected]=fn(accounts[selected])),nextDemoId:()=>++id,
 demoLedgerMutation:(amount,direction,balance,reason)=>store.writeDemoAccount(a=>{const field=balance==='main'?'main_balance':'bonus_balance',result=d8(a[field])+(direction==='credit'?d8(amount):-d8(amount));if(result<0n)throw Error('NEGATIVE');return {...a,[field]:fmt(result),ledger:[{id:++id,global_id:a.global_id,amount_efhc:amount,direction,balance_type:balance,reason,created_at:'2026-10-31T12:00:00Z'},...a.ledger]};}),
 demoIndexedHistoryPage:async()=>({items:[],total:0})};
const module={exports:{}};
vm.runInNewContext(code.outputText,{module,exports:module.exports,console,URL,Date,BigInt,setTimeout,window:undefined,require(mod){if(mod.includes('demo-tables-v866.json'))return require('./demo-tables-v866.json');if(mod.includes('demo-admin-seed-v866.json'))return require('./demo-admin-seed-v866.json');if(mod.endsWith('demoUnifiedStore'))return store;if(mod.endsWith('demoTables'))return {};throw Error('UNEXPECTED '+mod);}}, {timeout:1000,filename:'demoApi.ts'});
const api=module.exports.demoApiRequest;
function fail(code){return e=>e.code===code;}
test('exchange partial keeps D8, mirror, ledger and returns same replay',async()=>{
 const initial=accounts[selected].total_generated_kwh;
 const body={amount_kwh:'4.12500000'};
 const first=await api('/exchange/convert','POST',body,'ex-1');
 assert.equal(first.exchanged_kwh,'4.12500000');assert.equal(first.new_available_kwh,'18.37500000');assert.equal(accounts[selected].main_balance,'104.12500000');
 const count=accounts[selected].ledger.length;
 const retry=await api('/exchange/convert','POST',body,'ex-1');
 assert.equal(retry.log_id,first.log_id);assert.equal(accounts[selected].ledger.length,count);
 assert.equal(accounts[selected].total_generated_kwh,initial);
 await assert.rejects(api('/exchange/convert','POST',{amount_kwh:'1.00000000'},'ex-1'),fail('IDEMPOTENCY_KEY_CONFLICT'));
});
test('exchange all preserves one operation on retry, rejects missing key',async()=>{
 const out=await api('/exchange/convert','POST',{},'ex-all');
 assert.equal(out.exchanged_kwh,'18.37500000');assert.equal(out.new_available_kwh,'0.00000000');
 const count=accounts[selected].ledger.length;
 assert.equal((await api('/exchange/convert','POST',{},'ex-all')).log_id,out.log_id);
 assert.equal(accounts[selected].ledger.length,count);
 await assert.rejects(api('/exchange/convert','POST',{}),fail('IDEMPOTENCY_KEY_REQUIRED'));
});
test('withdraw enforces minimum 10, wallet proof, and replay for one debit',async()=>{
 await assert.rejects(api('/withdraw/request','POST',{amount:'9.99999999',wallet_id:1},'wd-min'),fail('WITHDRAW_BELOW_MINIMUM'));
 await assert.rejects(api('/withdraw/request','POST',{amount:'10000.00000000',wallet_id:1},'wd-large'),fail('WITHDRAW_INSUFFICIENT_BALANCE'));
 const pre=accounts[selected].main_balance;
 const first=await api('/withdraw/request','POST',{amount:'10.00000000',wallet_id:1},'wd-1');
 assert.equal(first.status,'pending');assert.equal(first.amount,'10.00000000');
 assert.equal(accounts[selected].main_balance,fmt(d8(pre)-d8('10.00000000')));
 const count=accounts[selected].ledger.length;
 const again=await api('/withdraw/request','POST',{amount:'10.00000000',wallet_id:1},'wd-1');
 assert.equal(again.id,first.id);assert.equal(accounts[selected].ledger.length,count);
 await assert.rejects(api('/withdraw/request','POST',{amount:'12.00000000',wallet_id:1},'wd-1'),fail('IDEMPOTENCY_KEY_CONFLICT'));
});
test('cancel refunds once and history/withdraw lists use same account',async()=>{
 const row=accounts[selected].withdrawals[0], before=accounts[selected].main_balance;
 const canceled=await api(`/withdraw/${row.id}/cancel`,'POST',{},'cancel-1');
 assert.equal(canceled.status,'cancelled');assert.equal(accounts[selected].main_balance,fmt(d8(before)+d8(row.amount)));
 const count=accounts[selected].ledger.length;
 assert.equal((await api(`/withdraw/${row.id}/cancel`,'POST',{},'cancel-1')).id,row.id);
 assert.equal(accounts[selected].ledger.length,count);
 const list=await api('/withdraw/list?limit=10','GET');assert.equal(list.items[0].status,'cancelled');
 const history=await api('/wallets/balance-history?limit=20','GET');assert.ok(history.items.length>=4);
});
test('scenario no_wallet refuses withdrawal and Global IDs isolate replay/balances',async()=>{
 const old=selected;scenario='no_wallet';
 await assert.rejects(api('/withdraw/request','POST',{amount:'10.00000000',wallet_id:1},'wd-nowallet'),fail('WITHDRAW_WALLET_MISSING'));
 scenario='filled';selected='0000000002';
 const before=accounts[selected].main_balance;
 const out=await api('/exchange/convert','POST',{amount_kwh:'4.12500000'},'ex-1');
 assert.equal(out.credited_efhc,'4.12500000');assert.equal(accounts[selected].main_balance,fmt(d8(before)+d8('4.12500000')));
 assert.equal(accounts[old].main_balance,'122.50000000'); // partial+all exchange, withdrawal refunded
});
