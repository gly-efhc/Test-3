import {publicAssetPath} from "../lib/publicAssetPath";
import {demoServerRequest} from "./demoServer";
import {DemoOperationError} from "./demoServerCore";
import {demoPaymentIntentView,isImportedDemoIntent} from './demoPaymentIntent';
/** Isolated DEMO adapter: original local operations plus read-only TEST history on Pages.
 * An unsupported endpoint MUST fail closed rather than reach a real backend.
 * The simulated Global ID is an account selector, never a session credential.
 */
import canonical from "./demo-tables-v866.json";
import {demoMyRankWithTop, demoRankTopPage, demoRankContext} from "./demoTables";
import {DEMO_GLOBAL_ID, d8, formatD8, isLocalDemoActive, readDemoAccount, readDemoState,
  writeDemoAccount, demoIndexedHistoryPage, bootstrapDemoIndexedDb, isNeonPagesDemo, demoAdminFixtureUsers, transactDemoState, seedAccount, type DemoAccountState} from "./demoUnifiedStore";

export class PreviewApiError extends Error {
  constructor(public readonly status:number,public readonly code:string){super(`DEMO_${code}`);this.name="PreviewApiError";}
}
const zero="0.00000000";
const stamp=()=>new Date().toISOString();
function must(condition:boolean,code:string,status=400):void {if(!condition)throw new PreviewApiError(status,code);}
function cursorPage<T>(values:readonly T[],args:URLSearchParams,defaultLimit=20):{items:T[];next_cursor:string|null}{
 const offset=args.get("cursor")===null?0:Number(args.get("cursor"));
 const limit=Math.min(100,Math.max(1,Number(args.get("limit")||defaultLimit)||defaultLimit));
 must(Number.isInteger(offset)&&offset>=0&&offset<=values.length,"BAD_CURSOR");
 return {items:values.slice(offset,offset+limit),next_cursor:offset+limit<values.length?String(offset+limit):null};
}
const freshReferral=(globalId:string,index:number,active:boolean)=>{
 const time=new Date(Date.now()-(index+1)*3600000).toISOString();
 const gid=String(9000000001+index).padStart(10,"0");
 return {child_global_id:gid,global_id:gid,username:`ref_${String(index+1).padStart(4,"0")}`,joined_at:time,
  invited_at:time,activated_at:active?time:null,is_active:active,total_generated_kwh:active?"120.00000000":zero,panels_count:active?1:0};
};
function referralStats(a:DemoAccountState){
 const links=readDemoState().server?.settings.neon_referrals as Record<string,unknown>[]|undefined;
 if(links){
  const own=links.filter(r=>r.inviter_global_id===a.global_id);
  const active=own.filter(r=>r.activated_at).length,inactive=own.length-active;
  const requirements=[10,100,1000,3000,10000],rewards=['1','10','100','300','1000'];
  const level=requirements.filter(n=>active>=n).length;
  const total=a.ledger.filter(r=>r.reason==='referral_bonus'&&r.direction==='credit').reduce((n,r)=>n+d8(r.amount_efhc),0n);
  const direct=BigInt(active)*d8('0.1');
  const steps=requirements.map((required,i)=>({level:i+1,required_active:required,
    level_bonus:formatD8(d8(rewards[i])),direct_bonus_total:formatD8(BigInt(Math.min(required,10000))*d8('0.1')),
    cumulative_level_bonus:formatD8(rewards.slice(0,i+1).reduce((v,n)=>v+d8(n),0n)),
    cumulative_total_reward:formatD8(BigInt(Math.min(required,10000))*d8('0.1')+
      rewards.slice(0,i+1).reduce((v,n)=>v+d8(n),0n))}));
  const next=requirements[level]??10000,previous=level?requirements[level-1]:0;
  return {bonus_balance:a.bonus_balance,referrals_bonus_total:formatD8(total),total_referrals:own.length,
   active_referrals:active,inactive_referrals:inactive,level,current_level_min:previous,next_level:Math.min(level+1,5),
   next_level_min:next,refs_to_next:Math.max(0,next-active),
   progress:next>previous?(active-previous)/(next-previous):1,unit_bonus_per_active:'0.10000000',
   direct_bonus_total:formatD8(direct),cumulative_level_bonus:formatD8(total-direct),
   cumulative_total_reward:formatD8(total),max_active_for_unit_bonus:10000,
   bonus_asset:'EFHCb',full_cycle_direct_bonus:'1000.00000000',full_cycle_level_bonus:'1411.00000000',
   full_cycle_total_bonus:'2411.00000000',level_steps:steps,referral_code:a.global_id,
   referral_link:`https://t.me/efhc_bot/app?startapp=${a.global_id}`};
 }

 const active=17,inactive=7,next=100;
 const steps=[1,2,3,4,5].map((level,i)=>({level,required_active:[10,100,1000,3000,10000][i],
  level_bonus:["1.00000000","10.00000000","100.00000000","300.00000000","1000.00000000"][i],
  direct_bonus_total:zero,cumulative_level_bonus:zero,cumulative_total_reward:zero}));
 return {bonus_balance:a.bonus_balance,referrals_bonus_total:"2.70000000",total_referrals:active+inactive,
  active_referrals:active,inactive_referrals:inactive,level:1,current_level_min:10,next_level:2,next_level_min:next,
  refs_to_next:next-active,progress:(active-10)/(next-10),unit_bonus_per_active:"0.10000000",
  max_active_for_unit_bonus:10000,bonus_asset:"EFHCb",full_cycle_direct_bonus:"1000.00000000",
  full_cycle_level_bonus:"1411.00000000",full_cycle_total_bonus:"2411.00000000",level_steps:steps,
  referral_code:a.global_id,referral_link:`https://t.me/efhc_bot/app?startapp=${a.global_id}`};
}
function walletPayload(a:DemoAccountState){return {is_connected:a.wallets.some(w=>w.is_active),wallets:a.wallets};}
function withdrawalOut(row:Record<string,unknown>){return {
  request_id:String(row.id),global_id:row.global_id,outcome_kind:String(row.status||"pending"),locale:"ru",
  comment:{text:"Демонстрационная заявка. Реального перевода нет.",source:"demo",locale:"ru"},
  promo:null,top_zone_enabled:false,metadata:{demo:true}};
}
function flowTruth(walletLinked:boolean){return {
 handoff_configured:true,handoff_mode:"connected",wallet_linked:walletLinked,wallet_sync_required:false,
 wallet_ready:walletLinked,wallet_blocked:!walletLinked,action_allowed:walletLinked,action_denied:!walletLinked,
 readiness_state:walletLinked?"ready":"wallet_required",primary_cta:walletLinked?"create_intent":"sync_wallet",
 active_intent:null,active_order_id:null,active_order_status:null,product_state:"BROWSING",next_action:"browse",
 return_path:"/browser-shop",canonical_center:"browser_shop",next_step:walletLinked?"create_intent":"sync_wallet",
 blocker_codes:walletLinked?[]:["wallet_not_linked"],browser_shop_path:"/browser-shop",truth_label:"shop_hub_truth_layer"};
}
function shopPayments(a:DemoAccountState){
 const history=(readDemoState().server?.intents||[]).filter(r=>r.global_id===a.global_id&&r.purpose!=='deposit').map(demoPaymentIntentView);
 return {intent_history:history,active_payment:history.find(r=>!isImportedDemoIntent(r)&&['PENDING','CONFIRMING','CREATED'].includes(r.status))||null};
}
function shopProfile(a:DemoAccountState){const server=readDemoState().server;return {global_id:a.global_id,wallets:a.wallets,orders:(server?.orders||[]).filter(r=>r.global_id===a.global_id).map(r=>({...r,id:String(r.id),type:r.type||r.item_type||r.purpose||'EFHC_PACKAGE',sku:r.sku||r.item_code||'',quantity:Number(r.quantity||1),created_at:r.created_at||stamp(),updated_at:r.updated_at||r.created_at||stamp()})),access_mode:"telegram_handoff",
 profile_mode:"web_profile",bot_open_url:null,wallet_sync_url:null,telegram_sync_url:null,
 flow_truth:flowTruth(a.wallets.length>0),...shopPayments(a),latest_withdraw_request_id:null,latest_withdraw_status:null,latest_withdraw_outcome:null};}

/** Demo history is a VIEW of real frozen IndexedDB transactions + new local
 * browser-only ledger movements. It never creates transactions in Neon. */
async function readDemoCombinedHistory(a:DemoAccountState,q:URLSearchParams,empty:boolean,limit=50){
 const rawOffset=Number(q.get("cursor")||"0");
 if(!Number.isSafeInteger(rawOffset)||rawOffset<0)throw new PreviewApiError(400,"BAD_CURSOR");
 const windowSize=Math.min(50,Math.max(1,Number(q.get("limit")||limit)||limit));
 if(empty)return {items:[] as Record<string,unknown>[],next_cursor:null};
 const local=isNeonPagesDemo()
  ?(await import('./demoTableView')).localDemoLedger(readDemoState(),a.global_id)
  :a.ledger as unknown as Record<string,unknown>[];
 const localWindow=local.slice(rawOffset,rawOffset+windowSize);
 const remaining=windowSize-localWindow.length;
 let historic:Record<string,unknown>[]=[];
 let historicTotal=0;
 if(typeof indexedDB!=="undefined"){
  const afterLocal=Math.max(0,rawOffset-local.length);
  const page=await demoIndexedHistoryPage(a.global_id,afterLocal,Math.max(1,remaining));
  historicTotal=page.total;
  if(remaining>0)historic=page.items;
 }
 const records=[...localWindow,...historic];
 const end=rawOffset+records.length;
 return {items:records,next_cursor:end<local.length+historicTotal?String(end):null};
}
function demoHistoricBalanceEntry(row:Record<string,unknown>){
 return {id:String(row.id),amount_efhc:String(row.amount_efhc||row.amount||zero),
  direction:row.direction==="debit"?"debit":"credit",
  balance_type:row.balance_type==="bonus"?"bonus":"main",
  reason:String(row.reason||row.type||"history"),
  created_at:String(row.created_at||row.occurred_at||new Date(Number(row.createdAt)||Date.now()).toISOString())};
}
function demoProfileHistoryEntry(row:Record<string,unknown>){
 const b=demoHistoricBalanceEntry(row),asset=b.balance_type==='bonus'?'EFHCb':'EFHCm';
 return {id:b.id,source:String(row.source||'balance'),kind:String(row.type||b.reason),
  occurred_at:b.created_at,status:String(row.status||'completed'),direction:b.direction,
  balance_type:b.balance_type,amount_efhc:b.amount_efhc,amount_asset:b.amount_efhc,asset,reason:b.reason};
}
export async function demoApiRequest(path:string,method:string,body:unknown=undefined,idempotencyKey?:string):Promise<unknown>{
 if(!isLocalDemoActive())throw new PreviewApiError(403,"PREVIEW_DISABLED");
 if(isNeonPagesDemo())await bootstrapDemoIndexedDb();
 const route=new URL(path,"https://efhc.preview.invalid");
 method=method.toUpperCase();
 const p=route.pathname.replace(/^\/api(?=\/)/,"").replace(/\/$/,"")||"/";
 const q=route.searchParams,control=readDemoState();
 if(control.scenario==="loading")await new Promise(resolve=>setTimeout(resolve,600));
 if(control.scenario==="error"&&!p.startsWith("/auth/"))throw new PreviewApiError(503,"SCENARIO_ERROR");
 if(isNeonPagesDemo()&&method.toUpperCase()==='GET'&&['/ranks/my-plus-top/me','/ranks/top/me'].includes(p)){
  const {runtimeDemoTableRows}=await import('./demoTableView');
  const rows=runtimeDemoTableRows(control,'ranks')!,me=rows.find(r=>r.global_id===control.selected_global_id);
  must(Boolean(me),'USER_NOT_FOUND',404);const snapshot_at=stamp(),empty=control.scenario==='empty';
  if(p==='/ranks/my-plus-top/me'){
   const page=cursorPage(empty?[]:rows,q,100);
   return {snapshot_at,me:empty?{...me,total_generated_kwh:zero}:me,top:page.items,next_cursor:page.next_cursor};
  }
  if(q.get('around_me')==='true'){
   const index=rows.indexOf(me!);return {snapshot_at,items:empty?[]:rows.slice(Math.max(0,index-2),index+3),next_cursor:null};
  }
  return {snapshot_at,...cursorPage(empty?[]:rows,q,100)};
 }
 if(/^\/admin\/logs\/export\.(csv|xlsx)$/.test(p)&&method.toUpperCase()==='GET'){
  const {demoLogExport}=await import('./demoLogExport');
  return demoLogExport(p.endsWith('.xlsx')?'xlsx':'csv',q);
 }
 if(isNeonPagesDemo()&&p==="/exchange/history"&&method.toUpperCase()==="GET"&&control.server?.settings?.neon_seed_revision){
   const {getNeonExchangePage}=await import("./neonDemoDataApi");
   if(control.scenario==='empty')return {items:[],next_cursor:null};
   const gid=control.selected_global_id,local=control.accounts[gid]?.exchanges||[];
   const offset=Number(q.get("cursor")||"0"),limit=Math.min(100,Math.max(1,Number(q.get("limit")||50)));
   if(!Number.isSafeInteger(offset)||offset<0)throw new PreviewApiError(400,"BAD_CURSOR");
   const localRows=local.slice(offset,offset+limit),remaining=limit-localRows.length;
   if(!remaining)return {items:localRows,next_cursor:String(offset+limit)};
   const sql=await getNeonExchangePage(gid,Math.max(0,offset-local.length),remaining);
   return {items:[...localRows,...sql.items],next_cursor:localRows.length+sql.items.length===limit?String(offset+limit):null};
  }
  if(isNeonPagesDemo()&&p==="/admin/logs/transfers"&&method.toUpperCase()==="GET"){
  const {readNeonDemoJournal}=await import('./neonDemoReadRoutes');
  return readNeonDemoJournal(q);
 }
 if(!isNeonPagesDemo()&&p.startsWith('/admin/')&&!readDemoState().server?.settings.fixture_users_loaded){
  const rows=await demoAdminFixtureUsers();
  if(rows.length)transactDemoState(state=>{
   if(state.server?.settings.fixture_users_loaded)return;
   for(const row of rows){const gid=String(row.global_id);if(state.accounts[gid])continue;
    const a={...seedAccount(gid),...row,global_id:gid} as DemoAccountState;
    state.accounts[gid]=a;
    if(state.server)state.server.bank_balance=formatD8(d8(state.server.bank_balance)-d8(a.main_balance)-d8(a.bonus_balance));
   }
   if(state.server)state.server.settings.fixture_users_loaded=true;
  });
 }
 try{
  const result=demoServerRequest(p+route.search,method.toUpperCase(),body,idempotencyKey);
  if(result!==undefined)return result;
 }catch(error){if(error instanceof DemoOperationError)throw new PreviewApiError(error.status,error.code);throw error;}
 const a=readDemoAccount();const empty=control.scenario==="empty",now=stamp();
 const readOnly=method.toUpperCase()==="GET";
 const adminHistory=/^\/admin\/users\/(\d{10})\/history$/.exec(p);
 if(adminHistory&&readOnly){
  const target=readDemoState().accounts[adminHistory[1]];must(Boolean(target),'USER_NOT_FOUND',404);
  const rows=await readDemoCombinedHistory(target,q,empty);
  return {...rows,items:rows.items.map(demoProfileHistoryEntry),page_size:50};
 }

 if(p==="/ranks/my-plus-top/me"&&readOnly){
  const previous=demoMyRankWithTop();
  const match=canonical.ranks.users.find(row=>row.global_id===a.global_id);
  const me=a.global_id===DEMO_GLOBAL_ID?{...previous.me,total_generated_kwh:a.total_generated_kwh}:{
    global_id:a.global_id,username:`demo_${a.global_id}`,total_generated_kwh:a.total_generated_kwh,
    rank_pos:match?.rank_pos??canonical.ranks.users.length+1,is_vip:match?.is_vip??false};
  return empty?{...previous,me:{...me,total_generated_kwh:zero},top:[],next_cursor:null}:{...previous,me};
 }
 if(p==="/ranks/top/me"&&readOnly){
  if(empty)return {snapshot_at:now,items:[],next_cursor:null};
  if(q.get("around_me")==="true"){
    if(a.global_id===DEMO_GLOBAL_ID)return demoRankContext();
    const loc=canonical.ranks.users.findIndex(row=>row.global_id===a.global_id);
    const index=loc<0?canonical.ranks.users.length-1:loc;
    return {snapshot_at:now,items:canonical.ranks.users.slice(Math.max(0,index-2),Math.min(index+3,canonical.ranks.users.length)),next_cursor:null};
  }
  return demoRankTopPage(q.get("cursor")||"0");
 }
 if(p==="/referrals/stats/me"&&readOnly)return empty?{...referralStats(a),total_referrals:0,active_referrals:0,inactive_referrals:0,level:0,refs_to_next:10,progress:0}:referralStats(a);
 if((p==="/referrals/active/me"||p==="/referrals/inactive/me")&&readOnly){
  const active=p.includes("/active/"),links=control.server?.settings.neon_referrals as Record<string,unknown>[]|undefined;
  if(links){
   const rows=links.filter(r=>r.inviter_global_id===a.global_id&&Boolean(r.activated_at)===active)
     .map(r=>{const gid=String(r.invitee_global_id),child=control.accounts[gid];
      return {child_global_id:gid,global_id:gid,username:child?.username||gid,
       joined_at:r.created_at,invited_at:r.created_at,activated_at:r.activated_at,is_active:active,
       total_generated_kwh:child?.total_generated_kwh||zero,panels_count:child?.panels?.length||0};});
   return cursorPage(empty?[]:rows,q);
  }
  const size=active?17:7;const rows=empty?[]:Array.from({length:size},(_,i)=>freshReferral(a.global_id,active?i:17+i,active));
  return cursorPage(rows,q);
 }
 if(p==="/wallets/me"&&readOnly)return walletPayload(control.scenario==="no_wallet"?{...a,wallets:[]}:a);
 if(/^\/wallets\/\d+\/make-primary$/.test(p)&&method==="POST"){
  const id=Number(p.split("/")[2]);must(a.wallets.some(w=>w.id===id),"WALLET_NOT_FOUND",404);
  writeDemoAccount(cur=>({...cur,wallets:cur.wallets.map(w=>({...w,is_primary:w.id===id}))}));return {ok:true};
 }
 if(/^\/wallets\/\d+$/.test(p)&&method==="DELETE"){
  const id=Number(p.split("/")[2]);must(a.wallets.some(w=>w.id===id),"WALLET_NOT_FOUND",404);
  writeDemoAccount(cur=>({...cur,wallets:cur.wallets.filter(w=>w.id!==id)}));return {ok:true};
 }
 if(p==="/wallets/balance-history"&&readOnly){
  const rows=await readDemoCombinedHistory(a,q,empty);
  return {...rows,items:rows.items.map(demoHistoricBalanceEntry)};
 }
 if((p.startsWith("/v1/me/withdraw-outcomes/")||p.startsWith("/api/v1/me/withdraw-outcomes/"))&&readOnly){
  const id=p.split("/").pop();const record=a.withdrawals.find(r=>String(r.id)===id);
  must(Boolean(record),"WITHDRAW_NOT_FOUND",404);return withdrawalOut(record!);
 }
 if(p==="/profile/history"&&readOnly){
  const rows=await readDemoCombinedHistory(a,q,empty);
  return {...rows,items:rows.items.map(demoProfileHistoryEntry),page_size:50};
 }
 if(p==="/auth/profile-photos"&&readOnly)return {items:[]};
 if(p==="/hub/efhc-handoff"&&method==="POST"||p==="/shopfront/access-key"&&method==="POST"){
  return {redirect_url:`${window.location.origin}${publicAssetPath("/browser-shop/")}#token=demo:${a.global_id}`,expires_at:new Date(Date.now()+900000).toISOString(),transport:"external_url",mode:"signed_token"};
 }
 if(p==="/hub/shop-truth"&&readOnly){const wallet=a.wallets.find(w=>w.is_primary&&w.is_active);return {handoff_configured:true,handoff_mode:"connected",wallet_linked:Boolean(wallet),wallet_sync_required:false,
  active_wallet_address:wallet?.wallet_address||null,bot_open_url:null,telegram_sync_url:null,wallet_sync_url:null,flow_truth:flowTruth(Boolean(wallet))};}
 if(p==="/shopfront/bootstrap"&&readOnly){const wallet=a.wallets.find(w=>w.is_primary&&w.is_active);return {mode:"handoff_bound",tg_linked:true,global_id:a.global_id,wallet_linked:Boolean(wallet),
  active_wallet_address:wallet?.wallet_address||null,wallets:a.wallets,wallet_sync_required:false,bot_open_url:null,telegram_sync_url:null,wallet_sync_url:null,
  storefront_mode:"browser_shop_mvp",access_mode:"telegram_handoff",future_game_entry_enabled:false,available_modules:["efhc","vip"],usdt_checkout_mode:"simulation",
  flow_truth:flowTruth(Boolean(wallet)),...shopPayments(a)};}
 if(p==="/shopfront/profile"&&readOnly)return shopProfile(a);
 throw new PreviewApiError(501,`UNIMPLEMENTED_${method}_${p.replace(/[^a-z0-9/_-]/ig,"_").slice(0,100)}`);
}
