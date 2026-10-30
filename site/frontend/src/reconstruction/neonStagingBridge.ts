/** Real Neon TEST backend mode. GitHub Pages contains NO Neon secrets or privileges.
 * The test server, not the browser-selected Global ID, is identity authority.
 * Never use this module outside explicitly enabled Pages preview.
 */
import {isDemoPreviewEnabled} from './demoUnifiedStore';

export function isNeonStagingRequested():boolean {
  return process.env.NEXT_PUBLIC_EFHC_TEST_MODE === 'neon';
}
function stagingOrigin():string {
  const raw=process.env.NEXT_PUBLIC_EFHC_TEST_API_ORIGIN || '';
  let url:URL;
  try{url=new URL(raw);}catch{throw new Error('NEON_TEST_ORIGIN_MISSING');}
  if(url.protocol!=='https:' || !url.hostname || url.username || url.password ||
     url.search || url.hash || (url.pathname!== '/' && url.pathname!==''))
     throw new Error('NEON_TEST_ORIGIN_MUST_BE_HTTPS_ORIGIN');
  return url.origin;
}
export function isNeonStagingActive():boolean {
  return isDemoPreviewEnabled() && isNeonStagingRequested();
}
let csrf:string|null=null;
export function clearNeonStagingSession():void{csrf=null;}
export async function neonStagingControl<T>(route:string,method:'GET'|'POST'='GET',body?:unknown):Promise<T> {
  if(!isNeonStagingActive())throw new Error('NEON_TEST_DISABLED');
  if(!route.startsWith('/api/staging/'))throw new Error('NEON_TEST_CONTROL_ROUTE_DENIED');
  const url=stagingOrigin()+route;
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(method!=='GET' && route!=='/api/staging/login'){
    if(!csrf){const s=await neonStagingControl<{csrf:string}>('/api/staging/session');csrf=s.csrf;}
    headers['X-EFHC-Test-CSRF']=csrf;
  }
  const res=await fetch(url,{method,headers,credentials:'include',cache:'no-store',
    body:body===undefined?undefined:JSON.stringify(body)});
  if(!res.ok){
    if(res.status===401)csrf=null; // expired TEST session; never retry with production credentials
    throw Object.assign(new Error(`NEON_TEST_HTTP_${res.status}`),{status:res.status});
  }
  const payload=await res.json() as T;
  if(route==='/api/staging/login'||route==='/api/staging/session'){
    const token=(payload as {csrf?:unknown}).csrf;
    if(typeof token==='string')csrf=token;
  }
  if(route==='/api/staging/logout')csrf=null;
  return payload;
}
export async function neonStagingApiRequest<T>(path:string,method:string,body?:unknown,idempotencyKey?:string):Promise<T>{
  if(!isNeonStagingActive())throw new Error('NEON_TEST_DISABLED');
  // Do not ever fall through to production or browser-only accounting.
  const url=new URL(path,'https://efhc.test.invalid');
  if(!/^\/api\//.test(url.pathname))url.pathname='/api'+url.pathname;
  const endpoint=stagingOrigin()+url.pathname+url.search;
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(method!=='GET'){
    if(!csrf){const s=await neonStagingControl<{csrf:string}>('/api/staging/session');csrf=s.csrf;}
    headers['X-EFHC-Test-CSRF']=csrf;
  }
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  const res=await fetch(endpoint,{method,headers,credentials:'include',cache:'no-store',
    body:body===undefined?undefined:JSON.stringify(body)});
  if(!res.ok){
    if(res.status===401)csrf=null; // session revoked or expired; preserve fail-closed behaviour
    const payload=await res.json().catch(()=>({}));
    throw Object.assign(new Error(`NEON_TEST_HTTP_${res.status}`),{status:res.status,payload});
  }
  return await res.json() as T;
}
