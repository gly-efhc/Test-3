import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../../..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const versioned = read("ci/efhc-pages.yml");
const scanner = read("frontend/src/reconstruction/ci_predeploy_diagnostics.py");
const tasks = read("frontend/src/pages/tasks.tsx");
const badge = read("frontend/src/components/ui/Badge.tsx");
const css = read("frontend/src/styles/reconstruction-tasks-cycle0013-v892.css");
const pkg = JSON.parse(read("frontend/package.json"));
const lock = JSON.parse(read("frontend/package-lock.json"));
const support = "frontend/src/reconstruction/pages_ci/";

test("v907: Chrome Tasks tests reflect current Global-ID DEMO and real React badge markup", () => {
  assert.match(tasks, /data-demo-task-mode=\{isDemoPreview \? "global-id-unified-preview"/);
  assert.doesNotMatch(tasks, /isolated-preview/);
  assert.match(versioned, /result\.demo!==\x27global-id-unified-preview\x27/);
  assert.match(versioned, /taskDemo\.demo!==\x27global-id-unified-preview\x27/);
  assert.doesNotMatch(versioned, /!==\x27isolated-preview\x27/);
  assert.match(badge, /className=\{/);
  assert.match(versioned, /efhc-task-card_reward > span:last-child/);
  assert.match(css, /efhc-task-card_reward > span:last-child/);
  assert.match(css, /color:var\(--tasks-cycle-accent\)!important/);
});

test("v907: public Pages diagnostics run real runnable TONConnect and exact release/budget scripts", () => {
  assert.match(scanner, /node', '--test', str\(public_suite\)/);
  assert.match(scanner, /frontend-tonconnect-private-acceptance/);
  assert.match(scanner, /NOT_AVAILABLE/);
  assert.match(scanner, /'frontend-performance-budgets', 'budgets\.mjs'/);
  assert.match(scanner, /'frontend-release-assets', 'verify-production-assets\.mjs'/);
  const originalBudgets = read('frontend/scripts/budgets.mjs');
  const importedBudgets = read(support + 'budgets.mjs');
  for (const limit of ['300_000', '250_000', '420_000', '350_000', '370_000']) {
    assert.ok(originalBudgets.includes(limit), limit);
    assert.ok(importedBudgets.includes(limit), limit);
  }
  for (const behavior of ['gzipSync', 'brotliCompressSync', 'build-manifest.json']) {
    assert.ok(originalBudgets.includes(behavior));
    assert.ok(importedBudgets.includes(behavior));
  }
  assert.match(importedBudgets, /baseline_comparison: "NOT_AVAILABLE_IN_PUBLIC_PAGES_RUNNER"/);
  assert.equal(read('frontend/scripts/verify-production-assets.mjs'), read(support + 'verify-production-assets.mjs'));
  assert.doesNotMatch(versioned, /UPDATE_POLICY.json/);
});

test("v907: follow-redirects fixed at registry-verified integrity without dependency downgrades", () => {
  const rec = lock.packages['node_modules/follow-redirects'];
  assert.equal(pkg.overrides['follow-redirects'], '^1.16.2');
  assert.equal(rec.version, '1.16.2');
  assert.equal(rec.resolved, 'https://registry.npmjs.org/follow-redirects/-/follow-redirects-1.16.2.tgz');
  assert.equal(rec.integrity,
    'sha512-/kVP2U8z596Ia0gwFrwyIeo74ta5aVmSeU1FfAUMAmcEP5EP7zydmag3SLiN64NaRKef3lxsq7i/g7ltJQDGow==');
  assert.equal(pkg.dependencies['@tonconnect/sdk'], '5.0.0');
  assert.equal(pkg.dependencies.next, '16.4.3');
});

test("v907: diagnostics never treat missing private backend as successful testing", () => {
  assert.match(scanner, /backend_source_present/);
  for (const tool of ['bandit', 'flake8', 'ruff', 'mypy', 'pip-audit', 'pytest']) {
    assert.match(scanner, new RegExp('backend-' + tool));
  }
  assert.match(scanner, /TOOL_ERROR/);
  assert.match(scanner, /quality-\{args\.phase\}\.json/);
  assert.match(scanner, /asyncio\.create_subprocess_exec/);
  assert.doesNotMatch(scanner, /shell=True/);
});
