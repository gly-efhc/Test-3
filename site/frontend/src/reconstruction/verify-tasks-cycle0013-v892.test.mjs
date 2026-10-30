import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/reconstruction/demoTasksSimulation.ts'),'utf8');
const transpiled = ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function parse(v){const [a,b='']=v.split('.');return BigInt(a)*100000000n+BigInt(b.padEnd(8,'0'));}
function fmt(v){const digits=v.toString().padStart(9,'0');return digits.slice(0,-8)+'.'+digits.slice(-8);}
const format={format8: (s)=>fmt(parse(s)),sumScaledDown:(a,b)=>fmt(parse(a)+parse(b))};
const mock={exports:{}};
vm.runInNewContext(transpiled,{module:mock,exports:mock.exports,require:(name)=>{assert.equal(name,'../lib/format');return format;}});
const sim=mock.exports;
const catalog=JSON.parse(fs.readFileSync(path.join(root,'src/reconstruction/demo-tables-v866.json'),'utf8')).tasks.catalog;
const page=fs.readFileSync(path.join(root,'src/pages/tasks.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'src/styles/reconstruction-tasks-cycle0013-v892.css'),'utf8');
const index=fs.readFileSync(path.join(root,'src/pages/_app.tsx'),'utf8');

test('frozen 5 tasks and D8 authored rewards unchanged',()=>{
  assert.equal(catalog.length,5);
  assert.deepEqual(catalog.map(x=>x.bonus_efhc),['0.10000000','0.01000000','0.05000000','0.02000000','0.03000000']);
});
test('DEMO: initial five tasks are linked to common simulated Global ID not authenticated backend',()=>{
  assert.match(page,/isDemoPreview = useFrozenDemoTables\(\)/);
  assert.match(page,/if \(isDemoPreview\) \{\s*return !customization\.mutationBlocked/);
});
test('DEMO: non-ad tasks once only; 5 tasks remain inspectable',()=>{
  let state=sim.freshDemoTaskState('2026-10-30');
  for(const code of ['demo_join_telegram','demo_partner_webapp','demo_website_visit','demo_partner_bot']) {
    state=sim.applyDemoTaskAction(state,code,'2026-10-30');
    state=sim.applyDemoTaskAction(state,code,'2026-10-30');
  }
  assert.equal(state.completed.length,4);
  assert.match(page,/if \(isDemoPreview\) return !isSystemAdPlacementCode/);
  assert.equal(sim.demoTaskBonusDeltaD8(state),'0.20000000');
});
test('DEMO: ad limit 10 daily, reset on new UTC day',()=>{
  let state=sim.freshDemoTaskState('2026-10-30');
  for(let i=0;i<19;i++) state=sim.applyDemoTaskAction(state,'demo_watch_builtin','2026-10-30');
  assert.equal(state.adViews,10);
  assert.equal(sim.demoTaskBonusDeltaD8(state),'0.10000000');
  const tomorrow=sim.normalizeDemoTaskState(state,'2026-10-31');
  assert.equal(tomorrow.adViews,0);
  assert.equal(tomorrow.completed.length,0);
});
test('DEMO: progress/bonus totals exact D8',()=>{
  let state=sim.applyDemoTaskAction(sim.freshDemoTaskState('2026-10-30'),'demo_join_telegram','2026-10-30');
  state=sim.applyDemoTaskAction(state,'demo_watch_builtin','2026-10-30');
  assert.deepEqual(JSON.parse(JSON.stringify(sim.demoTaskTotalsD8(state,'0.02000000','78.00000000'))),{earned:'0.13000000',remaining:'78.11000000'});
});
test('DEMO: unknown/malformed input cannot mutate reward counters',()=>{
  const state=sim.normalizeDemoTaskState({dayUTC:'2026-10-30', completed:['evil','demo_join_telegram','demo_join_telegram'],adViews:999},'2026-10-30');
  assert.equal(state.adViews,10);assert.deepEqual([...state.completed],['demo_join_telegram']);
  assert.deepEqual([...sim.applyDemoTaskAction(state,'evil','2026-10-30').completed],['demo_join_telegram']);
});
test('Production claim/ad transport handlers remain connected; DEMO branch comes first',()=>{
  assert.match(page,/claimMutation\.mutateAsync/);
  assert.match(page,/AdManager\.runRewardedAd/);
  assert.match(page,/if \(isDemoPreview\) \{/);
  assert.ok(page.indexOf('const executeTask')<page.indexOf('const watchAd'));
  assert.match(page,/if \(isDemoPreview\) \{\s*if \(customization\.mutationBlocked\) return/);
});
test('No auto-reward just for opening external URL',()=>{
  const pos=page.indexOf('window.open(url, "_blank", "noopener,noreferrer")');
  assert.ok(pos>0);
  const block=page.slice(pos-220,pos+120);
  assert.doesNotMatch(block,/applyDemoTaskAction/);
});
test('The four selectors keep distinct hero shapes and CT variables; CSS loaded in actual _app',()=>{
  for(const tg of ['TG-01','TG-02','TG-03','TG-09']) assert.ok(css.includes(`data-tg="${tg}"`));
  assert.match(css,/--efhc-ct-accent-rgb/);
  assert.match(css,/--efhc-ct-accent/);
  assert.ok(index.includes('reconstruction-tasks-cycle0013-v892.css'));
});
test('Preview task state is now shared across routes via 10-digit Global ID account',()=>{
  assert.match(page,/data-demo-task-mode/);
  assert.match(page,/completeDemoTask/);
  assert.match(page,/completeDemoAd/);
  assert.match(page,/readDemoAccount/);
  const store=fs.readFileSync(path.join(root,'src/reconstruction/demoUnifiedStore.ts'),'utf8');
  assert.match(store,/DEMO_GLOBAL_ID = "0000657667"/);
  assert.match(store,/accounts:\{\[DEMO_GLOBAL_ID\]/);
  assert.match(store,/schema_version/);
  assert.doesNotMatch(page,/localStorage\.setItem/);
});
