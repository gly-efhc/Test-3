import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('v908: Pages build allows SDK restoration and real user-initiated wallet transport', () => {
  const wallet=source('src/lib/wallet-provider/adapters/TonConnectAdapter.ts');
  const layout=source('src/components/Layout.tsx');
  assert.doesNotMatch(wallet,/if\s*\(process\.env\.NEXT_PUBLIC_EFHC_PAGES_PREVIEW/);
  assert.doesNotMatch(layout,/__EFHC_TONCONNECT_USER_ACTIVATED_UNTIL__/);
  assert.match(wallet,/bindVerifiedTonConnectWallet/);
  assert.match(wallet,/sendTonConnectTransaction\(requireUi\(\), tx\)/);
  assert.match(layout,/if \(hasBoundWallet\)/);
  assert.match(layout,/wallet\.restore_requires_proof/);
  const app=source('src/pages/_app.tsx');
  const transport=source('src/lib/tonconnect.ts');
  assert.match(app,/NEXT_PUBLIC_EFHC_PAGES_PREVIEW !== "1"/);
  assert.match(transport,/NEXT_PUBLIC_EFHC_PAGES_PREVIEW !== "1"/);
});

test('v908: business operations use explicit TEST backend or isolated DEMO and never fall through to production',()=>{
  const api=source('src/lib/api.ts');
  const neon=source('src/reconstruction/neonStagingBridge.ts');
  assert.match(api,/isNeonStagingRequested\(\)/);
  assert.match(api,/neonStagingApiRequest/);
  assert.match(api,/PUBLIC_DEMO_NOT_BOOTSTRAPPED/);
  assert.match(neon,/NEON_TEST_ORIGIN_MUST_BE_HTTPS_ORIGIN/);
  assert.match(neon,/credentials:'include'/);
  assert.match(neon,/X-EFHC-Test-CSRF/);
});
