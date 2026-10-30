import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const load = (path) => readFileSync(resolve(root, path), 'utf8');
const css = load('src/styles/reconstruction-canon-v866-frames-header-v878.css');
const header = load('src/components/GlobalHeader.tsx');
const shell = load('src/components/ui/GameShell.tsx');
const card = load('src/components/ui/Card.tsx');
const app = load('src/pages/_app.tsx');
const profile = load('src/features/profile/WebProfilePage.tsx');

test('frozen v866 HTML remains external, pinned by source SHA', () => {
  assert.match(css, /9b6371f5fb62939596b78206f95031c447e9f2b375e62b30704403bb25102aef/);
  assert.doesNotMatch(css, /@import\s+url\(/);
  assert.doesNotMatch(css, /https?:\/\//);
});
test('canonical Header family, name size/weight and statuses are defined', () => {
  for (const marker of ['Inter,ui-sans-serif,system-ui','font-size:.875rem','font-weight:800','font-size:.64rem','font-size:.59rem','font-size:max(.75rem,12px)']) {
    assert.ok(css.includes(marker), marker);
  }
  assert.match(header, /className="profile-name"/);
  assert.doesNotMatch(header, /profile-name truncate text-sm font-bold/);
});
test('header user actions return to four without hiding admin preview', () => {
  assert.match(header, /const showAdminEntry = props\.isAdmin;/);
  assert.match(header, /data-action-count=\{showAdminEntry \? "5" : "4"\}/);
  assert.match(profile, /data-admin-demo-entry="true"/);
  assert.match(profile, /data-telegram-connect-demo-entry="true"/);
});
test('shared real React templates retain their preexisting classes and add canon markers', () => {
  for(const id of ['source-game-hero','source-stats','source-stat','source-card','source-notice']) {
    assert.ok(shell.includes(`data-canon-frame="${id}"`), id);
  }
  assert.match(shell, /data-canon-template="v866"/);
  assert.match(shell, /className=\{`efhc-game-hero /);
  assert.match(card, /data-canon-frame="source-card"/);
});
test('shared canon stylesheet loads after legacy CSS; no admin scope', () => {
  assert.ok(app.indexOf('reconstruction-canon-v866-frames-header-v878.css') > app.indexOf('reconstruction-dialog-navigation-v877.css'));
  assert.doesNotMatch(css, /data-interface-app-mode="admin"/);
  assert.ok(css.includes('data-interface-app-mode="user"'));
});
test('frame geometry matches frozen source CSS and panel third stat spans both columns', () => {
  for(const marker of ['gap:.72rem','border-radius:1rem','padding:.85rem','font-size:1.3rem','font-size:.65rem','padding:.55rem','border-radius:.75rem','gap:.48rem','grid-column:1/-1']) {
    assert.ok(css.includes(marker), marker);
  }
});
test('theme ownership is retained: no CT selectors or global forced colors', () => {
  assert.doesNotMatch(css, /\[data-color-theme-id\s*=/);
  assert.doesNotMatch(css, /\[data-global-theme-id\s*=/);
  assert.doesNotMatch(css, /!important/);
  assert.match(css, /--efhc-route-border/);
});
