/** The original DEMO runs from one immutable TEST dataset on the Pages origin.
 * Runtime reads never need Neon Auth, third-party cookies or a database session.
 */
import build from './demoDataBuild.json';
import {publicAssetPath} from '../lib/publicAssetPath';
type Row=Record<string,unknown>;
type Manifest={snapshot_id:string;dataset:string;files:Record<string,string>;
 collections:Record<string,{total:number;page_size:number}>};
const pending=new Map<string,Promise<unknown>>();
function sourceId():string{
 if(!/^[a-f0-9]{64}$/.test(build.snapshot_id))throw new Error('DEMO_DATASET_NOT_PREPARED');
 return build.snapshot_id;
}
async function file<T>(name:string):Promise<T>{
 const id=sourceId();
 if(!/^[a-z0-9_/-]+\.json$/.test(name)||name.includes('..'))throw new Error('DEMO_DATASET_PATH_DENIED');
 const key=id+'/'+name;
 if(!pending.has(key))pending.set(key,(async()=>{
  const path=publicAssetPath(`/demo/data/${id}/${name}`);
  const response=await fetch(new URL(path,window.location.origin).toString(),{
   method:'GET',credentials:'omit',redirect:'error',cache:'force-cache',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('DEMO_DATASET_HTTP_'+response.status);
  return response.json();
 })().catch(e=>{pending.delete(key);throw e;}));
 return await pending.get(key) as T;
}
async function manifest():Promise<Manifest>{
 const m=await file<Manifest>('manifest.json');
 if(m.snapshot_id!==sourceId()||m.dataset!=='RECON_CYCLE_0027')throw new Error('DEMO_DATASET_IDENTITY_MISMATCH');
 return m;
}
async function records(name:string):Promise<Row[]>{
 const m=await manifest();
 if(!Object.prototype.hasOwnProperty.call(m.files,name))throw new Error('DEMO_DATASET_COLLECTION_MISSING');
 const rows=await file<unknown>(name);
 if(!Array.isArray(rows))throw new Error('DEMO_DATASET_ROWSET_INVALID');
 return rows;
}
function globalId(value:string|undefined):string{
 if(!value||!/^eq\.\d{10}$/.test(value))throw new Error('DEMO_DATASET_GLOBAL_ID_REQUIRED');
 return value.slice(3);
}
function scoped(rows:Row[],params:Record<string,string>):Row[]{
 return rows.filter(r=>{
  if(params.global_id&&r.global_id!==globalId(params.global_id))return false;
  if(params.reason&&r.reason!==params.reason.slice(3))return false;
  if(params['item->>global_id']&&(r.item as Row)?.global_id!==globalId(params['item->>global_id']))return false;
  return true;
 });
}
export async function readDemoSnapshotPage<T>(view:string,params:Record<string,string>):Promise<{rows:T[];total:number}>{
 const offset=Number(params.offset||0),limit=Number(params.limit||100);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('DEMO_DATASET_BAD_PAGE');
 let rows:Row[];
 if(view==='bootstrap_snapshot')rows=[await file<Row>('bootstrap.json')];
 else if(view==='bank_overview')rows=[(await file<{bank:Row}>('bootstrap.json')).bank];
 else if(view==='accounts'||view==='panels'||view==='payment_intents'){
  const seed=await file<Record<string,Row[]>>('bootstrap.json');
  rows=seed[view==='accounts'?'users':view==='panels'?'panels':'intents'];
 }else if(view==='table_counts')rows=await records('table_counts.json');
 else if(view==='ledger'){
  const gid=globalId(params.global_id);rows=await records('ledger/'+gid+'.json');
  if(rows.some(r=>r.global_id!==gid))throw new Error('NEON_TEST_LEDGER_SCOPE_MISMATCH');
 }
 else if(view==='economic_events'){
  rows=params.reason==='eq.exchange_kwh'?await records('exchanges/'+globalId(params.global_id)+'.json'):await records('deposits.json');
 }else if(view==='catalog_rows'){
  const name=params.table_name?.replace(/^eq\./,'');
  if(!name||!/^[a-z_]+$/.test(name))throw new Error('DEMO_DATASET_CATALOG_REQUIRED');
  rows=await records('catalog/'+name+'.json');
 }else if(view==='transfers_all'){
  if(params.global_id){rows=await records('ledger/'+globalId(params.global_id)+'.json');}
  else{
   const name=params.system_entity==='not.is.null'?'bank_transfers':'transfers_all';
   const m=await manifest(),c=m.collections[name];if(!c)throw new Error('DEMO_DATASET_JOURNAL_MISSING');
   const last=Math.min(c.total,offset+limit),first=Math.floor(offset/c.page_size),end=Math.ceil(last/c.page_size);
   const pages=await Promise.all(Array.from({length:Math.max(0,end-first)},(_,i)=>records(`${name}/${first+i}.json`)));
   return {rows:pages.flat().slice(offset%c.page_size,offset%c.page_size+limit) as T[],total:c.total};
  }
 }else throw new Error('DEMO_DATASET_VIEW_DENIED');
 rows=scoped(rows,params);
 return {rows:rows.slice(offset,offset+limit) as T[],total:rows.length};
}
