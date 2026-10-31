/** Public Pages ONLY: persistent sample accounting, NEVER an authenticated wallet or ledger.
 * Derived from frozen FRONTEND_v866.html, STANDALONE_GLOBAL_ID and standaloneAdminSeed.
 * The state is indexed by simulated Global ID, not Telegram provider ID.
 */
import frozen from "./demo-tables-v866.json";
import admin from "./demo-admin-seed-v866.json";
import homeCanon from "./frozen-v866-home-fixture.json";

export const DEMO_GLOBAL_ID = "0000657667";
export const DEMO_DB_NAME = "EFHC_REACT_DEMO_CANON_V866";
// Local simulated account-state format and IndexedDB physical schema are independent.
// v3 repairs browsers where an early table reader created empty v2 stores.
export const DEMO_SCHEMA_VERSION = 2;
export const DEMO_DB_VERSION = 3;
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
/** Frozen v866 header shows EFHCm + EFHCb. The task fixture separately owns the
 * 78 EFHCb sample; subtract it from the frozen header total instead of replacing
 * the bonus ledger. These are public DEMO values, never Neon/production balances. */
export const DEMO_CANON_TOTAL_BALANCE = homeCanon.source_dom_ids.balanceValue;
export const DEMO_CANON_BONUS_BALANCE = frozen.tasks.bonus_balance_d8;
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
export function primaryDemoMainBalance():string {
  const main=d8(DEMO_CANON_TOTAL_BALANCE)-d8(DEMO_CANON_BONUS_BALANCE);
  if(main<0n)throw new Error("DEMO_CANON_BALANCE_INVALID");
  return formatD8(main);
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
    global_id:globalId,main_balance:isPrimary?primaryDemoMainBalance():formatD8(d8(String(1200+(index%113)*17.125))),
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
    cache=migrateUntouchedLegacyPrimary(stored);
    if(cache!==stored){try{window.localStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify(cache));}catch{/* quota */}}
    return cache;
  }
 }catch{ /* fallback to canon */ }
 cache=seedDemoState();return cache;
}
/** Migrate only the untouched v893/v899 primary sample. Never overwrite an
 * account with a ledger, task awards, withdrawals or user changes. */
function migrateUntouchedLegacyPrimary(state:DemoControlState):DemoControlState {
 const old=state.accounts[DEMO_GLOBAL_ID];
 if(!old||old.main_balance!=="12345.00000000"||old.bonus_balance!==DEMO_CANON_BONUS_BALANCE||
    old.available_kwh!=="421.12500000"||old.total_generated_kwh!==frozen.ranks.me.total_generated_kwh||
    old.ledger.length||old.withdrawals.length||old.exchanges.length||old.completed_tasks.length||
    old.activated_panels!==0||old.ad_views!==0)return state;
 return {...state,accounts:{...state.accounts,[DEMO_GLOBAL_ID]:{...old,main_balance:primaryDemoMainBalance()}}};
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

/** Every reader opens the same schema-upgrading path. A read before bootstrap cannot
 * poison a fresh database with an empty same-version object-store catalog. */
async function openDemoDatabase():Promise<IDBDatabase>{
 if(typeof indexedDB==="undefined")throw new Error("DEMO_INDEXEDDB_UNAVAILABLE");
 return await new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(DEMO_DB_NAME,DEMO_DB_VERSION);
  request.onupgradeneeded=()=>{
   const instance=request.result;
   for(const name of DEMO_TABLE_NAMES){
    const object=instance.objectStoreNames.contains(name)?request.transaction!.objectStore(name):instance.createObjectStore(name,{keyPath:"id"});
    if(!object.indexNames.contains("by_global_id"))object.createIndex("by_global_id","global_id",{unique:false});
   }
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error("DEMO_DATABASE_OPEN_FAILED"));
  request.onblocked=()=>reject(new Error("DEMO_DATABASE_UPGRADE_BLOCKED_CLOSE_OTHER_TABS"));
 });
}
let databaseBootstrap:Promise<void>|null=null;
let lastMirroredGlobalId:string|null=null;
let selectedMirror:Promise<void>|null=null;
export async function bootstrapDemoIndexedDb():Promise<void>{
 if(!isDemoPreviewEnabled())return;
 if(!databaseBootstrap){
  databaseBootstrap=bootstrapDemoDatabaseContents().catch(error=>{
   databaseBootstrap=null;
   throw error;
  });
 }
 await databaseBootstrap;
 // A subsequent Global ID selection must update the corresponding logical
 // stores without re-seeding the 27,500 historical transactions.
 if(lastMirroredGlobalId!==readDemoState().selected_global_id){
  if(!selectedMirror){selectedMirror=(async()=>{
   const db=await openDemoDatabase();
   try {const state=readDemoState();await mirrorSelectedDemoAccount(db,state);
    lastMirroredGlobalId=state.selected_global_id;
   } finally {db.close();}
  })().finally(()=>{selectedMirror=null;});}
  await selectedMirror;
 }
}
async function bootstrapDemoDatabaseContents():Promise<void>{
 const db=await openDemoDatabase();
 try {
  const status=await new Promise<unknown>((resolve,reject)=>{
    const tx=db.transaction("settings","readonly"),r=tx.objectStore("settings").get("canon_seed_complete");
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  if(status){const current=readDemoState();await mirrorSelectedDemoAccount(db,current);lastMirroredGlobalId=current.selected_global_id;return;}
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
  const current=readDemoState();
  await mirrorSelectedDemoAccount(db,current);
  lastMirroredGlobalId=current.selected_global_id;
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction("settings","readwrite");
   tx.objectStore("settings").put({id:"canon_seed_complete",source_sha256:frozen.source_sha256,global_id:DEMO_GLOBAL_ID,rows:Object.fromEntries(Object.entries(seededTables).map(([name,rows])=>[name,rows.length]))});
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
 } finally {db.close();}
}
export async function demoTableCount(name:DemoTableName):Promise<number>{
 if(!isDemoPreviewEnabled()||!DEMO_TABLE_NAMES.includes(name))throw new Error("DEMO_TABLE_READ_DENIED");
 await bootstrapDemoIndexedDb();
 const db=await openDemoDatabase();
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
 await bootstrapDemoIndexedDb();
 const db=await openDemoDatabase();
 try{return await new Promise<Record<string,unknown>[]>((resolve,reject)=>{
  const tx=db.transaction(name,"readonly"),object=tx.objectStore(name);
  const globalCatalogs=new Set<DemoTableName>(["task_catalog","shop_items","hub_links","ad_providers","skins","faq","settings"]);
  const request=!globalCatalogs.has(name)&&object.indexNames.contains("by_global_id")
    ?object.index("by_global_id").getAll(IDBKeyRange.only(globalId),Math.min(50,Math.max(1,limit)))
    :object.getAll(undefined,Math.min(50,Math.max(1,limit)));
  request.onsuccess=()=>resolve(request.result as Record<string,unknown>[]);request.onerror=()=>reject(request.error);
 })}finally{db.close();}
}

/** Read a bounded, stable window of historical DEMO rows for the selected account.
 * Never promotes a browser Global ID into a server identity. */
export async function demoIndexedHistoryPage(globalId:string,offset:number,limit:number):Promise<{items:Record<string,unknown>[];total:number}>{
 if(!isDemoPreviewEnabled()||!/^[0-9]{10}$/.test(globalId)||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>50)
  throw new Error("DEMO_HISTORY_ARGUMENT_INVALID");
 await bootstrapDemoIndexedDb();
 const db=await openDemoDatabase();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction("ledger_entries","readonly");
  const index=tx.objectStore("ledger_entries").index("by_global_id");
  const key=IDBKeyRange.only(globalId);
  let total=0,records:Record<string,unknown>[]=[];
  const count=index.count(key);
  count.onsuccess=()=>{total=count.result;const cursor=index.openCursor(key);
   let skipped=false;
   cursor.onsuccess=()=>{
    const item=cursor.result;
    if(!item||records.length>=limit){resolve({items:records,total});return;}
    if(!skipped&&offset){skipped=true;item.advance(offset);return;}
    skipped=true;records.push(item.value as Record<string,unknown>);item.continue();
   };
   cursor.onerror=()=>reject(cursor.error||new Error("DEMO_HISTORY_CURSOR_FAILED"));
  };
  count.onerror=()=>reject(count.error||new Error("DEMO_HISTORY_COUNT_FAILED"));
  tx.onabort=()=>reject(tx.error||new Error("DEMO_HISTORY_ABORTED"));
 })}finally{db.close();}
}
