import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname, '../../..');
const a=readFileSync(resolve(root,'.github/workflows/efhc-pages.yml'),'utf8');
const b=readFileSync(resolve(root,'ci/efhc-pages.yml'),'utf8');
const py=readFileSync(resolve(root,'frontend/src/reconstruction/ci_predeploy_diagnostics.py'),'utf8');
for (const [label,yaml] of [['registered',a],['versioned',b]]) {
 test(`${label}: security and quality scanners run before artifact upload and pages`,()=>{
  const names=['Install optional quality scanners (non-blocking)','Collect security, lint, type and dependency findings (non-blocking)','Collect frontend regression test failures (non-blocking)','Compile actual React/Next for Pages (no backend)','Collect post-build quality findings (non-blocking)','Collect Chrome route and UI failures before Pages (non-blocking)','Summarize pre-deploy diagnostics, including failures','Upload pre-deploy diagnostic logs, even when tests fail','Upload compiled React to Pages','Deploy real React to GitHub Pages'];
  const positions=names.map(n=>yaml.indexOf(`      - name: ${n}`));
  assert.ok(positions.every(p=>p>=0),String(positions));
  assert.ok(positions.every((p,i)=>!i||p>positions[i-1]));
  assert.match(yaml,/EFHC_QUALITY_PREBUILD_OUTCOME/);
  assert.match(yaml,/EFHC_QUALITY_POSTBUILD_OUTCOME/);
  assert.match(yaml,/backend_coverage_gap/);
  assert.match(yaml,/retention-days: 14/);
 });
 test(`${label}: scanners do not block deploy, build and export still block`,()=>{
  for(const n of ['Install optional quality scanners (non-blocking)','Collect security, lint, type and dependency findings (non-blocking)','Collect post-build quality findings (non-blocking)']){
   const section=yaml.split(`      - name: ${n}\n`)[1].split('\n      - name: ')[0];
   assert.match(section,/continue-on-error: true/);
  }
  for(const n of ['Compile actual React/Next for Pages (no backend)','Fail closed if real React static export is missing','Upload compiled React to Pages','Deploy real React to GitHub Pages']){
   const section=yaml.split(`      - name: ${n}\n`)[1].split('\n      - name: ')[0];
   assert.doesNotMatch(section,/continue-on-error: true/);
  }
 });
}
test('versioned retains all 4 embedded Pages tools; registered loads versioned imported tools',()=>{
 assert.match(b,/EFHC_BUNDLED_BROWSER_SMOKE_MJS/);
 for(const name of ['prepare_pages.py','fix_pages_assets.py','verify_export.py','browser-smoke.mjs']) assert.ok(b.includes(name));
 assert.match(a,/Load versioned Pages tools imported from ZIP/);
 assert.notEqual(a,b);
});
test('security checks exist and mark missing backend checks NOT_AVAILABLE',()=>{
 for (const name of ['frontend-typecheck','frontend-tonconnect-regression','npm-dependency-audit','pages-python-compile','pages-flake8','pages-bandit','pages-ruff','backend-compile','backend-bandit','backend-flake8','backend-ruff','backend-mypy','backend-pip-audit','backend-pytest','frontend-performance-budgets','frontend-release-assets']) assert.ok(py.includes(name),name);
 assert.match(py,/NOT_AVAILABLE/);
 assert.match(py,/TOOL_ERROR/);
 assert.match(py,/quality-\{args.phase\}\.json/);
});
