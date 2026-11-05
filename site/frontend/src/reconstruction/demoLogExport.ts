import {isNeonPagesDemo,readDemoState} from './demoUnifiedStore';
import {buildSimpleXlsx} from '../lib/export/simpleXlsx';

export async function demoLogExportTable(q:URLSearchParams):Promise<string[][]>{
 const scope=q.get('scope')||'bank',gid=q.get('global_id'),raw=q.get('rows')||'100';
 if(!['bank','panels'].includes(scope)||gid&&!/^\d{10}$/.test(gid)||!['100','1000','100000','1000000','all'].includes(raw))throw new Error('DEMO_EXPORT_ARGUMENT_INVALID');
 const max=raw==='all'?1000000:Number(raw),state=readDemoState();
 let rows:Record<string,unknown>[];
 if(scope==='panels')rows=Object.values(state.accounts).flatMap(a=>a.panels||[]).filter(r=>!gid||r.global_id===gid).slice(0,max);
 else if(!isNeonPagesDemo())rows=(state.server?.audit||[]).filter(r=>!gid||r.global_id===gid).slice(0,max);
 else {
  rows=[];let cursor:string|null='0';
  const {readNeonDemoJournal}=await import('./neonDemoReadRoutes');
  while(cursor!==null&&rows.length<max){
   const args=new URLSearchParams({cursor,limit:String(Math.min(100,max-rows.length))});
   if(gid)args.set('global_id',gid);
   const page=await readNeonDemoJournal(args);rows.push(...page.items);cursor=page.next_cursor;
  }
 }
 const fields=scope==='bank'?['id','global_id','system_entity','amount_efhc','direction','balance_type','reason','created_at']:
  ['id','global_id','public_id','generated_kwh','is_active','activated_at','expires_at'];
 return [fields,...rows.map(r=>fields.map(key=>String(r[key]??'')))];
}
export async function demoLogExport(format:'csv'|'xlsx',q:URLSearchParams):Promise<Blob>{
 const table=await demoLogExportTable(q);
 if(format==='xlsx')return buildSimpleXlsx(table);
 const cell=(text:string)=>'"'+(/^[=+\-@\t\r]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"';
 return new Blob(['\uFEFF'+table.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
}
