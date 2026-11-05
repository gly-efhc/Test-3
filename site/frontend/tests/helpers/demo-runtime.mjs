import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import{createRequire}from'node:module';import{fileURLToPath}from'node:url';
const require=createRequire(import.meta.url),ts=require('typescript'),root=fileURLToPath(new URL('../../src/',import.meta.url));
export function demoRuntime({storage=new Map(),now=Date.parse('2026-11-04T00:00:00Z'),preview=true,testMode='',withIndexedDB=false,keyRange,basePath='/Test-3',pathname=basePath+'/',origin='https://demo.invalid',fetchImpl}={}){
 let clock=now;const modules=new Map();
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const window={__EFHC_DEMO_READ_ONLY__:true,location:{origin,pathname},dispatchEvent(){},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)}};
 const context=vm.createContext({window,console,Date:ClockDate,URL,URLSearchParams,BigInt,Blob,TextEncoder,structuredClone,setTimeout,clearTimeout,
  ...(withIndexedDB?{indexedDB:typeof withIndexedDB==='object'?withIndexedDB:{},IDBKeyRange:keyRange}:{}),Event:class{},process:{env:{NEXT_PUBLIC_EFHC_BASE_PATH:basePath,NEXT_PUBLIC_EFHC_TEST_MODE:testMode,NEXT_PUBLIC_EFHC_PAGES_PREVIEW:preview?'1':'0',NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF:preview?'1':'0'}},
  fetch:fetchImpl||(()=>{throw Error('Unexpected network request in DEMO test');})});
 function load(filename){
  filename=path.resolve(filename);if(!path.extname(filename))filename+='.ts';
  if(modules.has(filename))return modules.get(filename).exports;
  const module={exports:{}};modules.set(filename,module);
  if(filename.endsWith('.json')){module.exports=JSON.parse(fs.readFileSync(filename,'utf8'));return module.exports;}
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;
  const run=vm.runInContext(`(function(require,module,exports){${code}\n})`,context,{filename});
  run(name=>name.startsWith('.')?load(path.resolve(path.dirname(filename),name)):require(name),module,module.exports);return module.exports;
 }
 return {loadSource:relative=>load(path.join(root,relative)),storage,advance:ms=>{clock+=ms;},api:load(path.join(root,'reconstruction/demoApi.ts')).demoApiRequest,
  store:load(path.join(root,'reconstruction/demoUnifiedStore.ts')),core:load(path.join(root,'reconstruction/demoServerCore.ts'))};
}
