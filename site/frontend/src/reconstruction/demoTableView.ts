/** Logical DEMO tables and API handlers read the same committed browser state.
 * SQL history stays paginated remotely. No materialization of the full ledger.
 */
import type {DemoControlState,DemoTableName} from './demoUnifiedStore';
import {d8} from './demoUnifiedStore';
type Row=Record<string,unknown>;
const objectRows=(value:unknown):Row[]=>Array.isArray(value)?value as Row[]:[];
export function isGlobalDemoTable(name:DemoTableName):boolean{
 return ['task_catalog','shop_items','hub_links','ad_providers','settings','admin_roles',
  'admin_permissions','skins','faq','bank_transfers','supply_events'].includes(name);
}

/** Imported C28 bonus entries are already in SQL. Only committed local audit
 * entries belong in the overlay, including states saved before this adapter.
 */
export function localDemoLedger(state:DemoControlState,gid?:string):Row[]{
 const localIds=new Set((state.server?.audit||[]).map(r=>`${r.global_id}:${r.id}`));
 return Object.values(state.accounts).filter(a=>!gid||a.global_id===gid).flatMap(a=>a.ledger)
  .filter(r=>!state.server?.settings.neon_seed_revision||localIds.has(`${r.global_id}:${r.id}`))
  .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id);
}
export function runtimeDemoTableRows(state:DemoControlState,name:DemoTableName,gid?:string):Row[]|null{
 const s=state.server,accounts=Object.values(state.accounts).filter(a=>!gid||a.global_id===gid);
 const scoped=(rows:unknown)=>objectRows(rows).filter(r=>!gid||r.global_id===gid);
 switch(name){
  case 'accounts':case 'admin_users':return accounts.map(a=>({
   id:a.global_id,global_id:a.global_id,username:a.username,is_active:a.is_active!==false,
   is_vip:a.is_vip===true,main_balance:a.main_balance,bonus_balance:a.bonus_balance,
   available_kwh:a.available_kwh,total_generated_kwh:a.total_generated_kwh}));
  case 'balances':return accounts.map(a=>({id:a.global_id,global_id:a.global_id,
   main_balance:a.main_balance,bonus_balance:a.bonus_balance,available_kwh:a.available_kwh,total_generated_kwh:a.total_generated_kwh}));
  case 'panels':return accounts.flatMap(a=>a.panels||[]);
  case 'ranks':return Object.values(state.accounts).sort((a,b)=>{
   const x=d8(a.total_generated_kwh),y=d8(b.total_generated_kwh);return x===y?a.global_id.localeCompare(b.global_id):x>y?-1:1;
  }).map((a,i)=>({id:a.global_id,global_id:a.global_id,rank_pos:i+1,username:a.username,
   total_generated_kwh:a.total_generated_kwh,is_vip:a.is_vip===true})).filter(r=>!gid||r.global_id===gid);
  case 'wallet_links':return accounts.flatMap(a=>a.wallets).map(r=>({...r,id:`${r.global_id}:${r.id}`}));
  case 'task_catalog':return s?.tasks||[];
  case 'task_completions':return accounts.flatMap(a=>a.completed_tasks.map(code=>({
   id:`${a.global_id}:${code}`,global_id:a.global_id,task_code:code,status:'completed'})));
  case 'task_submissions':return scoped(s?.submissions);
  case 'deposits':return scoped(s?.deposits);
  case 'referral_bonuses':return accounts.flatMap(a=>a.ledger.filter(r=>r.reason==='referral_bonus'));
  case 'ad_reward_sessions':return [
   ...accounts.flatMap(a=>a.ledger.filter(r=>r.reason==='ad_reward'&&
    !(s?.audit||[]).some(local=>local.id===r.id&&local.global_id===r.global_id)).map(r=>({
     id:`opening:${r.id}`,session_id:`opening:${r.id}`,global_id:a.global_id,
     status:'rewarded',reward_snapshot_efhcb:r.amount_efhc,rewarded_at:r.created_at,test_mode:true}))),
   ...objectRows(s?.settings.ad_sessions).filter(r=>!gid||r.global_id===gid).map(r=>({...r,id:String(r.session_id)}))
  ];
  case 'withdrawals':return accounts.flatMap(a=>a.withdrawals);
  case 'withdraw_outcomes':return accounts.flatMap(a=>a.withdrawals.map(r=>({
   id:r.id,request_id:r.id,global_id:a.global_id,outcome_kind:r.status,created_at:r.created_at})));
  case 'shop_items':return s?.items||[];
  case 'shop_orders':return scoped(s?.orders);
  case 'shop_intents':return scoped(s?.intents);
  case 'hub_links':return s?.hub||[];
  case 'ad_providers':return (s?.providers||[]).map(({secret_masks, ...r})=>r);
  case 'admin_audit':case 'admin_logs':return scoped(s?.audit);
  case 'avatars':return accounts.flatMap(a=>{
   const pref=s?.settings[`avatar:${a.global_id}`];return pref?[{id:a.global_id,global_id:a.global_id,...pref}]:[];
  });
  case 'supply_events':return (s?.audit||[]).filter(r=>r.reason==='minted'||r.reason==='burned');
  case 'referrals':return objectRows(s?.settings.neon_referrals)
   .filter(r=>!gid||r.inviter_global_id===gid).map(r=>({...r,
    id:`${r.inviter_global_id}:${r.invitee_global_id}`,global_id:r.inviter_global_id}));
  // Paginated SQL baseline plus only new local rows; the imported bonus ledger
  // must never be added again to counts, journals or rewards.
  case 'ledger_entries':case 'balance_history':case 'bank_transfers':case 'exchanges':
  case 'settings':case 'admin_roles':return null;
  case 'skins':return [{id:'1',skin_id:1,title:'EFHC',price_efhc:'0.00000000'}];
  case 'provider_identities':case 'sessions':case 'vip_reservations':case 'admin_permissions':
  case 'notifications':case 'diagnostics':case 'faq':case 'generation_ticks':return [];
 }
}
export function demoTableOverlay(state:DemoControlState,name:DemoTableName,gid?:string):Row[]{
 const rows=localDemoLedger(state,gid);
 switch(name){
  case 'ledger_entries':case 'balance_history':return rows;
  case 'bank_transfers':return [...rows.map(r=>({...r,id:`bank:${r.id}`,global_id:null,system_entity:'BANK_EFHC',
   direction:r.direction==='credit'?'debit':'credit'})),...(!gid?(state.server?.audit||[])
    .filter(r=>r.reason==='minted'||r.reason==='burned').map(r=>({...r,global_id:null,system_entity:'BANK_EFHC',
     direction:r.reason==='minted'?'credit':'debit'})):[])];
  case 'exchanges':return Object.values(state.accounts).filter(a=>!gid||a.global_id===gid)
   .flatMap(a=>a.exchanges.map(r=>({...r,global_id:a.global_id})));
  case 'deposits':return (state.server?.deposits||[]).filter(r=>!gid||r.global_id===gid);
  case 'referral_bonuses':return rows.filter(r=>r.reason==='referral_bonus');
  case 'ad_reward_sessions':return objectRows(state.server?.settings.ad_sessions).filter(r=>!gid||r.global_id===gid)
   .map(r=>({...r,id:r.session_id}));
  default:return [];
 }
}
