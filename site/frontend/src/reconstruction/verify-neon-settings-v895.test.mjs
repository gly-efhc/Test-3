import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve(import.meta.dirname);
const bridge=fs.readFileSync(path.join(base,'neonStagingBridge.ts'),'utf8');
const api=fs.readFileSync(path.join(base,'../lib/api.ts'),'utf8');
const lab=fs.readFileSync(path.join(base,'../pages/demo-lab.tsx'),'utf8');
test('Neon test is opt-in, isolated and does not fall back to production',()=>{
  assert.match(bridge,/NEXT_PUBLIC_EFHC_TEST_MODE === 'neon'/);
  assert.match(bridge,/NEON_TEST_ORIGIN_MUST_BE_HTTPS_ORIGIN/);
  assert.match(bridge,/if\(res.status===401\)csrf=null/g);
  assert.match(api,/NEON_TEST_REQUIRES_PUBLIC_PREVIEW/);
  assert.match(api,/return await neonStagingApiRequest<T>/);
  assert.match(lab,/disabled=\{remote\}/);
});
test('No privileged server variables or credentials appear in frontend staging bridge',()=>{
 for(const secret of ['NEON_TEST_DATABASE_URL','EFHC_STAGING_OPERATOR_PASSWORD','EFHC_STAGING_ALLOW_BUSINESS_WRITES','postgresql://','postgres://']){
  assert.equal(bridge.includes(secret),false,`Unexpected server-only item in frontend bridge: ${secret}`);
 }
});
