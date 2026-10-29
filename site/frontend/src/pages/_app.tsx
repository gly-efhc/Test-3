import { BackgroundMusicController } from "../components/BackgroundMusicController";
import "../polyfills";
import { publicRuntimeValue } from "../lib/public-runtime";
import type { AppProps, NextWebVitalsMetric } from "next/app";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import "../styles/globals.css";
import "../styles/generated/theme03-chroma-tokens.css";
import "../styles/theme03-shell-chroma.css";
import "../styles/theme03-panels-exchange-chroma.css";
import "../styles/theme03-tasks-referrals-chroma.css";
import "../styles/theme03-ranks-profile-chroma.css";
import "../styles/theme03-energy-chroma.css";
import "../styles/theme03-faq-chroma.css";
import "../styles/theme03-balance-history-chroma.css";
import "../styles/theme03-browser-shop-chroma.css";
import "../styles/generated/global-theme-projections.css";
import "../styles/theme01-bounded-chroma-corrections.css";
import "../styles/theme02-bounded-chroma-corrections.css";
import "../styles/theme04-bounded-chroma-corrections.css";
import "../styles/global-theme-page-kicker-contract.css";
import "../styles/global-theme-ranks-action-shadow-contract.css";
import "../styles/theme03-ranks-shared-action-correction.css";
import "../styles/referrals-social-brand-contract.css";
import "../styles/universal-frame-material-contract.css";
import "../styles/panels-ph12-chroma-contract.css";
import "../styles/global-theme-owner-coverage.css";
import "../styles/global-theme-energy-progress-contract.css";
import "../styles/global-theme-owner-0544.css";
import "../styles/generated/admin-theme03-canon-tokens.css";
import "../styles/admin-theme03-canon.css";
import "../styles/owner-0549-faq-balance-ct.css";
import "../styles/owner-0550-faq-withdraw-ct.css";
import "../styles/owner-0551-user-polish.css";
import "../styles/owner-0553-profile-ct.css";
import "../styles/owner-0556-profile-settings-avatar.css";
import "../styles/owner-0557-avatar-ring.css";
import "../styles/hub-demo-react-parity.css";
import React, {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  AuthSessionProvider,
  useAuthOwnerGlobalId,
  useAuthSessionController,
} from "../auth/AuthSessionProvider";
import {
  getEmbeddedDict,
  loadDict,
  tFromDicts,
  type Dict,
  type Lang,
} from "../lib/i18n";
import {
  applyTelegramCssVars,
  getTelegramColorScheme,
  getTelegramUser,
  onTelegramThemeChanged,
  onTelegramViewportChanged,
  setTelegramChromeColors,
  tgReady,
} from "../lib/telegram";
import { Layout } from "../components/Layout";
import { getBrowserFallbackSnapshot } from "../lib/browserFallback";
import { ShopLayout } from "../components/ShopLayout";
import { SplashScreen } from "../components/SplashScreen";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useSnapshot } from "../hooks/useSnapshot";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  loadSettingsAsync,
  saveSettingsAsync,
  type UserSettings,
} from "../lib/settings";
import { fetchAdminAccess } from "../lib/admin";
import { createEfhcQueryClient } from "../lib/queryClient";
import {
  getSkinKey,
  getUserLevel,
  getUserSkin,
} from "../lib/skins";
import { WalletProvider } from "../lib/wallet-provider";
import { emitRuntimeProgress } from "../lib/runtimeProgress";
import { recordWebVital } from "../services/webVitals.service";
import {
  recordImageFormatSupport,
} from "../services/imageFormatSupport.service";
import { OnboardingTour } from "../components/OnboardingTour";
import {
  buildTonConnectManifestUrl,
  type HttpsUrl,
} from "../services/appShell.service";
import { useAppBackNavigation } from "../lib/appBackNavigation";
import { InterfaceCustomizationProvider } from
  "../components/interface-settings/InterfaceCustomizationProvider";

// Keep service-worker UI behavior but load its rarely visible status logic
// outside the shared _app JavaScript chunk; the component initially renders
// nothing and retains the same props, hooks and update policy.
const PwaRuntimeStatus = dynamic(
  () => import("../components/PwaRuntimeStatus").then(
    (module) => module.PwaRuntimeStatus,
  ),
  { ssr: false },
);

const SkinBackgroundController = dynamic(
  () => import("../components/SkinBackgroundController").then(
    (module) => module.SkinBackgroundController,
  ),
  { ssr: false },
);

const AdminVisualProofRouter = dynamic(
  () => import("../proof/AdminVisualProofRouter").then(
    (module) => module.AdminVisualProofRouter,
  ),
  { ssr: false },
);

const SHELL_BOOT_TIMEOUT_MS = 1800;
const SPLASH_FADE_MS = 120;
const SPLASH_UNMOUNT_MS = 420;

function browserSupportsServiceWorker(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  );
}


export function reportWebVitals(metric: NextWebVitalsMetric): void {
  recordWebVital(metric);
}

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => createEfhcQueryClient());

  const [tcManifestUrl, setTcManifestUrl] = useState<HttpsUrl>(() => {
    if (typeof window === "undefined") {
      return "https://placeholder.invalid/manifest.json";
    }
    return buildTonConnectManifestUrl(window.location.origin);
  });
  const [tcReturnUrl, setTcReturnUrl] = useState<HttpsUrl>(
    "https://t.me/efhc_bot/app",
  );
  const [tgScheme, setTgScheme] = useState<"light" | "dark">("dark");

  const [settings, setSettings] = useState<UserSettings>(
    DEFAULT_SETTINGS,
  );
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [uiDictLoaded, setUiDictLoaded] = useState(false);
  const [ruDictLoaded, setRuDictLoaded] = useState(false);
  const [descDictLoaded, setDescDictLoaded] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [uiDict, setUiDict] = useState<Dict>(() =>
    getEmbeddedDict("en"),
  );
  const [ruDict, setRuDict] = useState<Dict>(() =>
    getEmbeddedDict("ru"),
  );
  const [descDict, setDescDict] = useState<Dict>(() =>
    getEmbeddedDict("en"),
  );

  const [telegramProviderId, setTelegramProviderId] = useState<number | null>(null);
  const [telegramName, setTelegramName] = useState<string>("");
  const [telegramAvatarUrl, setTelegramAvatarUrl] = useState<
    string | null
  >(null);

  const applyTheme = (mode: UserSettings["theme_mode"]) => {
    if (typeof document === "undefined") return;
    const tg = getTelegramColorScheme() || "dark";
    const eff = mode === "auto" ? tg : mode;
    document.documentElement.dataset.theme = eff;
    // Keep Telegram chrome aligned with Telegram tokens (best effort).
    // Telegram API accepts either theme keywords (e.g. "bg_color")
    // or a color string. Prefer computed token values if present.
    if (typeof window !== "undefined") {
      const styles = getComputedStyle(document.documentElement);
      const bg = styles.getPropertyValue("--tg-bg").trim();
      const sec = styles.getPropertyValue("--tg-secondary-bg").trim();
      const bgColor = bg || "bg_color";
      const secColor = sec || bg || "bg_color";
      setTelegramChromeColors(bgColor, secColor);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const runtimeWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (runtimeWindow.requestIdleCallback) {
      const id = runtimeWindow.requestIdleCallback(() => {
        void recordImageFormatSupport();
      });
      return () => runtimeWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => {
      void recordImageFormatSupport();
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setTcManifestUrl(buildTonConnectManifestUrl(window.location.origin));
    } catch {
      // keep fallback
    }
    try {
      const twa = publicRuntimeValue("NEXT_PUBLIC_TWA_RETURN_URL")?.trim();
      if (twa) {
        setTcReturnUrl(twa as `${string}://${string}`);
      }
    } catch {
      // keep fallback
    }
    tgReady();
    applyTelegramCssVars();
    const u = getTelegramUser();
    setTelegramProviderId(u?.id ?? null);
    setTelegramName(u?.username || u?.first_name || "");
    setTelegramAvatarUrl((u as any)?.photo_url || null);

    const s = loadSettings();
    const currentScheme = getTelegramColorScheme() || "dark";
    setTgScheme(currentScheme);
    setSettings(s);
    setLang(s.lang);
    loadSettingsAsync()
      .then((next) => {
        setSettings(next);
        setLang(next.lang);
        applyTheme(next.theme_mode);
      })
      .catch(() => undefined)
      .finally(() => setSettingsHydrated(true));

    // Apply theme immediately and then subscribe
    // to Telegram theme changes.
    applyTheme(s.theme_mode);
    const off = onTelegramThemeChanged(() => {
      // Use latest persisted settings to avoid stale closure.
      const latest = loadSettings();
      const nextScheme = getTelegramColorScheme() || "dark";
      setTgScheme(nextScheme);
      applyTelegramCssVars();
      applyTheme(latest.theme_mode);
    });

    const offVp = onTelegramViewportChanged(() => {
      applyTelegramCssVars();
    });

    return () => {
      off();
      offVp();
    };
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    // Persist settings only after stored settings were loaded.
    void saveSettingsAsync(settings);
    setLang(settings.lang);
    applyTheme(settings.theme_mode);
  }, [settings, settingsHydrated]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = "ltr";
    document.documentElement.dataset.efhcLocale = lang;
  }, [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (settings.reduce_motion) {
      document.documentElement.dataset.reduceMotion = "1";
      return;
    }
    delete (document.documentElement.dataset as any).reduceMotion;
  }, [settings.reduce_motion]);

  useEffect(() => {
    let active = true;
    setRuDictLoaded(false);
    loadDict("ru")
      .then((dict) => {
        if (!active) return;
        setRuDict(dict);
      })
      .catch(() => {
        if (!active) return;
        setRuDict(getEmbeddedDict("ru"));
      })
      .finally(() => {
        if (active) setRuDictLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setUiDictLoaded(false);
    setDescDictLoaded(false);
    loadDict(lang)
      .then((dict) => {
        if (!active) return;
        setUiDict(dict);
        setDescDict(dict);
      })
      .catch(() => {
        if (!active) return;
        const fallback = getEmbeddedDict(lang);
        setUiDict(fallback);
        setDescDict(fallback);
      })
      .finally(() => {
        if (!active) return;
        setUiDictLoaded(true);
        setDescDictLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [lang]);

  return (
    <>
      <Head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="black" />
        <meta name="application-name" content="EFHC Bot" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="EFHC Bot" />
      </Head>
      <WalletProvider
        manifestUrl={tcManifestUrl}
        returnUrl={tcReturnUrl}
        restoreConnection={
          process.env.NEXT_PUBLIC_EFHC_E2E_DISABLE_TONCONNECT_RESTORE
            === "1"
            ? false
            : undefined
        }
        language={lang}
        themeMode={settings.theme_mode}
        telegramScheme={tgScheme}
      >
        <QueryClientProvider client={queryClient}>
          <AuthSessionProvider>
            <InterfaceCustomizationProvider
              settings={settings}
              setSettings={setSettings}
            >
              <AppInner
                Component={Component}
                pageProps={pageProps}
                lang={lang}
                uiDict={uiDict}
                ruDict={ruDict}
                descDict={descDict}
                telegramProviderId={telegramProviderId}
                telegramName={telegramName}
                telegramAvatarUrl={telegramAvatarUrl}
                settings={settings}
                setSettings={setSettings}
                tgScheme={tgScheme}
                uiDictLoaded={uiDictLoaded}
                ruDictLoaded={ruDictLoaded}
                descDictLoaded={descDictLoaded}
              />
            </InterfaceCustomizationProvider>
          </AuthSessionProvider>
        </QueryClientProvider>
      </WalletProvider>
    </>
  );
}

function AppInner(props: {
  Component: AppProps["Component"];
  pageProps: AppProps["pageProps"];
  lang: Lang;
  uiDict: Dict;
  ruDict: Dict;
  descDict: Dict;
  telegramProviderId: number | null;
  telegramName: string;
  telegramAvatarUrl: string | null;
  settings: UserSettings;
  setSettings: Dispatch<SetStateAction<UserSettings>>;
  tgScheme: "light" | "dark";
  uiDictLoaded: boolean;
  ruDictLoaded: boolean;
  descDictLoaded: boolean;
}) {
  const {
    Component,
    pageProps,
    lang,
    uiDict,
    ruDict,
    descDict,
    telegramProviderId,
    telegramName,
    telegramAvatarUrl,
    settings,
    setSettings,
    tgScheme,
    uiDictLoaded,
    ruDictLoaded,
    descDictLoaded,
  } = props;

  const router = useRouter();
  useAppBackNavigation(router);
  const isBrowserShop = router.pathname === "/browser-shop" || router.pathname.startsWith("/browser-shop/");
  const [adminVisualProofPath, setAdminVisualProofPath] = useState<
    string | null
  >(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const candidate = (window as typeof window & {
      __EFHC_ADMIN_PROOF_PATH__?: string;
    }).__EFHC_ADMIN_PROOF_PATH__;
    if (!candidate?.startsWith("/admin")) return;

    const hostname = window.location.hostname;
    const localAutomationProof = Boolean(
      window.navigator.webdriver
      && ["127.0.0.1", "localhost", "::1"].includes(hostname),
    );
    const configuredProof =
      process.env.NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF === "1";
    if (configuredProof || localAutomationProof) {
      setAdminVisualProofPath(candidate);
    }
  }, []);

  // Snapshot is cached via React Query.
  const {
    snap,
    status: snapshotStatus,
    loading: snapshotLoading,
    refreshing: snapshotRefreshing,
    refresh: refreshSnapshot,
  } = useSnapshot();
  const authSession = useAuthSessionController();
  const globalId = useAuthOwnerGlobalId();
  const [adminAccessState, setAdminAccessState] = useState<
    "checking" | "allowed" | "denied"
  >("checking");

  useEffect(() => {
    let active = true;
    if (authSession.status !== "authenticated" || globalId === null) {
      setAdminAccessState(
        authSession.status === "restoring"
          || authSession.status === "authenticating"
          ? "checking"
          : "denied",
      );
      return () => { active = false; };
    }
    setAdminAccessState("checking");
    void fetchAdminAccess()
      .then((access) => {
        if (!active) return;
        setAdminAccessState(access ? "allowed" : "denied");
      })
      .catch(() => {
        if (!active) return;
        setAdminAccessState("denied");
      });
    return () => { active = false; };
  }, [authSession.status, globalId]);

  const visibleSnap = snap ?? getBrowserFallbackSnapshot();
  const snapshotMode = globalId === null ? "browser-preview" : "live";
  const visibleSnapshotStatus = globalId === null
    ? "success"
    : snapshotStatus;

  const isVip = Boolean(visibleSnap.profile.is_vip);
  // Admin access is server-authoritative via /admin/access.
  // Telegram provider subject is not an admin/business owner credential.
  const isAdmin = adminAccessState === "allowed";

  const [shopSkinBgUrl, setShopSkinBgUrl] = useState<
    string | null
  >(null);
  const handleSetLang = useCallback((next: Lang) => {
    setSettings((current) => ({
      ...current,
      lang: next,
    }));
  }, [setSettings]);

  const [showSplash, setShowSplash] = useState(true);
  const [splashMounted, setSplashMounted] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [shellTimeoutReady, setShellTimeoutReady] = useState(false);

  const splashReady = useMemo(() => {
    // Browser/PWA must never stay blank because Telegram data
    // or locale files are temporarily unavailable.  Missing
    // dictionaries fall back to keys/RU defaults; missing Telegram
    // data falls back to a visible browser snapshot.
    const dictsDone = uiDictLoaded && ruDictLoaded && descDictLoaded;
    const tgReadyState =
      globalId === null || Boolean(snap) || !snapshotLoading;
    return dictsDone && tgReadyState;
  }, [
    descDictLoaded,
    ruDictLoaded,
    snap,
    snapshotLoading,
    globalId,
    uiDictLoaded,
  ]);

  const effectiveSplashReady = splashReady || shellTimeoutReady;
  const shellProgress = useMemo(() => {
    const steps = [
      uiDictLoaded,
      ruDictLoaded,
      descDictLoaded,
      globalId === null || Boolean(snap) || !snapshotLoading,
    ];
    const complete = steps.filter(Boolean).length;
    return effectiveSplashReady
      ? 100
      : Math.max(8, Math.round((complete / steps.length) * 92));
  }, [
    descDictLoaded,
    effectiveSplashReady,
    ruDictLoaded,
    snap,
    snapshotLoading,
    globalId,
    uiDictLoaded,
  ]);

  useEffect(() => {
    emitRuntimeProgress({
      channel: "shell",
      value: shellProgress,
      complete: shellProgress >= 100,
    });
  }, [shellProgress]);

  const isAdminRoute = Boolean(adminVisualProofPath)
    || router.pathname === "/admin"
    || router.pathname.startsWith("/admin/");
  const adminGuardCanDecide = adminAccessState !== "checking";
  const adminRouteBlocked = isAdminRoute
    && adminGuardCanDecide
    && !isAdmin
    && !adminVisualProofPath;
  const adminRouteChecking = isAdminRoute
    && !adminGuardCanDecide
    && !adminVisualProofPath;

  useEffect(() => {
    if (
      adminVisualProofPath
      || !isAdminRoute
      || !adminGuardCanDecide
      || isAdmin
    ) {
      return;
    }
    void router.replace("/");
  }, [
    adminGuardCanDecide,
    adminVisualProofPath,
    isAdmin,
    isAdminRoute,
    router,
  ]);

  useEffect(() => {
    if (splashDone || splashReady) {
      setShellTimeoutReady(false);
      return;
    }
    const id = window.setTimeout(() => {
      setShellTimeoutReady(true);
    }, SHELL_BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [splashDone, splashReady]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (effectiveSplashReady) {
      root.dataset.efhcShell = "ready";
      delete root.dataset.efhcLoadingReason;
      return;
    }
    root.dataset.efhcShell = "booting";
    root.dataset.efhcLoadingReason = "shell-startup";
  }, [effectiveSplashReady]);

  const t = useMemo(
    () => (key: string) => tFromDicts(key, uiDict, ruDict),
    [uiDict, ruDict],
  );


  useEffect(() => {
    if (typeof document === "undefined") return;
    const total = visibleSnap.profile.total_generated_kwh || "0";
    const level = getUserLevel(total);
    const skin = getUserSkin(level);
    const key = getSkinKey(level);
    document.documentElement.dataset.skin = key;
    document.documentElement.style.setProperty("--gold", skin.accent_1);
    document.documentElement.style.setProperty(
      "--gold-2",
      skin.accent_2,
    );
    document.documentElement.style.setProperty("--energy", skin.energy);
  }, [visibleSnap.profile.total_generated_kwh]);

  useEffect(() => {
    if (splashDone) return;
    if (!effectiveSplashReady) {
      setShowSplash(true);
      setSplashMounted(true);
      return;
    }
    const fadeId = window.setTimeout(() => {
      setShowSplash(false);
    }, SPLASH_FADE_MS);
    const unmountId = window.setTimeout(() => {
      setSplashMounted(false);
      setSplashDone(true);
    }, SPLASH_UNMOUNT_MS);
    return () => {
      window.clearTimeout(fadeId);
      window.clearTimeout(unmountId);
    };
  }, [effectiveSplashReady, splashDone]);

  if (isBrowserShop) {
    return (
      <ShopLayout
        lang={lang}
        uiDict={uiDict}
        ruDict={ruDict}
        descDict={descDict}
        telegramName={telegramName}
        telegramAvatarUrl={telegramAvatarUrl}
        snapshot={visibleSnap}
        isVip={isVip}
        isAdmin={isAdmin}
        settings={settings}
        setLang={handleSetLang}
        setSettings={setSettings}
      >
        <ErrorBoundary title="EFHC Storefront" t={t}>
          <Component
            {...pageProps}
            snap={visibleSnap}
            settings={settings}
            setSettings={setSettings}
            tgScheme={tgScheme}
            snapshotStatus={visibleSnapshotStatus}
            snapshotMode={snapshotMode}
            snapshotRefreshing={snapshotRefreshing}
            refreshSnapshot={() => {
              void refreshSnapshot();
            }}
          />
        </ErrorBoundary>
      </ShopLayout>
    );
  }

  return (
    <>
      {splashMounted ? (
        <SplashScreen
          visible={showSplash}
          progress={shellProgress}
          label={t("common.loading")}
        />
      ) : null}
      <BackgroundMusicController enabled={settingsHydrated && settings.music_enabled} />
      <PwaRuntimeStatus t={t} enabled={browserSupportsServiceWorker()} />
      {telegramProviderId && effectiveSplashReady ? (
        <SkinBackgroundController
          onChange={setShopSkinBgUrl}
        />
      ) : null}
      <Layout
        lang={lang}
        uiDict={uiDict}
        ruDict={ruDict}
        descDict={descDict}
        telegramProviderId={telegramProviderId}
        telegramName={telegramName}
        telegramAvatarUrl={telegramAvatarUrl}
        snapshot={visibleSnap}
        isVip={isVip}
        isAdmin={isAdmin || Boolean(adminVisualProofPath)}
        settings={settings}
        setLang={handleSetLang}
        setSettings={setSettings}
        shopSkinBgUrl={shopSkinBgUrl}
      >
        <ErrorBoundary title="EFHC Mini App" t={t}>
          {adminRouteBlocked || adminRouteChecking ? (
            <AdminRouteGuardState checking={adminRouteChecking} t={t} />
          ) : adminVisualProofPath ? (
            <AdminVisualProofRouter
              path={adminVisualProofPath}
              pageProps={{
                ...pageProps,
                snap: visibleSnap,
                settings,
                setSettings,
                tgScheme,
                uiDictLoaded,
                ruDictLoaded,
                descDictLoaded,
                snapshotStatus: visibleSnapshotStatus,
                snapshotMode,
                snapshotRefreshing,
                refreshSnapshot: () => {
                  void refreshSnapshot();
                },
              }}
            />
          ) : (
            <Component
              {...pageProps}
                  snap={visibleSnap}
              settings={settings}
              setSettings={setSettings}
              tgScheme={tgScheme}
              uiDictLoaded={uiDictLoaded}
              ruDictLoaded={ruDictLoaded}
              descDictLoaded={descDictLoaded}
              snapshotStatus={visibleSnapshotStatus}
              snapshotMode={snapshotMode}
              snapshotRefreshing={snapshotRefreshing}
              refreshSnapshot={() => {
                void refreshSnapshot();
              }}
            />
          )}
        </ErrorBoundary>
        <OnboardingTour t={t} />
      </Layout>
    </>
  );
}


function AdminRouteGuardState(props: {
  checking: boolean;
  t: (key: string) => string;
}) {
  const title = props.checking
    ? props.t("admin_guard.checking_title")
    : props.t("admin_guard.blocked_title");
  const text = props.checking
    ? props.t("admin_guard.checking_text")
    : props.t("admin_guard.blocked_text");

  return (
    <section
      className="admin-route-guard"
      data-admin-client-route-guard="1329"
      data-admin-route-guard-state={props.checking ? "checking" : "blocked"}
    >
      <div className="admin-route-guard_card">
        <span className="admin-route-guard_eyebrow">EFHC Admin</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </section>
  );
}
