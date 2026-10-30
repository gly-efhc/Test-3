import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const base=path.resolve(import.meta.dirname);
const bridge=fs.readFileSync(path.join(base,'neonStagingBridge.ts'),'utf8');
const api=fs.readFileSync(path.join(base,'../lib/api.ts'),'utf8');
const lab=fs.readFileSync(path.join(base,'../pages/demo-lab.tsx'),'utf8');
function loadBridge(){
 const code=ts.transpileModule(bridge,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)((name)=>{
  assert.equal(name,'./demoUnifiedStore');
  return {isDemoPreviewEnabled:()=>true};
 },mod,mod.exports);
 return mod.exports;
}
const previous={...process.env};
function cfg(origin='https://efhc-test.example'){
 process.env.NEXT_PUBLIC_EFHC_TEST_MODE='neon';
 process.env.NEXT_PUBLIC_EFHC_TEST_API_ORIGIN=origin;
}
function reset(){for(const k of ['NEXT_PUBLIC_EFHC_TEST_MODE','NEXT_PUBLIC_EFHC_TEST_API_ORIGIN']){
 if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}

test('staging mode is explicit and never substitutes a local/fake success',async()=>{
 const b=loadBridge();delete process.env.NEXT_PUBLIC_EFHC_TEST_MODE;
 assert.equal(b.isNeonStagingRequested(),false);
 cfg();assert.equal(b.isNeonStagingActive(),true);
 const prior=globalThis.fetch;
 try{
  globalThis.fetch=async()=>({ok:false,status:503,json:async()=>({code:'NEON_UNREADY'})});
  await assert.rejects(b.neonStagingApiRequest('/sync/me','POST'),/NEON_TEST_HTTP_503/);
 }finally{globalThis.fetch=prior;reset();}
});
test('invalid origins, embedded credentials and HTTP are rejected before network',async()=>{
 const b=loadBridge(),prior=globalThis.fetch;
 try{
  for(const origin of ['http://demo.example','https://u:pw@demo.example','https://demo.example/staging','']){
   cfg(origin);
   globalThis.fetch=()=>{throw new Error('INVALID_ORIGIN_DID_FETCH')};
   await assert.rejects(b.neonStagingApiRequest('/sync/me','GET'),/NEON_TEST_ORIGIN_/);
  }
 }finally{globalThis.fetch=prior;reset();}
});
test('operator session and business calls always use cookie, CSRF and test origin',async()=>{
 const b=loadBridge(),prior=globalThis.fetch,seen=[];
 cfg('https://efhc-test.example');
 globalThis.fetch=async(url,opts)=>{
  seen.push({url,opts});
  if(url.endsWith('/api/staging/login'))return {ok:true,json:async()=>({csrf:'a-test-csrf',global_id:'0000657667'})};
  return {ok:true,json:async()=>({profile:{global_id:'0000657667'}})};
 };
 try{
  await b.neonStagingControl('/api/staging/login','POST',{password:'operator-test'});
  await b.neonStagingApiRequest('/sync/me','POST');
  assert.equal(seen[0].opts.credentials,'include');
  assert.equal(seen[0].url,'https://efhc-test.example/api/staging/login');
  assert.equal(seen[1].url,'https://efhc-test.example/api/sync/me');
  assert.equal(seen[1].opts.headers['X-EFHC-Test-CSRF'],'a-test-csrf');
  await assert.rejects(b.neonStagingControl('/api/admin/secret'),/NEON_TEST_CONTROL_ROUTE_DENIED/);
 }finally{globalThis.fetch=prior;reset();}
});
test('real React API route chooses staging before local mock and never production on error',()=>{
 assert.match(api,/isNeonStagingRequested\(\)/);
 assert.match(api,/neonStagingApiRequest<T>/);
 assert.ok(api.indexOf('neonStagingApiRequest<T>')<api.indexOf('demoApiRequest\(path'));
 assert.match(api,/PUBLIC_DEMO_NOT_BOOTSTRAPPED/);
 assert.match(lab,/type="password"/);
 assert.match(lab,/neonStagingControl<\{global_id:string\}>/);
 assert.match(lab,/disabled=\{remote\}/);
 assert.match(lab,/testSnapshot\?\.profile\.main_balance/);
 assert.equal(bridge.includes('NEON_TEST_DATABASE_URL'),false);
});
