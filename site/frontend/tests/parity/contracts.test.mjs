import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {expectedSelectionOrder} from './progress-order.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(process.env.EFHC_FRONTEND_DEPENDENCIES || new URL('../../package.json',import.meta.url));
const ts=require('typescript');
const cache=new Map();
function load(relative){
 const filename=path.resolve(root,relative);
 if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=name=>name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts'))):require(name);
 vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(localRequire,module,module.exports);
 return module.exports;
}
const canon=JSON.parse(fs.readFileSync(new URL('./v866-contract.json',import.meta.url)));
const registry=load('src/lib/interfaceVariantRegistry.ts');
const colors=load('src/lib/colorThemeRegistry.ts');
const headers=load('src/lib/headerThemeComposition.ts');
const json=value=>JSON.parse(JSON.stringify(value));
test('PA-01 source reference and delivered public stylesheet stay connected',()=>{
 const reference=JSON.parse(fs.readFileSync(new URL('./v866-panels-activation-reference.json',import.meta.url)));
 assert.equal(reference.source_html_sha256,canon.source.html_sha256);
 const source=fs.readFileSync(path.join(root,'src/styles/reconstruction-v866-panels-cycle0010.css'),'utf8');
 const delivered=fs.readFileSync(path.join(root,'public/react-shell-mobile-viewport-v923.css'),'utf8');
 const start='/* BEGIN SOURCE: src/styles/reconstruction-v866-panels-cycle0010.css */\n';
 const end='/* END SOURCE: src/styles/reconstruction-v866-panels-cycle0010.css */';
 assert.equal(delivered.split(start).length,2);assert.equal(delivered.split(end).length,2);
 assert.equal(delivered.split(start)[1].split(end)[0],source,'Pages must receive the actual corrected source CSS');
});
test('Portfolio color bridge preserves accepted geometry rules and contains no sizing changes',()=>{
 const source=fs.readFileSync(path.join(root,'src/styles/reconstruction-v866-panels-cycle0010.css'),'utf8');
 const start='/* RECON_CYCLE_0024/02 — source Portfolio chroma bridge.';
 const end='/* PC-01 source shows plain countdown text';
 const bridge=source.split(start)[1].split(end)[0];
 const before=source.split(start)[0],after=end+source.split(end)[1];
 const accepted=(before+after).slice(before.indexOf('/* RECON_CYCLE_0011:'));
 assert.equal(crypto.createHash('sha256').update(accepted.replace(/\s+/g,'')).digest('hex'),'e759f04a3a87f4cd8d645e56f99afb79fee309d40e5ba263fa071e42e13ad88c','accepted PC source geometry/selectors unchanged after whitespace normalization');
 const allowed=new Set(['background-image','background-color','background','border-color','color','box-shadow','text-shadow']);
 for(const [,body] of bridge.matchAll(/\{([^{}]*)\}/g))for(const [,property] of body.matchAll(/([\w-]+)\s*:/g))assert.ok(allowed.has(property),`geometry declaration in color-only bridge: ${property}`);
 const fixture=JSON.parse(fs.readFileSync(new URL('./v866-panels-hero-reference.json',import.meta.url)));
 assert.equal(fixture.source_html_sha256,canon.source.html_sha256);
 assert.deepEqual(fixture.cases.map(c=>c.selection),canon.REGISTRY.PH.slice(1));
});
test('OWNER shared progress library exposes 24 positions with independent PB/RP identities',()=>{
 const expected=expectedSelectionOrder('PB',canon);
 assert.deepEqual(json(registry.INTERFACE_VARIANT_REGISTRY.PB),expected);
 assert.equal(registry.getInterfaceVariantAuthoredSlotCount('PB'),24,'hidden empty positions remain');
 assert.equal(registry.getInterfaceVariantAuthoredSlotCount('RP'),24);
 for(const id of canon.REGISTRY.PB.filter(id=>!expected.includes(id)))assert.equal(registry.normalizeInterfaceVariant('PB',id),'PB-01','retired choice still selectable');
});
test('USER available-height source is delivered byte-for-byte after frozen CSS',()=>{
 const source=fs.readFileSync(path.join(root,'src/styles/user-available-height.css'),'utf8').trimEnd();
 const delivered=fs.readFileSync(path.join(root,'public/react-shell-mobile-viewport-v923.css'),'utf8');
 const begin='/* BEGIN SOURCE: src/styles/user-available-height.css */\n';
 const end='\n/* END SOURCE: src/styles/user-available-height.css */';
 assert.equal(delivered.split(begin).length,2,'duplicate/missing height authority');
 assert.equal(delivered.split(begin)[1].split(end)[0],source);
});
test('OWNER: first ten progress positions are accepted CT starters; all saved IDs retain their models',()=>{
 for(const group of ['PB','RP']){
  const expected=expectedSelectionOrder(group,canon);
  assert.deepEqual(json(registry.INTERFACE_VARIANT_SLOT_REGISTRY[group]),expected,`${group} dot positions`);
  for(let i=0;i<expected.length;i++){
   const selected=expected[i];
   assert.equal(registry.cycleInterfaceVariant({...canon.DEFAULTS,[group]:selected},group,1)[group],expected[(i+1)%expected.length]);
   assert.equal(registry.cycleInterfaceVariant({...canon.DEFAULTS,[group]:selected},group,-1)[group],expected[(i+expected.length-1)%expected.length]);
   assert.equal(registry.normalizeInterfaceVariants({[group]:selected})[group],selected,'saved selection migrated unnecessarily');
   assert.equal(registry.resolveInterfaceVariantStyle(group,selected),canon.SOURCE_STYLE[group][selected]||selected);
  }
 }
});
test('source model bindings and 28 other families remain intact after OWNER Energy cleanup',()=>{
 const catalog={...canon.REGISTRY,PB:expectedSelectionOrder('PB',canon),RP:expectedSelectionOrder('RP',canon)};
 assert.deepEqual(json(registry.INTERFACE_VARIANT_REGISTRY),catalog);
 assert.deepEqual(json(registry.INTERFACE_VARIANT_STYLE_BINDINGS),canon.SOURCE_STYLE);
 assert.deepEqual(json(registry.DEFAULT_INTERFACE_VARIANTS),canon.DEFAULTS);
 for(const [group,variants] of Object.entries(catalog))for(const selection of variants){
  const order=expectedSelectionOrder(group,canon);
  assert.equal(registry.resolveInterfaceVariantStyle(group,selection),canon.SOURCE_STYLE[group][selection]||selection,`${group}/${selection}`);
  const next=registry.cycleInterfaceVariant({...canon.DEFAULTS,[group]:selection},group,1);
  assert.equal(next[group],order[(order.indexOf(selection)+1)%order.length]);
  assert.equal(registry.cycleInterfaceVariant(next,group,-1)[group],selection);
 }
});
test('header composition uses each canonical selection once',()=>{
 for(const selection of canon.REGISTRY.HS){
  const expected=canon.HEADER_THEME_COMPOSITION[canon.SOURCE_STYLE.HS[selection]||selection];
  const actual=headers.resolveHeaderThemeComposition(selection);
  assert.deepEqual({shell:actual.shell,hb:actual.balance,sc:actual.statuses},expected);
 }
});
test('ten color palettes and runtime projections match HTML v866',()=>{
 assert.equal(colors.COLOR_THEME_CATALOG.length,10);
 for(const expected of canon.COLOR_THEME_CATALOG){
  const actual=colors.getColorThemeDefinition(expected.id);
  assert.equal(actual.accent,expected.accent);
  assert.equal(colors.runtimeLegacyThemeIdForColorTheme(expected.id),canon.COLOR_TO_RUNTIME_LEGACY_THEME[expected.id]);
  const next=colors.cycleColorThemeRecord(expected.id,1);
  assert.equal(colors.cycleColorThemeRecord(next.id,-1).id,expected.id);
 }
});
test('frozen v866 CSS retains exact source extraction hashes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/design-system/v866-css-canon-manifest.json')));
 assert.equal(manifest.stylesheets['FRONTEND_v866.css'].source_html_sha256,canon.source.html_sha256);
 for(const [name,expected] of Object.entries(manifest.stylesheets)){
  const bytes=fs.readFileSync(path.join(root,'public',name));
  assert.equal(bytes.length,expected.bytes,name);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected.sha256,name);
 }
});

test('rank selections use the authored style identities from HTML v866',()=>{
 for(const selection of canon.REGISTRY.KG)assert.equal(registry.rankStyleId(selection),canon.RANK_STYLE_ID_BY_SELECTION[selection]);
});

// OWNER cycle0023 explicitly replaces dot positioning; retain its new renderer
// checksum and independent behavioral geometry guards. Provider stays byte-locked.
// Preserve rollback state/DOM. OWNER subsequently authorized progress ordering
// and four Energy unit text wrappers; physical models stay covered above.
test('OWNER-rejected progress and Header adapters stay detached after rollback',()=>{
 const expected={"src/components/interface-settings/InterfaceCustomizationProvider.tsx": "235a699fed368ce2c7790b1566dcb3b6eb5a3e7719cf98f95643b0334402dcbd", "src/components/interface-settings/InterfaceVariantDotsLayer.tsx": "6e33cbe39795db57cf3eb24063901b7116398ffde5d92d5521d4534877f02120"};
 for(const [file,hash] of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file);
 const app=fs.readFileSync(path.join(root,'src/pages/_app.tsx'),'utf8');
 assert.doesNotMatch(app,/v866-react-progress\.css|react-header-transparent\.css/);
 assert.equal(registry.INTERFACE_VARIANT_REGISTRY.PB.length,24);
 assert.equal(registry.INTERFACE_VARIANT_REGISTRY.RP.length,24);
 const energy=fs.readFileSync(path.join(root,'src/pages/index.tsx'),'utf8')
  // OWNER 0024/03 authorizes data projection only; retain the previous full
  // source lock after removing precisely that declared functional delta.
  .replace('import { useDemoGenerationProjection } from "../hooks/useDemoGenerationProjection";\n','')
  .replace('const localEnergyScaled = useMemo','const eLiveScaled = useMemo')
  .replace('  const demoGeneration = useDemoGenerationProjection();\n  const eLiveScaled = demoGeneration ? toScaled(demoGeneration.total_generated_kwh) : localEnergyScaled;\n\n','')
  .replace('formatFixedDown(demoGeneration?.available_kwh ?? fromScaled(toScaled(props.available_kwh) + (eLiveScaled - e0ScaledRaw)), 8)','formatFixedDown(props.available_kwh, 8)')
  .replace('import { EnergyUnitText } from "../components/energy/EnergyUnitText";\n','')
  .replace('<EnergyUnitText text={props.labels.total_generated} />','{props.labels.total_generated}')
  .replace('<EnergyUnitText text={props.labels.kwh_suffix} />','props.labels.kwh_suffix')
  .replace('<EnergyUnitText text="kWh/s" />','<span data-i18n-fixed-token="kWh/с">kWh/с</span>')
  .replace('<EnergyUnitText text={props.labels.available_kwh_chip} />','{props.labels.available_kwh_chip}');
 assert.equal(crypto.createHash('sha256').update(energy).digest('hex'),'0932660bfb1fc8f4d1a5534377a815bf78a8e6923cf6a18aece3b4b64e4f11fb','Energy changed beyond approved unit labels and cycle0023 indicator relocation');
});
