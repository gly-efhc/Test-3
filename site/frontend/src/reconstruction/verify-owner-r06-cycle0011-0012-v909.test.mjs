/** OWNER continuation 0011–0012; R06-backed regression contract.
 * These source tests supplement, but never substitute for, actual Next/Chrome E2E. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const here=import.meta.dirname;
const read = p=>fs.readFileSync(path.resolve(here,p),'utf8');

test('R06 ranks D8 is atomic, only within the hero; no global styles or list changes',()=>{
 const css=read('../styles/reconstruction-ranks-hero-cycle0012-v891.css');
 const anchor='.efhc-ranks-shell[data-kg] [data-ranks-hero-energy-d8="true"]';
 const i=css.indexOf(anchor);
 assert.ok(i>0,'Missing exact D8 span selector');
 const body=css.slice(i,css.indexOf('}',i));
 assert.match(body,/white-space:\s*nowrap/);
 assert.match(body,/overflow-wrap:\s*normal/);
 assert.match(body,/word-break:\s*normal/);
 assert.doesNotMatch(body,/anywhere/);
 assert.doesNotMatch(css,/\.efhc-rank-card|\.efhc-rank-username|\.efhc-rank-generated|!important/);
 const ranks=read('../pages/ranks.tsx');
 assert.match(ranks,/value=\{<span data-ranks-hero-energy-d8="true">\{myMetric\}<\/span>\}/);
 assert.match(ranks,/data-ranks-load-more="true"/);
});

test('R06 live Chrome check measures text fragments, not only container overflow',()=>{
 const script=read('../../../ci/efhc-pages.yml');
 assert.ok((script.match(/const energyFragments=/g)||[]).length>=2);
 assert.ok((script.match(/energyWrapOrClip/g)||[]).length>=6);
 assert.match(script,/energyRange\.getClientRects\(\)/);
 assert.match(script,/OWNER_RANKS_220_DEMO_PAGINATION_REGRESSION/);
});

test('R06 archive requires full 20+20+20, no duplicates and final panel 160',()=>{
 const script=read('../../../ci/efhc-pages.yml');
 for(const x of ['OWNER_PORTFOLIO_ARCHIVE_20_20_20_FAILED','OWNER_PORTFOLIO_ARCHIVE_OVERFETCH',
  'OWNER_PORTFOLIO_ARCHIVE_LAST_RECORD_MISSING','PNL-000000101','PNL-000000160'])
  assert.ok(script.includes(x),x);
 const source=read('../pages/panels/portfolio.tsx');
 assert.match(source,/data-panels-tab-button="archive"/);
 assert.match(source,/data-panels-scroll-mode="canonical-window"/);
 assert.match(source,/data-panel-identity=\{p\.public_id \?\? String\(p\.id\)\}/);
});

test('R06 source evidence does not authorize changes to protected UX and economics',()=>{
 const ranks=read('../pages/ranks.tsx');
 const portfolio=read('../pages/panels/portfolio.tsx');
 assert.match(ranks,/useRankTopPages\(/);
 assert.match(ranks,/void moreQ\.fetchNextPage\(\)/);
 assert.match(portfolio,/current === "oldest" \? "newest" : "oldest"/);
 assert.match(portfolio,/listQuery\.fetchNextPage\(\)/);
});
