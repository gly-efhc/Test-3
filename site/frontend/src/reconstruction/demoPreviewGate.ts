/** Pure preview routing gates: no fixtures, stores or API handlers in the shared shell. */
/** Explicit and independent of authentication; production builds can never turn this on through UI or storage. */
export function isDemoPreviewEnabled():boolean {
  return typeof window !== "undefined"
    && process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1"
    && process.env.NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF === "1"
    && (window as Window & { __EFHC_DEMO_READ_ONLY__?:boolean }).__EFHC_DEMO_READ_ONLY__ === true;
}
/** A configured real TEST backend must never be shadowed by local simulation. */
export function isLocalDemoActive():boolean {
 return isDemoPreviewEnabled() && process.env.NEXT_PUBLIC_EFHC_TEST_MODE !== 'neon';
}

/** Only the real published Pages origin uses the SQL-backed C27 dataset.
 * Offline parity harness and production retain the original simulator contracts.
 * On this origin an unavailable Neon API fails closed without frozen-data fallback.
 */
export function isNeonPagesDemo():boolean {
 return isDemoPreviewEnabled()&&window.location.origin==="https://gly-efhc.github.io";
}
