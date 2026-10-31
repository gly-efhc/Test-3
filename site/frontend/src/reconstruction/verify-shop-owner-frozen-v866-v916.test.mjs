import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, "../../public");
test("SHOP_v866 physical HTML is included verbatim as a frozen, separate page", () => {
  const contents = readFileSync(resolve(root, "SHOP_v866.html"));
  assert.equal(createHash("sha256").update(contents).digest("hex"), "1c9f0916f562c0d3c407670741fc8f555d43cc26684c2472d242175d60722b46");
  assert.match(contents.toString("utf8").slice(0,128), /SHOP RELEASE SHOP_v866/);
});
