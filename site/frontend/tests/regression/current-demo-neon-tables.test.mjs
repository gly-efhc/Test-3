import test from 'node:test';
import assert from 'node:assert/strict';
import {demoRuntime,snapshotManifest} from '../helpers/demo-runtime.mjs';

function reader(rows){
 const requests=[];
 const h=demoRuntime({origin:'https://gly-efhc.github.io',basePath:'/efhc',fetchImpl:async(path,options)=>{
  const url=new URL(path);requests.push({url,options});
  if(url.pathname.endsWith('/manifest.json'))return {ok:true,json:async()=>snapshotManifest([
   'ledger/0000657667.json','exchanges/0000657667.json',...['referrals','referral_bonuses','ad_reward_sessions','task_submissions'].map(n=>'catalog/'+n+'.json')])};
  return {ok:true,json:async()=>rows};
 }});
 return {api:h.loadSource('reconstruction/neonDemoDataApi.ts'),requests};
}
test('SQL user history paginates beyond 100 and returns the exact total',async()=>{
 const rows=Array.from({length:137},(_,i)=>({id:String(1000-i),global_id:'0000657667',dataset:'RECON_CYCLE_0027',amount:'0.10000000'}));
 const {api,requests}=reader(rows),page=await api.getNeonAccountLedgerPage('0000657667',100,20);
 assert.equal(page.total,137);assert.equal(page.items.length,20);assert.equal(page.items[0].id,'900');
 assert.match(requests.at(-1).url.pathname,/ledger\/0000657667\.json$/);
 assert.equal(requests.at(-1).url.origin,'https://gly-efhc.github.io');
 assert.equal(requests.at(-1).options.headers.Authorization,undefined);
});
test('all four populated logical tables have an account-scoped SQL reader',async()=>{
 for(const table of ['referrals','referral_bonuses','ad_reward_sessions','task_submissions']){
  const {api,requests}=reader([{item:{id:'r1',global_id:'0000657667'}}]);
  const rows=await api.getNeonDemoTableRows(table,'0000657667');
  assert.equal(rows.length,1,table);assert.equal(rows[0].id,'r1');
  assert.ok(requests.at(-1).url.pathname.endsWith('/catalog/'+table+'.json'));
 }
});
test('SQL reader rejects invalid page limits and out-of-scope ledger rows',async()=>{
 const {api}=reader([{id:'1',global_id:'8000000001',dataset:'RECON_CYCLE_0027'}]);
 await assert.rejects(api.getNeonAccountLedgerPage('0000657667',0,20),/SCOPE_MISMATCH/);
 await assert.rejects(api.getNeonDemoTableRows('panels','0000657667',NaN),/BAD_LIMIT/);
});
test('exchange history uses the stored kWh amount rather than the EFHC amount',async()=>{
 const {api}=reader([{id:'1',global_id:'0000657667',reason:'exchange_kwh',amount_kwh:'2.00000000',amount_efhc:'1.00000000',created_at:'2026-11-01T00:00:00Z'}]);
 assert.equal((await api.getNeonExchangePage('0000657667',0,20)).items[0].amount_kwh,'2.00000000');
});
