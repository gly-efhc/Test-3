/** Stateful implementations of public DEMO operations. Only demoApi calls this
 * module after its compile-time/runtime isolation gates. No fetch or TON SDK. */
import canonical from './demo-tables-v866.json';
import {d8,formatD8,DEMO_GLOBAL_ID,transactDemoState,type DemoControlState,type DemoAccountState} from './demoUnifiedStore';
import {account,ensureServer,ensurePanels,settleGeneration,transfer,replay,activatePanel,pageRows,panelRows,userRow,amount,requireDemo,DemoOperationError,BASE_RATE,VIP_RATE} from './demoServerCore';
import type {DemoRow,DemoPanel} from './demoServerModel';

const zero='0.00000000';
const totals=(rows:DemoRow[],key:string)=>formatD8(rows.reduce((n,r)=>n+d8(String(r[key]||zero)),0n));
const outputWithdrawal=(r:DemoRow)=>({...r,id:String(r.id),amount_efhc:r.amount_efhc||r.amount,status:String(r.status).toUpperCase(),
 external_address:r.external_address||r.wallet_address||null,tx_hash:r.tx_hash||null,processed_at:r.processed_at||null,error_message:r.error_message||null,
 is_vip:r.is_vip??true,payout_asset:'EFHC',tonconnect_transport_kind:null,jetton_master_address:null,jetton_decimals:8,fee_message_ton_amount:null});
function snapshot(state:DemoControlState){
 const a=account(state),rows=panelRows(a).filter(p=>!p.meta?.protectively_voided),active=rows.filter(p=>p.is_active);
 const rate=a.is_vip===false?BASE_RATE:VIP_RATE;
 const empty=state.scenario==='empty';
 return {profile:{...userRow(a),...(empty?{main_balance:zero,bonus_balance:zero,total_generated_kwh:zero,available_kwh:zero}:{}),has_activ:!empty&&rows.length>0,gen_per_sec_base:BASE_RATE,gen_per_sec_vip:VIP_RATE},
  panels:{active_count:active.length,total_generated_by_panels:totals(rows,'generated_kwh'),nearest_expire_at:active.map(p=>p.expires_at).sort()[0]||null},
  exchange_preview:{ok:true,available_kwh:a.available_kwh,max_exchangeable_kwh:a.available_kwh,rate_kwh_to_efhc:'1.00000000',detail:''},
  meta:{server_now_iso:new Date().toISOString(),gen_per_sec_effective:empty?zero:formatD8(d8(rate)*BigInt(active.length)),next_scheduler_eta_sec:0,fallback_task_id:null}};
}
function overview(state:DemoControlState){
 const s=ensureServer(state),users=Object.values(state.accounts),panels=users.flatMap(a=>panelRows(a)).filter(p=>!p.meta?.protectively_voided);
 const main=totals(users,'main_balance'),bonus=totals(users,'bonus_balance'),circulation=formatD8(d8(main)+d8(bonus));
 const expected=d8(s.supply_initial)+d8(s.minted)-d8(s.burned),actual=d8(s.bank_balance)+d8(circulation),delta=actual-expected;
 const pct=(v:bigint)=>expected===0n?zero:formatD8(v*10000000000n/expected);
 const active=panels.filter(p=>p.is_active),archived=panels.filter(p=>!p.is_active);
 const facts:Record<string,string>={bank_metrics_ready:'1',bank_metrics_integrity_ok:delta===0n?'1':'0',
  bank_metrics_reserve_efhc:s.bank_balance,bank_metrics_circulation_efhc:circulation,bank_metrics_expected_supply_efhc:formatD8(expected),
  bank_metrics_actual_supply_efhc:formatD8(actual),bank_metrics_integrity_delta_efhc:formatD8(delta),bank_metrics_integrity_pct:pct(actual),
  bank_metrics_reserve_pct:pct(d8(s.bank_balance)),bank_metrics_circulation_pct:pct(d8(circulation)),
  users_total__main__efhc:main,users_total_main_efhc:main,users_total_bonus_efhc:bonus,
  users_total_generated_kwh:totals(users,'total_generated_kwh'),users_total_available_kwh:totals(users,'available_kwh'),
  users_total_exchanged_kwh:formatD8(users.reduce((n,a)=>n+d8(a.total_generated_kwh)-d8(a.available_kwh),0n)),
  panels_total_active:String(active.length),panels_total_archived:String(archived.length),panels_total_bought:String(panels.length),
  panels_total_paid_efhc:formatD8(BigInt(panels.length)*d8('100')),panels_total_generated_kwh:totals(panels,'generated_kwh'),
  bank_balance:s.bank_balance,bank_metrics_main_efhc:main,bank_metrics_bonus_efhc:bonus,
  bank_metrics_main_pct:pct(d8(main)),bank_metrics_bonus_pct:pct(d8(bonus))};
 return {ok:true,ts:new Date().toISOString(),facts,counters:{users_total:users.length,users_active:users.filter(a=>a.is_active!==false).length,
  users_vip:users.filter(a=>a.is_vip!==false).length,panels_total:panels.length,panels_active:active.length,
  withdrawals_pending:users.flatMap(a=>a.withdrawals).filter(r=>r.status==='pending').length,tasks_total:s.tasks.length,
  shop_orders_total:s.orders.length},notes:null};
}
function rowById(rows:DemoRow[],id:string){const found=rows.find(r=>String(r.id)===id);requireDemo(found,'NOT_FOUND',404);return found;}
function fulfilOrder(state:DemoControlState,row:DemoRow){
 if(row.demo_fulfilled)return row;
 requireDemo(!['CANCELLED','REJECTED','REFUNDED'].includes(String(row.status).toUpperCase()),'ORDER_NOT_FULFILLABLE',409);
 const a=account(state,String(row.global_id));
 if(String(row.item_type||row.purpose).includes('VIP'))a.is_vip=true;
 else transfer(state,a.global_id,amount(row.quantity_efhc||row.efhc_amount_d8||'100'),'credit','main','shop_package');
 Object.assign(row,{status:'FULFILLED',order_status:'FULFILLED',demo_fulfilled:true,updated_at:new Date().toISOString()});return row;
}
function protectivelyVoid(state:DemoControlState,p:DemoPanel,reason:string){
 requireDemo(reason.trim(),'REASON_REQUIRED');requireDemo(!p.meta?.protectively_voided,'PANEL_ALREADY_VOID',409);
 const a=account(state,p.global_id),g=d8(p.generated_kwh),available=d8(a.available_kwh),u=g<available?g:available,r=g-u;
 requireDemo(r<=d8('100')&&d8(a.total_generated_kwh)>=g,'PANEL_ECONOMIC_ANOMALY',409);
 const net=d8('100')-r,bonus=d8(p.cost_bonus||zero),bonusReturn=bonus<net?bonus:net;
 a.available_kwh=formatD8(available-u);a.total_generated_kwh=formatD8(d8(a.total_generated_kwh)-g);
 if(bonusReturn)transfer(state,a.global_id,bonusReturn,'credit','bonus','panel_protective_refund');
 if(net-bonusReturn)transfer(state,a.global_id,net-bonusReturn,'credit','main','panel_protective_refund');
 p.is_active=false;p.is_archived=true;p.archived_at=new Date().toISOString();p.meta={...p.meta,protectively_voided:true,protective_reason:reason,protective_refund:formatD8(net)};
 return {ok:true,item:p,refund_efhc:formatD8(net)};
}

/** Undefined means the existing explicit adapter owns the route. Unknown
 * requests are rejected there, never converted into a generic success. */
export function demoServerRequest(path:string,method:string,body:unknown,key?:string):unknown {
 const url=new URL(path,'https://demo.invalid'),p=url.pathname.replace(/^\/api(?=\/)/,'').replace(/\/$/,''),q=url.searchParams;
 const b=(body&&typeof body==='object'?body:{}) as DemoRow,read=method==='GET';
 const supported=p.startsWith('/admin/')||p==='/admin'||p.startsWith('/health')||p.startsWith('/meta/')||p.startsWith('/cron/')||
  ['/sync/me','/user/me/panels-summary','/panels/active','/panels/archive','/panels/activate','/exchange/preview','/exchange/convert','/exchange/history','/withdraw/list','/withdraw/list/me','/withdraw/request','/hub/links','/hub/support-links','/tasks/catalog','/tasks/my','/tasks/claim','/tasks/earnings/me','/shopfront/create-intent','/shopfront/intent-status','/shopfront/catalog','/shop/purchase-efhc','/deposit/direct-open'].includes(p)||/^\/withdraw\/\d+(?:\/cancel)?$/.test(p);
 if(!supported)return undefined;
 const run=(state:DemoControlState):unknown=>{
  settleGeneration(state);const s=ensureServer(state),a=account(state),now=new Date().toISOString();
  if(state.scenario==='empty'&&read&&!p.startsWith('/admin/')){
   if(p==='/panels/active'||p==='/panels/archive')return {items:[],next_cursor:null,server_now_utc:now};
  }
  if(state.scenario==='empty'&&!read&&['/panels/activate','/exchange/convert','/withdraw/request'].includes(p))throw new DemoOperationError(409,'DEMO_EMPTY_NO_FUNDS');
  if(p==='/sync/me'&&method==='POST')return snapshot(state);
  if(p==='/user/me/panels-summary'&&read)return snapshot(state).panels;
  if((p==='/panels/active'||p==='/panels/archive')&&read){
   const rows=panelRows(a).filter(r=>!r.meta?.protectively_voided&&(p.endsWith('/active')?r.is_active:!r.is_active));
   rows.sort((x,y)=>Date.parse(x.activated_at)-Date.parse(y.activated_at)||Number(x.id)-Number(y.id));
   if(q.get('demo_sort')==='newest')rows.reverse();return {...pageRows(rows,q),server_now_utc:now};
  }
  if(p==='/panels/activate'&&method==='POST')return replay(state,key,`${a.global_id}:activate`,()=>({panel:activatePanel(state,a.global_id),server_now_utc:now}));
  if(p==='/exchange/preview'&&read)return snapshot(state).exchange_preview;
  if(p==='/exchange/history'&&read)return pageRows(a.exchanges,q,50);
  if(p==='/exchange/convert'&&method==='POST')return replay(state,key,`${a.global_id}:exchange:${b.amount_kwh??'all'}`,()=>{
   const value=amount(b.amount_kwh??a.available_kwh);requireDemo(value<=d8(a.available_kwh),'EXCHANGE_AMOUNT_INVALID',409);
   transfer(state,a.global_id,value,'credit','main','exchange_kwh');a.available_kwh=formatD8(d8(a.available_kwh)-value);
   const row={id:String(++state.next_id),created_at:now,amount_kwh:formatD8(value),amount_efhc:formatD8(value),reason:'exchange_kwh'};a.exchanges.unshift(row);
   return {ok:true,exchanged_kwh:row.amount_kwh,credited_efhc:row.amount_efhc,new_available_kwh:a.available_kwh,new__main__balance:a.main_balance,log_id:row.id,detail:''};
  });
  if((p==='/withdraw/list'||p==='/withdraw/list/me')&&read)return pageRows(a.withdrawals.filter(r=>!q.get('status_filter')||q.get('status_filter')==='all'||String(r.status).toLowerCase()===q.get('status_filter')!.toLowerCase()),q);
  if(p==='/withdraw/request'&&method==='POST')return replay(state,key,`${a.global_id}:withdraw:${b.amount}:${b.wallet_id??''}`,()=>{
   const value=amount(b.amount);requireDemo(value>=d8('10'),'WITHDRAW_BELOW_MINIMUM',409);
   const wallet=state.scenario==='no_wallet'?undefined:a.wallets.find(w=>w.is_active&&w.proof_verified&&(b.wallet_id?String(w.id)===String(b.wallet_id):w.is_primary));
   requireDemo(wallet,'WITHDRAW_WALLET_MISSING');transfer(state,a.global_id,value,'debit','main','withdraw_hold');
   const row={id:String(++state.next_id),global_id:a.global_id,amount:formatD8(value),amount_efhc:formatD8(value),status:'pending',created_at:now,updated_at:now,
    wallet_address:wallet.wallet_address,hold_done:true,refund_done:false,is_vip:a.is_vip!==false};a.withdrawals.unshift(row);return row;
  });
  const wd=/^\/withdraw\/(\d+)(\/cancel)?$/.exec(p);
  if(wd){const row=rowById(a.withdrawals,wd[1]);if(read)return row;
   if(wd[2]&&method==='POST')return replay(state,key,`${a.global_id}:cancel:${row.id}`,()=>{
    requireDemo(row.status==='pending','WITHDRAW_NOT_CANCELLABLE',409);transfer(state,a.global_id,d8(String(row.amount)),'credit','main','withdraw_refund');
    Object.assign(row,{status:'cancelled',refund_done:true,updated_at:now});return row;});}
  if(p==='/hub/links'&&read)return s.hub.filter(r=>r.is_active);
  if(p==='/hub/support-links'&&read)return s.support.filter(r=>r.is_active);
  if(p==='/tasks/catalog'&&read)return {items:s.tasks.filter(r=>r.is_active).map(r=>({...r,id:String(r.id)}))};
  if(p==='/tasks/my'&&read)return {items:a.completed_tasks.map(code=>{const t=s.tasks.find(r=>r.code===code);return {id:String(t?.id),task_id:String(t?.id),status:'completed',can_claim:false,bonus_efhc:t?.bonus_efhc||zero,next_available_at:null,progress:{demo:true}};})};
  if(p==='/tasks/earnings/me'&&read)return {total_bonus_earned:formatD8(a.ledger.filter(r=>r.reason==='task_bonus'||r.reason==='ad_reward').reduce((n,r)=>n+d8(r.amount_efhc),d8(canonical.tasks.earnings.total_bonus_earned))),bonus_asset:'EFHCb',includes_ads:true};
  if(p==='/tasks/claim'&&method==='POST'){
   const t=s.tasks.find(r=>String(r.id)===String(b.task_id));requireDemo(t?.is_active,'TASK_NOT_FOUND',404);requireDemo(!a.completed_tasks.includes(t.code),'TASK_ALREADY_COMPLETED',409);
   transfer(state,a.global_id,amount(t.bonus_efhc),'credit','bonus','task_bonus');a.completed_tasks.push(t.code);
   return {ok:true,global_id:a.global_id,task_id:String(t.id),bonus_efhc:t.bonus_efhc,main_balance:a.main_balance,bonus_balance:a.bonus_balance,detail:''};
  }
  if(p.startsWith('/health')||p.startsWith('/meta/'))return {ok:true,status:'ok',mode:'demo',backend:{ok:true,mode:'simulation'},db:{ok:true,mode:'browser'},watcher:{ok:false,status:'simulation',heartbeat_age_sec:null}};
  if(p==='/admin/access')return {ok:true,is_admin:state.role!=='user',is_superadmin:state.role==='superadmin',roles:[state.role]};
  if(p.startsWith('/admin/')&&!read)requireDemo(state.role==='admin'||state.role==='superadmin','DEMO_ADMIN_ROLE_REQUIRED',403);
  if(p==='/admin/reports/overview'&&read)return overview(state);
  if(/^\/admin\/reports\//.test(p)&&read)return {...overview(state),items:[],series:[],period:q.get('period')||'30d'};
  if(p==='/admin/bank/balance'&&read)return {bank_name:'BANK_EFHC',efhc_main:s.bank_balance};
  if((p==='/admin/bank/mint'||p==='/admin/bank/burn')&&method==='POST'){
   requireDemo(state.role==='superadmin','SUPERADMIN_REQUIRED',403);
   return replay(state,key||b.idempotency_key,`${p}:${JSON.stringify(b)}`,()=>{const value=amount(b.amount);requireDemo(String(b.reason||'').trim(),'REASON_REQUIRED');
    const mint=p.endsWith('/mint');s.bank_balance=formatD8(d8(s.bank_balance)+(mint?value:-value));
    const field=mint?'minted':'burned';s[field]=formatD8(d8(s[field])+value);s.audit.unshift({id:++state.next_id,reason:field,amount_efhc:formatD8(value),created_at:now});return {ok:true,bank_balance_after:s.bank_balance};});
  }
  if(p==='/admin/transfer'&&method==='POST')return replay(state,key,`${p}:${JSON.stringify(b)}`,()=>{
   requireDemo(['credit','debit'].includes(b.direction)&&['main','bonus'].includes(b.balance_type),'INVALID_TRANSFER_DIRECTION_OR_BALANCE');
   const row=transfer(state,String(b.global_id),amount(b.amount),b.direction==='debit'?'debit':'credit',b.balance_type==='bonus'?'bonus':'main',String(b.reason||'admin_transfer'));
   return {ok:true,result:row,user:userRow(account(state,String(b.global_id))),bank_balance_after:s.bank_balance};});
  if(p==='/admin/users'&&read){const text=(q.get('q')||q.get('query')||q.get('global_id')||'').toLowerCase();return pageRows(Object.values(state.accounts).map(userRow).filter(r=>!text||r.global_id.includes(text)||r.username.includes(text)),q);}
  if(p==='/admin/users/resolve-provider'&&read)return {global_id:q.get('provider_subject')||q.get('subject')||DEMO_GLOBAL_ID};
  const user=/^\/admin\/users\/(\d{10})(?:\/(.*))?$/.exec(p);
  if(user){const target=account(state,user[1]),suffix=user[2]||'';
   if(!suffix&&read)return userRow(target);
   if(suffix==='history'&&read)return {...pageRows(target.ledger.map(r=>({...r,id:String(r.id),source:'balance',kind:r.reason,occurred_at:r.created_at,status:'completed',amount_asset:r.amount_efhc,asset:r.balance_type==='bonus'?'EFHCb':'EFHCm'})),q,50),page_size:50};
   if(suffix==='panels/activate'&&method==='POST')return replay(state,key,`${p}:activate`,()=>({ok:true,panel:activatePanel(state,user[1]),server_now_utc:now}));
   if((suffix==='vip'||suffix==='vip/check')&&!read){target.is_vip=b.is_vip??b.enabled??!target.is_vip;return {ok:true,user:userRow(target),is_vip:target.is_vip};}
   if(suffix==='wallet/reset'&&!read){target.wallets=[];return {ok:true};}
  }
  if(p==='/admin/users/vip/check-all'&&!read)return {ok:true,checked:Object.keys(state.accounts).length,changed:0};
  if(p==='/admin/panels'&&read){const rows=Object.values(state.accounts).flatMap(panelRows).filter(r=>(!q.get('global_id')||r.global_id===q.get('global_id'))&&(q.get('contour')==='dead'?r.meta?.protectively_voided:!r.meta?.protectively_voided));return {ok:true,...pageRows(rows,q)};}
  const panel=/^\/admin\/panels\/(\d+)(?:\/(activate|deactivate))?$/.exec(p);
  if(panel){const found=Object.values(state.accounts).flatMap(x=>ensurePanels(x)).find(x=>x.id===panel[1]);requireDemo(found,'PANEL_NOT_FOUND',404);
   if(!panel[2]&&read)return {...found,remaining_seconds:Math.max(0,Math.floor((Date.parse(found.expires_at)-Date.now())/1000))};
   if(panel[2]==='deactivate'&&!read)return replay(state,key,`${p}:${JSON.stringify(b)}`,()=>protectivelyVoid(state,found,String(b.reason||'')));
   if(panel[2]==='activate'&&!read)return replay(state,key,`${p}:${JSON.stringify(b)}`,()=>{requireDemo(found.meta?.protectively_voided,'PANEL_NOT_DEAD',409);const created=activatePanel(state,found.global_id);return {ok:true,item:created};});
  }
  if(p==='/admin/withdrawals'&&read)return Object.values(state.accounts).flatMap(x=>x.withdrawals).filter(r=>(!q.get('global_id')||r.global_id===q.get('global_id'))&&(!q.get('status_filter')||q.get('status_filter')==='all'||String(r.status).toUpperCase()===q.get('status_filter')!.toUpperCase())).map(outputWithdrawal);
  const adminWd=/^\/admin\/withdrawals\/(\d+)\/(.*)$/.exec(p);
  if(adminWd){const owner=Object.values(state.accounts).find(x=>x.withdrawals.some(r=>String(r.id)===adminWd[1]));requireDemo(owner,'WITHDRAW_NOT_FOUND',404);const row=rowById(owner.withdrawals,adminWd[1]),action=adminWd[2];
   if(action==='outcome-preview'&&read)return {ok:true,request_id:String(row.id),global_id:owner.global_id,outcome_kind:row.status,locale:'ru',comment:{text:'Демонстрационная выплата: реального перевода нет.',source:'demo',locale:'ru'},promo:null,top_zone_enabled:false,metadata:{demo:true}};
   if(action==='payout-reservation'&&read)return {ok:true,result:{ok:true,status:row.status,reserved:false,safe_to_send:false,recovered:false,request_id:String(row.id)}};
   if(['approve','mark-paid','reject'].includes(action)&&!read)return replay(state,key,`${p}:${JSON.stringify(b)}`,()=>{
    requireDemo(row.status==='pending','WITHDRAW_ALREADY_FINAL',409);
    if(action==='reject'){requireDemo(String(b.reason||'').trim(),'REASON_REQUIRED');transfer(state,owner.global_id,d8(String(row.amount)),'credit','main','withdraw_refund');row.refund_done=true;row.status='rejected';}
    else row.status='paid';row.processed_at=now;row.updated_at=now;row.demo=true;return {ok:true,result:outputWithdrawal(row)};});
   if(action==='payout-reserve'&&!read)return {ok:true,result:{ok:true,status:'DEMO_ONLY',reserved:false,safe_to_send:false,recovered:false,request_id:String(row.id)}};
  }
  if(p==='/admin/withdrawals/repair-consistency'&&!read){let fixed=0;for(const x of Object.values(state.accounts))for(const row of x.withdrawals){if(['rejected','cancelled'].includes(String(row.status))&&!row.refund_done){transfer(state,x.global_id,d8(String(row.amount)),'credit','main','withdraw_refund');row.refund_done=true;fixed++;}}return {ok:true,auto_fixed_hold:0,auto_fixed_refund:fixed};}
  if(p==='/admin/bonuses'&&read)return {ok:true,...pageRows(Object.values(state.accounts).flatMap(x=>x.ledger).filter(r=>r.balance_type==='bonus'),q,50)};
  if(p==='/admin/logs/transfers'&&read)return {ok:true,...pageRows(s.audit.filter(r=>!q.get('global_id')||r.global_id===q.get('global_id')),q,50)};
  if(p==='/admin/bank/transfers/'+p.split('/')[4]+'/rollback'&&!read){const row=rowById(s.audit,p.split('/')[4]);return replay(state,key,`${p}:rollback`,()=>{requireDemo(!row.rolled_back,'ALREADY_ROLLED_BACK',409);const next=transfer(state,String(row.global_id),d8(String(row.amount_efhc)),row.direction==='credit'?'debit':'credit',row.balance_type==='bonus'?'bonus':'main','rollback');row.rolled_back=true;return {ok:true,result:next};});}
  if(p==='/admin/tasks/refresh-statuses'&&!read)return {ok:true,updated:0};
  if(p==='/shopfront/catalog'&&read)return {items:s.items.filter(r=>r.is_active&&r.status!=='hidden')};
  if(p==='/admin/shop/items'&&read)return s.items;
  if(p==='/admin/shop/auto-reply'&&read)return {text:String(s.settings.shop_auto_reply||'')};
  if(p==='/admin/shop/auto-reply'&&!read){s.settings.shop_auto_reply=String(b.text||'');return {ok:true};}
  if(p==='/admin/shop/items/upsert'&&!read){
   requireDemo(String(b.code||'').trim()&&String(b.title||'').trim(),'ITEM_CODE_AND_TITLE_REQUIRED');
   for(const k of ['price_ton','price_usdt'])if(b[k])requireDemo(/^\d+(?:\.\d{1,2})?$/.test(String(b[k])),'EXTERNAL_PRICE_MAX_2_DECIMALS');
   if(b.price_efhc)amount(b.price_efhc);
   let row=s.items.find(r=>r.code===b.code);if(!row){row={id:String(++state.next_id),sku:b.code,is_active:true,active:true,status:'live',sort_order:s.items.length*10};s.items.push(row);}
   Object.assign(row,b);row.sku=row.code;row.quantity_efhc=row.quantity_efhc||row.efhc_amount_d8||null;
   row.methods={TON:{price:row.price_ton||''},USDT:{price:row.price_usdt||''},...(row.price_efhc?{EFHC:{price:row.price_efhc}}:{})};
   row.ton_enabled=Boolean(row.price_ton&&Number(row.price_ton)>0);row.usdt_enabled=Boolean(row.price_usdt&&Number(row.price_usdt)>0);return {ok:true,item:row};
  }
  if(['/admin/shop/items/status','/admin/shop/items/set-price','/admin/shop/items/delete'].includes(p)&&!read){
   const row=s.items.find(r=>r.code===b.code||String(r.id)===String(b.item_id||b.id));requireDemo(row,'ITEM_NOT_FOUND',404);
   if(p.endsWith('/delete')){s.items.splice(s.items.indexOf(row),1);return {ok:true};}
   Object.assign(row,b);if(b.status)row.is_active=!['hidden','archived','disabled'].includes(b.status);if(b.is_active!==undefined)row.active=row.is_active=b.is_active;
   return {ok:true,item:row};
  }
  if(p==='/admin/shop/orders/status-counters'&&read){const out:DemoRow={ok:true,total:s.orders.length,counters:{}};for(const row of s.orders){out.counters[row.status]=(out.counters[row.status]||0)+1;out[row.status]=(out[row.status]||0)+1;}return out;}
  if(p==='/admin/shop/orders'&&read)return {ok:true,...pageRows(s.orders.filter(r=>(!q.get('global_id')||r.global_id===q.get('global_id'))&&(!q.get('status')||q.get('status')==='all'||r.status===q.get('status'))),q)};
  const userOrders=/^\/admin\/shop\/orders\/user\/(\d{10})$/.exec(p);if(userOrders&&read)return s.orders.filter(r=>r.global_id===userOrders[1]);
  const order=/^\/admin\/shop\/(?:order|orders)\/(\d+)(?:\/(force-fulfill))?$/.exec(p);
  if(order){const row=rowById(s.orders,order[1]);if(read)return row;if(order[2])return replay(state,key,`${p}:fulfil`,()=>({ok:true,order:fulfilOrder(state,row)}));}
  if(p==='/admin/shop/nft-requests'&&read)return {ok:true,...pageRows(s.orders.filter(r=>String(r.item_type||r.purpose).includes('VIP')),q)};
  const nft=/^\/admin\/shop\/nft-requests\/(\d+)\/decision$/.exec(p);
  if(nft&&!read)return replay(state,key,`${p}:${JSON.stringify(b)}`,()=>{const row=rowById(s.orders,nft[1]);requireDemo(!row.demo_decided,'NFT_REQUEST_ALREADY_FINAL',409);
   requireDemo(String(b.reason||b.comment||'').trim(),'REASON_REQUIRED');row.demo_decided=true;
   if(['approve','grant','issued','approved'].includes(String(b.decision||b.action)))fulfilOrder(state,row);else row.status='REJECTED';return {ok:true,order:row};});
  if(p==='/shopfront/create-intent'&&method==='POST')return replay(state,key||b.client_nonce,`${a.global_id}:${p}:${JSON.stringify(b)}`,()=>{
   const item=s.items.find(r=>r.sku===b.sku||r.code===b.sku);requireDemo(item?.is_active,'ITEM_NOT_FOUND',404);
   const pay=String(b.pay_method||'TON').toUpperCase();requireDemo(['TON','USDT','EFHC'].includes(pay),'PAYMENT_METHOD_INVALID');
   const price=String(item.methods?.[pay]?.price||'0');requireDemo(d8(price)>0n,'PAYMENT_METHOD_DISABLED',409);
   const quantity=Number(b.quantity||1);requireDemo(Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=1000,'QUANTITY_INVALID');
   const credits=b.custom_efhc_amount_d8||item.quantity_efhc||'100';amount(credits);
   const row={id:String(++state.next_id),global_id:a.global_id,sku:item.sku,item_type:item.item_type,purpose:item.item_type,asset:pay,
    amount_asset_d8:formatD8(d8(price)*BigInt(quantity)),efhc_amount_d8:formatD8(d8(credits)*BigInt(quantity)),quantity_efhc:formatD8(d8(credits)*BigInt(quantity)),
    status:'PENDING',created_at:now,expires_at:new Date(Date.now()+900000).toISOString(),payload:`DEMO:${a.global_id}`,to_address:'DEMO_NO_EXTERNAL_TRANSFER',
    external_decimals:pay==='TON'?9:pay==='USDT'?6:8,external_amount_display:price,external_amount_atomic:'0',usdt_checkout_mode:'simulation',demo:true};
   s.intents.unshift(row);s.orders.unshift({...row,order_status:row.status});
   return {global_id:a.global_id,intent_id:row.id,order_id:row.id,item_type:row.item_type,pay_method:pay,amount:row.amount_asset_d8,
    external_amount_atomic:row.external_amount_atomic,external_decimals:row.external_decimals,external_amount_display:row.external_amount_display,
    memo:row.payload,to_wallet:row.to_address,tonconnect_tx:null,usdt_checkout_mode:'simulation',expires_at:row.expires_at};
  });
  if(p==='/shopfront/intent-status'&&read){const row=rowById(s.intents,String(q.get('intent_id')));requireDemo(row.global_id===a.global_id,'INTENT_OWNER_MISMATCH',403);
   const age=Date.now()-Date.parse(row.created_at);if(age>=10000&&!row.demo_fulfilled){fulfilOrder(state,row);row.status='PAID';Object.assign(rowById(s.orders,String(row.id)),row);}else if(age>=3000&&row.status==='PENDING')row.status='CONFIRMING';
   return row;
  }
  if(p==='/shop/purchase-efhc'&&!read)return replay(state,key,`${a.global_id}:${p}:${JSON.stringify(b)}`,()=>{
   const value=amount(b.amount_efhc||b.amount||'100');transfer(state,a.global_id,value,'credit','main','shop_package');return {ok:true,main_balance:a.main_balance,amount_efhc:formatD8(value),mode:'demo'};});
  if(p==='/deposit/direct-open'&&method==='POST')return {purpose:'direct_efhc_jetton_deposit',asset:'EFHC',receiver_owner_address:'DEMO_NO_EXTERNAL_TRANSFER',jetton_master_address:'DEMO_NO_EXTERNAL_TRANSFER',jetton_decimals:8,forward_payload_text:`EFHC:GID:${a.global_id}`,fee_message_ton_amount:'0.00000000',forward_ton_amount:'0.00000000',memo_binding:'global_id',mode:'demo'};
  // CRUD families use persisted rows shared with their USER-facing readers.
  const crud=/^\/admin\/(hub\/(?:support-links|links)|sale-packages|tasks|templates)(?:\/([^/]+))?(?:\/(toggle|reorder|subs))?$/.exec(p);
  if(crud){const family=crud[1],id=crud[2],op=crud[3],rows=family==='hub/links'?s.hub:family==='hub/support-links'?s.support:family==='sale-packages'?s.packages:family==='tasks'?s.tasks:s.templates;
   if(!id&&read)return family==='tasks'||family==='sale-packages'?{items:rows,next_cursor:null}:rows;
   if(id==='reorder'&&!read){const ids=b.ids||b.order||[];ids.forEach((id:unknown,i:number)=>{const row=rows.find(r=>String(r.id)===String(id));if(row)row.sort_order=i*10;});rows.sort((x,y)=>Number(x.sort_order||0)-Number(y.sort_order||0));return {ok:true,items:rows};}
   if(id&&read){const row=rows.find(r=>String(r.id)===id||r.key===id);requireDemo(row,'NOT_FOUND',404);return op==='subs'?{items:s.submissions.filter(x=>String(x.task_id)===id),next_cursor:null}:row;}
   if(method==='POST'&&!id){const row={...b,id:String(++state.next_id),is_active:b.is_active??true,created_at:now,updated_at:now};requireDemo(String(b.title||b.key||'').trim(),'TITLE_REQUIRED');rows.push(row);return row;}
   if(id){const row=rows.find(r=>String(r.id)===id||r.key===id);requireDemo(row,'NOT_FOUND',404);if(op==='toggle'){row.is_active=!row.is_active;return row;}if(method==='DELETE'){rows.splice(rows.indexOf(row),1);return {ok:true};}if(['PUT','PATCH','POST'].includes(method)){Object.assign(row,b,{updated_at:now});return row;}}
  }
  if(p==='/admin/ads/providers'&&read)return s.providers;
  const provider=/^\/admin\/ads\/providers\/([^/]+)(?:\/(.*))?$/.exec(p);
  if(provider){const row=s.providers.find(r=>r.code===provider[1]);requireDemo(row,'PROVIDER_NOT_FOUND',404);const op=provider[2];
   if(read)return row;if(op==='test')return {ok:true,mode:'demo',provider:row.code,detail:'Демонстрационная проверка завершена. Внешний сервис не вызывался.'};
   if(op?.startsWith('secrets/')){row.secret_masks=op.endsWith('/delete')?{}:Object.fromEntries(Object.keys(b.secrets||b).map(k=>[k,'••••••••']));return {ok:true,provider:row};}
   if(op==='reset-errors'){row.last_error_code=null;row.health='ok';return {ok:true};}Object.assign(row,b);return row;
  }
  if(p==='/admin/ads/dashboard'&&read)return {period:q.get('period')||'30d',overall:{ad_requests:0,impressions:0,completed_rewarded_views:0,rewarded_users:0,provider_no_fill:0,errors:0,fallback:0,efhcb_distributed:zero,estimated_revenue_usd:zero,confirmed_revenue_usd:zero,revenue_per_1000_requests_usd:zero,revenue_per_completed_ad_usd:zero},providers:s.providers,geo:[],languages:[],tasks:s.tasks,timeline:[]};
  if(p.startsWith('/admin/ads/revenue-optimizer'))return {metric:'completed_rewarded_views',min_requests:20,recommended_order:s.providers.map(r=>r.code),ranked:[],insufficient_data:s.providers,auto_apply_enabled:false};
  if(p==='/admin/tasks/refresh-statuses'&&!read)return {ok:true,updated:0};
  const moderate=/^\/admin\/tasks\/submissions\/(\d+)\/moderate$/.exec(p);
  if(moderate&&!read){const row=rowById(s.submissions,moderate[1]);requireDemo(row.status==='pending','SUBMISSION_ALREADY_FINAL',409);row.status=b.approved||b.status==='approved'?'approved':'rejected';return {ok:true,item:row};}
  if(p==='/admin/referrals/summary'&&read)return {items:Object.values(state.accounts).map(x=>({inviter_global_id:x.global_id,active_count:x.global_id===DEMO_GLOBAL_ID?17:0,inactive_count:x.global_id===DEMO_GLOBAL_ID?7:0,total_bonus_efhc:x.global_id===DEMO_GLOBAL_ID?'2.70000000':zero,last_invited_at:null})),next_cursor:null};
  if(p==='/admin/referrals/logs'&&read)return {items:[],next_cursor:null};
  if(p.startsWith('/admin/observability/'))return {ok:true,mode:'demo',backend:{ok:true,mode:'simulation'},db:{ok:true,mode:'browser'},watcher:{ok:false,status:'simulation'},items:s.audit,events:s.audit,series:[],points:[],counts:{operations:s.audit.length},summary:{operations:s.audit.length}};
  if(p==='/admin/ton/reconcile'&&!read)return {ok:true,mode:'demo',checked:s.deposits.length,credited:0,external_requests:0};
  if(p==='/admin/efhc-deposits/runtime-summary'&&read)return {ok:true,credited_efhc_operations_count:s.deposits.length,credited_efhc_total:totals(s.deposits,'amount_efhc'),credited_efhc_30d:totals(s.deposits,'amount_efhc'),credited_efhc_24h:totals(s.deposits,'amount_efhc'),generated_at:now};
  if((p==='/admin/efhc-deposits/inbox'||p==='/admin/efhc-deposits/unmatched')&&read)return {ok:true,...pageRows(s.deposits,q)};
  if(p.startsWith('/admin/efhc-deposits/')&&!read)return {ok:true,processed:s.deposits.length,credited:0,external_requests:0,mode:'demo'};
  return undefined;
 };
 return transactDemoState(state=>{
  if(!read&&p.startsWith('/admin/')&&key){
   requireDemo(state.role==='admin'||state.role==='superadmin','DEMO_ADMIN_ROLE_REQUIRED',403);
   return replay(state,`admin-transport:${key}`,`${method}:${p}:${JSON.stringify(b)}`,()=>run(state));
  }
  return run(state);
 });
}
