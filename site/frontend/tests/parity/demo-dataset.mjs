/** Producer/consumer gate for the exact new TEST data delivered in Pages. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {demoRuntime} from '../helpers/demo-runtime.mjs';
const {IDBFactory,IDBKeyRange}=createRequire(import.meta.url)('fake-indexeddb');
const target=path.resolve(process.argv[2]),build=JSON.parse(fs.readFileSync(path.join(target,'src/reconstruction/demoDataBuild.json'),'utf8'));
const root=path.join(target,'public/demo/data',build.snapshot_id),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.match(build.snapshot_id,/^[a-f0-9]{64}$/);assert.equal(manifest.snapshot_id,build.snapshot_id);
for(const [name,hash]of Object.entries(manifest.files)){
 assert.match(name,/^[a-z0-9_/-]+\.json$/);assert.ok(!name.includes('..'));
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),hash,name);
}
let requests=0;
const h=demoRuntime({origin:'https://gly-efhc.github.io',basePath:'/efhc',snapshotId:build.snapshot_id,
 withIndexedDB:new IDBFactory(),keyRange:IDBKeyRange,fetchImpl:async(url,options)=>{
  const u=new URL(url);assert.equal(u.origin,'https://gly-efhc.github.io');assert.equal(options.method,'GET');
  const prefix='/efhc/demo/data/'+build.snapshot_id+'/';assert.ok(u.pathname.startsWith(prefix));
  requests++;return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,u.pathname.slice(prefix.length)),'utf8'))};
 }});
const store=h.storage.set.bind(h.storage);h.storage.set=(key,value)=>{
 if(String(value).length>5242880)throw new Error('DEMO_LOCAL_STORAGE_QUOTA');return store(key,value);
};
h.store.transactDemoState(s=>{s.scenario='empty';h.core.ensureServer(s).settings.neon_seed_revision='RECON_CYCLE_0028_CAUSAL_V1';});
await h.store.bootstrapDemoIndexedDb();
const initial=h.store.readDemoState(),gid=initial.selected_global_id;
const counts=await h.store.demoTableCounts();
assert.equal(Object.keys(counts).length,39);assert.equal(counts.panels,4000);assert.equal(counts.deposits,1000);assert.equal(counts.ledger_entries,88696);
assert.equal(initial.scenario,'filled');assert.equal(Object.keys(initial.accounts).length,1000);
assert.equal(Object.values(initial.accounts).flatMap(a=>a.panels).length,4000);
const bank=await h.api('/admin/reports/overview','GET');h.loadSource('lib/adminBankSnapshot.ts').requireBankSnapshot(bank);
assert.equal(bank.facts.bank_metrics_generated_kwh,'162572.83200000');assert.equal(bank.facts.bank_metrics_integrity_delta_efhc,'0.00000000');
const summary=await h.api('/admin/efhc-deposits/runtime-summary','GET');assert.equal(summary.credited_efhc_operations_count,1000);assert.equal(summary.credited_efhc_total,'1500000.00000000');
const first=await h.api('/admin/efhc-deposits/inbox?limit=20','GET');
const second=await h.api('/admin/efhc-deposits/inbox?limit=20&cursor_id='+first.next_cursor_id,'GET');
assert.equal(first.items.length,20);assert.equal(second.items.length,20);assert.notEqual(first.items[0].id,second.items[0].id);
const required={ledger_entries:'amount_efhc',balance_history:'amount_efhc',bank_transfers:'amount_efhc',exchanges:'amount_kwh',
 deposits:'amount_efhc',panels:'generated_kwh',accounts:'main_balance',balances:'main_balance',ranks:'rank_pos',
 referrals:'invitee_global_id',referral_bonuses:'amount_efhc',ad_reward_sessions:'session_id',task_submissions:'task_id'};
for(const name of h.store.DEMO_TABLE_NAMES){
 const rows=await h.store.demoTableRows(name,gid);assert.ok(Array.isArray(rows),name);
 if(required[name]){assert.ok(rows.length>0,name+' unexpectedly empty');assert.ok(rows.every(r=>r[required[name]]!==undefined),name+' returns a foreign table shape');}
}
const history=await h.api('/profile/history','GET');assert.ok(history.items.length>0);assert.equal(new Set(history.items.map(r=>r.id)).size,history.items.length);
const exchange=await h.api('/exchange/history','GET');assert.ok(exchange.items.length>0);assert.ok(exchange.items.every(r=>typeof r.amount_kwh==='string'));
const shop=h.loadSource('lib/api/generated/economicUserSeamValidators.ts');
shop.parseBrowserShopProfileResponse(await h.api('/shopfront/profile','GET'));shop.parseBrowserShopBootstrapResponse(await h.api('/shopfront/bootstrap','GET'));
await h.api('/demo/deposits','POST',{amount:'2.12345678'},'snapshot-deposit');
await h.api('/demo/deposits','POST',{amount:'2.12345678'},'snapshot-deposit');
assert.equal((await h.api('/admin/efhc-deposits/runtime-summary','GET')).credited_efhc_total,'1500002.12345678');
assert.equal((await h.api('/admin/efhc-deposits/runtime-summary','GET')).credited_efhc_24h,'2.12345678');
h.store.setDemoRole('superadmin');
await h.api('/admin/transfer','POST',{global_id:gid,amount:'1.12345678',direction:'credit',balance:'main'},'snapshot-transfer');
const panel=await h.api('/panels/activate','POST',{},'snapshot-panel');assert.ok(panel.panel.id);
const logs=await h.api('/admin/logs/transfers?global_id='+gid,'GET');assert.ok(logs.items.some(r=>r.amount_efhc==='1.12345678'));
assert.equal((await h.api('/admin/reports/overview','GET')).facts.bank_metrics_integrity_delta_efhc,'0.00000000');
console.log('EFHC_DEMO_ORIGINAL_MODEL=PASS tables=39 users=1000 panels=4000 deposits=1000 ledger='+manifest.counts.ledger_entries+' runtime_external_requests=0 source_requests='+requests);
