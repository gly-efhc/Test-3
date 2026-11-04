import test from 'node:test';
import assert from 'node:assert/strict';
import {demoRuntime} from '../helpers/demo-runtime.mjs';

const numeric=['reserve_efhc','circulation_efhc','expected_supply_efhc','actual_mass_efhc','integrity_delta_efhc','users_main_efhc','users_bonus_efhc','new_obligations_efhcm','fixed_obligations_efhcm','panel_spent_efhc','generated_kwh','converted_kwh','pending_kwh','reserve_pct','circulation_pct','users_main_pct','users_bonus_pct','actual_mass_pct','new_obligations_pct','fixed_obligations_pct','panel_spent_pct','generated_pct','converted_pct','pending_pct','integrity_pct'];
const facts=h=>h.api('/admin/reports/overview','GET').then(x=>x.facts);

test('Bank response supplies every amount and percent consumed by its eleven visible rows',async()=>{
 const h=demoRuntime(),f=await facts(h);
 for(const key of numeric)assert.match(f['bank_metrics_'+key]||'',/^-?\d+\.\d{8}$/,key+' must not silently become a UI zero');
 assert.equal(f.bank_metrics_ready,'1');
 assert.equal(f.bank_metrics_users_main_efhc,'12345600.12345678');
 assert.equal(f.bank_metrics_users_bonus_efhc,'78.00000000');
 assert.equal(f.bank_metrics_panel_spent_efhc,'12000.00000000');
 assert.notEqual(f.bank_metrics_generated_kwh,'0.00000000');
});

function smallBank(h,{reserve='400.00000000',supply='1000.00000000',main='500.00000000',bonus='100.00000000'}={}){
 h.store.transactDemoState(s=>{
  const a=s.accounts[s.selected_global_id];s.accounts={[a.global_id]:a};a.main_balance=main;a.bonus_balance=bonus;a.total_generated_kwh='190.00000000';a.available_kwh='160.00000000';a.exchanges=[];a.ledger=[];
  const common={global_id:a.global_id,activated_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',last_generated_at:'2026-11-04T00:00:00Z',expires_at:'2027-01-01T00:00:00Z',remainder:'0',base_gen_per_sec:'0.00000692',archived_at:null};
  a.panels=[{...common,id:'custom-active',public_id:'A',generated_kwh:'150.00000000',is_active:true,is_archived:false},{...common,id:'custom-archive',public_id:'B',generated_kwh:'40.00000000',is_active:false,is_archived:true}];
  Object.assign(s.server,{bank_balance:reserve,supply_initial:supply,minted:'0.00000000',burned:'0.00000000',audit:[{id:1,global_id:a.global_id,amount_efhc:'100.00000000',direction:'debit',balance_type:'main',reason:'panel_purchase'},{id:2,global_id:a.global_id,amount_efhc:'20.00000000',direction:'debit',balance_type:'bonus',reason:'panel_purchase'},{id:3,global_id:a.global_id,amount_efhc:'100.00000000',direction:'debit',balance_type:'main',reason:'panel_activation'}]});
 });
}
test('Bank uses the distinct percent bases and signed snapshot values instead of one denominator',async()=>{
 const h=demoRuntime();await facts(h);smallBank(h);const f=await facts(h);
 const expected={users_main_efhc:'500.00000000',users_bonus_efhc:'100.00000000',actual_mass_efhc:'1000.00000000',panel_spent_efhc:'220.00000000',generated_kwh:'190.00000000',converted_kwh:'30.00000000',pending_kwh:'160.00000000',new_obligations_efhcm:'-30.00000000',fixed_obligations_efhcm:'-60.00000000',panel_spent_pct:'44.00000000',generated_pct:'19.00000000',converted_pct:'15.78947368',pending_pct:'84.21052632',new_obligations_pct:'-3.00000000',fixed_obligations_pct:'-6.00000000'};
 for(const [key,value]of Object.entries(expected))assert.equal(f['bank_metrics_'+key],value,key);
});
test('Bank integrity exposes supply mismatch and zero denominators without renormalizing it away',async()=>{
 const h=demoRuntime();await facts(h);smallBank(h,{reserve:'401.00000000'});let f=await facts(h);
 assert.equal(f.bank_metrics_integrity_ok,'0');assert.equal(f.bank_metrics_integrity_delta_efhc,'1.00000000');assert.equal(f.bank_metrics_integrity_pct,'100.10000000');
 smallBank(h,{reserve:'0.00000000',supply:'0.00000000',main:'0.00000000',bonus:'0.00000000'});f=await facts(h);assert.equal(f.bank_metrics_integrity_pct,'0.00000000');assert.equal(f.bank_metrics_panel_spent_pct,'0.00000000');
});
test('Bank stores a prepared snapshot atomically with deposit and preserves replay semantics',async()=>{
 const h=demoRuntime();await facts(h);const before=h.store.readDemoState().server.bank_snapshot;
 assert.ok(before?.facts.bank_metrics_users_main_efhc);
 await h.api('/demo/deposits','POST',{amount:'2.12345678'},'bank-deposit');
 const first=h.store.readDemoState().server.bank_snapshot;
 assert.equal(h.store.d8(first.facts.bank_metrics_users_main_efhc)-h.store.d8(before.facts.bank_metrics_users_main_efhc),212345678n);
 await h.api('/demo/deposits','POST',{amount:'2.12345678'},'bank-deposit');
 assert.equal(h.store.readDemoState().server.bank_snapshot.facts.bank_metrics_users_main_efhc,first.facts.bank_metrics_users_main_efhc);
 assert.equal(first.facts.bank_metrics_integrity_delta_efhc,'0.00000000');
});
test('Bank panel spend reverses the original price after protective void and counts same-ID reactivation once',async()=>{
 const h=demoRuntime();h.store.setDemoRole('superadmin');const initial=await facts(h),p=await h.api('/panels/activate','POST',{},'bank-panel');h.advance(120000);
 const snap=await h.api('/sync/me','POST');await h.api('/exchange/convert','POST',{amount_kwh:snap.profile.available_kwh},'bank-exchange');
 await h.api(`/admin/panels/${p.panel.id}/deactivate`,'POST',{reason:'DEMO regression'},'bank-void');
 assert.equal((await facts(h)).bank_metrics_panel_spent_efhc,initial.bank_metrics_panel_spent_efhc);
 const result=await h.api(`/admin/panels/${p.panel.id}/activate`,'POST',{reason:'DEMO regression'},'bank-reactivate');
 await h.api(`/admin/panels/${p.panel.id}/activate`,'POST',{reason:'DEMO regression'},'bank-reactivate');
 assert.equal(h.store.d8((await facts(h)).bank_metrics_panel_spent_efhc)-h.store.d8(initial.bank_metrics_panel_spent_efhc),10000000000n);
});

test('Bank refuses incomplete or malformed snapshots instead of showing invented zeroes',async()=>{
 const h=demoRuntime();const snapshot=await h.api('/admin/reports/overview','GET');
 const {requireBankSnapshot}=h.loadSource('lib/adminBankSnapshot.ts');
 assert.equal(requireBankSnapshot(snapshot),snapshot);
 for(const field of numeric){
  const partial=structuredClone(snapshot);delete partial.facts['bank_metrics_'+field];
  assert.throws(()=>requireBankSnapshot(partial),/BANK_SNAPSHOT_INCOMPLETE/);
 }
 const malformed=structuredClone(snapshot);malformed.facts.bank_metrics_users_main_efhc='NaN';
 assert.throws(()=>requireBankSnapshot(malformed),/BANK_SNAPSHOT_INCOMPLETE/);
});
