/** Cycle0028: one existing DEMO state, new Neon C27 data. No extra UI/mode.
 * On first use replace the old frozen fixture with complete TEST users, panels and intents.
 * All original DEMO API handlers and 39 logical IndexedDB stores remain available.
 */
import {getNeonCoreSeed} from "./neonDemoDataApi";
import {DEMO_GLOBAL_ID,seedAccount,readDemoState,transactDemoState,d8,
  openDemoDatabase,mirrorSelectedDemoAccount,type DemoAccountState} from "./demoUnifiedStore";
import {ensureServer} from "./demoServerCore";
import {demoBankSnapshot} from "./demoBankSnapshot";

const sourceCycle="RECON_CYCLE_0027";
const sourceRevision="RECON_CYCLE_0028_CAUSAL_V1";
export async function bootstrapNeonDemoMirror():Promise<void>{
 const already=readDemoState().server?.settings?.neon_seed_revision===sourceRevision;
 if(!already){
  const seed=await getNeonCoreSeed();
  const users:Record<string,DemoAccountState>={};
  for(const u of seed.users){
   const a=seedAccount(u.global_id);
   a.username=u.username??u.global_id;a.is_active=u.is_active;a.is_vip=u.is_vip;
   a.main_balance=u.main_balance;a.bonus_balance=u.bonus_balance;
   a.total_generated_kwh=u.total_generated_kwh;a.available_kwh=u.available_kwh;
   a.panels=[];a.activated_panels=0;a.ledger=[];a.withdrawals=[];a.exchanges=[];
   users[u.global_id]=a;
  }
  for(const p of seed.panels){
   const a=users[p.global_id];if(!a)throw new Error("NEON_DEMO_PANEL_OWNER_MISMATCH");
   a.panels!.push({id:p.id,global_id:p.global_id,public_id:p.public_id||"C27-P-"+p.id,
    created_at:p.created_at,activated_at:p.activated_at||p.created_at,
    expires_at:p.expires_at||p.created_at,archived_at:p.archived_at,
    last_generated_at:p.last_generated_at||p.activated_at||p.created_at,
    is_active:p.is_active,is_archived:p.is_archived,generated_kwh:p.generated_kwh,
    base_gen_per_sec:p.base_gen_per_sec,remainder:"0",
    cost_main:"100.00000000",cost_bonus:"0.00000000",
    meta:{source:sourceCycle,purchase_event_id:p.purchase_event_id}});
   a.activated_panels++;
  }
  for(const b of seed.bonus_events){
   const a=users[b.global_id];if(!a)throw new Error("NEON_DEMO_BONUS_OWNER_MISMATCH");
   a.ledger.push({id:Number(b.id),global_id:b.global_id,amount_efhc:b.amount_efhc,
     direction:b.direction,balance_type:b.balance_type,reason:b.reason,created_at:b.created_at});
   if(b.task_code&&!a.completed_tasks.includes(b.task_code))a.completed_tasks.push(b.task_code);
  }
  for(const a of Object.values(users)){
   a.ledger.sort((x,y)=>Date.parse(y.created_at)-Date.parse(x.created_at)||y.id-x.id);
   const bonus=a.ledger.reduce((n,r)=>n+d8(r.amount_efhc),0n);
   if(d8(a.bonus_balance)!==bonus)throw new Error("NEON_DEMO_BONUS_RECONCILIATION");
  }
  const facts=seed.bank.facts;
  const outstanding=Object.values(users).reduce((n,a)=>n+d8(a.main_balance)+d8(a.bonus_balance),0n);
  if(d8(facts.bank_metrics_reserve_efhc)+outstanding!==d8(facts.bank_metrics_expected_supply_efhc)||
     outstanding!==d8(facts.bank_metrics_circulation_efhc))
   throw new Error("NEON_DEMO_OPENING_MASS_INTEGRITY_ERROR");
  transactDemoState(state=>{
   state.accounts=users;
   if(!users[state.selected_global_id])state.selected_global_id=DEMO_GLOBAL_ID;
   const server=ensureServer(state);
   server.bank_balance=facts.bank_metrics_reserve_efhc;
   server.supply_initial=facts.bank_metrics_expected_supply_efhc;
   server.minted="0.00000000";server.burned="0.00000000";
   server.audit=[];server.orders=[];server.deposits=[];
   server.tasks=seed.tasks.map(task=>({...task,id:String(task.id),is_active:task.active,
     bonus_efhc:typeof task.bonus_efhc==='number'?task.bonus_efhc.toFixed(8):task.bonus_efhc}));
   server.settings.neon_referrals=seed.referrals;
   server.settings.neon_frozen_panels_as_of="2026-10-31T10:00:00Z";
   server.intents=seed.intents.map(intent=>({...intent,amount_efhc:intent.efhc_amount_d8}));
   server.settings.neon_seed_cycle=sourceCycle;
   server.settings.neon_seed_revision=sourceRevision;
   server.settings.neon_mode="READ_ONLY_SQL_SEED_WITH_EXISTING_LOCAL_DEMO_ACTIONS";
   const calculated=demoBankSnapshot(state);
   if(!calculated||Object.entries(facts).some(([field,value])=>
       field.startsWith('bank_metrics_')&&calculated.facts[field]!==undefined&&calculated.facts[field]!==value))
     throw new Error("NEON_DEMO_SNAPSHOT_FORMULA_PARITY_MISMATCH");
  });
 }
 const db=await openDemoDatabase();
 try{
  if(!already){
   const state=readDemoState();
   const accounts=Object.values(state.accounts);
   const sources:Record<string,Record<string,unknown>[]>={};
   sources.accounts=accounts.map(a=>({...a,id:a.global_id}));
   sources.admin_users=accounts.map(a=>({...a,id:a.global_id}));
   sources.balances=accounts.map(a=>({id:a.global_id,global_id:a.global_id,main_balance:a.main_balance,
     bonus_balance:a.bonus_balance,available_kwh:a.available_kwh,total_generated_kwh:a.total_generated_kwh}));
   sources.panels=accounts.flatMap(a=>a.panels||[]).map(p=>({...p,id:p.id}));
   sources.shop_intents=(state.server?.intents||[]).map(x=>({...x,id:String(x.id)}));
   for(const [name,rows] of Object.entries(sources)){
    await new Promise<void>((resolve,reject)=>{
     const tx=db.transaction(name,"readwrite"),store=tx.objectStore(name);
     store.clear();
     for(const row of rows)store.put(row);
     tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
   }
   await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction("settings","readwrite");
    tx.objectStore("settings").put({id:"neon_c27_seed_complete",dataset:sourceCycle,
      revision:sourceRevision,users:1000,panels:4000,payment_intents:1000,ledger_rows:88696,
      bonus_events:4348,referrals:999,
      note:"Ledger views are fetched on demand from the real TEST database"});
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
   });
  }
  await mirrorSelectedDemoAccount(db,readDemoState());
 }finally{db.close();}
}
