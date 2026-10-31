import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const source = readFileSync(resolve(import.meta.dirname, "../features/browser-shop/BrowserShopPage.tsx"), "utf8");

test("package and VIP price DOM must not duplicate the payment method label", () => {
  const rows = [...source.matchAll(/<span className="efhc-shop-product-price"><small>\{methodLabel\(globalMethod\)\}<\/small><b>\{([^}]+)\}/g)];
  assert.equal(rows.length, 3, "package list and two VIP modes");
  for (const row of rows) {
    assert.doesNotMatch(row[1], /\bpriceLabel\(/);
    assert.match(row[1], /priceAmountOnly\(/);
  }
  assert.match(source, /function priceAmountOnly\(/);
  assert.match(source, /function checkoutPriceLabel\(/);
});
