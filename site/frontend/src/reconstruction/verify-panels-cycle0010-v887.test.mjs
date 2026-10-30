/** RECON_CYCLE_0010: immutable OWNER guards + D8 display + safe DEMO preview. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('Panels main source is mapped to frozen HTML without touching the My Panels CTA',()=>{
 const s=read('pages/panels.tsx');
 assert.match(s,/data-panels-canon-scope="main-v866"/);
 assert.match(s,/data-panels-hero-source="panelsHero"/);
 assert.match(s,/data-panels-activation-source="panels-activation-card"/);
 assert.match(s,/data-panels-portfolio-entrypoint="canonical"/);
 assert.match(s,/router\.push\(PANELS_ROUTE_STATIC_GUARD\.portfolio\)/);
 assert.match(s,/className="w-full efhc-panels-portfolio-entry"/);
});

test('public DEMO activation is explicit preview and cannot mutate data',()=>{
 const s=read('pages/panels.tsx');
 assert.match(s,/const demoPreview = useFrozenDemoTables\(\) && !globalId/);
 const guard=s.indexOf('if (demoPreview) {',s.indexOf('const activatePanel = async'));
 const mutation=s.indexOf('await activationMutation.mutateAsync');
 assert.ok(guard>0 && mutation>guard);
 const preview=s.slice(guard,s.indexOf('const idk = newIdempotencyKey()'));
 assert.match(preview,/toast\("DEMO:/);
 assert.match(preview,/return;/);
 assert.doesNotMatch(preview,/mutateAsync|newIdempotencyKey/);
 assert.match(s,/data-panels-demo-preview=\{demoPreview \? "read-only" : undefined\}/);
});

test('production panel activation still requires owner Global ID + idempotency',()=>{
 const s=read('pages/panels.tsx');
 assert.match(s,/\(!globalId && !demoPreview\)/);
 assert.match(s,/const idk = newIdempotencyKey\(\)/);
 assert.match(s,/await activationMutation.mutateAsync\(idk\)/);
 assert.match(s,/cmp8\(totalActivationBalance, "100"\)/);
 assert.match(s,/sumScaledDown\(/);
});

test('effective rate is never visually truncated to an ellipsis',()=>{
 const css=read('styles/reconstruction-v866-panels-cycle0010.css');
 assert.match(read('pages/_app.tsx'),/reconstruction-v866-panels-cycle0010\.css/);
 assert.match(css,/\.efhc-panels-hero \.efhc-game-stat_value/);
 assert.match(css,/overflow-wrap: anywhere/);
 assert.match(css,/text-overflow: clip/);
 assert.match(css,/white-space: normal/);
 assert.match(css,/font-variant-numeric: tabular-nums lining-nums/);
 assert.match(read('pages/panels.tsx'),/format8\(genPerSecEffective\)/);
});

test('protected Energy / MAX / Referrals controls remain present',()=>{
 assert.match(read('pages/index.tsx'),/efhc-energy/);
 assert.match(read('components/ExchangePanel.tsx'),/data-exchange-max-action="true"/);
 assert.match(read('pages/withdraw.tsx'),/efhc-withdraw-max-cta/);
 assert.match(read('pages/referrals.tsx'),/referrals/);
});

test('portfolio pagination remains isolated for cycle 0011',()=>{
 const s=read('pages/panels/portfolio.tsx');
 assert.match(s,/data-panels-batch-size="20"/);
 assert.match(s,/listQuery.fetchNextPage\(\)/);
 assert.match(s,/data-panels-tabs="active-archive"/);
});
