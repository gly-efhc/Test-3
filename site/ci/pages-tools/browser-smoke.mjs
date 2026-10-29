// Temporary GitHub Pages React runtime smoke. No external dependencies or accounts.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const url = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+\/Test-3\/$/.test(url || '')) {
  throw new Error('Smoke needs exact local project Pages URL');
}
const binary = process.env.CHROME_BIN;
if (!binary || !existsSync(binary)) throw new Error('Chrome executable missing (fail closed)');
const port = 19241;
const chrome = spawn(binary, [
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--no-first-run','--no-default-browser-check','--disable-background-networking',
  '--remote-allow-origins=*',`--remote-debugging-port=${port}`,
  `--user-data-dir=/tmp/efhc-pages-browser-smoke-${process.pid}`,'about:blank',
], {stdio:'ignore'});
let socket;
const pending = new Map();
let nextId = 0;
function close() { try { socket?.close(); } catch {} try { chrome.kill('SIGTERM'); } catch {} }
process.on('SIGINT',()=>{close();process.exit(130)});
process.on('SIGTERM',()=>{close();process.exit(143)});
async function getJson(path, options) {
  const response=await fetch(`http://127.0.0.1:${port}${path}`, options);
  if (!response.ok) throw Error(`Chrome DevTools HTTP ${response.status}`);
  return response.json();
}
async function send(method, params={}) {
  const id=++nextId;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},12000);
    pending.set(id, {resolve:(x)=>{clearTimeout(timer);resolve(x)},reject:(e)=>{clearTimeout(timer);reject(e)}});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function inspect(path) {
  const address=url.replace(/\/$/,'')+path;
  await send('Page.navigate',{url:address});
  await sleep(8500);
  const expr=`JSON.stringify({href:location.href,path:location.pathname,title:document.title,text:(document.body?.innerText||'').slice(0,600),root:!!document.querySelector('#_next'),html:!!document.documentElement})`;
  const result=await send('Runtime.evaluate',{expression:expr,returnByValue:true});
  const data=JSON.parse(result.result.result.value);
  const count=(data.path.match(/\/Test-3/g)||[]).length;
  if (count !== 1 || !data.path.startsWith('/Test-3/')) throw Error('RECURSIVE_BASEPATH_OR_REDIRECT: '+data.href);
  if (!data.root || !data.html) throw Error('REACT_MOUNT_MISSING: '+data.href);
  if (/Section not found|Internal Server Error/i.test(data.text)) throw Error('REACT_ROUTE_ERROR: '+data.text);
  console.log('PASS HEADLESS CHROME ROUTE',data.href, 'textchars='+data.text.length);
  return data;
}
try {
  let ready=false;
  for(let attempt=0;attempt<60;attempt++) {
    if (chrome.exitCode !== null) throw Error('Chrome exited unexpectedly');
    try { await getJson('/json/version'); ready=true; break; } catch {await sleep(200)}
  }
  if(!ready)throw Error('Chrome remote debugging unavailable');
  const target=await getJson('/json/new?about:blank',{method:'PUT'});
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('CDP socket timeout')),10000);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});
    socket.addEventListener('error',(e)=>{clearTimeout(timer);reject(e)},{once:true});
  });
  socket.addEventListener('message',ev=>{
    try {const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m);}}catch{}
  });
  await send('Page.enable');await send('Runtime.enable');
  await inspect('/');
  await inspect('/faq/');
  await inspect('/hub/');
  console.log('EFHC_PAGES_CHROME_RUNTIME_SMOKE=PASS');
} catch(e) {
  console.error('EFHC_PAGES_CHROME_RUNTIME_SMOKE=FAIL',e.stack||String(e));
  process.exitCode=1;
} finally {close()}
