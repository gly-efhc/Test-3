import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const root = process.cwd();
const manifestPath = resolve(root, "release-assets-manifest.json");
const faqLanguages = [
  "ru", "en", "uk", "de", "fr", "es", "it",
  "tr", "pl", "da", "hi", "id", "sw", "pt", "ko", "ja",
];
const localeLanguages = [...faqLanguages];

function fail(message) {
  console.error(`EFHC RELEASE ASSETS VERIFY: FAIL; ${message}`);
  process.exit(1);
}

function checksum(path) {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

if (!existsSync(manifestPath)) {
  fail("release-assets-manifest.json is missing");
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`invalid release asset manifest: ${error}`);
}
if (manifest.schema !== "EFHC_FRONTEND_RELEASE_ASSETS_V1") {
  fail("unsupported release asset manifest schema");
}
if (!manifest.files || typeof manifest.files !== "object") {
  fail("manifest files map is missing");
}
if (manifest.asset_state !== "CHECKED_IN_BEFORE_RELEASE_PACKAGING") {
  fail("frontend assets are not marked checked-in");
}
if (manifest.packaging_mutates_runtime_assets !== false) {
  fail("release packaging must not mutate runtime assets");
}
if (
  !Array.isArray(manifest.packaging_generation_dependencies) ||
  manifest.packaging_generation_dependencies.length !== 0
) {
  fail("release packaging generation dependency forbidden");
}
if (manifest.ssot_role !== "DUPLICATE_CONTROL_ONLY_NO_RUNTIME_WRITE") {
  fail("FAQ SSOT must be duplicate control only");
}
if (manifest.packaging_source !== "checked-in production frontend assets") {
  fail("release packaging source must be checked-in assets");
}

for (const [relativePath, expected] of Object.entries(manifest.files)) {
  const absolutePath = resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(root + sep)) {
    fail(`unsafe asset path: ${relativePath}`);
  }
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    fail(`missing packaged asset: ${relativePath}`);
  }
  const expectedHash = Array.isArray(expected)
    ? expected.join("")
    : expected;
  const actual = checksum(absolutePath);
  if (actual !== expectedHash) {
    fail(`checksum mismatch: ${relativePath}`);
  }
  if (relativePath.endsWith(".json")) {
    try {
      JSON.parse(readFileSync(absolutePath, "utf8"));
    } catch (error) {
      fail(`invalid JSON asset ${relativePath}: ${error}`);
    }
  }
}

for (const language of faqLanguages) {
  const faq = `public/faq/${language}.json`;
  if (!Object.hasOwn(manifest.files, faq)) fail(`missing ${faq}`);
}
for (const language of localeLanguages) {
  const locale = `public/locale/${language}.json`;
  if (!Object.hasOwn(manifest.files, locale)) fail(`missing ${locale}`);
}
for (const path of [
  "src/data/faq/catalogs.ts",
  "public/pwa-build.json",
  ".efhc-build-id",
]) {
  if (!Object.hasOwn(manifest.files, path)) fail(`missing ${path}`);
}

const pwa = JSON.parse(
  readFileSync(resolve(root, "public/pwa-build.json"), "utf8"),
);
if (pwa.schema !== "EFHC_PWA_BUILD_V2") {
  fail("invalid PWA build schema");
}
for (const language of faqLanguages) {
  const faqPath = resolve(root, "public", "faq", `${language}.json`);
  if (pwa.faq_checksums?.[language] !== checksum(faqPath)) {
    fail(`PWA FAQ checksum mismatch: ${language}`);
  }
}
for (const language of localeLanguages) {
  const localePath = resolve(root, "public", "locale", `${language}.json`);
  if (pwa.locale_checksums?.[language] !== checksum(localePath)) {
    fail(`PWA locale checksum mismatch: ${language}`);
  }
}

console.log(
  `EFHC RELEASE ASSETS VERIFY: PASS; files=${Object.keys(manifest.files).length}`,
);
