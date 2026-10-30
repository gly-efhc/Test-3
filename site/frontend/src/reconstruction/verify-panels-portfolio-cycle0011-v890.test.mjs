/** Cycle 0011; source & real fixture executable tests. Not Next/browser evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const folder=import.meta.dirname;
const read=(name)=>fs.readFileSync(path.resolve(folder,name),'utf8');
const fixtures=JSON.parse(read('demo-tables-v866.json'));
function loadAt(ms){
 class FixedDate extends Date {static now(){return ms;}}
 const source=read('demoTables.ts');
 const {outputText}=ts.transpileModule(source,{fileName:'demoTables.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const globals={exports:{},Date:FixedDate,require(name){
  if(name.endsWith('demo-tables-v866.json'))return {default:fixtures};
  if(name.endsWith('/db-id'))return {dbIdFromApi:value=>String(value)};
  throw Error('Unexpected import '+name);
 }};
 vm.runInNewContext(outputText,globals,{filename:'cycle0011-demoTables.js'});
 return globals.exports;
}
test('frozen 60+60 rows are ordered BEFORE 20-record pages in both directions',()=>{
 const demo=loadAt(Date.parse('2026-10-30T12:00:00Z'));
 for(const tab of ['active','archive'])for(const direction of ['oldest','newest']){
  let cursor=null;let records=[];let lengths=[];
  do{
   const page=demo.demoPanelsPage(tab,cursor,direction);
   lengths.push(page.items.length);records.push(...page.items);cursor=page.next_cursor;
  }while(cursor!==null);
  assert.deepEqual(lengths,[20,20,20]);
  assert.equal(records.length,60);
  assert.equal(new Set(records.map(p=>p.public_id)).size,60);
  const ids=records.map(p=>Number(p.id));
  const expected=(tab==='active'?Array.from({length:60},(_,i)=>i+1):Array.from({length:60},(_,i)=>i+101));
  if(direction==='oldest')expected.reverse();
  assert.deepEqual(ids,expected);
  assert.equal(records[0].generated_kwh.endsWith('00000000')||/\.\d{8}$/.test(records[0].generated_kwh),true);
 }
});
test('default source-order remains backward compatible with older consumers',()=>{
 const d=loadAt(Date.parse('2026-10-30T12:00:00Z'));
 assert.equal(d.demoPanelsPage('active',null).items[0].public_id,'PNL-000000001');
 assert.equal(d.demoPanelsPage('archive',null).items[0].public_id,'PNL-000000101');
 assert.equal(d.demoPanelsPage('active',null,'oldest').items[0].public_id,'PNL-000000060');
 assert.equal(d.demoPanelsPage('archive',null,'oldest').items[0].public_id,'PNL-000000160');
});
test('React DEMO query key isolates sorting; production stays API-authoritative',()=>{
 const s=read('../queries/usePanels.ts');
 assert.match(s,/queryKey: demo\s*\?/);
 assert.match(s,/\[\.\.\.queryKeys\.panels\.list\(globalId, tab\), "demo", sortDirection\]/);
 assert.match(s,/\: queryKeys\.panels\.list\(globalId, tab\)/);
 assert.match(s,/demoPanelsPage\(tab, pageParam, sortDirection\)/);
 assert.match(s,/getPanelsPage\(\{ tab, cursor: pageParam, signal \}\)/);
});
test('onScroll uses visible panel identity rather than raw added scrollHeight',()=>{
 const s=read('../pages/panels/portfolio.tsx');
 assert.match(s,/data-panel-identity=\{p\.public_id \?\? String\(p\.id\)\}/);
 assert.match(s,/visibleId: visible\?\.dataset\.panelIdentity/);
 assert.match(s,/visible\.getBoundingClientRect\(\)\.top/);
 assert.doesNotMatch(s,/node\.scrollTop\s*=\s*anchor\.scrollTop\s*\+\s*addedHeight/);
 assert.match(s,/data-panels-batch-size="20"/);
});
test('PC-01 density and UTC seconds are scoped, fixed token Activ stays neutral on archived',()=>{
 const s=read('../pages/panels/portfolio.tsx');
 const css=read('../styles/reconstruction-v866-panels-cycle0010.css');
 assert.match(s, /\$\{dd\}\.\$\{mm\}\.\$\{yy\}, \$\{hh\}:\$\{mi\}:\$\{ss\} UTC/);
 assert.match(s,/data-active=\{p\.is_active \? "true" : "false"\}/);
 assert.match(s,/data-i18n-fixed-token="Activ"/);
 assert.match(css,/\.efhc-panels-portfolio-shell \.efhc-panels-card-surface\[data-pc="PC-01"\]/);
 assert.doesNotMatch(css,/\.efhc-panels-portfolio-shell \.efhc-panels-card-surface\[data-pc="PC-02"\]/);
});
test('Pages CI has a real DOM gate for 60+60, 20+20+20, dates and sorted tabs',()=>{
 const s=read('../../../ci/efhc-pages.yml');
 for(const label of ['OWNER_PORTFOLIO_INITIAL_OLDEST_20_REGRESSION','OWNER_PORTFOLIO_20_20_20_PAGE_LOAD_FAILED','OWNER_PORTFOLIO_SCROLL_ANCHOR_OR_DUPLICATE','OWNER_PORTFOLIO_ARCHIVE_OLDEST_PAGE_FAILED','OWNER_PORTFOLIO_ARCHIVE_NEWEST_PAGE_FAILED','OWNER_PORTFOLIO_CARD_DATE_GEOMETRY_REGRESSION']) assert.ok(s.includes(label),label);
});
