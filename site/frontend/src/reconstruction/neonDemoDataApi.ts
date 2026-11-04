/** Read-only EFHC_Nektron_Test API. No credentials or business writes in browser. */
export const NEON_DEMO_ENDPOINT="https://ep-fragrant-feather-zaribpm5.apirest.c-2.eu-west-2.aws.neon.tech/neondb/rest/v1";
export type Bank={id:number;ok:boolean;ts:string;facts:Record<string,string>;counters:Record<string,number>;database_scope:string;dataset:string};
export type Account={global_id:string;username:string|null;main_balance:string;bonus_balance:string;available_kwh:string;total_generated_kwh:string;exchanged_kwh_total:string;dataset:string};
export type Panel={id:string;global_id:string;public_id:string;is_active:boolean;is_archived:boolean;generated_kwh:string;base_gen_per_sec:string;purchase_event_id:string|null;dataset:string};
export type Ledger={id:string;global_id:string;created_at:string;reason:string;direction:string;amount:string;event_id:string|null;dataset:string};
type View="bank_overview"|"accounts"|"panels"|"ledger"|"transfers_all"|"payment_intents"|"table_counts"|"catalog_rows"|"bootstrap_snapshot";
const allowed:readonly View[]=["bank_overview","accounts","panels","ledger","transfers_all","payment_intents","table_counts","catalog_rows","bootstrap_snapshot"];
const root=new URL(NEON_DEMO_ENDPOINT);
export function assertGlobalId(value:string):string{if(!/^\d{10}$/.test(value))throw new Error("NEON_GLOBAL_ID_MUST_BE_10_DIGITS");return value;}
/** Neon Auth issues short-lived public anonymous JWTs, not database credentials. */
const NEON_DEMO_AUTH="https://ep-fragrant-feather-zaribpm5.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth";
let anonymousJwt:{token:string,expires:number}|null=null;
let pendingAnonymousJwt:Promise<string>|null=null;
async function neonAnonymousJwt():Promise<string>{
  if(anonymousJwt&&anonymousJwt.expires>Date.now()/1000+30)return anonymousJwt.token;
  if(!pendingAnonymousJwt){
    pendingAnonymousJwt=(async()=>{
      const response=await fetch(NEON_DEMO_AUTH+"/token/anonymous",{
        method:"GET",credentials:"omit",cache:"no-store",redirect:"error",headers:{"Accept":"application/json"}
      });
      if(!response.ok)throw new Error("NEON_TEST_AUTH_HTTP_"+response.status);
      const body:unknown=await response.json();
      if(!body||typeof body!=="object")throw new Error("NEON_TEST_AUTH_RESPONSE_INVALID");
      const record=body as {token?:unknown,expires_at?:unknown};
      if(typeof record.token!=="string"||record.token.split(".").length!==3||
         typeof record.expires_at!=="number")
        throw new Error("NEON_TEST_AUTH_TOKEN_INVALID");
      const expires=record.expires_at>1000000000000?record.expires_at/1000:record.expires_at;
      if(!Number.isFinite(expires)||expires<=Date.now()/1000+10)
        throw new Error("NEON_TEST_AUTH_TOKEN_EXPIRED");
      anonymousJwt={token:record.token,expires};return record.token;
    })().finally(()=>{pendingAnonymousJwt=null;});
  }
  return pendingAnonymousJwt;
}
async function getRows<T>(view:View,params:Record<string,string>):Promise<T[]>{
  if(!allowed.includes(view)||root.protocol!=="https:"||root.username||root.password||root.search||root.hash||
    root.origin!=="https://ep-fragrant-feather-zaribpm5.apirest.c-2.eu-west-2.aws.neon.tech"||
    root.pathname!=="/neondb/rest/v1")throw new Error("NEON_TEST_VIEW_DENIED");
  const url=new URL(NEON_DEMO_ENDPOINT+"/"+view);
  for(const [key,value] of Object.entries(params)){
    if(!["select","global_id","limit","offset","order","table_name","system_entity"].includes(key))throw new Error("NEON_TEST_QUERY_DENIED");
    url.searchParams.set(key,value);
  }
  const jwt=await neonAnonymousJwt();
  const response=await fetch(url.toString(),{method:"GET",credentials:"omit",cache:"no-store",redirect:"error",headers:{"Accept":"application/json","Authorization":"Bearer "+jwt}});
  if(!response.ok)throw new Error("NEON_TEST_HTTP_"+response.status);
  const body:unknown=await response.json();
  if(!Array.isArray(body)||body.length>100)throw new Error("NEON_TEST_RESPONSE_INVALID");
  return body as T[];
}
export async function getNeonBank():Promise<Bank>{
 const rows=await getRows<Bank>("bank_overview",{select:"id,ok,ts,facts,counters,database_scope,dataset",limit:"1"});
 if(rows.length!==1||rows[0].database_scope!=="EFHC_Nektron_Test"||rows[0].dataset!=="RECON_CYCLE_0027"||rows[0].facts?.bank_metrics_ready!=="1")
   throw new Error("NEON_TEST_BANK_NOT_READY");
 return rows[0];
}
export async function getNeonAccount(gid:string):Promise<Account>{
 const rows=await getRows<Account>("accounts",{select:"global_id,username,main_balance,bonus_balance,available_kwh,total_generated_kwh,exchanged_kwh_total,dataset",global_id:"eq."+assertGlobalId(gid),limit:"1"});
 if(rows.length!==1||rows[0].global_id!==gid||rows[0].dataset!=="RECON_CYCLE_0027")throw new Error("NEON_TEST_ACCOUNT_NOT_FOUND");
 return rows[0];
}
export async function getNeonPanels(gid:string,offset=0):Promise<Panel[]>{
 if(!Number.isSafeInteger(offset)||offset<0)throw new Error("NEON_TEST_BAD_OFFSET");
 const rows=await getRows<Panel>("panels",{select:"id,global_id,public_id,is_active,is_archived,generated_kwh,base_gen_per_sec,purchase_event_id,dataset",global_id:"eq."+assertGlobalId(gid),order:"id.asc",offset:String(offset),limit:"20"});
 if(rows.some(p=>p.global_id!==gid||p.dataset!=="RECON_CYCLE_0027"))throw new Error("NEON_TEST_PANEL_SCOPE_MISMATCH");
 return rows;
}
export async function getNeonLedger(gid:string,offset=0):Promise<Ledger[]>{
 if(!Number.isSafeInteger(offset)||offset<0)throw new Error("NEON_TEST_BAD_OFFSET");
 const rows=await getRows<Ledger>("ledger",{select:"id,global_id,created_at,reason,direction,amount,event_id,dataset",global_id:"eq."+assertGlobalId(gid),order:"created_at.desc,id.desc",offset:String(offset),limit:"20"});
 if(rows.some(x=>x.global_id!==gid||x.dataset!=="RECON_CYCLE_0027"))throw new Error("NEON_TEST_LEDGER_SCOPE_MISMATCH");
 return rows;
}

/** Hydrate the original Pages simulator from the C27 Neon dataset, not frozen v866. */
export type NeonSeedUser=Account&{is_active:boolean;is_vip:boolean;rank_position:number;rank_score_kwh:string;created_at:string;updated_at:string};
export type NeonSeedPanel=Panel&{created_at:string;activated_at:string|null;expires_at:string|null;archived_at:string|null;last_generated_at:string|null;title:string|null};
export type NeonSeedIntent={id:string;global_id:string;purpose:string;asset:string;status:string;efhc_amount_d8:string;amount_asset_d8:string;created_at:string;expires_at:string|null;updated_at:string;dataset:string};
export type NeonTableCount={table_name:string;rows_count:number};
/** One consistent read replaces 60 sequential Data API pages. */
export async function getNeonCoreSeed():Promise<{bank:Bank;users:NeonSeedUser[];panels:NeonSeedPanel[];intents:NeonSeedIntent[]}>{
 const rows=await getRows<{bank:Bank;users:NeonSeedUser[];panels:NeonSeedPanel[];intents:NeonSeedIntent[]}>(
  "bootstrap_snapshot",{select:"bank,users,panels,intents",limit:"1"});
 if(rows.length!==1)throw new Error("NEON_DEMO_BOOTSTRAP_NOT_UNIQUE");
 const {bank,users,panels,intents}=rows[0];
 if(!bank||bank.database_scope!=="EFHC_Nektron_Test"||bank.dataset!=="RECON_CYCLE_0027"||
    bank.facts?.bank_metrics_integrity_ok!=="1"||bank.counters?.users_total!==1000||
    bank.counters?.panels_total!==4000||!Array.isArray(users)||!Array.isArray(panels)||
    !Array.isArray(intents)||users.length!==1000||panels.length!==4000||intents.length!==1000)
    throw new Error("NEON_DEMO_BOOTSTRAP_COUNT_OR_INTEGRITY_MISMATCH");
 if(users.some(u=>u.dataset!=="RECON_CYCLE_0027"||!/^\d{10}$/.test(u.global_id))||
    panels.some(p=>p.dataset!=="RECON_CYCLE_0027")||
    intents.some(x=>x.dataset!=="RECON_CYCLE_0027"))
    throw new Error("NEON_DEMO_DATASET_SCOPE_MISMATCH");
 return {bank,users,panels,intents};
}
export async function getNeonTableCounts():Promise<Record<string,number>>{
 const rows=await getRows<NeonTableCount>("table_counts",{select:"table_name,rows_count",order:"table_name.asc",limit:"100"});
 const counts:Record<string,number>={};
 for(const row of rows){
  if(Object.prototype.hasOwnProperty.call(counts,row.table_name)||!Number.isSafeInteger(row.rows_count)||row.rows_count<0)throw new Error("NEON_DEMO_TABLE_COUNT_INVALID");
  counts[row.table_name]=row.rows_count;
 }
 return counts;
}
export async function getNeonDemoTableRows(name:string,gid:string,limit=20):Promise<Record<string,unknown>[]>{
 assertGlobalId(gid);const n=String(Math.max(1,Math.min(50,limit))),id="eq."+gid;
 if(["accounts","admin_users","balances","ranks"].includes(name))
  return getRows<Record<string,unknown>>("accounts",{select:"*",global_id:id,limit:n});
 if(name==="panels")return getRows<Record<string,unknown>>("panels",{select:"*",global_id:id,limit:n});
 if(["ledger_entries","balance_history"].includes(name))
  return getRows<Record<string,unknown>>("ledger",{select:"*",global_id:id,order:"created_at.desc",limit:n});
 if(name==="bank_transfers")return getRows<Record<string,unknown>>("transfers_all",{select:"*",system_entity:"not.is.null",order:"id.desc",limit:n});
 if(name==="shop_intents")return getRows<Record<string,unknown>>("payment_intents",{select:"*",global_id:id,limit:n});
 if(["hub_links","shop_items","task_catalog","settings","admin_roles"].includes(name)){
  const rows=await getRows<{item:Record<string,unknown>}>("catalog_rows",{
   select:"item",table_name:"eq."+name,order:"id.asc",limit:n});
  return rows.map(x=>x.item);
 }
 return [];
}
export async function getNeonAccountLedgerPage(gid:string,offset:number,limit:number):Promise<{items:Record<string,unknown>[];total:number}>{
 assertGlobalId(gid);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>50)throw new Error("NEON_DEMO_BAD_LEDGER_PAGE");
 const rows=await getRows<Record<string,unknown>>("ledger",{select:"id,global_id,amount,amount_efhc,direction,balance_type,reason,created_at,event_id,dataset",global_id:"eq."+gid,order:"created_at.desc,id.desc",limit:"100"});
 return {items:rows.slice(offset,offset+limit),total:rows.length};
}
export async function getNeonAdminLedgerPage(gid:string|null,offset:number,limit:number):Promise<{ok:true;items:Record<string,unknown>[];next_cursor:string|null}>{
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw new Error("NEON_DEMO_BAD_ADMIN_PAGE");
 const q:Record<string,string>={select:"*",order:"id.desc",offset:String(offset),limit:String(limit)};
 if(gid)q.global_id="eq."+assertGlobalId(gid);
 const rows=await getRows<Record<string,unknown>>("transfers_all",q);
 return {ok:true,items:rows,next_cursor:rows.length===limit?String(offset+limit):null};
}
