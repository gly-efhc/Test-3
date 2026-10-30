import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const base=path.resolve(import.meta.dirname);
const root=path.resolve(base,'../../..');
const file=fs.readFileSync(path.join(base,'demoUnifiedStore.ts'),'utf8');
function getMirror(){
  const source=ts.createSourceFile('demoUnifiedStore.ts',file,ts.ScriptTarget.ES2020,true,ts.ScriptKind.TS);
  const declaration=source.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='mirrorSelectedDemoAccount');
  assert.ok(declaration,'GitHub Pages failure regression: the referenced mirror function must be declared');
  const js=ts.transpileModule(declaration.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  return new Function('seedAccount', `${js}\nreturn mirrorSelectedDemoAccount;`)(gid=>({global_id:gid,main_balance:'0.00000000',bonus_balance:'0.00000000',available_kwh:'0.00000000',total_generated_kwh:'0.00000000',wallets:[]}));
}
test('GitHub Pages TS2304 regression fixed: declared mirror uses one IndexedDB transaction',async()=>{
 const mirror=getMirror();
 const written={};let count=0;
 const db={transaction:(names,mode)=>{
  count++;assert.deepEqual(names,['accounts','balances','wallet_links']);assert.equal(mode,'readwrite');
  const transaction={objectStore:(name)=>({put:(row)=>{(written[name]??=[]).push(row);}})};
  queueMicrotask(()=>transaction.oncomplete?.());return transaction;
 }};
 const gid='0000657667';const account={global_id:gid,main_balance:'12.50000000',bonus_balance:'2.00000000',available_kwh:'1.25000000',total_generated_kwh:'50.00000000',wallets:[{id:31,global_id:gid,wallet_address:'DEMO_ONLY'}]};
 await mirror(db,{selected_global_id:gid,accounts:{[gid]:account}});
 assert.equal(count,1);
 assert.equal(written.accounts[0].id,gid);
 assert.equal(written.balances[0].main_balance,account.main_balance);
 assert.equal(written.wallet_links[0].id,`${gid}:31`);
});
test('DEMO account mirroring rejects wrong Global ID and a failed transaction',async()=>{
 const mirror=getMirror();
 await assert.rejects(mirror({},{selected_global_id:'123',accounts:{}}),/DEMO_GLOBAL_ID_INVALID/);
 await assert.rejects(mirror({},{selected_global_id:'0000657667',accounts:{'0000657667':{global_id:'8000000001'}}}),/DEMO_OWNER_MISMATCH/);
 const db={transaction:()=>{const transaction={objectStore:()=>({put:()=>{}})};queueMicrotask(()=>transaction.onabort?.());return transaction;}};
 await assert.rejects(mirror(db,{selected_global_id:'0000657667',accounts:{}}),/DEMO_MIRROR_ABORTED/);
 assert.match(file,/await mirrorSelectedDemoAccount\(db,readDemoState\(\)\);/);
 assert.doesNotMatch(file,/mirrorSelectedDemoAccount\(readDemoState\(\)\)/);
});
test('same strict English EFHC company license in FULL root and imported public frontend',()=>{
 const l1=fs.readFileSync(path.join(root,'LICENSE'),'utf8');
 const l2=fs.readFileSync(path.join(root,'frontend/public/LICENSE.txt'),'utf8');
 assert.equal(l1,l2);
 for(const phrase of ['EFHC — Energy for Humanity Coin','ALL RIGHTS RESERVED — NO LICENSE GRANTED','LEGAL WARNING','THIRD-PARTY RIGHTS AND NONWAIVABLE LEGAL EXCEPTIONS'])assert.ok(l1.includes(phrase),phrase);
});
test('two distinct, non-executable embedded license comments exist in frontend/backend source',()=>{
 const frontend=fs.readFileSync(path.join(root,'frontend/src/lib/api.ts'),'utf8');
 const backend=fs.readFileSync(path.join(root,'staging/neon_api/app.py'),'utf8');
 assert.ok(frontend.startsWith('/*! EFHC_EMBEDDED_LICENSE_FRONTEND_01'));
 assert.ok(backend.includes('# EFHC_EMBEDDED_LICENSE_BACKEND_02'));
 assert.ok(backend.includes('from __future__ import annotations\n'));
 assert.ok(!frontend.includes('EFHC_EMBEDDED_LICENSE_BACKEND_02'));
 assert.ok(!backend.includes('EFHC_EMBEDDED_LICENSE_FRONTEND_01'));
 const full=fs.readFileSync(path.join(root,'LICENSE'),'utf8').trimEnd().split('\n');
 for(const line of full){
  assert.ok(frontend.includes(` *${line ? ' '+line : ''}\n`),'frontend embedded license line missing: '+line.slice(0,40));
  assert.ok(backend.includes(`#${line ? ' '+line : ''}\n`),'backend embedded license line missing: '+line.slice(0,40));
 }
});
