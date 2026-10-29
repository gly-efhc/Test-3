import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

import { SafeErrorState } from
  "../components/ui/SafeErrorState";
import { useT } from "../hooks/useT";
import { useInterfaceVariantSurface } from "../hooks/useInterfaceVariantSurface";

type ErrorClass = 401 | 403 | 413 | 429 | 500;

type SafeErrorProofWindow = Window & {
  __EFHC_SAFE_ERROR_STATUS__?: number;
};

function safeStatus(
  value: string | string[] | number | undefined,
): ErrorClass {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw || 500);
  if ([401, 403, 413, 429, 500].includes(parsed)) {
    return parsed as ErrorClass;
  }
  return 500;
}

export default function ServerFallbackPage() {
  const router = useRouter();
  const t = useT();
  const [status, setStatus] = useState<ErrorClass>(500);
  const errorSurface = useInterfaceVariantSurface<HTMLElement>("ER", {
    dotsPlacement: "below",
  });

  useEffect(() => {
    const proofStatus = (
      window as SafeErrorProofWindow
    ).__EFHC_SAFE_ERROR_STATUS__;
    setStatus(safeStatus(proofStatus || router.query.status));
  }, [router.query.status]);

  return (
    <main
      ref={errorSurface.ref}
      {...errorSurface.handlers}
      className="min-h-screen p-4 flex items-center justify-center efhc-error-page"
      data-public-surface="safe-error"
      data-er={errorSurface.variant}
    >
      <div className="max-w-md w-full">
        <p className="sr-only">
          {t("common.safe_recoverable_screen_detail")}
        </p>
        <SafeErrorState
          status={status}
          onRetry={() => window.location.reload()}
        />
      </div>
    </main>
  );
}
