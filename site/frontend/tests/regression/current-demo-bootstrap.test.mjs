import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {demoRuntime} from '../helpers/demo-runtime.mjs';
const {IDBFactory,IDBKeyRange}=createRequire(import.meta.url)('fake-indexeddb');
const primary='0000657667',dataset='RECON_CYCLE_0027',created_at='2026-11-01T00:00:00Z';
const gid=i=>i===0?primary:String(8000000001+i);
function opening(){
 const bonus_events=Array.from({length:4348},(_,i)=>({id:String(i+1),global_id:gid(i%1000),
  amount_efhc:'0.10000000',direction:'credit',balance_type:'bonus',
  reason:i<2250?'task_bonus':i<3250?'ad_reward':'referral_bonus',task_code:i<2250?'join':null,
  created_at,event_id:'event-'+i}));
 const users=Array.from({length:1000},(_,i)=>({global_id:gid(i),username:'test_'+i,
  main_balance:'1100.00000000',bonus_balance:i<348?'0.50000000':'0.40000000',
  available_kwh:'0.00000000',total_generated_kwh:'0.00000000',exchanged_kwh_total:'0.00000000',
  is_active:true,is_vip:false,rank_position:i+1,rank_score_kwh:'0.00000000',created_at,updated_at:created_at,dataset}));
 const panels=Array.from({length:4000},(_,i)=>({id:String(i+1),global_id:gid(i%1000),
  public_id:'PNL-'+i,is_active:true,is_archived:false,generated_kwh:'0.00000000',base_gen_per_sec:'0.00000692',
  created_at,activated_at:created_at,expires_at:'2027-04-30T00:00:00Z',archived_at:null,last_generated_at:created_at,dataset}));
 const intents=users.map((u,i)=>({id:String(i+1),global_id:u.global_id,purpose:'deposit',asset:'EFHC_DEMO',status:'DEMO_SETTLED',
  efhc_amount_d8:'1500.00000000',amount_asset_d8:'1500.00000000',created_at,expires_at:'2026-11-02T00:00:00Z',updated_at:created_at,dataset}));
 return {users,panels,intents,bonus_events,
  referrals:Array.from({length:999},(_,i)=>({inviter_global_id:primary,invitee_global_id:gid(i+1),created_at,activated_at:created_at,unit_reward_no:i+1})),
  tasks:Array.from({length:7},(_,i)=>({id:i+1,code:i===0?'join':'task_'+i,active:true,bonus_efhc:'0.10000000'})),
  bank:{id:1,ok:true,ts:created_at,dataset,database_scope:'EFHC_Nektron_Test',counters:{users_total:1000,panels_total:4000},
   facts:{bank_metrics_ready:'1',bank_metrics_integrity_ok:'1',bank_metrics_reserve_efhc:'3899565.20000000',
    bank_metrics_circulation_efhc:'1100434.80000000',bank_metrics_expected_supply_efhc:'5000000.00000000'}}};
}
test('fresh DEMO rebuild replaces obsolete/empty cached state and recreates all 39 stores from new opening data',async()=>{
 const seed=opening();let seedReads=0;
 const h=demoRuntime({origin:'https://gly-efhc.github.io',withIndexedDB:new IDBFactory(),keyRange:IDBKeyRange,
  fetchImpl:async(path,options)=>{
   assert.equal(options.method,'GET');
   if(new URL(path).pathname.endsWith('/bootstrap.json')){seedReads++;return {ok:true,json:async()=>seed};}
   return {ok:true,json:async()=>[]};
  }});
 h.store.transactDemoState(s=>{const server=h.core.ensureServer(s);server.settings.neon_seed_revision='RECON_CYCLE_0028_CAUSAL_V1';
  server.replays.old={fingerprint:'obsolete',response:{}};s.scenario='empty';s.role='superadmin';s.accounts[primary].main_balance='999999.00000000';});
 await h.store.bootstrapDemoIndexedDb();
 const state=h.store.readDemoState(),db=await h.store.openDemoDatabase();
 assert.equal(db.objectStoreNames.length,39);db.close();
 assert.equal(Object.keys(state.accounts).length,1000);assert.equal(state.accounts[primary].main_balance,'1100.00000000');
 assert.equal(Object.values(state.accounts).flatMap(a=>a.panels).length,4000);
 assert.equal(state.server.deposits.length,1000);assert.equal(state.scenario,'filled');assert.equal(state.role,'user');
 assert.equal(state.server.replays.old,undefined);assert.equal(state.server.bank_snapshot.facts.bank_metrics_integrity_delta_efhc,'0.00000000');
 const summary=await h.api('/admin/efhc-deposits/runtime-summary','GET');
 assert.equal(summary.credited_efhc_operations_count,1000);assert.equal(summary.credited_efhc_total,'1500000.00000000');
 const first=await h.api('/admin/efhc-deposits/inbox?limit=20','GET');
 const second=await h.api('/admin/efhc-deposits/inbox?limit=20&cursor_id='+first.next_cursor_id,'GET');
 assert.equal(first.items.length,20);assert.equal(second.items.length,20);assert.notEqual(first.items[0].id,second.items[0].id);
 await h.api('/demo/deposits','POST',{amount:'1.12345678'},'new-deposit');
 assert.equal((await h.api('/admin/efhc-deposits/runtime-summary','GET')).credited_efhc_total,'1500001.12345678');
 assert.equal(seedReads,1,'existing completed V2 state must not reset new operations');
});
