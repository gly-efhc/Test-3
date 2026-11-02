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
test('OWNER Energy cleanup retains 18 positions and leaves Referrals at 33',()=>{
 const expected=expectedSelectionOrder('PB',canon);
 assert.deepEqual(json(registry.INTERFACE_VARIANT_REGISTRY.PB),expected);
 assert.equal(registry.getInterfaceVariantAuthoredSlotCount('PB'),18,'hidden empty positions remain');
 assert.equal(registry.getInterfaceVariantAuthoredSlotCount('RP'),33);
 for(const id of canon.REGISTRY.PB.filter(id=>!expected.includes(id)))assert.equal(registry.normalizeInterfaceVariant('PB',id),'PB-01','retired choice still selectable');
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
 const catalog={...canon.REGISTRY,PB:expectedSelectionOrder('PB',canon)};
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

// Preserve rollback state/DOM. OWNER subsequently authorized progress ordering
// and four Energy unit text wrappers; physical models stay covered above.
test('OWNER-rejected progress and Header adapters stay detached after rollback',()=>{
 const expected={"src/components/interface-settings/InterfaceCustomizationProvider.tsx": "235a699fed368ce2c7790b1566dcb3b6eb5a3e7719cf98f95643b0334402dcbd", "src/components/interface-settings/InterfaceVariantDotsLayer.tsx": "e1b45f4406aa1dd2b603f13d6a736dc2a8d1735dd0356e6345120e5f53834f0d"};
 for(const [file,hash] of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file);
 const app=fs.readFileSync(path.join(root,'src/pages/_app.tsx'),'utf8');
 assert.doesNotMatch(app,/v866-react-progress\.css|react-header-transparent\.css/);
 assert.equal(registry.INTERFACE_VARIANT_REGISTRY.PB.length,18);
 assert.equal(registry.INTERFACE_VARIANT_REGISTRY.RP.length,33);
 const energy=fs.readFileSync(path.join(root,'src/pages/index.tsx'),'utf8')
  .replace('import { EnergyUnitText } from "../components/energy/EnergyUnitText";\n','')
  .replace('<EnergyUnitText text={props.labels.total_generated} />','{props.labels.total_generated}')
  .replace('<EnergyUnitText text={props.labels.kwh_suffix} />','props.labels.kwh_suffix')
  .replace('<EnergyUnitText text="kWh/s" />','<span data-i18n-fixed-token="kWh/с">kWh/с</span>')
  .replace('<EnergyUnitText text={props.labels.available_kwh_chip} />','{props.labels.available_kwh_chip}');
 assert.equal(crypto.createHash('sha256').update(energy).digest('hex'),'31fc0fbba4a10b444ed18ab885953482b05fb2d0ff2b9f6a46929e845dd22116','Energy changed beyond approved unit labels');
});
