import { useEffect, useState } from "react";

/** Public Pages-only preview, never an authenticated session or live API. */
export function useFrozenDemoTables(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const runtime = window as Window & { __EFHC_DEMO_READ_ONLY__?: boolean };
    setEnabled(
      process.env.NEXT_PUBLIC_EFHC_E2E_TONCONNECT_MOCK === "1" &&
      process.env.NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF === "1" &&
      runtime.__EFHC_DEMO_READ_ONLY__ === true,
    );
  }, []);
  return enabled;
}
