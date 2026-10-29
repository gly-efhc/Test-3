import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('./demo-tables-v866.json',import.meta.url),'utf8'));
test('frozen v866 provenance and cardinalities',()=>{
 assert.equal(data.source_sha256,'9b6371f5fb62939596b78206f95031c447e9f2b375e62b30704403bb25102aef');
 assert.equal(data.panels.active.length,60);
 assert.equal(data.panels.archive.length,60);
 assert.equal(data.ranks.users.length,220);
 assert.equal(data.tasks.catalog.length,5);
});
test('original panel rule and batches retained',()=>{
 assert.equal(data.panels.batch_size,20);
 assert.equal(data.panels.active[0].public_id,'PNL-000000001');
 assert.equal(data.panels.archive[0].public_id,'PNL-000000101');
 assert.equal(data.panels.active[0].base_gen_per_sec,'0.00000692');
 assert.equal(data.panels.archive[0].generated_kwh,'107.61984000');
 for(const k of ['active','archive']) assert.equal(new Set(data.panels[k].map(x=>x.public_id)).size,60);
});
test('original 220 rank users with deliberate equal scores',()=>{
 assert.equal(data.ranks.users.filter(r=>r.username==='federation_003').length,1);
 const b=data.ranks.users.find(r=>r.username==='federation_002');
 const c=data.ranks.users.find(r=>r.username==='federation_003');
 assert.equal(b.total_generated_kwh,c.total_generated_kwh);
 assert.equal(b.rank_pos,c.rank_pos);
 assert.equal(data.ranks.me.total_generated_kwh,'8123.12345678');
});
test('original 5 task codes, rewards and templates',()=>{
 assert.deepEqual(data.tasks.catalog.map(x=>x.code),
 ['demo_join_telegram','demo_watch_builtin','demo_partner_webapp','demo_website_visit','demo_partner_bot']);
 assert.equal(data.tasks.catalog[1].meta.ads.daily_limit,10);
 assert.equal(data.tasks.catalog[0].bonus_efhc,'0.10000000');
 assert.equal(data.tasks.earnings.total_bonus_earned,'0.02000000');
});
