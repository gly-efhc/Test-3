/** SQL-backed history plus committed local DEMO actions. Read-only SQL transport. */
import {readDemoState} from './demoUnifiedStore';
import {localDemoLedger} from './demoTableView';
import {getNeonAdminLedgerPage} from './neonDemoDataApi';
type Row=Record<string,unknown>;
function pageArgs(q:URLSearchParams){
 const offset=Number(q.get('cursor')||0),limit=Number(q.get('limit')||50);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)
  throw new Error('DEMO_BAD_HISTORY_PAGE');
 return {offset,limit};
}
export function localDemoJournal(gid?:string|null):Row[]{
 const state=readDemoState();
 return [...localDemoLedger(state,gid||undefined).flatMap<Row>(r=>[
  {...r,amount:r.amount_efhc,system_entity:null},
  {...r,id:`local-bank:${r.id}`,amount:r.amount_efhc,global_id:null,system_entity:'BANK_EFHC',
   direction:r.direction==='credit'?'debit':'credit'}
 ]),...(!gid?(state.server?.audit||[]).filter(r=>r.reason==='minted'||r.reason==='burned').map(r=>({
  ...r,global_id:null,system_entity:'BANK_EFHC',amount:r.amount_efhc,direction:r.reason==='minted'?'credit':'debit'})):[])]
  .filter(r=>!gid||r.global_id===gid);
}
async function mergedPage(local:Row[],q:URLSearchParams,sql:(offset:number,limit:number)=>Promise<{items:Row[];next_cursor:string|null}>){
 const {offset,limit}=pageArgs(q),overlay=local.slice(offset,offset+limit),remaining=limit-overlay.length;
 if(!remaining)return {ok:true,items:overlay,next_cursor:String(offset+limit)};
 const page=await sql(Math.max(0,offset-local.length),remaining);
 return {ok:true,items:[...overlay,...page.items],next_cursor:page.next_cursor?String(offset+overlay.length+page.items.length):null};
}
export async function readNeonDemoJournal(q:URLSearchParams){
 const gid=q.get('global_id');
 return mergedPage(localDemoJournal(gid),q,(offset,limit)=>getNeonAdminLedgerPage(gid,offset,limit));
}
