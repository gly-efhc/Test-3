/** Public Pages-only data laboratory — never authenticates an administrator or wallet. */
import React,{useEffect,useState} from "react";
import {useRouter} from "next/router";
import {bootstrapDemoIndexedDb,DEMO_GLOBAL_ID,DEMO_TABLE_NAMES,readDemoAccount,readDemoState,
  selectDemoGlobalId,setDemoScenario,setDemoRole,resetDemoDatabase,demoTableCount,demoTableRows,demoLedgerMutation,
  isDemoPreviewEnabled,type DemoScenario,type DemoRole,type DemoControlState} from "../reconstruction/demoUnifiedStore";
import {useQueryClient} from "@tanstack/react-query";
import {isNeonStagingRequested,neonStagingControl,neonStagingApiRequest,clearNeonStagingSession} from "../reconstruction/neonStagingBridge";
import demoRoutes from "../reconstruction/demo-route-catalog-v893.json";

export default function DemoLabPage(){
 const router=useRouter(),client=useQueryClient();
 const remote=isNeonStagingRequested();
 const [testPassword,setTestPassword]=useState("");
 const [testSnapshot,setTestSnapshot]=useState<{profile:{global_id:string;main_balance:string;bonus_balance:string;available_kwh:string}}|null>(null);
 const refreshTestSnapshot=async()=>{try{const x=await neonStagingApiRequest<{profile:{global_id:string;main_balance:string;bonus_balance:string;available_kwh:string}}>("/sync/me","POST");setTestSnapshot(x);}catch(e){setTestSnapshot(null);setRemoteStatus("Серверный профиль недоступен: "+String(e));}};
 const [remoteStatus,setRemoteStatus]=useState("Не подключён");
 const [remoteSchema,setRemoteSchema]=useState<{total:number;tables:{schema:string;name:string}[]}|null>(null);
 const [ready,setReady]=useState(false),[state,setState]=useState<DemoControlState|null>(null);
 const [candidate,setCandidate]=useState(DEMO_GLOBAL_ID),[message,setMessage]=useState("");
 const [loading,setLoading]=useState(false),[counts,setCounts]=useState<Record<string,number>>({});
 const [amount,setAmount]=useState("10.00000000");
 const [currentTable,setCurrentTable]=useState<typeof DEMO_TABLE_NAMES[number]>("accounts");
 const [tableRows,setTableRows]=useState<Record<string,unknown>[]>([]);
 const [tableMessage,setTableMessage]=useState("");
 useEffect(()=>{
  const sync=()=>{setReady(isDemoPreviewEnabled());if(isDemoPreviewEnabled()){
   const next=readDemoState();setState({...next});setCandidate(next.selected_global_id);
  }};
  sync();const listener=()=>sync();window.addEventListener("efhc:demo:state-changed",listener);
  return ()=>window.removeEventListener("efhc:demo:state-changed",listener);
 },[]);
 const handleTestLogin=async()=>{
  try{const x=await neonStagingControl<{global_id:string}>("/api/staging/login","POST",{password:testPassword});setTestPassword("");setRemoteStatus("Neon TEST: оператор авторизован; Global ID "+x.global_id);selectDemoGlobalId(x.global_id);await refreshTestSnapshot();}
  catch(e){setRemoteStatus("Вход не выполнен: "+String(e));} };
 const handleTestSchema=async()=>{try{const x=await neonStagingControl<{total:number;tables:{schema:string;name:string}[]}>("/api/staging/schema");setRemoteSchema(x);setRemoteStatus("Получена фактическая структура Neon TEST");}catch(e){setRemoteStatus("Ошибка доступа: "+String(e));}};
 const withAction=(callback:()=>void)=>{try{callback();setMessage("DEMO: локальное состояние обновлено");void client.invalidateQueries();}catch(error){setMessage(error instanceof Error?error.message:String(error));}};
 useEffect(()=>{if(!remote||!ready)return;
  void neonStagingControl<{global_id:string}>("/api/staging/session").then(x=>{
    selectDemoGlobalId(x.global_id);setRemoteStatus("Neon TEST: действующая сессия "+x.global_id);
    void refreshTestSnapshot();
  }).catch(()=>setRemoteStatus("Требуется вход оператора Neon TEST"));
 // Deliberately one mount check; no polling of protected data from an unauthenticated preview.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[remote,ready]);
 const loadDatabase=async()=>{
  setLoading(true);setMessage("Проверка 39 IndexedDB-таблиц и загрузка канонических DEMO-записей…");
  try{
   await bootstrapDemoIndexedDb();const result:Record<string,number>={};
   for(const name of DEMO_TABLE_NAMES)result[name]=await demoTableCount(name);
   setCounts(result);setMessage("Все таблицы созданы и заполнены по доступным данным эталона v866");
  }catch(err){setMessage(err instanceof Error?err.message:String(err));}finally{setLoading(false);}
 };
 // Automatically expose real counts on the Pages laboratory. The root App
 // triggers the same bootstrap; the store deduplicates concurrent calls.
 useEffect(()=>{if(ready&&!remote)void loadDatabase();
 // One initialization per selected mode, not per mutable balance/counter.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,remote]);
 if(!ready)return <main style={{padding:20,maxWidth:760,margin:"auto"}}><h1>DEMO Laboratory</h1><p>Доступен только в изолированном публичном Pages-DEMO.</p></main>;
 const a=readDemoAccount();
 const field:React.CSSProperties={background:"var(--tg-secondary-bg,#162334)",color:"inherit",border:"1px solid var(--tg-hint-color,#70829b)",padding:"10px 12px",borderRadius:10,minWidth:0};
 const button:React.CSSProperties={...field,cursor:"pointer",background:"var(--efhc-ct-accent,#618dff)",color:"#07101e",fontWeight:650};
 return <main data-demo-lab="v894-neon-ready" style={{maxWidth:800,margin:"0 auto",padding:"20px 16px 120px",color:"var(--tg-text-color,#fff)",fontSize:14}}>
  <h1 style={{margin:"0 0 6px",fontSize:23}}>EFHC · DEMO: таблицы и режимы</h1>
  <p style={{opacity:.8}}>{remote?"Подключённый режим Neon TEST. Global ID выбирается только авторизованным сервером; до готовности схемы финансовые записи запрещены.":"Автономный DEMO: изменения только в браузере. Global ID — ключ тестовых связей, не подтверждение личности."} Admin/SuperAdmin — визуальные сценарии, не настоящие полномочия.</p>
  {remote&&<section data-neon-test-operator style={{display:"grid",gap:8,border:"1px solid var(--efhc-ct-accent,#618dff)",padding:12,borderRadius:12}}>
   <h2 style={{fontSize:18}}>Neon TEST · серверное подключение</h2>
   <label>Пароль оператора тестового API<input type="password" autoComplete="off" value={testPassword} onChange={e=>setTestPassword(e.target.value)} style={{width:"100%",minHeight:42}} /></label>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>void handleTestLogin()}>Войти в TEST</button><button onClick={()=>void handleTestSchema()}>Проверить таблицы Neon</button><button onClick={()=>void neonStagingControl("/api/staging/logout","POST").then(()=>{clearNeonStagingSession();setTestSnapshot(null);setRemoteSchema(null);setRemoteStatus("Выход выполнен");}).catch(e=>setRemoteStatus(String(e)))}>Выйти</button></div>
   <p role="status">{remoteStatus}</p>
   {remoteSchema&&<div><p>Фактические таблицы: {remoteSchema.total}</p><div style={{maxHeight:200,overflow:"auto",fontSize:12}}>{remoteSchema.tables.map(t=><div key={t.schema+"."+t.name}>{t.schema}.{t.name}</div>)}</div></div>}
  </section>}
  <section style={{display:"grid",gap:10,margin:"18px 0"}}>
   <label>Global ID (ровно 10 цифр)<div style={{display:"flex",gap:8,marginTop:5}}>
    <input style={{...field,flex:1}} value={candidate} maxLength={10} inputMode="numeric" onChange={e=>setCandidate(e.target.value)}/>
    <button style={button} onClick={()=>{if(remote){void neonStagingControl<{global_id:string}>("/api/staging/select-global-id","POST",{global_id:candidate}).then(x=>{selectDemoGlobalId(x.global_id);setRemoteStatus("Neon TEST: выбран "+x.global_id);void refreshTestSnapshot();void client.invalidateQueries();}).catch(e=>setRemoteStatus("GID не выбран: "+String(e)));}else{withAction(()=>selectDemoGlobalId(candidate));}}}>Выбрать</button></div></label>
   <label>Сценарий данных<select style={{...field,width:"100%",marginTop:5}} disabled={remote} value={state?.scenario||"filled"} onChange={e=>withAction(()=>setDemoScenario(e.target.value as DemoScenario))}>
    <option value="filled">Заполненные данные</option><option value="empty">Пустые таблицы</option><option value="loading">Задержка ответов</option><option value="error">Ошибка сервиса</option><option value="no_wallet">Без кошелька</option></select></label>
   <label>Роль в визуальном DEMO (не RBAC)<select style={{...field,width:"100%",marginTop:5}} disabled={remote} value={state?.role||"user"} onChange={e=>withAction(()=>setDemoRole(e.target.value as DemoRole))}>
    <option value="user">User</option><option value="admin">Admin · preview</option><option value="superadmin">SuperAdmin · preview</option></select></label>
   <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
     <div style={{...field}}>Основной EFHCm <b style={{display:"block",fontSize:17,overflowWrap:"anywhere"}}>{remote?(testSnapshot?.profile.main_balance??"Только после подключения"):a.main_balance}</b></div>
     <div style={{...field}}>Бонус EFHCb <b style={{display:"block",fontSize:17,overflowWrap:"anywhere"}}>{remote?(testSnapshot?.profile.bonus_balance??"—"):a.bonus_balance}</b></div>
     <div style={{...field}}>Доступно kWh <b style={{display:"block",fontSize:17,overflowWrap:"anywhere"}}>{remote?(testSnapshot?.profile.available_kwh??"—"):a.available_kwh}</b></div>
     <div style={{...field}}>Global ID <b style={{display:"block",fontSize:17}}>{remote?(testSnapshot?.profile.global_id??"—"):a.global_id}</b></div>
   </div>
   <label>Сумма тестового начисления/списания<input style={{...field,width:"100%",marginTop:5}} value={amount} onChange={e=>setAmount(e.target.value)} /></label>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <button style={button} disabled={remote} onClick={()=>withAction(()=>demoLedgerMutation(amount,"credit","main","demo_topup"))}>+ EFHCm (DEMO)</button>
    <button style={button} disabled={remote} onClick={()=>withAction(()=>demoLedgerMutation(amount,"debit","main","demo_debit"))}>− EFHCm (DEMO)</button>
    <button style={button} disabled={remote} onClick={()=>withAction(()=>demoLedgerMutation(amount,"credit","bonus","demo_bonus"))}>+ EFHCb (DEMO)</button>
    <button style={{...button,background:"transparent",color:"inherit"}} disabled={remote} onClick={()=>withAction(resetDemoDatabase)}>Сбросить DEMO</button>
   </div>
  </section>
  {!remote&&<section style={{margin:"22px 0"}}><h2 style={{fontSize:18}}>Таблицы и Global-ID связи</h2>
    <p>Из эталона v866: 1000 пользователей, 27 500 транзакций и связанные истории. Первое заполнение выполняется локально в IndexedDB; после заполнения оно сохраняется между страницами.</p>
    <button style={button} disabled={loading||remote} onClick={()=>void loadDatabase()}>{loading?"Загрузка канонических таблиц…":"Создать / проверить все таблицы"}</button>
    <div role="status" aria-live="polite">{loading?"Загрузка данных v866 в IndexedDB; на мобильных устройствах обработка 65 000 записей может выполняться постепенно.":""}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))",gap:7,marginTop:12}}>
     {DEMO_TABLE_NAMES.map(n=><div key={n} style={{...field,padding:8}}><b style={{overflowWrap:"anywhere"}}>{n}</b><div>{counts[n]===undefined?"—":counts[n]}</div></div>)}
    </div>
  </section>}
  {!remote&&<section style={{margin:"18px 0"}}><h2 style={{fontSize:18}}>Записи конкретного Global ID</h2>
    <p style={{opacity:.85}}>Показываются первые 20 связанных записей. Глобальные каталоги не имеют владельца Global ID; полный счётчик каждой таблицы отображён выше.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <select style={{...field,flex:"1 1 180px"}} value={currentTable} onChange={e=>{setCurrentTable(e.target.value as typeof DEMO_TABLE_NAMES[number]);setTableRows([]);}}>
        {DEMO_TABLE_NAMES.map(name=><option key={name} value={name}>{name}</option>)}
      </select>
      <button style={button} onClick={()=>{void demoTableRows(currentTable,readDemoState().selected_global_id).then(rows=>{setTableRows(rows);setTableMessage(`${rows.length} записей для Global ID ${readDemoState().selected_global_id}`);}).catch(error=>setTableMessage(String(error)));}}>Просмотреть</button>
    </div>
    {tableMessage&&<p role="status">{tableMessage}</p>}
    <div style={{maxHeight:300,overflow:"auto",marginTop:8}}>{tableRows.map((row,index)=><pre key={index} style={{...field,whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:11}}>{JSON.stringify(row,null,2).slice(0,4500)}</pre>)}</div>
  </section>}
  <h2 style={{fontSize:18}}>Маршруты React: {demoRoutes.length} страниц для последовательной проверки</h2>
  <section style={{display:"flex",gap:8,flexWrap:"wrap"}}>
   {demoRoutes.map(href=><button key={href} style={button} onClick={()=>void router.push(href)}>{href==="/"?"Главная":href}</button>)}
  </section>
  {message&&<div role="status" style={{...field,marginTop:18,overflowWrap:"anywhere"}}>{message}</div>}
 </main>;
}
