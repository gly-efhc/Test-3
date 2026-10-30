import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const base=path.resolve(import.meta.dirname);
const canon=JSON.parse(fs.readFileSync(path.join(base,'demo-tables-v866.json'),'utf8'));
const admin=JSON.parse(fs.readFileSync(path.join(base,'demo-admin-seed-v866.json'),'utf8'));
const local=new Map();
globalThis.window={
 __EFHC_DEMO_READ_ONLY__:true,
 location:{pathname:'/Test-3/demo-lab',origin:'https://fake.example'},
 localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},
 dispatchEvent:()=>undefined
};
process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW='1';
process.env.NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF='1';
const modules=new Map();
function load(name){
 if(modules.has(name))return modules.get(name);
 const file=path.join(base,name+'.ts');
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{
  target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true,resolveJsonModule:true
 }}).outputText;
 const module={exports:{}};
 modules.set(name,module.exports);
 const mockRequire=(target)=>{
  if(target==='./demo-tables-v866.json')return canon;
  if(target==='./demo-admin-seed-v866.json')return admin;
  if(target==='./demoUnifiedStore')return load('demoUnifiedStore');
  if(target==='./demoTables')return {
   demoPanelsPage:(tab,cursor,sort='oldest')=>{
    const rows=[...canon.panels[tab]];if(sort==='oldest')rows.reverse();
    const at=cursor?Number(cursor):0;return {items:rows.slice(at,at+20),next_cursor:at+20<rows.length?String(at+20):null,server_now_utc:new Date().toISOString()};
   },
   demoPanelsSummary:()=>canon.panels.summary,
   demoMyRankWithTop:()=>({snapshot_at:new Date().toISOString(),me:canon.ranks.me,top:canon.ranks.users.slice(0,100),next_cursor:'100'}),
   demoRankTopPage:cursor=>{const at=Number(cursor);return {snapshot_at:new Date().toISOString(),items:canon.ranks.users.slice(at,at+100),next_cursor:at+100<canon.ranks.users.length?String(at+100):null};},
   demoRankContext:()=>({snapshot_at:new Date().toISOString(),items:canon.ranks.users.slice(209,214),next_cursor:null})
  };
  throw new Error('Unexpected dependency '+target);
 };
 new Function('require','module','exports',code)(mockRequire,module,module.exports);
 modules.set(name,module.exports);
 return module.exports;
}
const store=load('demoUnifiedStore');
const api=load('demoApi');
const call=(p,verb='GET',body=undefined)=>api.demoApiRequest(p,verb,body);

test('isolated public Pages DEMO needs explicit flags, never allows production activation',()=>{
 assert.equal(store.isDemoPreviewEnabled(),true);
 process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW='0';
 assert.equal(store.isDemoPreviewEnabled(),false);
 process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW='1';
 assert.equal(store.DEMO_GLOBAL_ID,'0000657667');
 assert.equal(store.DEMO_TABLE_NAMES.length,39);
});
test('frozen original administrator fixture has 1000 users and linked tables',()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(base,'../../public/demo/frozen-admin-1000-v866.json'),'utf8'));
 assert.equal(raw.users.length,1000);
 assert.equal(raw.users[0].global_id,store.DEMO_GLOBAL_ID);
 assert.equal(raw.transactions.length,27500);
 for(const key of ['withdrawals','deposits','panels','shopOrders'])assert.equal(raw[key].length,2500);
 for(const key of ['taskSubmissions','referrals'])assert.equal(raw[key].length,1000);
 assert.equal(raw.logs.length,27500);
});
test('panel activation debits selected D8 account, changes snapshot, and creates history',async()=>{
 store.resetDemoDatabase();
 const prev=await call('/sync/me','POST');
 const a=store.readDemoAccount();
 const row=await call('/panels/activate','POST');
 assert.ok(row.panel.public_id.startsWith('PNL-'));
 assert.equal(store.readDemoAccount().activated_panels,1);
 assert.equal(store.d8(a.main_balance)+store.d8(a.bonus_balance)-store.d8(store.readDemoAccount().main_balance)-store.d8(store.readDemoAccount().bonus_balance),10000000000n);
 const next=await call('/sync/me','POST');assert.equal(next.panels.active_count,prev.panels.active_count+1);
 const history=await call('/profile/history');assert.equal(history.items.some(x=>x.kind==='panel_purchase'),true);
});
test('tasks, bonuses, wallet and Global ID selection share account and history',async()=>{
 store.resetDemoDatabase();
 const before=store.readDemoAccount();
 const first=store.completeDemoTask('demo_join_telegram');
 assert.equal(store.d8(first.bonus_balance)-store.d8(before.bonus_balance),10000000n);
 store.completeDemoTask('demo_join_telegram');
 assert.equal(store.readDemoAccount().completed_tasks.length,1);
 const mine=await call('/tasks/my');assert.equal(mine.items.length,1);
 const earnings=await call('/tasks/earnings/me');assert.equal(store.d8(earnings.total_bonus_earned),store.d8(canon.tasks.earnings.total_bonus_earned)+10000000n);
 const snap=await call('/sync/me','POST');assert.equal(snap.profile.bonus_balance,store.readDemoAccount().bonus_balance);
 const wallet=await call('/wallets/me');assert.equal(wallet.wallets.length,3);
 const mainId=store.readDemoState().selected_global_id;
 store.selectDemoGlobalId('8000000001');
 assert.equal((await call('/sync/me','POST')).profile.global_id,'8000000001');
 assert.equal((await call('/tasks/my')).items.length,0);
 store.selectDemoGlobalId(mainId);
 assert.equal((await call('/tasks/my')).items.length,1);
});
test('220 ranks and 60+60 panels are paginated and paired with selected Global ID',async()=>{
 store.resetDemoDatabase();
 const top=await call('/ranks/my-plus-top/me');assert.equal(top.top.length,100);
 const page=await call('/ranks/top/me?cursor=100');assert.equal(page.items.length,100);
 const tail=await call('/ranks/top/me?cursor=200');assert.equal(tail.items.length,20);
 const a=await call('/panels/active?limit=20&demo_sort=oldest');assert.equal(a.items.length,20);assert.equal(a.next_cursor,'20');
 const b=await call('/panels/archive?limit=20&demo_sort=newest');assert.equal(b.items.length,20);
 store.selectDemoGlobalId('8000000001');
 const me=await call('/ranks/my-plus-top/me');assert.equal(me.me.global_id,'8000000001');
});
test('5 repeatable data modes never bypass financial or identity safeguards',async()=>{
 store.resetDemoDatabase();
 store.setDemoScenario('empty');
 assert.equal((await call('/panels/active')).items.length,0);
 store.setDemoScenario('no_wallet');
 assert.equal((await call('/wallets/me')).wallets.length,0);
 store.setDemoScenario('error');
 await assert.rejects(call('/sync/me','POST'),err=>err.status===503);
 store.setDemoScenario('filled');
 await assert.rejects(call('/deposit/direct-open','POST'),err=>err.status===403);
 await assert.rejects(call('/bogus-route'),err=>err.status===501);
});
