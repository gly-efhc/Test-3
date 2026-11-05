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
