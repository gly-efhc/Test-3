/** Cycle0032: behavioral network-contract checks, no deleted browser DEMO engine. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=fileURLToPath(new URL('../../src/',import.meta.url));
function harness({origin='https://demo-api.example.org',auth='Bearer TEST_OPERATOR',onRequest}={}){
 const calls=[];
 let cleared=0;
 let issued=null;
 const cache=new Map();
 const fakeApi={
  ApiError:class ApiError extends Error{constructor(args){super('EFHC_API_REQUEST_FAILED');Object.assign(this,args);}},
  normalizeApiPath:p=>p.startsWith('/api/')?p:'/api'+p,
 };
 const env={NEXT_PUBLIC_EFHC_DEMO_API_ORIGIN:origin,NEXT_PUBLIC_EFHC_DATA_SOURCE:'demo_backend'};
 const mocks={
  'lib/api':fakeApi,
  'lib/auth-session':{
   getAuthAuthorizationHeader:()=>issued ? 'Bearer '+issued.access_token : auth,
   storeAuthSession:credential=>{issued=credential;},
   clearAuthSession:()=>{cleared++;issued=null;},
  },
 };
 const context=vm.createContext({process:{env},URL,URLSearchParams,AbortController,AbortSignal,Response,Headers,Blob,console,Promise,Date,Error,JSON,fetch:async(url,opts={})=>{
  calls.push({url:String(url),options:opts});
  if(onRequest)return onRequest(String(url),opts);
  if(String(url).endsWith('/api/staging/session'))return Response.json({ok:true,global_id:issued?.access_token?.startsWith('S')?'0000000088':'0000000002',csrf:issued?.access_token?.startsWith('S')?'next-csrf':'csrf-token',mode:'operator'});
  if(String(url).endsWith('/api/staging/login'))return Response.json({ok:true,global_id:'0000000002',csrf:'login-csrf',mode:'operator',demo_bearer_token:'L'.repeat(64),expires_at_epoch:Math.floor(Date.now()/1000)+3600});
  if(String(url).endsWith('/api/staging/select-global-id'))return Response.json({ok:true,global_id:'0000000088',csrf:'next-csrf',mode:'operator',demo_bearer_token:'S'.repeat(64),expires_at_epoch:Math.floor(Date.now()/1000)+3600});
  if(String(url).endsWith('/api/staging/logout'))return Response.json({ok:true});
  if(String(url).endsWith('/api/sync/me'))return Response.json({profile:{global_id:'0000000002'}});
  return Response.json({code:'not-found'},{status:404});
 }});
 function load(rel){
  rel=rel.replace(/\\/g,'/');
  const key=rel.replace(/\.(tsx?|json)$/,'');
  if(mocks[key])return mocks[key];
  let f=path.join(root,rel);
  if(!fs.existsSync(f)){if(fs.existsSync(f+'.ts'))f+='.ts';else if(fs.existsSync(f+'.tsx'))f+='.tsx';}
  if(cache.has(f))return cache.get(f).exports;
  const mod={exports:{}};cache.set(f,mod);
  const src=fs.readFileSync(f,'utf8');
  const output=ts.transpileModule(src,{fileName:f,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const customRequire=name=>name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(f),name))):require(name);
  vm.runInContext(`(function(require,module,exports){${output}\n})`,context,{filename:f})(customRequire,mod,mod.exports);
  return mod.exports;
 }
 return {load,env,calls,get cleared(){return cleared;}};
}
test('DEMO API origin accepts only strict HTTPS origins and never database credentials',()=>{
 const h=harness();assert.equal(h.load('demo/config.ts').demoApiOrigin(),'https://demo-api.example.org');
 for(const url of ['','http://demo-api.example.org','https://user:secret@demo-api.example.org','https://demo-api.example.org/db','https://demo-api.example.org/?token=1','https://demo-api.example.org/#secret']){
  h.env.NEXT_PUBLIC_EFHC_DEMO_API_ORIGIN=url;
  assert.throws(()=>h.load('demo/config.ts').demoApiOrigin(),/EFHC_DEMO_API_ORIGIN/);
 }
});
test('DEMO business request uses authenticated remote API, Idempotency-Key and server CSRF',async()=>{
 const h=harness(),bridge=h.load('demo/transport.ts');
 const result=await bridge.demoBackendTransport.request('/sync/me','POST',{body:{fresh:true},idempotencyKey:'unique-31',requestId:'trace-42',headers:{'X-EFHC-Handoff':'real-handoff'}});
 assert.equal(result.profile.global_id,'0000000002');
 assert.equal(h.calls.length,2,'CSRF session lookup then real backend request');
 const {url,options}=h.calls[1];
 assert.equal(url,'https://demo-api.example.org/api/sync/me');
 assert.equal(options.credentials,'include');
 assert.equal(options.cache,'no-store');
 assert.equal(options.headers['X-EFHC-Test-CSRF'],'csrf-token');
 assert.equal(options.headers['Idempotency-Key'],'unique-31');
 assert.equal(options.headers['X-Request-ID'],'trace-42');
 assert.equal(options.headers['X-EFHC-Handoff'],'real-handoff');
 assert.equal(options.headers.Authorization,'Bearer TEST_OPERATOR');
 assert.deepEqual(JSON.parse(options.body),{fresh:true});
});
test('unauthorized API response revokes DEMO session and returns an explicit error, not fixtures',async()=>{
 let hits=0;
 const h=harness({onRequest:()=>{hits++;return Response.json({detail:'expired'},{status:401});}});
 const demo=h.load('demo/transport.ts');
 await assert.rejects(()=>demo.demoBackendTransport.request('/wallets/me','GET',{}),error=>error.status===401);
 assert.equal(h.cleared,1);
 assert.equal(hits,1);
});
test('DEMO operator login and Global ID switching preserve server-issued bearer when cross-site cookies are blocked',async()=>{
 const h=harness({auth:null}),s=h.load('demo/session.ts');
 const login=await s.loginDemo('test-password');
 assert.equal(login.global_id,'0000000002');
 assert.equal(login.demo_bearer_token,undefined,'bearer must not leak into UI return value');
 const session=await s.sessionInfo();
 assert.equal(session.global_id,'0000000002');
 assert.equal(h.calls[1].options.headers.Authorization,'Bearer '+'L'.repeat(64));
 const selected=await s.selectDemoGlobalId('0000000088');
 assert.equal(selected.global_id,'0000000088');
 assert.equal(selected.demo_bearer_token,undefined);
 assert.equal(h.calls[2].options.headers['X-EFHC-Test-CSRF'],'csrf-token');
 assert.equal(h.calls[2].options.headers.Authorization,'Bearer '+'L'.repeat(64));
 assert.equal(h.calls[2].options.credentials,'include');
 assert.deepEqual(JSON.parse(h.calls[2].options.body),{global_id:'0000000088'});
 const renewed=await s.sessionInfo();
 assert.equal(renewed.ok,true);
 assert.equal(h.calls[3].options.headers.Authorization,'Bearer '+'S'.repeat(64));
 await assert.rejects(()=>s.selectDemoGlobalId('88'),/INVALID_GLOBAL_ID/);
 await s.logoutDemo();
 assert.equal(h.calls[4].options.headers['X-EFHC-Test-CSRF'],'next-csrf');
 assert.equal(h.calls[4].options.headers.Authorization,'Bearer '+'S'.repeat(64));
 assert.equal(h.cleared,1);
});
test('DEMO operator credential must be server-issued and not invented client-side',async()=>{
 const h=harness({auth:null,onRequest:()=>Response.json({ok:true,global_id:'0000000002',csrf:'unsafe',mode:'neon-test'})});
 await assert.rejects(()=>h.load('demo/session.ts').loginDemo('test-password'),/DEMO_SESSION_CREDENTIAL_MISSING/);
 assert.equal(h.calls.length,1);
});
test('registered transport preserves request options and raw binary response path',async()=>{
 const h=harness(),dispatcher=h.load('data/transport.ts');
 const seen=[];
 dispatcher.registerTransport({
  request:async(...args)=>{seen.push(args);return{value:'server'};},
  requestRaw:async(...args)=>{seen.push(args);return new Response('csv',{headers:{'Content-Type':'text/csv'}});},
 });
 const options={signal:new AbortController().signal,idempotencyKey:'test-replay'};
 assert.equal((await dispatcher.transportRequest('/sync/me','POST',options)).value,'server');
 assert.equal(await (await dispatcher.transportRawRequest('/admin/logs/export.csv','GET',{})).text(),'csv');
 assert.equal(seen[0][2],options);
 assert.equal(seen[1][0],'/admin/logs/export.csv');
});
