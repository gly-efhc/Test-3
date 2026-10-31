import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
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
test('all 29 design families, 236 selections and defaults match HTML v866',()=>{
 assert.deepEqual(json(registry.INTERFACE_VARIANT_REGISTRY),canon.REGISTRY);
 assert.deepEqual(json(registry.DEFAULT_INTERFACE_VARIANTS),canon.DEFAULTS);
 for(const [group,variants] of Object.entries(canon.REGISTRY))for(const selection of variants){
  assert.equal(registry.resolveInterfaceVariantStyle(group,selection),canon.SOURCE_STYLE[group][selection]||selection,`${group}/${selection}`);
  const next=registry.cycleInterfaceVariant({...canon.DEFAULTS,[group]:selection},group,1);
  assert.equal(next[group],variants[(variants.indexOf(selection)+1)%variants.length]);
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
