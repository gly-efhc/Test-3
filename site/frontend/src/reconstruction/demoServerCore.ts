import canonical from './demo-tables-v866.json';
import seed from './demo-admin-seed-v866.json';
import {d8,formatD8,DEMO_GLOBAL_ID,seedAccount,type DemoControlState,type DemoAccountState} from './demoUnifiedStore';
import type {DemoPanel,DemoRow,DemoServerState} from './demoServerModel';
import {buildCatalog} from './demoShopCatalog';

export const BASE_RATE='0.00000692',VIP_RATE='0.00000741';
export class DemoOperationError extends Error {
 constructor(public status:number,public code:string){super(code);}
}
export function requireDemo(value:unknown,code:string,status=400):asserts value {
 if(!value)throw new DemoOperationError(status,code);
}
export function amount(value:unknown):bigint {
 try{const result=d8(String(value));requireDemo(result>0n,'AMOUNT_MUST_BE_POSITIVE');return result;}
 catch(e){if(e instanceof DemoOperationError)throw e;throw new DemoOperationError(400,'INVALID_D8_AMOUNT');}
}
export function account(state:DemoControlState,gid=state.selected_global_id):DemoAccountState {
 requireDemo(/^[0-9]{10}$/.test(gid),'GLOBAL_ID_EXACT_10_REQUIRED');
 if(state.accounts[gid])return state.accounts[gid];
 const value=seedAccount(gid);state.accounts[gid]=value;
 if(state.server)state.server.bank_balance=formatD8(d8(state.server.bank_balance)-d8(value.main_balance)-d8(value.bonus_balance));
 return value;
}
export function ensureServer(state:DemoControlState,now=Date.now()):DemoServerState {
 if(state.server)return state.server;
 const circulation=Object.values(state.accounts).reduce((n,a)=>n+d8(a.main_balance)+d8(a.bonus_balance),0n);
 state.server={version:1,started_at:new Date(now).toISOString(),as_of_utc:new Date(now).toISOString(),
  bank_balance:formatD8(d8(seed.supplyInitial)-circulation),supply_initial:seed.supplyInitial,
  minted:'0.00000000',burned:'0.00000000',audit:[],replays:{},
  tasks:structuredClone(seed.tasks),submissions:[],hub:structuredClone(seed.hubLinks),support:[],
  items:buildCatalog().map((r,i)=>({...r,id:String(7100+i),code:r.sku,is_active:true,active:true,price_ton:r.methods.TON?.price||'',price_usdt:r.methods.USDT?.price||'',price_efhc:(r.methods as Record<string,{price?:string}>).EFHC?.price||'',pay_currencies:Object.keys(r.methods)})),orders:structuredClone(seed.shopOrders),packages:structuredClone(seed.salePackages),deposits:[],
  providers:['builtin','adsgram','monetag','richads','tads','mybid'].map((code,i)=>({code,title:code==='builtin'?'Встроенный просмотр':code,
   enabled:code==='builtin',is_active:code==='builtin',priority:i+1,miniapp_enabled:true,bot_enabled:false,rewarded_enabled:true,
   is_configured:true,configuration_status:'configured',verification_level:'demo',verification_mode:'simulation',health:'ok',
   public_config:{},secret_masks:{},countries_allow:[],countries_block:[],languages_allow:[],languages_block:[],
   capabilities:['rewarded'],config_schema:[],contract_status:'demo',source:'demo'})),
  templates:[],settings:{scheduler_enabled:true},intents:[]};
 return state.server;
}
export function ensurePanels(a:DemoAccountState,now=Date.now()):DemoPanel[] {
 if(a.panels)return a.panels;
 const day=86400000,lifetime=180*day;
 a.panels=(['active','archive'] as const).flatMap(tab=>canonical.panels[tab].map((row,index)=>{
  const end=tab==='active'?now-(index+1)*day+lifetime:now-(index+1)*day;
  return {...row,id:String(row.id),public_id:row.public_id||`PNL-${String(row.id).padStart(9,'0')}`,
   global_id:a.global_id,activated_at:new Date(end-lifetime).toISOString(),created_at:new Date(end-lifetime).toISOString(),
   expires_at:new Date(end).toISOString(),archived_at:tab==='archive'?new Date(end).toISOString():null,
   last_generated_at:new Date(now).toISOString(),is_active:tab==='active',is_archived:tab==='archive',remainder:'0'};
 }));
 // Preserve already purchased panels from earlier DEMO revisions.
 for(let i=0;i<a.activated_panels;i++)a.panels.push(newPanel(a,now,String(500000+i)));
 return a.panels;
}
export function newPanel(a:DemoAccountState,now:number,id:string):DemoPanel {
 const iso=new Date(now).toISOString();return {id,public_id:`PNL-${id.padStart(9,'0')}`,global_id:a.global_id,
  activated_at:iso,created_at:iso,expires_at:new Date(now+180*86400000).toISOString(),archived_at:null,
  last_generated_at:iso,base_gen_per_sec:BASE_RATE,generated_kwh:'0.00000000',is_active:true,is_archived:false,remainder:'0'};
}
export function settleGeneration(state:DemoControlState,now=Date.now()):void {
 ensureServer(state,now).as_of_utc=new Date(now).toISOString();
 for(const a of Object.values(state.accounts)){
  const panels=ensurePanels(a,now);let delta=0n;
  for(const p of panels){
   if(!p.is_active||p.meta?.protectively_voided)continue;
   const end=Math.min(now,Date.parse(p.expires_at)),elapsed=Math.max(0,Math.floor(end-Date.parse(p.last_generated_at)));
   if(elapsed>0){const numerator=d8(a.is_vip===false?BASE_RATE:VIP_RATE)*BigInt(elapsed)+BigInt(p.remainder||'0');
    const add=numerator/1000n;p.remainder=String(numerator%1000n);p.generated_kwh=formatD8(d8(p.generated_kwh)+add);
    p.last_generated_at=new Date(end).toISOString();delta+=add;}
   if(now>=Date.parse(p.expires_at)){p.is_active=false;p.is_archived=true;p.archived_at=p.expires_at;}
  }
  a.total_generated_kwh=formatD8(d8(a.total_generated_kwh)+delta);a.available_kwh=formatD8(d8(a.available_kwh)+delta);
 }
}
export function transfer(state:DemoControlState,gid:string,value:bigint,direction:'credit'|'debit',balance:'main'|'bonus',reason:string):DemoRow {
 requireDemo(value>0n,'AMOUNT_MUST_BE_POSITIVE');const a=account(state,gid),s=ensureServer(state);
 const key=balance==='main'?'main_balance':'bonus_balance',before=d8(a[key]);
 const next=direction==='credit'?before+value:before-value;requireDemo(next>=0n,'INSUFFICIENT_BALANCE',409);
 a[key]=formatD8(next);s.bank_balance=formatD8(d8(s.bank_balance)+(direction==='credit'?-value:value));
 const row={id:++state.next_id,global_id:gid,amount_efhc:formatD8(value),direction,balance_type:balance,reason,created_at:new Date().toISOString()};
 a.ledger.unshift(row);s.audit.unshift({...row,bank_balance_after:s.bank_balance});return row;
}
export function replay<T>(state:DemoControlState,key:string|undefined,fingerprint:string,run:()=>T):T {
 requireDemo(key&&key.length>=1,'IDEMPOTENCY_KEY_REQUIRED');key=`${state.selected_global_id}:${key}`;const s=ensureServer(state),old=s.replays[key];
 if(old){requireDemo(old.fingerprint===fingerprint,'IDEMPOTENCY_KEY_CONFLICT',409);return structuredClone(old.response) as T;}
 const result=run();s.replays[key]={fingerprint,response:structuredClone(result)};return result;
}
export function activatePanel(state:DemoControlState,gid:string,now=Date.now()):DemoPanel {
 const a=account(state,gid),panels=ensurePanels(a,now);requireDemo(panels.filter(p=>p.is_active).length<1000,'PANEL_LIMIT',409);
 const price=d8('100'),bonus=d8(a.bonus_balance),bonusPay=bonus>price?price:bonus;
 requireDemo(bonus+d8(a.main_balance)>=price,'PANEL_INSUFFICIENT_BALANCE',409);
 if(bonusPay)transfer(state,gid,bonusPay,'debit','bonus','panel_purchase');
 if(price-bonusPay)transfer(state,gid,price-bonusPay,'debit','main','panel_purchase');
 const p=newPanel(a,now,String(++state.next_id));p.cost_bonus=formatD8(bonusPay);p.cost_main=formatD8(price-bonusPay);
 panels.push(p);a.activated_panels++;return p;
}
export function pageRows<T>(rows:T[],q:URLSearchParams,defaultLimit=20){
 const cursor=q.get('cursor'),offset=cursor===null?0:Number(cursor),limit=Math.min(1000,Math.max(1,Number(q.get('limit')||defaultLimit)));
 requireDemo(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit),'BAD_CURSOR');
 return {items:rows.slice(offset,offset+limit),next_cursor:offset+limit<rows.length?String(offset+limit):null};
}
export function panelRows(a:DemoAccountState){return ensurePanels(a).map(p=>({...p,
 remaining_seconds:Math.max(0,Math.floor((Date.parse(p.expires_at)-Date.now())/1000)),state:p.meta?.protectively_voided?'dead':p.is_active?'active':'archive'}));}
export function userRow(a:DemoAccountState){return {global_id:a.global_id,username:a.username||(a.global_id===DEMO_GLOBAL_ID?'efhc_player':`demo_${a.global_id}`),
 is_vip:a.is_vip!==false,is_active:a.is_active!==false,main_balance:a.main_balance,bonus_balance:a.bonus_balance,
 available_kwh:a.available_kwh,total_generated_kwh:a.total_generated_kwh,active_panels_count:ensurePanels(a).filter(p=>p.is_active&&!p.meta?.protectively_voided).length,
 ton_wallet:a.wallets.find(w=>w.is_primary)?.wallet_address||null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};}
