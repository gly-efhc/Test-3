// Guard marker: Panel activation needs at least 100 EFHCm.
import React, { useContext, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { publicApiErrorMessage } from "../lib/publicError";
import {
  usePanelActivation,
  usePanelsSummary,
} from "../queries/usePanels";
import { newIdempotencyKey } from "../lib/idempotency";
import { useAuthOwnerGlobalId } from "../auth/AuthSessionProvider";
import { useT } from "../hooks/useT";
import type { SyncSnapshot } from "../hooks/useSnapshot";
import { LayoutContext } from "../components/Layout";
import {
  GameHero,
  GameNotice,
  GamePageShell,
  GameStat,
  GameStatsGrid,
} from "../components/ui/GameShell";
import { cmp8, format8, sumScaledDown } from "../lib/format";
import {
  hapticTap,
  telegramMainButtonOnClick,
  telegramMainButtonSet,
} from "../lib/telegram";
import { useInterfaceCustomization } from
  "../hooks/useInterfaceCustomization";
import { useInterfaceVariantSurface } from
  "../hooks/useInterfaceVariantSurface";
import { useFrozenDemoTables } from "../reconstruction/useFrozenDemoTables";

const PANELS_ROUTE_STATIC_GUARD = {
  active: "/panels/active",
  archive: "/panels/archive",
  activate: "/panels/activate",
  portfolio: "/panels/portfolio",
} as const;

export default function PanelsPage(props: {
  snap: SyncSnapshot | null;
}) {
  const t = useT();
  const router = useRouter();
  const globalId = useAuthOwnerGlobalId();
  const demoPreview = useFrozenDemoTables() && !globalId;
  const customization = useInterfaceCustomization();
  const heroSurface = useInterfaceVariantSurface<HTMLElement>("PH");
  const activationSurface = useInterfaceVariantSurface<HTMLDivElement>("PA");
  const { confirm, toast, settings } = useContext(LayoutContext);
  const summaryQuery = usePanelsSummary();
  const activationMutation = usePanelActivation();

  const summary = summaryQuery.data || props.snap?.panels;
  const profile = props.snap?.profile;
  const meta = props.snap?.meta;
  const mainBalance = profile?.main_balance ?? "0";
  const bonusBalance = profile?.bonus_balance ?? "0";
  const totalActivationBalance = sumScaledDown(
    mainBalance,
    bonusBalance,
    8,
  );

  const activePanels = summary?.active_count ?? null;
  const genPerSecEffective = meta?.gen_per_sec_effective ?? null;
  const activeGenerationRate = profile
    ? profile.is_vip
      ? profile.gen_per_sec_vip
      : profile.gen_per_sec_base
    : null;
  const generationTier = profile?.is_vip ? "VIP" : "BASE";
  const activating = activationMutation.isPending;

  const canActivatePanel = useMemo(() => {
    return cmp8(totalActivationBalance, "100") >= 0;
  }, [totalActivationBalance]);

  const activatePanel = async () => {
    if (customization.mutationBlocked) return;
    if (activating || !canActivatePanel || (!globalId && !demoPreview)) return;
    const ok = await confirm(
      "purchase",
      t("panels.activate_panel"),
      t("panels.subtitle_price_100"),
    );
    if (!ok) return;
    // A public Pages preview must never create a panel, debit a balance, or
    // claim successful activation. The real mutation remains owner-authorized.
    if (demoPreview) {
      toast("DEMO: подтверждение показано; баланс и панели не изменены.", "info");
      return;
    }
    const idk = newIdempotencyKey();
    try {
      await activationMutation.mutateAsync(idk);
      toast(t("panels.activate_ok"), "success");
    } catch (error) {
      const message = publicApiErrorMessage(
        error,
        t,
        "panels.activate_failed",
      );
      toast(message, "error");
    }
  };

  const activatePanelRef = useRef(activatePanel);

  useEffect(() => {
    activatePanelRef.current = activatePanel;
  }, [activatePanel]);

  useEffect(() => {
    if (!globalId || customization.mutationBlocked) {
      telegramMainButtonSet({ text: "", show: false });
      return () => undefined;
    }

    telegramMainButtonSet({
      text: t("panels.activate_panel"),
      enabled: !activating && canActivatePanel,
      show: true,
    });

    const onClick = async () => {
      hapticTap(settings.haptics_enabled);
      await activatePanelRef.current();
    };
    const off = telegramMainButtonOnClick(onClick);

    return () => {
      off();
      telegramMainButtonSet({ text: "", show: false });
    };
  }, [
    t,
    settings.haptics_enabled,
    activating,
    canActivatePanel,
    customization.mutationBlocked,
  ]);

  return (
    <GamePageShell
      className="efhc-panels-shell"
      data-panels-canon-scope="main-v866"
      data-panels-layout="activation-with-portfolio-entry"
      data-panels-route-active={PANELS_ROUTE_STATIC_GUARD.active}
      data-panels-route-archive={PANELS_ROUTE_STATIC_GUARD.archive}
      data-panels-route-activate={PANELS_ROUTE_STATIC_GUARD.activate}
      data-panels-route-portfolio={PANELS_ROUTE_STATIC_GUARD.portfolio}
    >
      <GameHero
        ref={heroSurface.ref}
        {...heroSurface.handlers}
        className="efhc-panels-hero"
        data-panels-hero-source="panelsHero"
        data-ph={heroSurface.variant}
        kicker={t("panels.game_kicker")}
        title={t("panels.title")}
        right={
          profile ? (
            <span
              className="efhc-panels-generation-tier"
              data-tier={profile.is_vip ? "vip" : "base"}
              aria-label={generationTier}
            >
              <span
                className="efhc-panels-generation-tier_dot"
                aria-hidden="true"
              />
              {generationTier}
            </span>
          ) : null
        }
      >
        <GameStatsGrid>
          <GameStat
            label={t("panels.active_count")}
            value={activePanels ?? "—"}
          />
          <GameStat
            label={t("panels.effective_rate")}
            value={
              genPerSecEffective === null
                ? "—"
                : `${format8(genPerSecEffective)} kWh/с`
            }
          />
          <GameStat
            label={t("panels.active_generation")}
            value={
              activeGenerationRate === null
                ? "—"
                : `${format8(activeGenerationRate)} kWh/с`
            }
          />
        </GameStatsGrid>
      </GameHero>

      <Card
        ref={activationSurface.ref}
        {...activationSurface.handlers}
        title={t("panels.activate_panel")}
        className="efhc-panels-activation-card"
        data-panels-activation-source="panels-activation-card"
        data-pa={activationSurface.variant}
        data-panels-mvp-activation="cycle-1556"
      >
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs efhc-text-muted2">
                {t("panels.activation_price_100")}
              </div>
              <div className="font-semibold tabular-nums">100 EFHC</div>
            </div>
            <div>
              <div className="text-xs efhc-text-muted2">
                {t("panels.interactive_total_balance")}
              </div>
              <div className="font-semibold tabular-nums">
                {format8(totalActivationBalance)} EFHC
              </div>
            </div>
          </div>
          <div className="text-sm efhc-text-muted">
            {t("panels.activation_debit_order")}
          </div>
          {!canActivatePanel ? (
            <GameNotice
              title={t("panels.interactive_not_ready")}
              detail={t("panels.needs_100_efhc_total")}
            />
          ) : null}
          <Button
            onClick={activatePanel}
            disabled={activating || !canActivatePanel}
            className="efhc-panels-activate efhc-theme03-cta"
            data-panels-demo-preview={demoPreview ? "read-only" : undefined}
            data-panel-activation-cta="100-efhc"
            data-panel-activation-debit="bonus-first-main-second"
            aria-label={t("panels.buy_panel")}
          >
            {activating ? t("common.loading") : t("panels.buy_panel")}
          </Button>
        </div>
      </Card>

      <Button
        type="button"
        className="w-full efhc-panels-portfolio-entry"
        variant="secondary"
        data-panels-portfolio-entrypoint="canonical"
        onClick={() => void router.push(PANELS_ROUTE_STATIC_GUARD.portfolio)}
      >
        {t("panels.my_panels")}
      </Button>
    </GamePageShell>
  );
}
