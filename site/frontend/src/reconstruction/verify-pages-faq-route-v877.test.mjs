import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const yaml = readFileSync(new URL("../../../ci/efhc-pages.yml", import.meta.url), "utf8");
const line = yaml.split("\n").find((x) => x.includes("PATTERN = re.compile"));
assert.ok(line, "Pages asset rewrite pattern must exist");
const source = line.match(/PATTERN = re\.compile\(r'(.+)'\)/)?.[1];
assert.ok(source, "Pages asset rewrite must be a parseable Python raw regex");
const pattern = new RegExp(source, "g");
const rewrite = (value) => value.replace(pattern, (_match, prefix, item) => `${prefix}/Test-3/${item}`);
test("Pages asset rewrite preserves the real FAQ route and Next client-side navigation", () => {
  for (const route of ['href="/faq"','router.push("/faq")',"'/faq'",'href="/faq/"']) {
    assert.equal(rewrite(route), route, route);
  }
  assert.equal(rewrite('href="/Test-3/faq/"'), 'href="/Test-3/faq/"');
});
test("Pages rewrite still prefixes static translations and public image assets", () => {
  assert.equal(rewrite('fetch("/faq/ru.json")'), 'fetch("/Test-3/faq/ru.json")');
  assert.equal(rewrite('src="/assets/efhc/logo.svg"'), 'src="/Test-3/assets/efhc/logo.svg"');
});
