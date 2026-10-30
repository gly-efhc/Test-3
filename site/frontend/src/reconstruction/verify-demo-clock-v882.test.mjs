import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const folder = path.dirname(fileURLToPath(import.meta.url));
const tsPath = path.join(folder,'demoTables.ts');
const source = fs.readFileSync(tsPath,'utf8');
const fixture = JSON.parse(fs.readFileSync(path.join(folder,'demo-tables-v866.json'),'utf8'));

function loadDemoAt(startMs) {
  let currentMs = startMs;
  class PreviewDate extends Date { static now() { return currentMs; } }
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const sandbox={exports:{},Date:PreviewDate,require(name) {
    if (name.endsWith('demo-tables-v866.json')) return {__esModule:true,default:fixture};
    if (name.endsWith('/db-id')) return {dbIdFromApi:value=>String(value)};
    throw new Error('Unapproved import '+name);
  }};
  vm.runInNewContext(js,sandbox,{filename:'demoTables.v882.transpiled.js'});
  return {demo:sandbox.exports,advance(ms){currentMs+=ms;}};
}
test('same 60+60 HTML-derived panel rows keep one clock across page requests',()=>{
  const startMs=Date.parse('2026-10-30T12:00:00.000Z');
  const {demo,advance}=loadDemoAt(startMs);
  const first=demo.demoPanelsPage('active',null);
  assert.equal(first.items.length,20);
  const stable=first.items[0].activated_at;
  assert.equal(stable,new Date(startMs-86400000).toISOString());
  advance(180000);
  const second=demo.demoPanelsPage('active','20');
  assert.equal(second.items[0].activated_at,new Date(startMs-21*86400000).toISOString());
  const firstAgain=demo.demoPanelsPage('active',null);
  assert.equal(firstAgain.items[0].activated_at,stable);
  const archive=demo.demoPanelsPage('archive',null);
  assert.equal(archive.items.length,20);
  assert.ok(Date.parse(archive.items[0].expires_at)<startMs);
  assert.equal(demo.demoPanelsSummary().nearest_expire_at,new Date(startMs-60*86400000+180*86400000).toISOString());
});
test('pagination and source fixtures retain canonical identifiers and rates',()=>{
  const {demo}=loadDemoAt(Date.parse('2026-10-30T12:00:00.000Z'));
  for(const tab of ['active','archive']) {
    const all=[];let cursor=null;
    do {const result=demo.demoPanelsPage(tab,cursor);all.push(...result.items);cursor=result.next_cursor;}while(cursor!==null);
    assert.equal(all.length,60);
    assert.equal(new Set(all.map(x=>x.public_id)).size,60);
  }
  assert.equal(demo.demoPanelsPage('active',null).items[0].base_gen_per_sec,'0.00000692');
  assert.throws(()=>demo.demoPanelsPage('active','-1'),/cursor/);
});
