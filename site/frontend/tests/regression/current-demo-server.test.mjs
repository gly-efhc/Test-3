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
 const remote=demoRuntime({testMode:'neon'});await assert.rejects(remote.api('/sync/me','POST'),e=>e.code==='PREVIEW_DISABLED');
 const real=demoRuntime({preview:false});await assert.rejects(real.api('/admin/bank/balance','GET'),e=>e.code==='PREVIEW_DISABLED');
});
test('Admin transfer, target USER balance, report and journal are the same state',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');await h.api('/sync/me','POST');
 const before=h.store.readDemoAccount().main_balance;const body={global_id:'0000657667',direction:'credit',balance:'main',amount:'2.12345678',reason:'DEMO test'};
 const first=await h.api('/admin/transfer','POST',body,'transfer1');await h.api('/admin/transfer','POST',body,'transfer1');
 assert.equal(h.store.d8(h.store.readDemoAccount().main_balance)-h.store.d8(before),h.store.d8('2.12345678'));
 assert.equal((await h.api('/admin/users/0000657667','GET')).main_balance,h.store.readDemoAccount().main_balance);
 const logs=await h.api('/admin/logs/transfers','GET');assert.equal(logs.items.filter(x=>x.id===first.result.id).length,1);
 assert.equal((await h.api('/admin/reports/overview','GET')).facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('Admin bank emergency actions preserve supply and reject user role',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const initial=await h.api('/admin/reports/overview','GET');
 await h.api('/admin/bank/mint','POST',{amount:'5.00000000',reason:'DEMO test'},'mint1');
 await h.api('/admin/bank/mint','POST',{amount:'5.00000000',reason:'DEMO test'},'mint1');
 await h.api('/admin/bank/burn','POST',{amount:'2.00000000',reason:'DEMO test'},'burn1');
 const o=await h.api('/admin/reports/overview','GET');assert.equal(h.store.d8(o.facts.bank_metrics_expected_supply_efhc)-h.store.d8(initial.facts.bank_metrics_expected_supply_efhc),h.store.d8('3'));assert.equal(o.facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('Admin HUB CRUD changes USER links and replays creation without duplicates',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const b={code:'demo_link',title:'Проверка',url:'https://example.com/',is_active:true};
 const created=await h.api('/admin/hub/links','POST',b,'hub1');assert.equal((await h.api('/admin/hub/links','POST',b,'hub1')).id,created.id);
 assert.equal((await h.api('/hub/links','GET')).filter(x=>x.id===created.id).length,1);
 await h.api(`/admin/hub/links/${created.id}/toggle`,'POST',{},'hub-toggle');assert.equal((await h.api('/hub/links','GET')).some(x=>x.id===created.id),false);
});
test('Admin task editor changes USER catalog and reward transaction',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const t=await h.api('/admin/tasks','POST',{code:'test_task',title:'Проверка',bonus_efhc:'0.12345678',kind:'social',is_active:true},'task1');
 const before=h.store.readDemoAccount().bonus_balance;await h.api('/tasks/claim','POST',{task_id:t.id},'claim1');
 assert.equal(h.store.d8(h.store.readDemoAccount().bonus_balance)-h.store.d8(before),h.store.d8('0.12345678'));
 await assert.rejects(h.api('/tasks/claim','POST',{task_id:t.id},'claim2'),e=>e.code==='TASK_ALREADY_COMPLETED');
});
test('Admin withdrawal decisions update USER and rejection refunds exactly once',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const w=await h.api('/withdraw/request','POST',{amount:'10',wallet_id:1},'w1');
 await h.api(`/admin/withdrawals/${w.id}/reject`,'POST',{reason:'Демо проверка'},'reject1');const balance=h.store.readDemoAccount().main_balance;
 await h.api(`/admin/withdrawals/${w.id}/reject`,'POST',{reason:'Демо проверка'},'reject1');assert.equal(h.store.readDemoAccount().main_balance,balance);
 assert.equal((await h.api('/withdraw/list','GET')).items[0].status,'rejected');
});
test('DEMO roles, balances and replay keys remain scoped to selected account',async()=>{
 const h=demoRuntime();await h.api('/exchange/convert','POST',{amount_kwh:'1'},'same-key');const original=h.store.readDemoAccount().main_balance;
 h.store.selectDemoGlobalId('0000000002');await h.api('/panels/activate','POST',{},'same-key');assert.equal(h.store.readDemoAccount().activated_panels,1);
 h.store.selectDemoGlobalId('0000657667');assert.equal(h.store.readDemoAccount().main_balance,original);
});

test('direct DEMO deposit updates USER, Admin inbox, D8 bank and balance history once',async()=>{
 const h=demoRuntime();await h.api('/sync/me','POST');const before=h.store.readDemoAccount().main_balance;
 await h.api('/demo/deposits','POST',{amount:'12.12345678'},'deposit1');await h.api('/demo/deposits','POST',{amount:'12.12345678'},'deposit1');
 assert.equal(h.store.d8(h.store.readDemoAccount().main_balance)-h.store.d8(before),h.store.d8('12.12345678'));
 assert.equal((await h.api('/admin/efhc-deposits/inbox','GET')).items.length,1);
 assert.equal((await h.api('/wallets/balance-history','GET')).items[0].reason,'efhc_external_deposit');
 assert.equal((await h.api('/admin/reports/overview','GET')).facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('Shop external DEMO payment transitions once and uses the same USER/Admin order',async()=>{
 const h=demoRuntime();await h.api('/sync/me','POST');const before=h.store.readDemoAccount().main_balance;
 const intent=await h.api('/shopfront/create-intent','POST',{sku:'EFHC_PACKAGE_10',pay_method:'TON',client_nonce:'shop1'});
 assert.equal(intent.tonconnect_tx,null);h.advance(11000);
 const status=await h.api(`/shopfront/intent-status?intent_id=${intent.intent_id}`,'GET');assert.equal(status.status,'CONFIRMED');
 await h.api(`/shopfront/intent-status?intent_id=${intent.intent_id}`,'GET');
 assert.equal(h.store.d8(h.store.readDemoAccount().main_balance)-h.store.d8(before),h.store.d8('10'));
 const profile=await h.api('/shopfront/profile','GET');assert.equal(profile.orders.find(r=>r.id===intent.order_id).status,'FULFILLED');
 assert.equal((await h.api(`/admin/shop/order/${intent.order_id}`,'GET')).demo_fulfilled,true);
});
test('Shop VIP paid with EFHC debits main and does not create EFHC credit',async()=>{
 const h=demoRuntime();await h.api('/sync/me','POST');const before=h.store.readDemoAccount().main_balance;
 const result=await h.api('/shop/purchase-efhc','POST',{sku:'EFHC_VIP_NFT_ANY',quantity:1},'vip1');
 assert.equal(h.store.d8(before)-h.store.d8(h.store.readDemoAccount().main_balance),h.store.d8('500'));
 await h.api('/shop/purchase-efhc','POST',{sku:'EFHC_VIP_NFT_ANY',quantity:1},'vip1');
 assert.equal((await h.api(`/admin/shop/order/${result.order_id}`,'GET')).status,'FULFILLED');
 await assert.rejects(h.api('/shop/purchase-efhc','POST',{sku:'EFHC_PACKAGE_100'},'bad'),e=>e.code==='ITEM_NOT_PURCHASABLE');
});
test('DEMO ad reward requires a shown session and elapsed viewing time, pays once and updates Admin',async()=>{
 const h=demoRuntime();await h.api('/sync/me','POST');const before=h.store.readDemoAccount().bonus_balance;
 const session=await h.api('/ads/session','POST',{task_code:'demo_watch_builtin'});
 await assert.rejects(h.api(`/ads/session/${session.session_id}/client-complete`,'POST',{payload:{completed:true}}),e=>e.code==='REWARD_NOT_ALLOWED');
 await h.api(`/ads/session/${session.session_id}/shown`,'POST');h.advance(10000);
 await h.api(`/ads/session/${session.session_id}/client-complete`,'POST',{payload:{completed:true}});
 await h.api(`/ads/session/${session.session_id}/client-complete`,'POST',{payload:{completed:true}});
 assert.equal(h.store.d8(h.store.readDemoAccount().bonus_balance)-h.store.d8(before),h.store.d8('0.01'));
 assert.equal((await h.api('/admin/ads/dashboard','GET')).overall.completed_rewarded_views,1);
});
test('protective void, refund, USER exclusion and dead contour share one panel state',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const created=await h.api('/panels/activate','POST',{},'p1');
 h.advance(60000);await h.api('/sync/me','POST');
 await h.api(`/admin/panels/${created.panel.id}/deactivate`,'POST',{reason:'Демонстрация'},'void1');
 const count=h.store.readDemoAccount().panels.filter(p=>p.is_active).length;assert.equal(count,60);
 assert.equal((await h.api('/admin/panels?contour=dead','GET')).items[0].id,created.panel.id);
 const balance=h.store.readDemoAccount().main_balance;await h.api(`/admin/panels/${created.panel.id}/deactivate`,'POST',{reason:'Демонстрация'},'void1');assert.equal(h.store.readDemoAccount().main_balance,balance);
 assert.equal((await h.api('/admin/reports/overview','GET')).facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('empty/no-wallet/error scenarios and unsupported operations do not pretend success',async()=>{
 const h=demoRuntime();h.store.setDemoScenario('empty');const s=await h.api('/sync/me','POST');assert.equal(s.panels.active_count,0);assert.equal(s.exchange_preview.available_kwh,'0.00000000');
 await assert.rejects(h.api('/panels/activate','POST',{},'p'),e=>e.code==='DEMO_EMPTY_NO_FUNDS');
 h.store.setDemoScenario('no_wallet');await assert.rejects(h.api('/withdraw/request','POST',{amount:'10'},'w'),e=>e.code==='WITHDRAW_WALLET_MISSING');
 h.store.setDemoScenario('error');await assert.rejects(h.api('/sync/me','POST'),e=>e.code==='SCENARIO_ERROR');
 h.store.setDemoScenario('filled');h.store.setDemoRole('superadmin');await assert.rejects(h.api('/admin/not-a-real-endpoint','POST',{},'x'),e=>e.status===501);
 await assert.rejects(h.api('/not-a-real-endpoint','GET'),e=>e.status===501);
});
test('D8 validation and persisted transaction failures leave no partial credit',async()=>{
 const h=demoRuntime();await h.api('/sync/me','POST');h.store.setDemoRole('superadmin');const before=h.store.readDemoAccount().main_balance;
 for(const amount of ['1e8','0.000000001','-1','NaN','0'])await assert.rejects(h.api('/admin/transfer','POST',{global_id:'0000657667',amount,direction:'credit',balance:'main'},amount));
 assert.equal(h.store.readDemoAccount().main_balance,before);
 h.storage.set=()=>{throw Error('QuotaExceededError');};
 await assert.rejects(h.api('/demo/deposits','POST',{amount:'10'},'quota'),/QuotaExceededError/);assert.equal(h.store.readDemoAccount().main_balance,before);
});

test('every non-export Admin contract in the checked-in Workbench resolves to an explicit DEMO handler',async()=>{
 const {readFileSync}=await import('node:fs');const catalog=readFileSync(new URL('../../src/lib/adminRouteCatalog.ts',import.meta.url),'utf8');
 const rows=[...catalog.matchAll(/method: "([A-Z]+)", path: "([^"]+)"/g)];assert.ok(rows.length>=90);
 const h=demoRuntime();h.store.setDemoRole('superadmin');await h.api('/sync/me','POST');
 const a=h.store.readDemoAccount(),panel=a.panels[0].id;
 const withdrawal=await h.api('/withdraw/request','POST',{amount:'10',wallet_id:1},'contract-w');
 const seed=h.store.readDemoState().server;
 const params={global_id:a.global_id,panel_id:panel,request_id:withdrawal.id,task_id:seed.tasks[0].id,code:'builtin',link_id:seed.hub[0].id,package_id:seed.packages[0].id,order_id:seed.orders[0].id,transfer_log_id:seed.audit[0].id,key:'demo-message',submission_id:'1',tx_hash:'DEMO-no-match'};
 let tested=0;
 for(const [,method,template]of rows){
  if(template.includes('/logs/export.'))continue; // Binary formats are tested through the download UI.
  const route=template.replace(/\{([^}]+)\}/g,(_,key)=>String(params[key]));
  try{await h.api(route,method,{global_id:a.global_id,amount:'1',direction:'credit',balance:'main',reason:'DEMO',title:'DEMO',code:'demo-code'},'catalog-'+tested);}
  catch(e){assert.notEqual(e.status,501,`${method} ${route}: ${e.code}`);assert.notEqual(e.code,'ADMIN_PUBLIC_DEMO_READ_ONLY',`${method} ${route}: missing handler`);assert.ok(e.status>=400&&e.status<500,`${method} ${route}: ${e.stack}`);}
  tested++;
 }
 assert.equal(tested,rows.length-2);
});
test('domain reports are derived from changed balances, operations and panels',async()=>{
 const h=demoRuntime();await h.api('/demo/deposits','POST',{amount:'12.125'},'report-d');
 const deposits=await h.api('/admin/reports/deposits','GET');assert.equal(deposits.synthetic,true);assert.equal(deposits.snapshot.total_credited_in_range,'12.12500000');assert.equal(deposits.snapshot.auto_credited,1);
 const panels=await h.api('/admin/reports/panels','GET');assert.equal(panels.snapshot.active_panels,60);assert.equal(panels.snapshot.archived_panels,60);
 const bank=await h.api('/admin/reports/bank','GET');assert.equal(bank.snapshot.debit_events_in_range,1);assert.equal(bank.snapshot.debits_in_range,'12.12500000');
 const summary=await h.api('/admin/observability/summary','GET');assert.equal(summary.metrics[0].value,'1');
});

test('dead-panel reactivation preserves Panel ID, renews the term and pays once',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const {panel}=await h.api('/panels/activate','POST',{},'same-id-buy');
 h.advance(60000);await h.api(`/admin/panels/${panel.id}/deactivate`,'PATCH',{reason:'DEMO'},'same-id-void');
 const dead=await h.api(`/admin/panels/${panel.id}`,'GET');assert.equal(dead.generated_kwh,'0.00000000');assert.equal(dead.is_archived,false);
 const before=h.store.readDemoAccount(),count=before.panels.length,total=h.store.d8(before.main_balance)+h.store.d8(before.bonus_balance);
 const next=await h.api(`/admin/panels/${panel.id}/activate`,'PATCH',{reason:'DEMO'},'same-id-revive');
 assert.equal(next.item.id,panel.id);assert.equal(next.item.public_id,panel.public_id);assert.equal(h.store.readDemoAccount().panels.length,count);
 assert.equal(total-h.store.d8(h.store.readDemoAccount().main_balance)-h.store.d8(h.store.readDemoAccount().bonus_balance),h.store.d8('100'));
 await h.api(`/admin/panels/${panel.id}/activate`,'PATCH',{reason:'DEMO'},'same-id-revive');assert.equal(h.store.readDemoAccount().panels.length,count);
 assert.equal((Date.parse(next.item.expires_at)-Date.parse(next.item.activated_at))/86400000,180);
});


test('Admin and USER history share historical rows without changing the selected account',async()=>{
 const h=demoRuntime({withIndexedDB:true});h.store.demoAdminFixtureUsers=async()=>[];
 h.store.demoIndexedHistoryPage=async(gid,offset,limit)=>({items:offset?[]:[{id:'h1',global_id:gid,amount_efhc:'1.25000000',direction:'credit',balance_type:'bonus',reason:'task_bonus',created_at:'2026-10-30T12:00:00Z'}],total:1});
 const user=await h.api('/profile/history?limit=20','GET');const admin=await h.api('/admin/users/0000657667/history?limit=20','GET');
 assert.equal(user.items.length,1);assert.deepEqual(JSON.parse(JSON.stringify(admin.items)),JSON.parse(JSON.stringify(user.items)));
 assert.equal(h.store.readDemoState().selected_global_id,'0000657667');
});

test('legacy builtin-timer DEMO API is account-bound, time-gated and credits the same bank once',async()=>{
 const h=demoRuntime();await h.api('/sync/me','POST');
 const initial=h.store.readDemoAccount().bonus_balance;
 const slot=await h.api('/ads/slot?task_code=demo_watch_builtin&provider=builtin_timer','GET');
 assert.equal(slot.min_view_sec,10);assert.match(slot.token,/^demo-timer:/);
 await assert.rejects(h.api('/ads/callback/builtin_timer','POST',{token:slot.token}),e=>e.code==='REWARD_NOT_ALLOWED');
 h.advance(10000);
 const first=await h.api('/ads/callback/builtin_timer','POST',{token:slot.token});
 const second=await h.api('/ads/callback/builtin_timer','POST',{token:slot.token});
 assert.equal(first.replayed,false);assert.equal(second.replayed,true);
 assert.equal(h.store.d8(h.store.readDemoAccount().bonus_balance)-h.store.d8(initial),h.store.d8('0.01'));
 assert.equal(h.store.readDemoAccount().ad_views,1);
 assert.equal((await h.api('/admin/reports/overview','GET')).facts.bank_metrics_integrity_delta_efhc,'0.00000000');
 h.store.selectDemoGlobalId('0000000002');
 await assert.rejects(h.api('/ads/callback/builtin_timer','POST',{token:slot.token}),e=>e.code==='DEMO_TIMER_TOKEN_NOT_FOUND');
});
test('legacy timer refuses unsupported provider and expired DEMO sessions without credit',async()=>{
 const h=demoRuntime();
 await assert.rejects(h.api('/ads/slot?task_code=demo_watch_builtin&provider=external','GET'),e=>e.code==='DEMO_BUILTIN_PROVIDER_REQUIRED');
 const slot=await h.api('/ads/slot?task_code=demo_watch_builtin&provider=builtin_timer','GET');
 const before=h.store.readDemoAccount().bonus_balance;
 h.advance(300001);
 await assert.rejects(h.api('/ads/callback/builtin_timer','POST',{token:slot.token}),e=>e.code==='SESSION_EXPIRED');
 assert.equal(h.store.readDemoAccount().bonus_balance,before);
});

test('DEMO avatar preference follows Global ID and uses optimistic revision without external identity',async()=>{
 const h=demoRuntime();const first=await h.api('/profile/avatar','GET');
 assert.deepEqual(JSON.parse(JSON.stringify(first)),{preference:{schemaVersion:1,selection:{kind:'icon'},fallbackIcon:'EI-07'},revision:0,updatedAt:null});
 assert.deepEqual(JSON.parse(JSON.stringify(await h.api('/profile/avatar/sources','GET'))),{items:[]});
 const pref={schemaVersion:1,selection:{kind:'system',systemId:'avatar-03'},fallbackIcon:'EI-07'};
 const changed=await h.api('/profile/avatar','PUT',{expectedRevision:0,preference:pref});
 assert.equal(changed.revision,1);assert.deepEqual(JSON.parse(JSON.stringify((await h.api('/profile/avatar','GET')).preference)),pref);
 await assert.rejects(h.api('/profile/avatar','PUT',{expectedRevision:0,preference:pref}),e=>e.code==='AVATAR_REVISION_CONFLICT');
 await assert.rejects(h.api('/profile/avatar','PUT',{expectedRevision:1,preference:{...pref,selection:{kind:'url',url:'https://victim.invalid@evil.invalid/p.png'}}}),e=>e.code==='AVATAR_INVALID_SELECTION');
 h.store.selectDemoGlobalId('0000000002');assert.equal((await h.api('/profile/avatar','GET')).revision,0);
 h.store.selectDemoGlobalId('0000657667');assert.equal((await h.api('/profile/avatar','GET')).revision,1);
});
