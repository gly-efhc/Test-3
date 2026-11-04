/** Live PostgreSQL read-only inspector for the public synthetic TEST dataset. */
import React,{useEffect,useState} from "react";
import {useRouter} from "next/router";
import {getNeonBank,getNeonAccount,getNeonPanels,getNeonLedger,assertGlobalId,type Bank,type Account,type Panel,type Ledger} from "../reconstruction/neonDemoDataApi";
const tile:React.CSSProperties={padding:12,border:"1px solid var(--tg-hint-color,#738099)",borderRadius:10,background:"var(--tg-secondary-bg,#202337)"};
const button:React.CSSProperties={padding:"9px 12px",cursor:"pointer",borderRadius:8,border:"1px solid #8e9ab0",background:"transparent",color:"inherit"};
const asError=(x:unknown)=>x instanceof Error?x.message:String(x);
export default function NeonDataPage(){
 const router=useRouter();
 const [entered,setEntered]=useState("0000657667"),[gid,setGid]=useState("0000657667"),[reload,setReload]=useState(0);
 const [bank,setBank]=useState<Bank|null>(null),[account,setAccount]=useState<Account|null>(null);
 const [panels,setPanels]=useState<Panel[]>([]),[ledger,setLedger]=useState<Ledger[]>([]);
 const [pOffset,setPOffset]=useState(0),[lOffset,setLOffset]=useState(0);
 const [error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);setError(null);setBank(null);setAccount(null);setPanels([]);setLedger([]);
  void Promise.all([getNeonBank(),getNeonAccount(gid),getNeonPanels(gid),getNeonLedger(gid)]).then(([b,a,p,h])=>{
   if(!active)return;setBank(b);setAccount(a);setPanels(p);setLedger(h);setPOffset(0);setLOffset(0);
  }).catch(e=>{if(active)setError(asError(e));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[gid,reload]);
 const change=()=>{try{const v=assertGlobalId(entered);if(v===gid)setReload(n=>n+1);else setGid(v);}catch(e){setError(asError(e));}};
 async function paginate(kind:"panels"|"ledger",delta:number){
  const offset=Math.max(0,(kind==="panels"?pOffset:lOffset)+delta*20);setLoading(true);
  try{if(kind==="panels"){setPanels(await getNeonPanels(gid,offset));setPOffset(offset);}else{setLedger(await getNeonLedger(gid,offset));setLOffset(offset);}setError(null);}
  catch(e){setError(asError(e));}finally{setLoading(false);}
 }
 const facts=bank?.facts??{},counts=bank?.counters??{};
 const cell=(label:string,value:string|number,unit="")=><div style={tile}><small style={{opacity:.75}}>{label}</small><div style={{fontSize:19,fontWeight:650,overflowWrap:"anywhere"}}>{value} {unit}</div></div>;
 return <main data-neon-data-source="EFHC_Nektron_Test" style={{maxWidth:900,margin:"auto",padding:"20px 16px 120px",color:"var(--tg-text-color,#fff)"}}>
  <h1 style={{fontSize:23,marginBottom:8}}>Neon TEST — данные PostgreSQL</h1>
  <p style={{opacity:.8,marginBottom:12}}>Реальный HTTPS Data API новой DEMO-базы, только чтение. Данные финансовых действий в основном приложении пока остаются отдельным локальным симулятором. Никаких паролей, переводов и записей в Neon из браузера.</p>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:15}}><button style={button} onClick={()=>setReload(n=>n+1)} disabled={loading}>Обновить из Neon</button><button style={button} onClick={()=>void router.push("/demo-lab")}>Настройки просмотра</button></div>
  {loading&&<p role="status">Чтение базы данных…</p>}
  {error&&<p role="alert" style={{...tile,borderColor:"#ca6666"}}>Ошибка соединения с Neon: {error}. Подмена локальным DEMO запрещена.</p>}
  {bank&&<><p role="status">Источник: {bank.database_scope}, {bank.dataset}. Снимок {new Date(bank.ts).toLocaleString("ru-RU")}. Целостность: {facts.bank_metrics_integrity_ok==="1"?"PASS":"НЕ ПРОЙДЕНА"}.</p>
   <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:9,margin:"12px 0 18px"}}>
     {cell("Пользователей",counts.users_total??"—")}{cell("Панелей",counts.panels_total??"—")}{cell("Активных",counts.panels_active??"—")}
     {cell("Резерв",facts.bank_metrics_reserve_efhc??"—","EFHC")}{cell("В обороте",facts.bank_metrics_circulation_efhc??"—","EFHC")}
     {cell("Масса",facts.bank_metrics_actual_mass_efhc??"—","EFHC")}{cell("Оплата Панелей",facts.bank_metrics_panel_spent_efhc??"—","EFHC")}
     {cell("Генерация",facts.bank_metrics_generated_kwh??"—","kWh")}{cell("Обменено",facts.bank_metrics_converted_kwh??"—","kWh")}
     {cell("В ожидании",facts.bank_metrics_pending_kwh??"—","kWh")}
   </section>
  </>}
  <section style={{...tile,marginBottom:14}}><h2 style={{fontSize:18}}>Пользователь DEMO</h2>
   <form onSubmit={e=>{e.preventDefault();change();}} style={{display:"flex",gap:7,marginTop:8}}>
     <input aria-label="Global ID" inputMode="numeric" maxLength={10} value={entered} onChange={e=>setEntered(e.target.value)}
      style={{minWidth:0,flex:1,padding:9,borderRadius:8,color:"inherit",background:"transparent",border:"1px solid #8e9ab0"}}/>
     <button style={button} type="submit" disabled={loading}>Загрузить</button>
   </form>
   {account&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:8,marginTop:12}}>
     {cell("Global ID",account.global_id)}{cell("EFHCm",account.main_balance)}{cell("EFHCb",account.bonus_balance)}
     {cell("Генерация",account.total_generated_kwh,"kWh")}{cell("Обменено",account.exchanged_kwh_total,"kWh")}{cell("Осталось",account.available_kwh,"kWh")}
   </div>}
  </section>
  {account&&<><section style={{...tile,marginBottom:14}}>
   <h2 style={{fontSize:18}}>Панели — записи Neon</h2>
   <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>Панель</th><th>Статус</th><th>kWh</th><th>Оплата</th></tr></thead>
   <tbody>{panels.map(p=><tr key={p.id}><td>{p.public_id}</td><td>{p.is_archived?"Архив":p.is_active?"Активна":"Неактивна"}</td><td>{p.generated_kwh}</td><td>{p.purchase_event_id?"Есть":"Нет"}</td></tr>)}</tbody></table></div>
   <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}><button style={button} disabled={loading||pOffset===0} onClick={()=>void paginate("panels",-1)}>Назад</button><span>{pOffset+1}–{pOffset+panels.length}</span><button style={button} disabled={loading||panels.length<20} onClick={()=>void paginate("panels",1)}>Далее</button></div>
  </section><section style={tile}>
   <h2 style={{fontSize:18}}>Финансовый журнал — записи Neon</h2>
   <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>Дата</th><th>Операция</th><th>Сторона</th><th>EFHC</th></tr></thead>
   <tbody>{ledger.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString("ru-RU")}</td><td>{x.reason}</td><td>{x.direction==="credit"?"Начисление":"Списание"}</td><td>{x.amount}</td></tr>)}</tbody></table></div>
   <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}><button style={button} disabled={loading||lOffset===0} onClick={()=>void paginate("ledger",-1)}>Назад</button><span>{lOffset+1}–{lOffset+ledger.length}</span><button style={button} disabled={loading||ledger.length<20} onClick={()=>void paginate("ledger",1)}>Далее</button></div>
  </section></>}
 </main>;
}
