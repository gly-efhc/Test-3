import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const source=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('C28 base and VIP constants are sealed and not independently redefined in active UI',()=>{
 const rates=source('demoGenerationRates.ts');
 assert.match(rates,/BASE_RATE = '0\.00000692'/);
 assert.match(rates,/VIP_RATE = '0\.00000741'/);
 assert.match(rates,/Object\.freeze/);
 const found=[];
 const explore=(dir)=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,e.name);
  if(e.isDirectory())explore(full);
  else if(/\.tsx?$/.test(e.name)&&!full.endsWith('demoGenerationRates.ts')){
   const data=fs.readFileSync(full,'utf8');
   if(/0\.00000692|0\.00000741|0\.00005000/.test(data))
     found.push(path.relative(path.join(root,'..'),full));
  }
 }};
 explore(path.join(root,'..'));
 assert.deepEqual(found,[],'Noncanonical hardcoded rates outside immutable source');
});
test('C28 live generator and browser projection freeze SQL-imported energy',()=>{
 assert.match(source('demoServerCore.ts'),/neon_seed_revision&&p\.meta\?\.source/);
 assert.match(source('../hooks/useDemoGenerationProjection.ts'),/neon_seed_revision&&p\.meta\?\.source/);
 assert.match(source('demoApi.ts'),/getNeonExchangePage/);
 assert.match(source('neonDemoSeed.ts'),/NEON_DEMO_SNAPSHOT_FORMULA_PARITY_MISMATCH/);
});
test('C28 invalid server-only ENV is blocked and not leaked to NEXT_PUBLIC',()=>{
 const config=source('../../next.config.js');
 assert.match(config,/GEN_PER_SEC_BASE_KWH/);
 assert.match(config,/GEN_PER_SEC_VIP_KWH/);
 assert.match(config,/EFHC_GENERATION_ENV_CANON_MISMATCH/);
 assert.doesNotMatch(config,/NEXT_PUBLIC_GEN_PER_SEC_/);
});
