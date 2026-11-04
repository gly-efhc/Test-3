import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// A repository workflow check: run from the checked-out source, not the
// temporary frontend copy used for Next's export.
const workflow=fs.readFileSync(new URL('../../../../.github/workflows/efhc-pages.yml',import.meta.url),'utf8');
function input(stepName,key,fallback){
 const step=workflow.split(`      - name: ${stepName}\n`)[1]?.split('\n      - name: ')[0];
 assert.ok(step,stepName+' must remain in the publication workflow');
 const value=step.match(new RegExp(`^          ${key}: (.+)$`,'m'))?.[1].trim();
 return value?.replace(/^['"]|['"]$/g,'')||fallback;
}
function evaluate(value,context){
 return value.replace(/\$\{\{\s*github\.(run_id|run_attempt|sha)\s*\}\}/g,(_,key)=>context[key]);
}

test('Pages selects exactly its current tested artifact after repeated attempts of the same commit',()=>{
 const upload=input('Upload compiled React to Pages','name','github-pages');
 const deploy=input('Deploy real React to GitHub Pages','artifact_name','github-pages');
 for(const run_id of ['41874108310','41874108311']){
  const artifacts=[];
  for(let run_attempt=1;run_attempt<=3;run_attempt++){
   const context={run_id,run_attempt:String(run_attempt),sha:'same-tested-source'};
   artifacts.push({name:evaluate(upload,context),run_attempt});
   // deploy-pages lists every attempt in this run, filters by artifact_name,
   // and rejects zero or multiple matches. This reproduced the real failure.
   const selected=artifacts.filter(a=>a.name===evaluate(deploy,context));
   assert.equal(selected.length,1,`attempt ${run_attempt}: ambiguous artifact lookup`);
   assert.equal(selected[0].run_attempt,run_attempt,'a retry must publish its own tested output');
  }
 }
});
