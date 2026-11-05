import test from 'node:test';
import assert from 'node:assert/strict';
import {demoRuntime} from '../helpers/demo-runtime.mjs';

function reader(rows){
 const requests=[];
 const h=demoRuntime({origin:'https://gly-efhc.github.io',basePath:'/efhc',fetchImpl:async(path,options)=>{
  const url=new URL(path);requests.push({url,options});
  if(url.pathname.endsWith('/token/anonymous'))return {ok:true,json:async()=>({token:'test.public.jwt',expires_at:Date.parse('2027-01-01')/1000})};
  const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||100);
  return {ok:true,headers:{get:key=>key==='content-range'?`${offset}-${offset+Math.min(limit,rows.length-offset)-1}/${rows.length}`:null},json:async()=>rows.slice(offset,offset+limit)};
 }});
 return {api:h.loadSource('reconstruction/neonDemoDataApi.ts'),requests};
}
test('SQL user history paginates beyond 100 and returns the exact total',async()=>{
 const rows=Array.from({length:137},(_,i)=>({id:String(1000-i),global_id:'0000657667',dataset:'RECON_CYCLE_0027',amount:'0.10000000'}));
 const {api,requests}=reader(rows),page=await api.getNeonAccountLedgerPage('0000657667',100,20);
 assert.equal(page.total,137);assert.equal(page.items.length,20);assert.equal(page.items[0].id,'900');
 assert.equal(requests.at(-1).url.searchParams.get('offset'),'100');
 assert.equal(requests.at(-1).options.headers.Prefer,'count=exact');
});
test('all four populated logical tables have an account-scoped SQL reader',async()=>{
 for(const table of ['referrals','referral_bonuses','ad_reward_sessions','task_submissions']){
  const {api,requests}=reader([{item:{id:'r1',global_id:'0000657667'}}]);
  const rows=await api.getNeonDemoTableRows(table,'0000657667');
  assert.equal(rows.length,1,table);assert.equal(rows[0].id,'r1');
  const q=requests.at(-1).url.searchParams;
  assert.equal(q.get('table_name'),'eq.'+table);assert.equal(q.get('item->>global_id'),'eq.0000657667');
 }
});
test('SQL reader rejects invalid page limits and out-of-scope ledger rows',async()=>{
 const {api}=reader([{id:'1',global_id:'8000000001',dataset:'RECON_CYCLE_0027'}]);
 await assert.rejects(api.getNeonAccountLedgerPage('0000657667',0,20),/SCOPE_MISMATCH/);
 await assert.rejects(api.getNeonDemoTableRows('panels','0000657667',NaN),/BAD_LIMIT/);
});
test('exchange history uses the stored kWh amount rather than the EFHC amount',async()=>{
 const {api}=reader([{id:'1',global_id:'0000657667',amount_kwh:'2.00000000',amount_efhc:'1.00000000',created_at:'2026-11-01T00:00:00Z'}]);
 assert.equal((await api.getNeonExchangePage('0000657667',0,20)).items[0].amount_kwh,'2.00000000');
});
