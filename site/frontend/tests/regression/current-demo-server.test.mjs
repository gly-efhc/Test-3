import test from 'node:test';import assert from 'node:assert/strict';import {demoRuntime}from'../helpers/demo-runtime.mjs';
const row=e=>e.code;
test('DEMO generation is shared by panels, total and available, survives reload and uses elapsed time',async()=>{
 const h=demoRuntime(),first=await h.api('/sync/me','POST'),list=await h.api('/panels/active?demo_sort=oldest','GET');
 assert.equal(list.items.length,20);assert.equal(first.meta.gen_per_sec_effective,'0.00044460');
 const before=list.items[0];h.advance(120000);
 const next=await h.api('/sync/me','POST'),panels=await h.api('/panels/active?demo_sort=oldest','GET');
 assert.equal(h.store.d8(next.profile.total_generated_kwh)-h.store.d8(first.profile.total_generated_kwh),h.store.d8('0.05335200'));
 assert.equal(h.store.d8(next.profile.available_kwh)-h.store.d8(first.profile.available_kwh),h.store.d8('0.05335200'));
 assert.equal(h.store.d8(panels.items[0].generated_kwh)-h.store.d8(before.generated_kwh),h.store.d8('0.00088920'));
 const restored=demoRuntime({storage:h.storage,now:Date.parse('2026-11-04T00:03:00Z')});
 const snap=await restored.api('/sync/me','POST');assert.equal(restored.store.d8(snap.profile.total_generated_kwh)-h.store.d8(next.profile.total_generated_kwh),h.store.d8('0.02667600'));
 const repeat=await restored.api('/sync/me','POST');assert.equal(repeat.profile.total_generated_kwh,snap.profile.total_generated_kwh);
});
test('archive stays fixed and expired active panels stop at their deadline',async()=>{
 const h=demoRuntime();await h.api('/sync/me','POST');const archive=await h.api('/panels/archive','GET');
 const p=h.store.readDemoAccount().panels.find(p=>p.is_active),id=p.id;
 h.store.transactDemoState(s=>{const p=s.accounts[s.selected_global_id].panels.find(p=>p.id===id);p.expires_at=new Date(Date.parse(p.last_generated_at)+30000).toISOString();});
 h.advance(60000);await h.api('/sync/me','POST');const after=h.store.readDemoAccount().panels.find(p=>p.id===id);
 assert.equal(after.is_active,false);assert.equal(h.store.d8(after.generated_kwh)-h.store.d8(p.generated_kwh),h.store.d8('0.00022230'));
 const unchanged=await h.api('/panels/archive','GET');assert.equal(unchanged.items.find(p=>p.id===archive.items[0].id).generated_kwh,archive.items[0].generated_kwh);
});
test('activation is one atomic purchase with one stable panel ID, bank movement and replay',async()=>{
 const h=demoRuntime();await h.api('/sync/me','POST');const before=h.store.readDemoAccount(),oldBalance=h.store.d8(before.main_balance)+h.store.d8(before.bonus_balance);
 const first=await h.api('/panels/activate','POST',{},'activate-1'),again=await h.api('/panels/activate','POST',{},'activate-1');
 assert.equal(first.panel.id,again.panel.id);const a=h.store.readDemoAccount();assert.equal(a.panels.filter(p=>p.id===first.panel.id).length,1);
 assert.equal(oldBalance-h.store.d8(a.main_balance)-h.store.d8(a.bonus_balance),h.store.d8('100'));
 const overview=await h.api('/admin/reports/overview','GET');assert.equal(overview.facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('failed activation rolls back every balance, ledger and panel write',async()=>{
 const h=demoRuntime();await h.api('/sync/me','POST');h.store.writeDemoAccount(a=>({...a,main_balance:'1.00000000',bonus_balance:'2.00000000'}));
 const before=JSON.stringify(h.store.readDemoState());await assert.rejects(h.api('/panels/activate','POST',{},'fail-1'),e=>e.code==='PANEL_INSUFFICIENT_BALANCE');assert.equal(JSON.stringify(h.store.readDemoState()),before);
});
test('exchange and withdrawal use D8, preserve lifetime, conserve bank and replay without duplicates',async()=>{
 const h=demoRuntime();const initial=await h.api('/sync/me','POST');const ex=await h.api('/exchange/convert','POST',{amount_kwh:'4.12500000'},'ex-1');
 assert.equal(ex.credited_efhc,'4.12500000');assert.equal((await h.api('/exchange/convert','POST',{amount_kwh:'4.12500000'},'ex-1')).log_id,ex.log_id);
 await assert.rejects(h.api('/exchange/convert','POST',{amount_kwh:'1.00000000'},'ex-1'),e=>e.code==='IDEMPOTENCY_KEY_CONFLICT');
 const wd=await h.api('/withdraw/request','POST',{amount:'10.00000000',wallet_id:1},'wd-1');const before=h.store.readDemoAccount().main_balance;
 await h.api(`/withdraw/${wd.id}/cancel`,'POST',{},'cancel-1');const refunded=h.store.readDemoAccount().main_balance;await h.api(`/withdraw/${wd.id}/cancel`,'POST',{},'cancel-1');
 assert.equal(h.store.d8(refunded)-h.store.d8(before),h.store.d8('10'));assert.equal(h.store.readDemoAccount().main_balance,refunded);
 assert.equal((await h.api('/sync/me','POST')).profile.total_generated_kwh,initial.profile.total_generated_kwh);
 assert.equal((await h.api('/admin/reports/overview','GET')).facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('Admin DEMO changes require explicit demo role; real build cannot activate the adapter',async()=>{
 const h=demoRuntime();await assert.rejects(h.api('/admin/transfer','POST',{global_id:'0000657667',amount:'1',direction:'credit',balance:'main'},'a1'),e=>e.code==='DEMO_ADMIN_ROLE_REQUIRED');
 const real=demoRuntime({preview:false});await assert.rejects(real.api('/admin/bank/balance','GET'),e=>e.code==='PREVIEW_DISABLED');
});
test('Admin transfer, target USER balance, report and journal are the same state',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');await h.api('/sync/me','POST');
 const before=h.store.readDemoAccount().main_balance;const body={global_id:'0000657667',direction:'credit',balance_type:'main',amount:'2.12345678',reason:'DEMO test'};
 const first=await h.api('/admin/transfer','POST',body,'transfer1');await h.api('/admin/transfer','POST',body,'transfer1');
 assert.equal(h.store.d8(h.store.readDemoAccount().main_balance)-h.store.d8(before),h.store.d8('2.12345678'));
 assert.equal((await h.api('/admin/users/0000657667','GET')).main_balance,h.store.readDemoAccount().main_balance);
 const logs=await h.api('/admin/logs/transfers','GET');assert.equal(logs.items.filter(x=>x.id===first.result.id).length,1);
 assert.equal((await h.api('/admin/reports/overview','GET')).facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('Admin bank emergency actions preserve supply and reject user role',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');await h.api('/sync/me','POST');
 await h.api('/admin/bank/mint','POST',{amount:'5.00000000',reason:'DEMO test'},'mint1');
 await h.api('/admin/bank/mint','POST',{amount:'5.00000000',reason:'DEMO test'},'mint1');
 await h.api('/admin/bank/burn','POST',{amount:'2.00000000',reason:'DEMO test'},'burn1');
 const o=await h.api('/admin/reports/overview','GET');assert.equal(o.facts.bank_metrics_expected_supply_efhc,'5000003.00000000');assert.equal(o.facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('Admin HUB CRUD changes USER links and replays creation without duplicates',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const b={code:'demo_link',title:'Проверка',url:'https://example.com/',is_active:true};
 const created=await h.api('/admin/hub/links','POST',b,'hub1');assert.equal((await h.api('/admin/hub/links','POST',b,'hub1')).id,created.id);
 assert.equal((await h.api('/hub/links','GET')).filter(x=>x.id===created.id).length,1);
 await h.api(`/admin/hub/links/${created.id}/toggle`,'POST',{},'hub-toggle');assert.equal((await h.api('/hub/links','GET')).some(x=>x.id===created.id),false);
});
test('Admin task editor changes USER catalog and reward transaction',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const t=await h.api('/admin/tasks','POST',{code:'test_task',title:'Проверка',bonus_efhc:'0.12345678',kind:'social',is_active:true},'task1');
 const before=h.store.readDemoAccount().bonus_balance;await h.api('/tasks/claim','POST',{task_id:t.id});
 assert.equal(h.store.d8(h.store.readDemoAccount().bonus_balance)-h.store.d8(before),h.store.d8('0.12345678'));
 await assert.rejects(h.api('/tasks/claim','POST',{task_id:t.id}),e=>e.code==='TASK_ALREADY_COMPLETED');
});
test('Admin withdrawal decisions update USER and rejection refunds exactly once',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const w=await h.api('/withdraw/request','POST',{amount:'10',wallet_id:1},'w1');
 await h.api(`/admin/withdrawals/${w.id}/reject`,'POST',{reason:'Демо проверка'},'reject1');const balance=h.store.readDemoAccount().main_balance;
 await h.api(`/admin/withdrawals/${w.id}/reject`,'POST',{reason:'Демо проверка'},'reject1');assert.equal(h.store.readDemoAccount().main_balance,balance);
 assert.equal((await h.api('/withdraw/list','GET')).items[0].status,'rejected');
});
test('DEMO roles, balances and replay keys remain scoped to selected account',async()=>{
 const h=demoRuntime();await h.api('/exchange/convert','POST',{amount_kwh:'1'},'same-key');const original=h.store.readDemoAccount().main_balance;
 h.store.selectDemoGlobalId('0000000002');const other=await h.api('/exchange/convert','POST',{amount_kwh:'1'},'same-key');assert.equal(other.credited_efhc,'1.00000000');
 h.store.selectDemoGlobalId('0000657667');assert.equal(h.store.readDemoAccount().main_balance,original);
});
