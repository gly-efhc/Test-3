/** Browser-only API adapter for the frozen v866 simulator. No remote API / TON calls.
 * An unsupported endpoint MUST fail closed rather than reach a real backend.
 * The simulated Global ID is an account selector, never a session credential.
 */
import canonical from "./demo-tables-v866.json";
import admin from "./demo-admin-seed-v866.json";
import {demoPanelsPage, demoPanelsSummary, demoMyRankWithTop, demoRankTopPage, demoRankContext} from "./demoTables";
import {DEMO_GLOBAL_ID, d8, formatD8, isDemoPreviewEnabled, readDemoAccount, readDemoState,
  writeDemoAccount, demoLedgerMutation, nextDemoId, type DemoAccountState} from "./demoUnifiedStore";

export class PreviewApiError extends Error {
  constructor(public readonly status:number,public readonly code:string){super(`DEMO_${code}`);this.name="PreviewApiError";}
}
const zero="0.00000000";
const stamp=()=>new Date().toISOString();
const sum=(a:string,b:string)=>formatD8(d8(a)+d8(b));
function must(condition:boolean,code:string,status=400):void {if(!condition)throw new PreviewApiError(status,code);}
function cursorPage<T>(values:readonly T[],args:URLSearchParams,defaultLimit=20):{items:T[];next_cursor:string|null}{
 const offset=args.get("cursor")===null?0:Number(args.get("cursor"));
 const limit=Math.min(100,Math.max(1,Number(args.get("limit")||defaultLimit)||defaultLimit));
 must(Number.isInteger(offset)&&offset>=0&&offset<=values.length,"BAD_CURSOR");
 return {items:values.slice(offset,offset+limit),next_cursor:offset+limit<values.length?String(offset+limit):null};
}
function taskState(a:DemoAccountState){
 const today=new Date().toISOString().slice(0,10),views=a.ad_date_utc===today?a.ad_views:0;
 return {completed:a.completed_tasks,adViews:views,dayUTC:today};
}
function taskEarnings(a:DemoAccountState):string {
 let earned=d8(canonical.tasks.earnings.total_bonus_earned);
 const rewards=new Map(canonical.tasks.catalog.map(t=>[t.code,t.bonus_efhc]));
 for(const code of a.completed_tasks)earned+=d8(rewards.get(code)||zero);
 earned+=BigInt(taskState(a).adViews)*d8(rewards.get("demo_watch_builtin")||zero);
 return formatD8(earned);
}
function walletPayload(a:DemoAccountState){return {is_connected:a.wallets.some(w=>w.is_active),wallets:a.wallets};}
function snapshot(a:DemoAccountState){
 const activeCount=canonical.panels.active.length+a.activated_panels;
 const effectiveRate="0.00000692";
 return {profile:{global_id:a.global_id,tg_id:0,username:a.global_id===DEMO_GLOBAL_ID?"efhc_player":`demo_${a.global_id}`,
   is_vip:true,has_activ:true,main_balance:a.main_balance,bonus_balance:a.bonus_balance,
   available_kwh:a.available_kwh,total_generated_kwh:a.total_generated_kwh,
   gen_per_sec_base:zero,gen_per_sec_vip:formatD8(d8(effectiveRate)*BigInt(activeCount))},
  panels:{active_count:activeCount,total_generated_by_panels:canonical.panels.summary.total_generated_by_panels,
    nearest_expire_at:demoPanelsSummary().nearest_expire_at},
  exchange_preview:{ok:true,available_kwh:a.available_kwh,max_exchangeable_kwh:a.available_kwh,
    rate_kwh_to_efhc:"1.00000000",detail:"DEMO / not a real financial operation"},
  meta:{server_now_iso:stamp(),gen_per_sec_effective:formatD8(d8(effectiveRate)*BigInt(activeCount)),next_scheduler_eta_sec:0,fallback_task_id:null}};
}
function taskMy(a:DemoAccountState){
 return canonical.tasks.catalog.filter(t=>a.completed_tasks.includes(t.code)).map(t=>({
  id:String(t.id),task_id:String(t.id),status:"completed",progress:{demo:true},
  bonus_efhc:t.bonus_efhc,can_claim:false,next_available_at:null,
 }));
}
const freshReferral=(globalId:string,index:number,active:boolean)=>{
 const time=new Date(Date.now()-(index+1)*3600000).toISOString();
 const gid=String(9000000001+index).padStart(10,"0");
 return {child_global_id:gid,global_id:gid,username:`ref_${String(index+1).padStart(4,"0")}`,joined_at:time,
  invited_at:time,activated_at:active?time:null,is_active:active,total_generated_kwh:active?"120.00000000":zero,panels_count:active?1:0};
};
function referralStats(a:DemoAccountState){
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
function exchangePreview(a:DemoAccountState){return snapshot(a).exchange_preview;}
function withdrawalOut(row:Record<string,unknown>){return {
  request_id:String(row.id),global_id:row.global_id,outcome_kind:String(row.status||"pending"),locale:"ru",
  comment:{text:"Демонстрационная заявка. Реального перевода нет.",source:"demo",locale:"ru"},
  promo:null,top_zone_enabled:false,metadata:{demo:true}};
}
function buildCatalog(){
 const fixed=["10","50","100","150","200","250","300","350","500","750","1000","1500","2000","2500","3000"];
 return [...fixed.map((amount,index)=>({sku:`EFHC_PACKAGE_${amount}`,title:`${amount} EFHCm`,description:`Демо-пакет ${amount} EFHCm`,item_type:"EFHC_PACKAGE",ton_enabled:true,usdt_enabled:true,
  methods:{TON:{price:(Number(amount)/100).toFixed(2)},USDT:{price:(Number(amount)*0.3).toFixed(2)}},
  image_url:null,category:"efhc",badge:"EFHC",status:"live",action_mode:"checkout",delivery_mode:"automatic",quantity_efhc:`${amount}.00000000`,sort_order:index*10})),
  {sku:"EFHC_PACKAGE_CUSTOM",title:"EFHCm",description:"Произвольная сумма (DEMO)",item_type:"EFHC_PACKAGE",ton_enabled:true,usdt_enabled:true,
    methods:{TON:{price:"0.01"},USDT:{price:"0.30"}},image_url:null,category:"efhc",badge:"",status:"live",action_mode:"checkout",delivery_mode:"automatic",quantity_efhc:null,sort_order:4000},
  {sku:"EFHC_VIP_NFT",title:"EFHC VIP NFT",description:"Выпуск NFT только моделируется",item_type:"NFT_VIP",ton_enabled:true,usdt_enabled:true,
    methods:{TON:{price:"100.00"},USDT:{price:"150.00"},EFHC:{price:"500.00000000"}},image_url:null,category:"vip",badge:"VIP NFT",status:"live",action_mode:"checkout",delivery_mode:"manual",quantity_efhc:null,sort_order:5000}];
}
function flowTruth(walletLinked:boolean){return {
 handoff_configured:true,handoff_mode:"connected",wallet_linked:walletLinked,wallet_sync_required:false,
 wallet_ready:walletLinked,wallet_blocked:!walletLinked,action_allowed:walletLinked,action_denied:!walletLinked,
 readiness_state:walletLinked?"ready":"wallet_required",primary_cta:walletLinked?"create_intent":"sync_wallet",
 active_intent:null,active_order_id:null,active_order_status:null,product_state:"BROWSING",next_action:"browse",
 return_path:"/browser-shop",canonical_center:"browser_shop",next_step:walletLinked?"create_intent":"sync_wallet",
 blocker_codes:walletLinked?[]:["wallet_not_linked"],browser_shop_path:"/browser-shop",truth_label:"shop_hub_truth_layer"};
}
function shopProfile(a:DemoAccountState){return {global_id:a.global_id,wallets:a.wallets,orders:[],access_mode:"telegram_handoff",
 profile_mode:"web_profile",bot_open_url:null,wallet_sync_url:null,telegram_sync_url:null,
 flow_truth:flowTruth(a.wallets.length>0),active_payment:null,intent_history:[],latest_withdraw_request_id:null,latest_withdraw_status:null,latest_withdraw_outcome:null};}

export async function demoApiRequest(path:string,method:string,body:unknown=undefined,idempotencyKey?:string):Promise<unknown>{
 if(!isDemoPreviewEnabled())throw new PreviewApiError(403,"PREVIEW_DISABLED");
 const route=new URL(path,"https://efhc.preview.invalid");
 const p=route.pathname.replace(/^\/api(?=\/)/,"");
 const q=route.searchParams,control=readDemoState();
 if(control.scenario==="loading")await new Promise(resolve=>setTimeout(resolve,600));
 if(control.scenario==="error"&&!p.startsWith("/auth/"))throw new PreviewApiError(503,"SCENARIO_ERROR");
 const a=readDemoAccount();const empty=control.scenario==="empty",now=stamp();
 const readOnly=method.toUpperCase()==="GET";
 // All state changes (including DEMO-only ones) are tied to selected ten-digit Global ID.
 if(p==="/sync/me"&&method==="POST")return snapshot(empty?{...a,available_kwh:zero,main_balance:zero,bonus_balance:zero,total_generated_kwh:zero,activated_panels:0}:a);
 if(p==="/user/me/panels-summary"&&readOnly)return empty?{active_count:0,total_generated_by_panels:zero,nearest_expire_at:null}:{...demoPanelsSummary(),active_count:60+a.activated_panels};
 if((p==="/panels/active"||p==="/panels/archive")&&readOnly){
  const tab=p.endsWith("/active")?"active":"archive";
  const direction=q.get("demo_sort")==="newest"?"newest":"oldest";
  const value=demoPanelsPage(tab,q.get("cursor"),direction);
  if(empty)return {...value,items:[],next_cursor:null};
  if(tab==="active"&&a.activated_panels){
   // Newly activated panels belong to the same Global ID as the snapshot and ledger.
   const rows=Array.from({length:a.activated_panels},(_,i)=>({id:String(500000+i),public_id:`PNL-${String(500000+i).padStart(9,"0")}`,
    activated_at:now,created_at:now,expires_at:new Date(Date.now()+180*86400000).toISOString(),archived_at:null,
    base_gen_per_sec:"0.00000692",generated_kwh:zero,is_active:true}));
   const combined=direction==="oldest"?[...canonical.panels.active,...rows]:[...rows,...canonical.panels.active];
   return {...value,...cursorPage(combined,q,20),server_now_utc:now};
  }
  return value;
 }
 if(p==="/panels/activate"&&method==="POST"){
  must(d8(a.main_balance)+d8(a.bonus_balance)>=d8("100"),"PANEL_INSUFFICIENT_BALANCE",409);
  const bonus=d8(a.bonus_balance),bonusPay=bonus>=d8("100")?d8("100"):bonus,mainPay=d8("100")-bonusPay;
  if(bonusPay>0n)demoLedgerMutation(formatD8(bonusPay),"debit","bonus","panel_purchase");
  if(mainPay>0n)demoLedgerMutation(formatD8(mainPay),"debit","main","panel_purchase");
  const id=nextDemoId();writeDemoAccount(cur=>({...cur,activated_panels:cur.activated_panels+1}));
  return {panel:{id:String(id),public_id:`PNL-${String(id).padStart(9,"0")}`,activated_at:now,expires_at:new Date(Date.now()+180*86400000).toISOString()},server_now_utc:now};
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
 if(p==="/tasks/catalog"&&readOnly)return {items:canonical.tasks.catalog.map(t=>({...t,id:String(t.id)}))};
 if(p==="/tasks/earnings/me"&&readOnly)return {total_bonus_earned:taskEarnings(a),bonus_asset:"EFHCb",includes_ads:true};
 if(p==="/tasks/my"&&readOnly)return {items:empty?[]:taskMy(a)};
 if(p==="/tasks/claim"&&method==="POST"){
  const record=body as {task_id?:string|number},target=canonical.tasks.catalog.find(t=>String(t.id)===String(record?.task_id));
  must(Boolean(target)&&target?.code!=="demo_watch_builtin","DEMO_TASK_NOT_FOUND",404);
  must(!a.completed_tasks.includes(target!.code),"DEMO_TASK_ALREADY_COMPLETED",409);
  demoLedgerMutation(target!.bonus_efhc,"credit","bonus","task_bonus");
  const next=writeDemoAccount(current=>({...current,completed_tasks:[...current.completed_tasks,target!.code]}));
  return {ok:true,global_id:a.global_id,task_id:String(target!.id),bonus_efhc:target!.bonus_efhc,
   bonus_balance:next.bonus_balance,main_balance:next.main_balance,detail:"DEMO only"};
 }
 if(p==="/referrals/stats/me"&&readOnly)return empty?{...referralStats(a),total_referrals:0,active_referrals:0,inactive_referrals:0,level:0,refs_to_next:10,progress:0}:referralStats(a);
 if((p==="/referrals/active/me"||p==="/referrals/inactive/me")&&readOnly){
  const active=p.includes("/active/");const size=active?17:7;const rows=empty?[]:Array.from({length:size},(_,i)=>freshReferral(a.global_id,active?i:17+i,active));
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
 if(p==="/wallets/balance-history"&&readOnly)return cursorPage(empty?[]:a.ledger,q,50);
 if(p==="/exchange/history"&&readOnly)return cursorPage(empty?[]:a.exchanges,q,50);
 if(p==="/exchange/preview"&&readOnly)return exchangePreview(a);
 if(p==="/exchange/convert"&&method==="POST"){
  const data=body as {amount_kwh?:string};const amount=d8(data?.amount_kwh||"0");
  must(amount>0n&&d8(a.available_kwh)>=amount,"EXCHANGE_AMOUNT_INVALID",409);
  const credited=formatD8(amount);demoLedgerMutation(credited,"credit","main","exchange_kwh");const id=nextDemoId();
  const next=writeDemoAccount(cur=>({...cur,available_kwh:formatD8(d8(cur.available_kwh)-amount),exchanges:[{
   id:String(id),created_at:now,amount_kwh:credited,amount_efhc:credited,reason:"exchange_kwh"},...cur.exchanges]}));
  return {ok:true,exchanged_kwh:credited,credited_efhc:credited,new_available_kwh:next.available_kwh,new__main__balance:next.main_balance,log_id:String(id),detail:"DEMO only"};
 }
 if((p==="/withdraw/list"||p==="/withdraw/list/me")&&readOnly){
  const rows=a.withdrawals.filter(r=>!q.get("status_filter")||q.get("status_filter")==="all"||r.status===q.get("status_filter"));
  return cursorPage(rows,q);
 }
 if(/^\/withdraw\/\d+$/.test(p)&&readOnly){
  const found=a.withdrawals.find(r=>String(r.id)===p.split("/")[2]);must(Boolean(found),"WITHDRAW_NOT_FOUND",404);return found;
 }
 if(p==="/withdraw/request"&&method==="POST"){
  const data=body as {amount:string;wallet_id:string|number};const value=d8(data.amount);
  must(value>0n&&d8(a.main_balance)>=value,"WITHDRAW_INSUFFICIENT_BALANCE",409);
  const wallet=a.wallets.find(w=>String(w.id)===String(data.wallet_id));must(Boolean(wallet),"WITHDRAW_WALLET_MISSING",400);
  demoLedgerMutation(data.amount,"debit","main","withdraw_hold");const id=nextDemoId();
  const record={id:String(id),global_id:a.global_id,amount:formatD8(value),status:"pending",created_at:now,updated_at:now,
   idempotency_key:idempotencyKey||`demo-${id}`,hold_done:true,refund_done:false,payout_ref:null,wallet_address:wallet!.wallet_address};
  writeDemoAccount(cur=>({...cur,withdrawals:[record,...cur.withdrawals]}));return record;
 }
 if(/^\/withdraw\/\d+\/cancel$/.test(p)&&method==="POST"){
  const id=p.split("/")[2],record=a.withdrawals.find(r=>String(r.id)===id);
  must(Boolean(record)&&record!.status==="pending","WITHDRAW_NOT_CANCELLABLE",409);
  demoLedgerMutation(String(record!.amount),"credit","main","withdraw_refund");
  let updated:Record<string,unknown>={};writeDemoAccount(cur=>({...cur,withdrawals:cur.withdrawals.map(row=>{
   if(String(row.id)!==id)return row;updated={...row,status:"cancelled",updated_at:now,refund_done:true};return updated;
  })}));return updated;
 }
 if((p.startsWith("/v1/me/withdraw-outcomes/")||p.startsWith("/api/v1/me/withdraw-outcomes/"))&&readOnly){
  const id=p.split("/").pop();const record=a.withdrawals.find(r=>String(r.id)===id);
  must(Boolean(record),"WITHDRAW_NOT_FOUND",404);return withdrawalOut(record!);
 }
 if(p==="/profile/history"&&readOnly){
  const rows=a.ledger.map(r=>({id:String(r.id),source:"balance",kind:r.reason,occurred_at:r.created_at,status:"completed",
   direction:r.direction,balance_type:r.balance_type,amount_efhc:r.amount_efhc,amount_asset:r.amount_efhc,asset:r.balance_type==="bonus"?"EFHCb":"EFHCm",reason:r.reason}));
  return {...cursorPage(empty?[]:rows,q,50),page_size:50};
 }
 if(p==="/auth/profile-photos"&&readOnly)return {items:[]};
 if(p==="/hub/links"&&readOnly)return (admin.hubLinks as Record<string,unknown>[]).filter(x=>x.is_active).slice(0,2);
 if(p==="/hub/support-links"&&readOnly)return (admin.hubLinks as Record<string,unknown>[]).filter(x=>String(x.url||"").startsWith("https://")).map(x=>({id:String(x.id),title:x.title,subtitle:x.subtitle,url:x.url,open_mode:x.open_mode||"external_browser",icon_key:x.icon_key||"link"}));
 if(p==="/hub/efhc-handoff"&&method==="POST"||p==="/shopfront/access-key"&&method==="POST"){
  return {redirect_url:`${window.location.origin}/browser-shop/`,expires_at:new Date(Date.now()+900000).toISOString(),transport:"external_url",mode:"signed_token"};
 }
 if(p==="/hub/shop-truth"&&readOnly){const wallet=a.wallets.find(w=>w.is_primary&&w.is_active);return {handoff_configured:true,handoff_mode:"connected",wallet_linked:Boolean(wallet),wallet_sync_required:false,
  active_wallet_address:wallet?.wallet_address||null,bot_open_url:null,telegram_sync_url:null,wallet_sync_url:null,flow_truth:flowTruth(Boolean(wallet))};}
 if(p==="/shopfront/bootstrap"&&readOnly){const wallet=a.wallets.find(w=>w.is_primary&&w.is_active);return {mode:"handoff_bound",tg_linked:true,global_id:a.global_id,wallet_linked:Boolean(wallet),
  active_wallet_address:wallet?.wallet_address||null,wallets:a.wallets,wallet_sync_required:false,bot_open_url:null,telegram_sync_url:null,wallet_sync_url:null,
  storefront_mode:"browser_shop_mvp",access_mode:"telegram_handoff",future_game_entry_enabled:false,available_modules:["efhc","vip"],usdt_checkout_mode:"simulation",
  flow_truth:flowTruth(Boolean(wallet)),active_payment:null,intent_history:[]};}
 if(p==="/shopfront/catalog"&&readOnly)return {items:empty?[]:buildCatalog()};
 if(p==="/shopfront/profile"&&readOnly)return shopProfile(a);
 if(p==="/shopfront/intent-status"&&readOnly)return {intent_id:q.get("intent_id"),status:"PENDING",asset:"TON",amount_asset_d8:"1.00000000"};
 if(p==="/shopfront/create-intent"&&method==="POST")throw new PreviewApiError(409,"SIMULATED_CHECKOUT_NOT_IMPLEMENTED_USE_NO_REAL_WALLET");
 if(p==="/shop/purchase-efhc"&&method==="POST")throw new PreviewApiError(409,"SIMULATED_EFHC_PURCHASE_NOT_IMPLEMENTED");
 if(p==="/skins/catalog"&&readOnly)return {items:[]};
 if(p==="/skins/my"&&readOnly)return {active_skin_id:1,owned:[]};
 if(p==="/skins/switcher"&&readOnly)return {current_level:9,available_skin_ids:[1],active_skin_id:1,items:[]};
 if(p==="/deposit/direct-open"&&method==="POST")throw new PreviewApiError(403,"REAL_DEPOSIT_DISABLED_IN_PUBLIC_DEMO");
 throw new PreviewApiError(501,`UNIMPLEMENTED_${method}_${p.replace(/[^a-z0-9/_-]/ig,"_").slice(0,100)}`);
}
