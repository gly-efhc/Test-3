import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
const frontend = process.cwd();
const read = (p) => fs.readFileSync(path.join(frontend, p), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const compat = read("src/lib/vendor/tonconnect-ui-react-compat.tsx");
const routing = read("src/lib/wallet-provider/primaryWalletRouting.ts");
const adapter = read("src/lib/wallet-provider/adapters/TonConnectAdapter.ts");
const chooser = read("src/components/wallet/TonConnectWalletChooser.tsx");
test("public Pages: SDK exact pin and package lock consistent", () => {
  const version = pkg.dependencies["@tonconnect/sdk"];
  assert.equal(version, "5.0.0");
  assert.equal(lock.packages["node_modules/@tonconnect/sdk"].version, version);
  assert.equal(lock.packages[""].dependencies["@tonconnect/sdk"], version);
});
test("public Pages: genuine TON Connect adapter and chooser are present", () => {
  assert.match(compat, /import\("@tonconnect\/sdk"\)/);
  assert.match(compat, /analytics:\s*\{\s*mode:\s*"off"\s*\}/);
  assert.match(compat, /restoreConnection\(/);
  assert.match(compat, /getWallets\(/);
  assert.match(adapter, /fetchTonConnectWallets\(ui\)/);
  assert.match(adapter, /ui\.connectWallet\(wallet\.walletKey\)/);
  assert.match(chooser, /wallet/i);
  assert.match(routing, /wallet/i);
});
