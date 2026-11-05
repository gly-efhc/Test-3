import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {d8,formatD8,isLocalDemoActive,readDemoState,subscribeDemoState} from '../reconstruction/demoUnifiedStore';
import {BASE_RATE,VIP_RATE} from '../reconstruction/demoServerCore';

const disabledSubscribe=()=>()=>{};
const empty=()=>null;
/** Shared read-only projection of the same DEMO account. A local tick never
 * writes a balance, performs an API request or grants a real identity. */
export function useDemoGenerationProjection(){
 const enabled=isLocalDemoActive();
 const state=useSyncExternalStore(enabled?subscribeDemoState:disabledSubscribe,enabled?readDemoState:empty,empty);
 const [,tick]=useState(0);
 const anchor=useRef({iso:'',clientMs:0});
 const iso=state?.server?.as_of_utc||'';
 if(anchor.current.iso!==iso)anchor.current={iso,clientMs:performance.now()};
 useEffect(()=>{if(!enabled)return;const id=window.setInterval(()=>tick(x=>x+1),333);return()=>window.clearInterval(id);},[enabled]);
 if(!state?.server||!iso)return null;
 const a=state.accounts[state.selected_global_id];if(!a?.panels)return null;
 if(state.scenario==='empty')return {total_generated_kwh:'0.00000000',available_kwh:'0.00000000',panels:{} as Record<string,string>};
 const now=Date.parse(iso)+Math.max(0,performance.now()-anchor.current.clientMs),rate=d8(a.is_vip===true?VIP_RATE:BASE_RATE);
 let delta=0n;const panels:Record<string,string>={};
 for(const p of a.panels){
  let add=0n;
  if(p.is_active&&!p.meta?.protectively_voided){const elapsed=Math.max(0,Math.floor(Math.min(now,Date.parse(p.expires_at))-Date.parse(p.last_generated_at)));
   add=(rate*BigInt(elapsed)+BigInt(p.remainder||'0'))/1000n;}
  panels[p.id]=formatD8(d8(p.generated_kwh)+add);delta+=add;
 }
 return {total_generated_kwh:formatD8(d8(a.total_generated_kwh)+delta),available_kwh:formatD8(d8(a.available_kwh)+delta),panels};
}
