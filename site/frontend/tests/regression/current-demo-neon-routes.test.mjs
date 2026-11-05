import test from 'node:test';
import assert from 'node:assert/strict';
import {demoRuntime} from '../helpers/demo-runtime.mjs';
import {createRequire} from 'node:module';
const {IDBFactory,IDBKeyRange}=createRequire(import.meta.url)('fake-indexeddb');
const gid='0000657667',sqlRow={id:'71',global_id:gid,amount_efhc:'0.10000000',amount:'0.10000000',direction:'credit',balance_type:'bonus',reason:'ad_reward',created_at:'2026-10-31T00:00:00Z',dataset:'RECON_CYCLE_0027'};
function neonRuntime(){
 const h=demoRuntime({origin:'https://gly-efhc.github.io',withIndexedDB:new IDBFactory(),keyRange:IDBKeyRange,basePath:'/efhc',fetchImpl:async(path,options)=>{
  const url=new URL(path);
  assert.equal(options.method,'GET','DEMO must not write anonymously to SQL');
  if(url.pathname.endsWith('/token/anonymous'))return {ok:true,json:async()=>({token:'test.public.jwt',expires_at:Date.parse('2027-01-01')/1000})};
  const view=url.pathname.split('/').at(-1),q=url.searchParams;
  let rows=view==='table_counts'?[{table_name:'ledger_entries',rows_count:2},{table_name:'balance_history',rows_count:1},{table_name:'bank_transfers',rows_count:1},{table_name:'deposits',rows_count:1}]:
   view==='economic_events'?[{id:'80',global_id:gid,reason:'efhc_external_deposit',amount_efhc:'10.00000000',created_at:'2026-11-03T00:00:00Z'}]:view==='catalog_rows'?[]:[sqlRow];
  const total=rows.length,offset=Number(q.get('offset')||0);rows=rows.slice(offset,offset+Number(q.get('limit')||100));
  return {ok:true,headers:{get:k=>k==='content-range'?`${offset}-${offset+rows.length-1}/${total}`:null},json:async()=>rows};
 }});
 // Restore a committed opening snapshot and run the real IndexedDB hydration
 // and Neon route readers, without a production adapter or database writes.
 h.store.transactDemoState(state=>{
  const s=h.core.ensureServer(state),a=state.accounts[gid];
  a.panels=[];a.ledger=[{...sqlRow,id:71}];a.completed_tasks=[];
  s.audit=[];s.orders=[];s.deposits=[{id:'80',global_id:gid,resolved_global_id:gid,
   amount_efhc:'10.00000000',amount:'10.00000000',status:'credited',created_at:'2026-11-03T00:00:00Z'}];s.submissions=[];
  s.settings.neon_seed_revision='RECON_CYCLE_0028_ORIGINAL_MODEL_V2';s.settings.neon_referrals=[];
 });
 return h;
}
test('Neon USER/Admin histories show imported rewards once, then the same new local transfer',async()=>{
 const h=neonRuntime();h.store.setDemoRole('superadmin');
 assert.equal((await h.api('/profile/history','GET')).items.length,1);
 await h.api('/admin/transfer','POST',{global_id:gid,amount:'2.12345678',direction:'credit',balance:'main'},'same-transfer');
 const user=await h.api('/profile/history','GET'),admin=await h.api(`/admin/users/${gid}/history`,'GET'),logs=await h.api('/admin/logs/transfers?global_id='+gid,'GET');
 assert.equal(user.items.length,2);assert.equal(user.items[0].amount_efhc,'2.12345678');
 assert.equal(admin.items[0].id,user.items[0].id);assert.equal(logs.items[0].amount_efhc,'2.12345678');
 assert.equal(user.items.filter(r=>r.id==='71').length,1);
 assert.equal((await h.api('/admin/reports/overview','GET')).facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('all 39 table projections are explicit; local actions change the same counts and account rows',async()=>{
 const h=neonRuntime(),before=await h.store.demoTableCounts();
 assert.equal(Object.keys(before).length,39);assert.equal(before.panels,0);
 const {panel}=await h.api('/panels/activate','POST',{},'table-panel');
 const counts=await h.store.demoTableCounts(),rows=await h.store.demoTableRows('panels',gid);
 assert.equal(counts.panels,1);assert.equal(rows[0].id,panel.id);
 assert.ok(counts.ledger_entries>before.ledger_entries);
 const balances=await h.store.demoTableRows('balances',gid);
 assert.equal(balances[0].main_balance,h.store.readDemoAccount().main_balance);
 assert.equal((await h.store.demoTableRows('panels','8000000002')).length,0);
 for(const name of h.store.DEMO_TABLE_NAMES){
  const rows=await h.store.demoTableRows(name,gid);assert.ok(Array.isArray(rows),name);
 }
});
test('Neon Admin deposit inbox and summary include SQL baseline and new DEMO deposit once',async()=>{
 const h=neonRuntime();let inbox=await h.api('/admin/efhc-deposits/inbox','GET');
 assert.equal(inbox.items.length,1);assert.equal(inbox.items[0].status,'credited');
 await h.api('/demo/deposits','POST',{amount:'1.12345678'},'deposit-overlay');
 await h.api('/demo/deposits','POST',{amount:'1.12345678'},'deposit-overlay');
 inbox=await h.api('/admin/efhc-deposits/inbox','GET');assert.equal(inbox.items.length,2);
 const summary=await h.api('/admin/efhc-deposits/runtime-summary','GET');
 assert.equal(summary.credited_efhc_operations_count,2);assert.equal(summary.credited_efhc_total,'11.12345678');
});
test('Neon ad dashboard counts a new reward once; scenario errors apply to SQL read routes',async()=>{
 const h=neonRuntime();const session=await h.api('/ads/session','POST',{task_code:'demo_watch_builtin'});
 await h.api(`/ads/session/${session.session_id}/shown`,'POST',{});h.advance(10000);
 await h.api(`/ads/session/${session.session_id}/client-complete`,'POST',{payload:{completed:true}});
 assert.equal((await h.api('/admin/ads/dashboard','GET')).overall.completed_rewarded_views,2);
 h.store.setDemoScenario('error');
 await assert.rejects(h.api('/admin/logs/transfers','GET'),e=>e.code==='SCENARIO_ERROR');
 await assert.rejects(h.api('/exchange/history','GET'),e=>e.code==='SCENARIO_ERROR');
});
test('Admin export routes produce actual CSV/XLSX including the SQL ledger',async()=>{
 const h=neonRuntime();
 const csv=await h.api('/admin/logs/export.csv?global_id='+gid,'GET');assert.match(await csv.text(),/0\.10000000/);
 const xlsx=await h.api('/admin/logs/export.xlsx?scope=panels','GET');
 assert.equal(xlsx.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 assert.equal(new Uint8Array(await xlsx.arrayBuffer())[0],0x50);
});
test('Neon rank routes use the same accounts and amounts as the logical ranks table',async()=>{
 const h=neonRuntime();
 const rows=await h.store.demoTableRows('ranks',gid),rank=await h.api('/ranks/my-plus-top/me','GET');
 assert.equal(rank.me.rank_pos,rows[0].rank_pos);assert.equal(rank.top.length,1);
 assert.equal(rank.me.total_generated_kwh,h.store.readDemoAccount().total_generated_kwh);
});
test('imported SQL payment intents satisfy Shop contracts and can never auto-credit a second time',async()=>{
 const h=neonRuntime();h.store.transactDemoState(s=>s.server.intents=[{id:'1',global_id:gid,
  dataset:'RECON_CYCLE_0027',purpose:'deposit',asset:'EFHC_DEMO',status:'DEMO_SETTLED',
  efhc_amount_d8:'1500.00000000',amount_asset_d8:'1500.00000000',created_at:'2026-04-20T09:00:00Z',expires_at:'2026-04-21T09:00:00Z'}]);
 const contracts=h.loadSource('lib/api/generated/economicUserSeamValidators.ts');
 const before=h.store.readDemoAccount().main_balance;
 contracts.parseBrowserShopProfileResponse(await h.api('/shopfront/profile','GET'));
 contracts.parseBrowserShopBootstrapResponse(await h.api('/shopfront/bootstrap','GET'));
 const status=await h.api('/shopfront/intent-status?intent_id=1','GET');
 contracts.parsePaymentIntentStatusResponse(status);assert.equal(status.status,'DEMO_SETTLED');
 assert.equal(h.store.readDemoAccount().main_balance,before);
});
