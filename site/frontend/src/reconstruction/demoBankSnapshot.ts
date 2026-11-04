import canonical from './demo-tables-v866.json';
import {d8,formatD8,DEMO_GLOBAL_ID,type DemoControlState} from './demoUnifiedStore';
import type {AdminBankSnapshot} from '../lib/adminBankSnapshot';

const openingIds=new Set([...canonical.panels.active,...canonical.panels.archive].map(p=>String(p.id)));
const paymentReasons=new Set(['panel_purchase','panel_activation','panel_reactivation']);
const price=10000000000n;
const sum=(rows:Record<string,any>[],key:string)=>rows.reduce((n,r)=>n+d8(String(r[key]||'0')),0n);
/** Signed, integer D8 percentages; the caller supplies the metric's own base. */
function percent(numerator:bigint,denominator:bigint):string {
  if(denominator===0n)return '0.00000000';
  const negative=(numerator<0n)!==(denominator<0n);
  const n=numerator<0n?-numerator:numerator,d=denominator<0n?-denominator:denominator;
  const result=(n*10000000000n+d/2n)/d;
  return formatD8(negative?-result:result);
}

/** Prepared by the existing local operation model before its atomic commit.
 * This is browser DEMO data, never a production finance calculation in React. */
export function demoBankSnapshot(state:DemoControlState):AdminBankSnapshot|null {
  const server=state.server;if(!server)return null;
  const users=Object.values(state.accounts),allPanels=users.flatMap(a=>a.panels||[]);
  const panels=allPanels.filter(p=>!p.meta?.protectively_voided);
  const main=sum(users,'main_balance'),bonus=sum(users,'bonus_balance'),reserve=d8(server.bank_balance);
  const actual=reserve+main+bonus,expected=d8(server.supply_initial)+d8(server.minted)-d8(server.burned);
  const generated=sum(panels,'generated_kwh');
  const converted=users.reduce((n,a)=>n+d8(a.total_generated_kwh)-d8(a.available_kwh),0n);
  // The frozen opening panels predate the live journal. Count that opening
  // inventory once; subsequent purchases/reactivations come from actual debits.
  const neonSeed=server.settings?.neon_seed_cycle==="RECON_CYCLE_0027";
  let paid=BigInt(neonSeed?allPanels.length:allPanels.filter(p=>p.global_id===DEMO_GLOBAL_ID&&openingIds.has(p.id)).length)*price;
  const payments=new Map<string,Record<string,any>>();
  for(const r of [...server.audit,...users.flatMap(a=>a.ledger)]){
    if(r.direction!=='debit'||!paymentReasons.has(r.reason))continue;
    const key=[r.global_id,r.id,r.balance_type,r.reason].join(':');
    payments.set(key,r);
  }
  paid+=sum([...payments.values()],'amount_efhc');
  // Reverse the original fixed payment, not the smaller NET protective refund.
  const voided=allPanels.reduce((n,p)=>n+BigInt((p.meta?.protective_events||[]).filter((e:Record<string,any>)=>e.operation==='protective_deactivate').length)*price,0n);
  const spent=paid>voided?paid-voided:0n;
  const fixed=panels.filter(p=>!p.is_active||p.is_archived);
  const fixedObligations=sum(fixed,'generated_kwh')-BigInt(fixed.length)*price;
  const values:Record<string,bigint>={reserve_efhc:reserve,circulation_efhc:main+bonus,users_main_efhc:main,users_bonus_efhc:bonus,
    actual_mass_efhc:actual,expected_supply_efhc:expected,integrity_delta_efhc:actual-expected,
    generated_kwh:generated,converted_kwh:converted,pending_kwh:generated-converted,panel_spent_efhc:spent,
    new_obligations_efhcm:generated-spent,fixed_obligations_efhcm:fixedObligations};
  const percentages:Record<string,[bigint,bigint]>={reserve:[reserve,expected],circulation:[main+bonus,expected],users_main:[main,expected],users_bonus:[bonus,expected],actual_mass:[actual,expected],integrity:[actual,expected],
    new_obligations:[generated-spent,actual],fixed_obligations:[fixedObligations,expected],panel_spent:[spent,main],generated:[generated,actual],converted:[converted,generated],pending:[generated-converted,generated]};
  const ts=new Date().toISOString();
  const facts:Record<string,string>={bank_metrics_ready:'1',bank_metrics_integrity_ok:actual===expected?'1':'0',bank_metrics_updated_at:ts};
  for(const [key,value]of Object.entries(values))facts['bank_metrics_'+key]=formatD8(value);
  for(const [key,[value,base]]of Object.entries(percentages))facts['bank_metrics_'+key+'_pct']=percent(value,base);
  return {ok:true,facts,ts,notes:null};
}
