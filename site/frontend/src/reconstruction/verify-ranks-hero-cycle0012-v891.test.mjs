/** RECON_CYCLE_0012: complete frozen ranks dataset and scoped upper panel.
 * Source executable tests are NOT a Next.js build or visual parity certificate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const folder=import.meta.dirname;
const read=name=>fs.readFileSync(path.resolve(folder,name),'utf8');
const fixtures=JSON.parse(read('demo-tables-v866.json'));
function demoApi(){
 const {outputText}=ts.transpileModule(read('demoTables.ts'),{fileName:'demoTables.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const scope={exports:{},Date,require(name){
  if(name.endsWith('demo-tables-v866.json'))return {default:fixtures};
  if(name.endsWith('/db-id'))return {dbIdFromApi:v=>String(v)};
  throw Error('Unexpected import '+name);
 }};
 vm.runInNewContext(outputText,scope,{filename:'demoTables.ts'});
 return scope.exports;
}
test('canonical 220 participants, D8 and rank ties from frozen fixture',()=>{
 const {users,me}=fixtures.ranks;
 assert.equal(users.length,220);
 assert.equal(new Set(users.map(x=>x.global_id)).size,220);
 assert.equal(me.rank_pos,212);
 assert.equal(me.total_generated_kwh,'8123.12345678');
 assert.equal(users[1].rank_pos,2);
 assert.equal(users[2].rank_pos,2);
 assert.equal(users[3].rank_pos,3);
 assert.ok(users.every(x=>/^\d+\.\d{8}$/.test(x.total_generated_kwh)));
});
test('DEMO ranks 100 + 100 + 20 pages, no duplicates, full 220',()=>{
 const api=demoApi();const first=api.demoMyRankWithTop();
 assert.equal(first.top.length,100);assert.equal(first.next_cursor,'100');
 const second=api.demoRankTopPage(first.next_cursor);
 const third=api.demoRankTopPage(second.next_cursor);
 assert.equal(second.items.length,100);assert.equal(second.next_cursor,'200');
 assert.equal(third.items.length,20);assert.equal(third.next_cursor,null);
 const all=[...first.top,...second.items,...third.items];
 assert.equal(all.length,220);assert.equal(new Set(all.map(x=>x.global_id)).size,220);
 assert.deepEqual(all.map(x=>x.rank_pos),fixtures.ranks.users.map(x=>x.rank_pos));
});
test('find me neighbors returns registered 212 identity and adjacent ranks',()=>{
 const ctx=demoApi().demoRankContext();
 assert.ok(ctx.items.some(x=>x.global_id===fixtures.ranks.me.global_id));
 assert.ok(ctx.items.every(x=>Math.abs(x.rank_pos-212)<=2));
 assert.equal(ctx.next_cursor,null);
});
test('only Ranks hero TSX changed; functional actions and list remain present',()=>{
 const page=read('../pages/ranks.tsx');
 assert.match(page,/data-ranks-hero-summary="cycle0012-responsive"/);
 assert.match(page,/data-ranks-hero-energy-d8="true"/);
 assert.match(page,/useMyRankWithTop\(globalId\)/);
 assert.match(page,/useRankTopPages\(/);
 assert.match(page,/data-ranks-load-more="true"/);
 assert.match(page,/data-ranks-show-me-action="load-and-focus-neighbors"/);
 assert.match(page,/data-ranks-refresh-action="shared-secondary"/);
 assert.match(page,/format8\(me\.total_generated_kwh\)/);
});
test('responsive CSS is strictly hero-scoped; no global list rule or 15px override',()=>{
 const css=read('../styles/reconstruction-ranks-hero-cycle0012-v891.css');
 const app=read('../pages/_app.tsx');
 assert.match(app,/import "\.\.\/styles\/reconstruction-ranks-hero-cycle0012-v891\.css";/);
 assert.match(css,/@container efhc-ranks-summary \(max-width: 440px\)/);
 assert.match(css,/\[data-ranks-hero-summary="cycle0012-responsive"\]/);
 assert.match(css,/\[data-ranks-hero-energy-d8="true"\]/);
 for(const banned of ['.efhc-rank-card','.efhc-rank-position','.efhc-rank-username','.efhc-rank-generated'])
  assert.ok(!css.includes(banned),'List CSS must not change: '+banned);
 assert.ok(!css.includes('!important'));
 assert.ok(!css.includes('font-size: 15px'));
});
test('existing Pages browser smoke gates real React top panel at 390 and 360',()=>{
 const y=read('../../../ci/efhc-pages.yml');
 for(const marker of ['OWNER_RANKS_HERO_OR_DEMO_REGRESSION','OWNER_RANKS_220_DEMO_PAGINATION_REGRESSION','PASS OWNER RANKS HERO RESPONSIVE','data-ranks-hero-energy-d8','data-ranks-show-me-action'])
  assert.ok(y.includes(marker),marker);
});
