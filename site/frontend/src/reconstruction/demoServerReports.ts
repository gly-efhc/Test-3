import { d8,formatD8,type DemoControlState } from './demoUnifiedStore';
import {ensureServer,panelRows,userRow} from './demoServerCore';
import type {DemoRow} from './demoServerModel';
const sum=(rows:DemoRow[],field:string)=>formatD8(rows.reduce((n,r)=>n+d8(String(r[field]||'0')),0n));
export function demoDomainReport(state:DemoControlState,domain:string,q:URLSearchParams){
 const s=ensureServer(state),now=Date.now(),hours=Number(q.get('range_hours')||168),since=now-hours*3600000;
 const inRange=(r:DemoRow)=>Date.parse(r.created_at)>=since;
 const users=Object.values(state.accounts),panels=users.flatMap(a=>a.panels?panelRows(a):[]).filter(p=>!p.meta?.protectively_voided),wd=users.flatMap(a=>a.withdrawals),audit=s.audit.filter(inRange);
 const active=panels.filter(p=>p.is_active),archived=panels.filter(p=>!p.is_active),deposits=s.deposits.filter(inRange);
 let snapshot:DemoRow={},events:DemoRow[]=[];
 if(domain==='users'){snapshot={total_users:users.length,new_in_range:users.filter(a=>inRange(a)).length,active_today:users.filter(a=>a.is_active!==false).length,with_panel:users.filter(a=>a.panels?.length).length,with_wallet:users.filter(a=>a.wallets.length).length};events=users;}
 if(domain==='bank'){
  const incoming=audit.filter(r=>r.direction==='debit'),outgoing=audit.filter(r=>r.direction==='credit');
  snapshot={bank_main_balance:s.bank_balance,credits_in_range:sum(incoming,'amount_efhc'),debits_in_range:sum(outgoing,'amount_efhc'),net_flow_in_range:formatD8(d8(sum(incoming,'amount_efhc'))-d8(sum(outgoing,'amount_efhc'))),credit_events_in_range:incoming.length,debit_events_in_range:outgoing.length,total_events_in_range:audit.length};events=audit;
 }
 if(domain==='panels'){
  const age=(p:DemoRow)=>(now-Date.parse(p.activated_at))/86400000;
  snapshot={total_panels:panels.length,active_panels:active.length,archived_panels:archived.length,created_in_range:panels.filter(inRange).length,avg_lifetime_days:180,
   expiring_7d:active.filter(p=>Date.parse(p.expires_at)-now<=7*86400000).length,expiring_30d:active.filter(p=>Date.parse(p.expires_at)-now<=30*86400000).length,expired_but_active:0,missing_expiry:0,
   generated_kwh_total:Number(sum(panels,'generated_kwh')),active_base_rate_total:Number(sum(active,'base_gen_per_sec')),active_age_under_30d:active.filter(p=>age(p)<30).length,active_age_30_119d:active.filter(p=>age(p)>=30&&age(p)<120).length,active_age_120d_plus:active.filter(p=>age(p)>=120).length};events=panels;
 }
 if(domain==='withdrawals'){snapshot={total_count:wd.length,pending_count:wd.filter(r=>r.status==='pending').length,paid_count:wd.filter(r=>r.status==='paid').length,rejected_count:wd.filter(r=>r.status==='rejected').length,canceled_count:wd.filter(r=>r.status==='cancelled').length,total_amount_paid_in_range:sum(wd.filter(r=>r.status==='paid'&&inRange(r)),'amount')};events=wd;}
 if(domain==='deposits'){snapshot={'pending_операции':deposits.filter(r=>r.status==='received').length,auto_credited:deposits.filter(r=>r.status==='credited').length,manual_review:deposits.filter(r=>r.status==='pending_manual').length,error_count:deposits.filter(r=>String(r.status).startsWith('error')).length,total_credited_in_range:sum(deposits.filter(r=>r.status==='credited'),'amount')};events=deposits;}
 const buckets=new Map<string,number>();for(const r of events.filter(inRange)){const iso=String(r.created_at);const bucket=iso.slice(0,q.get('bucket')==='hour'?13:10)+(q.get('bucket')==='hour'?':00:00Z':'T00:00:00Z');buckets.set(bucket,(buckets.get(bucket)||0)+1);}
 return {ok:true,mode:'demo',data_kind:'demo_timeseries',synthetic:true,domain,range_hours:hours,generated_at:new Date(now).toISOString(),snapshot,trend:[...buckets].sort().map(([bucket,value])=>({bucket,value})),empty_reason:null};
}
export function demoObservability(state:DemoControlState,path:string,q:URLSearchParams){
 const s=ensureServer(state),stamp=new Date().toISOString();
 const metrics=[{key:'efhc_transfer_count',label:'Операции',value:String(s.audit.length),unit:'count',source:'demo',data_kind:'derived'},
  {key:'efhc_transfer_amount',label:'EFHC',value:sum(s.audit,'amount_efhc'),unit:'EFHC',source:'demo',data_kind:'derived'}];
 if(path.endsWith('/summary'))return {ok:true,mode:'demo',generated_at:stamp,data_kind:'derived',source:'demo',metrics};
 if(path.endsWith('/timeseries'))return {ok:true,mode:'demo',generated_at:stamp,source:'demo',data_kind:'derived',metric:q.get('metric'),range_hours:Number(q.get('range_hours')||24),bucket:q.get('bucket')||'hour',unit:'count',points:s.audit.map(r=>({ts:r.created_at,value:q.get('metric')==='efhc_transfer_amount'?r.amount_efhc:'1'}))};
 if(path.endsWith('/events'))return {ok:true,mode:'demo',source:'demo',items:s.audit.map(r=>({id:String(r.id),type:r.reason,severity:'info',title:r.reason,ts:r.created_at,source:'demo'}))};
 return {ok:true,mode:'demo',backend:{ok:true,mode:'simulation'},db:{ok:true,mode:'browser'},watcher:{ok:false,status:'simulation'},source:'demo'};
}
