import React from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { useT } from "../hooks/useT";
import { useInterfaceVariantSurface } from "../hooks/useInterfaceVariantSurface";

export default function NotFoundPage() {
  const t = useT();
  const errorSurface = useInterfaceVariantSurface<HTMLElement>("ER", {
    dotsPlacement: "below",
  });
  return (
    <main
      ref={errorSurface.ref}
      {...errorSurface.handlers}
      className="min-h-screen p-4 flex items-center justify-center efhc-error-page"
      data-er={errorSurface.variant}
      data-public-surface="not-found"
    >
      <div className="max-w-md w-full">
        <EmptyState
          title={t("common.route_not_found_title")}
          detail={t("common.route_not_found_detail")}
          actionLabel={t("common.go_home")}
          onAction={() => window.location.assign("/")}
        />
        <p className="mt-3 text-sm efhc-text-muted2">
          {t("error.system_theme_note")}
        </p>
      </div>
    </main>
  );
}
