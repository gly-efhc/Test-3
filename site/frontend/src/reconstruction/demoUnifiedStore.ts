/** Public Pages ONLY: persistent sample accounting, NEVER an authenticated wallet or ledger.
 * Derived from frozen FRONTEND_v866.html, STANDALONE_GLOBAL_ID and standaloneAdminSeed.
 * The state is indexed by simulated Global ID, not Telegram provider ID.
 */
import frozen from "./demo-tables-v866.json";
import admin from "./demo-admin-seed-v866.json";

export const DEMO_GLOBAL_ID = "0000657667";
export const DEMO_DB_NAME = "EFHC_REACT_DEMO_CANON_V866";
export const DEMO_SCHEMA_VERSION = 2;
export const DEMO_STORAGE_KEY = "efhc:react:unified-demo:v893";
export const DEMO_SCENARIOS = ["filled", "empty", "loading", "error", "no_wallet"] as const;
export type DemoScenario = typeof DEMO_SCENARIOS[number];
export type DemoRole = "user" | "admin" | "superadmin";
export const DEMO_TABLE_NAMES = [
  "accounts", "provider_identities", "sessions", "balances", "wallet_links",
  "panels", "ranks", "task_catalog", "task_completions", "ad_reward_sessions",
  "referrals", "referral_bonuses", "ledger_entries", "balance_history",
  "exchanges", "withdrawals", "withdraw_outcomes", "deposits", "shop_items",
  "shop_orders", "shop_intents", "vip_reservations", "hub_links", "skins",
  "admin_users", "admin_roles", "admin_permissions", "admin_audit", "admin_logs",
  "task_submissions", "ad_providers", "notifications", "diagnostics", "settings",
  "avatars", "faq", "generation_ticks", "supply_events", "bank_transfers",
] as const;
export type DemoTableName = typeof DEMO_TABLE_NAMES[number];
type DemoWallet = {id:number; global_id:string; wallet_address:string; wallet_app:string; is_primary:boolean; is_active:boolean; proof_verified:boolean; created_at:string};
type DemoLedger = {id:number; global_id:string; amount_efhc:string; direction:"credit"|"debit"; balance_type:"main"|"bonus"; reason:string; created_at:string};
export type DemoAccountState = {
  global_id: string; main_balance:string; bonus_balance:string; available_kwh:string;
  total_generated_kwh:string; completed_tasks:string[]; ad_views:number; ad_date_utc:string;
  wallets:DemoWallet[]; ledger:DemoLedger[]; withdrawals:Record<string,unknown>[];
  exchanges:Record<string,unknown>[]; activated_panels:number;
};
export type DemoControlState = {
  schema_version:number; selected_global_id:string; scenario:DemoScenario;
  role:DemoRole; accounts:Record<string,DemoAccountState>; next_id:number;
};

/** Explicit and independent of authentication; production builds can never turn this on through UI or storage. */
export function isDemoPreviewEnabled():boolean {
  return typeof window !== "undefined"
    && process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1"
    && process.env.NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF === "1"
    && (window as Window & { __EFHC_DEMO_READ_ONLY__?:boolean }).__EFHC_DEMO_READ_ONLY__ === true;
}
const zero="0.00000000";
export function d8(value: string | number):bigint {
  const text=String(value).trim().replace(",", ".");
  if(!/^-?\d+(?:\.\d{1,8})?$/.test(text))throw new Error("DEMO_INVALID_D8");
  const neg=text.startsWith("-");const [whole,part=""]=(neg?text.slice(1):text).split(".");
  const atomic=BigInt(whole)*100000000n+BigInt(part.padEnd(8,"0"));return neg?-atomic:atomic;
}
export function formatD8(value:bigint):string {
  const negative=value<0n;const positive=negative?-value:value;
  return `${negative?"-":""}${positive/100000000n}.${String(positive%100000000n).padStart(8,"0")}`;
}
function seedAccount(globalId=DEMO_GLOBAL_ID):DemoAccountState {
  const isPrimary=globalId===DEMO_GLOBAL_ID;
  const known=globalId.match(/^8000000(\d{3})$/);
  const index=known?Number(known[1])-1:0;
  const wallets:DemoWallet[]=isPrimary?[
    {id:1,global_id:globalId,wallet_address:"UQB2PRIMARY9K7M000000000000000000000000000000000",wallet_app:"tonkeeper",is_primary:true,is_active:true,proof_verified:true,created_at:"2026-10-29T12:00:00Z"},
    {id:2,global_id:globalId,wallet_address:"UQMYTONWALLET2EFHC000000000000000000000000000000",wallet_app:"mytonwallet",is_primary:false,is_active:true,proof_verified:true,created_at:"2026-10-29T12:00:00Z"},
    {id:3,global_id:globalId,wallet_address:"UQTONSPACE3EFHC00000000000000000000000000000000",wallet_app:"telegram-wallet",is_primary:false,is_active:true,proof_verified:true,created_at:"2026-10-29T12:00:00Z"},
  ]:[];
  return {
    global_id:globalId,main_balance:isPrimary?"12345.00000000":formatD8(d8(String(1200+(index%113)*17.125))),
    bonus_balance:isPrimary?frozen.tasks.bonus_balance_d8:formatD8(d8(String(25+(index%47)*1.75))),
    available_kwh:isPrimary?"421.12500000":zero,total_generated_kwh:isPrimary?frozen.ranks.me.total_generated_kwh:formatD8(d8(String(5000+index*19.375))),
    completed_tasks:[],ad_views:0,ad_date_utc:new Date().toISOString().slice(0,10),
    wallets,ledger:[],withdrawals:[],exchanges:[],activated_panels:0,
  };
}
export function seedDemoState():DemoControlState {
 return {schema_version:DEMO_SCHEMA_VERSION,selected_global_id:DEMO_GLOBAL_ID,
   scenario:"filled",role:"user",accounts:{[DEMO_GLOBAL_ID]:seedAccount()},next_id:200000};
}
let cache:DemoControlState|null=null;
const callbacks=new Set<()=>void>();
function emit():void {callbacks.forEach(cb=>cb());if(typeof window!=="undefined")window.dispatchEvent(new Event("efhc:demo:state-changed"));}
export function subscribeDemoState(listener:()=>void):()=>void {callbacks.add(listener);return ()=>callbacks.delete(listener);}
export function readDemoState():DemoControlState {
 if(cache)return cache;
 if(typeof window==="undefined")return seedDemoState();
 try {
  const stored=JSON.parse(window.localStorage.getItem(DEMO_STORAGE_KEY)||"null") as DemoControlState|null;
  if(stored&&stored.schema_version===DEMO_SCHEMA_VERSION&&/^\d{10}$/.test(stored.selected_global_id)&&DEMO_SCENARIOS.includes(stored.scenario)){
    cache=stored;return cache;
  }
 }catch{ /* fallback to canon */ }
 cache=seedDemoState();return cache;
}
function save(state:DemoControlState):void {
 cache=state;
 if(typeof window!=="undefined"){
  try{window.localStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify(state));}catch{/* browser quota: keep in-memory state */}
 }
 emit();
}
export function readDemoAccount():DemoAccountState {
 const s=readDemoState();return s.accounts[s.selected_global_id]||seedAccount(s.selected_global_id);
}
export function writeDemoAccount(mutator:(a:DemoAccountState)=>DemoAccountState):DemoAccountState {
 const s=readDemoState();const current=readDemoAccount();const next=mutator(current);
 if(next.global_id!==s.selected_global_id)throw new Error("DEMO_OWNER_MISMATCH");
 save({...s,accounts:{...s.accounts,[s.selected_global_id]:next}});return next;
}
export function selectDemoGlobalId(value:string):void {
 if(!/^\d{10}$/.test(value))throw new Error("GLOBAL_ID_EXACT_10_REQUIRED");
 const state=readDemoState();save({...state,selected_global_id:value,accounts:{...state.accounts,[value]:state.accounts[value]||seedAccount(value)}});
}
export function setDemoScenario(scenario:DemoScenario):void {
 if(!DEMO_SCENARIOS.includes(scenario))throw new Error("DEMO_SCENARIO_UNKNOWN");save({...readDemoState(),scenario});
}
export function setDemoRole(role:DemoRole):void {
 if(!["user","admin","superadmin"].includes(role))throw new Error("DEMO_ROLE_UNKNOWN");
 // This role is only for UI demonstration. AuthSession / backend RBAC never trusts it.
 save({...readDemoState(),role});
}
export function resetDemoDatabase():void {save(seedDemoState());}
export function nextDemoId():number {const s=readDemoState();const id=s.next_id+1;save({...s,next_id:id});return id;}
export function demoLedgerMutation(amount:string,kind:"credit"|"debit",balance:"main"|"bonus",reason:string):DemoAccountState {
 const delta=d8(amount);if(delta<=0n)throw new Error("DEMO_AMOUNT_NOT_POSITIVE");
 const id=nextDemoId();const timestamp=new Date().toISOString();
 return writeDemoAccount(current=>{
  const key=balance==="main"?"main_balance":"bonus_balance";
  const before=d8(current[key]),after=kind==="credit"?before+delta:before-delta;
  if(after<0n)throw new Error("DEMO_INSUFFICIENT_BALANCE");
  return {...current,[key]:formatD8(after),ledger:[{id,global_id:current.global_id,amount_efhc:formatD8(delta),direction:kind,balance_type:balance,reason,created_at:timestamp},...current.ledger]};
 });
}
/** The user asked for every frozen table. These are the actual canonical table names of
 * the browser simulation; all are created in IndexedDB even when canon initially has zero rows.
 * Admin QA 1000-user tables are loaded lazily from the EXACT frozen generator output.
 */
/** Keep the selected public DEMO identity coherent between local demo state
 * and the materialized IndexedDB sample. This is never a production ledger.
 * Do not mark initial seeding complete if the transaction fails.
 */
async function mirrorSelectedDemoAccount(db:IDBDatabase,state:DemoControlState):Promise<void>{
 const globalId=state.selected_global_id;
 if(!/^\d{10}$/.test(globalId))throw new Error("DEMO_GLOBAL_ID_INVALID");
 const account=state.accounts[globalId]||seedAccount(globalId);
 if(account.global_id!==globalId)throw new Error("DEMO_OWNER_MISMATCH");
 await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(["accounts","balances","wallet_links"],"readwrite");
  tx.objectStore("accounts").put({...account,id:globalId,global_id:globalId});
  tx.objectStore("balances").put({id:globalId,global_id:globalId,
    main_balance:account.main_balance,bonus_balance:account.bonus_balance,
    available_kwh:account.available_kwh,total_generated_kwh:account.total_generated_kwh});
  for(const wallet of account.wallets){
   tx.objectStore("wallet_links").put({...wallet,id:`${globalId}:${wallet.id}`});
  }
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error("DEMO_MIRROR_FAILED"));
  tx.onabort=()=>reject(tx.error||new Error("DEMO_MIRROR_ABORTED"));
 });
}

export async function bootstrapDemoIndexedDb():Promise<void>{
 if(!isDemoPreviewEnabled()||typeof indexedDB==="undefined")return;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(DEMO_DB_NAME,DEMO_SCHEMA_VERSION);
  request.onupgradeneeded=()=>{
   const instance=request.result;
   for(const name of DEMO_TABLE_NAMES){
     const object=instance.objectStoreNames.contains(name)?request.transaction!.objectStore(name):instance.createObjectStore(name,{keyPath:"id"});
     if(!object.indexNames.contains("by_global_id"))object.createIndex("by_global_id","global_id",{unique:false});
   }
  };
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 try {
  const status=await new Promise<unknown>((resolve,reject)=>{
    const tx=db.transaction("settings","readonly"),r=tx.objectStore("settings").get("canon_seed_complete");
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  if(status)return;
  const pathname=window.location.pathname.replace(/\/[^/]*\/?$/, "/");
  // This is fetched only in public Pages; the 1000-user, 65k-row fixture is NOT in initial JS.
  const base=pathname.split("/").filter(Boolean)[0]==="Test-3"?"/Test-3":"";
  const result=await fetch(`${base}/demo/frozen-admin-1000-v866.json`,{credentials:"omit"});
  if(!result.ok)throw new Error(`DEMO_CANON_TABLES_HTTP_${result.status}`);
  const fixture=await result.json() as Record<string,unknown>;
  const account=readDemoAccount();
  const associations:Record<string,string>={users:"accounts",transactions:"ledger_entries",withdrawals:"withdrawals",deposits:"deposits",panels:"panels",shopOrders:"shop_orders",taskSubmissions:"task_submissions",referrals:"referrals",logs:"admin_logs"};
  const seededTables:Record<string,Record<string,unknown>[]>={};
  for(const [source,target] of Object.entries(associations)){
   const rows=fixture[source];if(!Array.isArray(rows))continue;
   seededTables[target]=rows.map((raw,index)=>{
     const row=raw as Record<string,unknown>;
     return {...row,id:row.id??((source==="users"||source==="referrals")?row.global_id:undefined)??`${source}_${index}`};
   });
  }
  const users=(fixture.users as Record<string,unknown>[]);
  seededTables.admin_users=users.map(row=>({...row,id:String(row.global_id)}));
  seededTables.balances=users.map(row=>({id:String(row.global_id),global_id:row.global_id,main_balance:row.main_balance,bonus_balance:row.bonus_balance,available_kwh:row.available_kwh}));
  seededTables.balance_history=seededTables.ledger_entries.map(row=>({...row,id:`balance:${row.id}`}));
  seededTables.wallet_links=users.filter(row=>typeof row.ton_wallet==="string"&&Boolean(row.ton_wallet)).map(row=>({id:`${row.global_id}:ton`,global_id:row.global_id,wallet_address:row.ton_wallet,wallet_app:"canonical-fixture",is_primary:true,is_active:true,proof_verified:false}));
  seededTables.task_completions=seededTables.task_submissions.filter(row=>["approved","completed","auto_paid"].includes(String(row.status))).map(row=>({...row,id:`task_completion:${row.id}`}));
  seededTables.withdraw_outcomes=seededTables.withdrawals.map(row=>({id:`withdraw_outcome:${row.id}`,global_id:row.global_id,request_id:row.id,status:row.status}));
  seededTables.vip_reservations=seededTables.shop_orders.filter(row=>/VIP/i.test(String(row.sku||row.item_type||""))).map(row=>({...row,id:`vip:${row.id}`}));
  for(const wallet of account.wallets)seededTables.wallet_links.push({...wallet,id:`${wallet.global_id}:${wallet.id}`});
  seededTables.task_catalog=frozen.tasks.catalog.map(row=>({...row,id:String(row.id)}));
  seededTables.ranks=frozen.ranks.users.map(row=>({...row,id:row.global_id}));
  seededTables.hub_links=(admin.hubLinks as Record<string,unknown>[]).map(row=>({...row,id:String(row.id)}));
  seededTables.shop_items=(admin.shopItems as Record<string,unknown>[]).map(row=>({...row,id:String(row.id)}));
  seededTables.provider_identities=(fixture.users as Record<string,unknown>[]).flatMap(row=>{
    const providers=(row.providers||{}) as Record<string,string>;
    return Object.entries(providers).map(([provider,subject])=>({id:`${provider}:${subject}`,global_id:row.global_id,provider,subject}));
  });
  for(const [name,rows]of Object.entries(seededTables)){
   // Bounded transactions keep Chromium responsive on low-memory Android devices.
   for(let offset=0;offset<rows.length;offset+=250){
    await new Promise<void>((resolve,reject)=>{
     const tx=db.transaction(name,"readwrite"),object=tx.objectStore(name);
     for(const row of rows.slice(offset,offset+250))object.put(row);
     tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
   }
  }
  await mirrorSelectedDemoAccount(db,readDemoState());
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction("settings","readwrite");
   tx.objectStore("settings").put({id:"canon_seed_complete",source_sha256:frozen.source_sha256,global_id:DEMO_GLOBAL_ID,rows:Object.fromEntries(Object.entries(seededTables).map(([name,rows])=>[name,rows.length]))});
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
 } finally {db.close();}
}
export async function demoTableCount(name:DemoTableName):Promise<number>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DEMO_DB_NAME,DEMO_SCHEMA_VERSION);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise<number>((resolve,reject)=>{const tx=db.transaction(name,"readonly"),r=tx.objectStore(name).count();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
}

/** Applies a canonical task reward exactly once to the selected DEMO Global ID. */
export function completeDemoTask(code:string):DemoAccountState {
 const known:Record<string,string>={demo_join_telegram:"0.10000000",demo_partner_webapp:"0.05000000",
   demo_website_visit:"0.02000000",demo_partner_bot:"0.03000000"};
 if(!Object.prototype.hasOwnProperty.call(known,code))throw new Error("DEMO_TASK_UNKNOWN");
 const owner=readDemoAccount();
 if(owner.completed_tasks.includes(code))return owner;
 demoLedgerMutation(known[code],"credit","bonus","task_bonus");
 return writeDemoAccount(a=>({...a,completed_tasks:[...a.completed_tasks,code]}));
}
export function completeDemoAd():DemoAccountState {
 const today=new Date().toISOString().slice(0,10);const owner=readDemoAccount();
 const views=owner.ad_date_utc===today?owner.ad_views:0;
 if(views>=10)return owner;
 demoLedgerMutation("0.01000000","credit","bonus","ad_reward");
 return writeDemoAccount(a=>({...a,ad_date_utc:today,ad_views:views+1}));
}

/** One read-only DB browser across 39 stores. Filter by indexed Global ID for
 * account-specific tables; show global catalogs when no matching rows exist.
 * Never loads full 27,500-row collections into a React component. */
export async function demoTableRows(name:DemoTableName,globalId:string,limit=20):Promise<Record<string,unknown>[]> {
 if(!isDemoPreviewEnabled()||!DEMO_TABLE_NAMES.includes(name)||!/^[0-9]{10}$/.test(globalId))throw new Error("DEMO_TABLE_READ_DENIED");
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(DEMO_DB_NAME,DEMO_SCHEMA_VERSION);
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 try{return await new Promise<Record<string,unknown>[]>((resolve,reject)=>{
  const tx=db.transaction(name,"readonly"),object=tx.objectStore(name);
  const globalCatalogs=new Set<DemoTableName>(["task_catalog","shop_items","hub_links","ad_providers","skins","faq","settings"]);
  const request=!globalCatalogs.has(name)&&object.indexNames.contains("by_global_id")
    ?object.index("by_global_id").getAll(IDBKeyRange.only(globalId),Math.min(50,Math.max(1,limit)))
    :object.getAll(undefined,Math.min(50,Math.max(1,limit)));
  request.onsuccess=()=>resolve(request.result as Record<string,unknown>[]);request.onerror=()=>reject(request.error);
 })}finally{db.close();}
}
