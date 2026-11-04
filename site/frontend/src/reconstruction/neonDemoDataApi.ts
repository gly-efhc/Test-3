/** Read-only EFHC_Nektron_Test API. No credentials or business writes in browser. */
export const NEON_DEMO_ENDPOINT="https://ep-fragrant-feather-zaribpm5.apirest.c-2.eu-west-2.aws.neon.tech/neondb/rest/v1";
export type Bank={id:number;ok:boolean;ts:string;facts:Record<string,string>;counters:Record<string,number>;database_scope:string;dataset:string};
export type Account={global_id:string;username:string|null;main_balance:string;bonus_balance:string;available_kwh:string;total_generated_kwh:string;exchanged_kwh_total:string;dataset:string};
export type Panel={id:string;global_id:string;public_id:string;is_active:boolean;is_archived:boolean;generated_kwh:string;base_gen_per_sec:string;purchase_event_id:string|null;dataset:string};
export type Ledger={id:string;global_id:string;created_at:string;reason:string;direction:string;amount:string;event_id:string|null;dataset:string};
type View="bank_overview"|"accounts"|"panels"|"ledger";
const allowed:readonly View[]=["bank_overview","accounts","panels","ledger"];
const root=new URL(NEON_DEMO_ENDPOINT);
export function assertGlobalId(value:string):string{if(!/^\d{10}$/.test(value))throw new Error("NEON_GLOBAL_ID_MUST_BE_10_DIGITS");return value;}
async function getRows<T>(view:View,params:Record<string,string>):Promise<T[]>{
  if(!allowed.includes(view)||root.protocol!=="https:"||root.username||root.password||root.search||root.hash||
    root.origin!=="https://ep-fragrant-feather-zaribpm5.apirest.c-2.eu-west-2.aws.neon.tech"||
    root.pathname!=="/neondb/rest/v1")throw new Error("NEON_TEST_VIEW_DENIED");
  const url=new URL(NEON_DEMO_ENDPOINT+"/"+view);
  for(const [key,value] of Object.entries(params)){
    if(!["select","global_id","limit","offset","order"].includes(key))throw new Error("NEON_TEST_QUERY_DENIED");
    url.searchParams.set(key,value);
  }
  const response=await fetch(url.toString(),{method:"GET",credentials:"omit",cache:"no-store",redirect:"error",headers:{"Accept":"application/json"}});
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
