import { useEffect, useRef } from "react";
import type { NextRouter } from "next/router";

const APP_BACK_BASE = "__efhcAppBackBaseV1";
const APP_BACK_GUARD = "__efhcAppBackGuardV1";
const APP_BACK_STACK_KEY = "efhc_app_back_stack_v1";
const APP_BACK_GUARD_HASH = "#efhc-app-back-guard";
const MAX_STACK_DEPTH = 48;

type AppHistoryState = Record<string, unknown> & {
  [APP_BACK_BASE]?: boolean;
  [APP_BACK_GUARD]?: boolean;
};

type AndroidBridgeWindow = Window & {
  __EFHC_ANDROID_BACK__?: () => void;
};

function pathWithoutHash(value: string): string {
  const index = value.indexOf("#");
  const route = index >= 0 ? value.slice(0, index) : value;
  // Next router.push must receive a *logical* route. GitHub Pages adds its
  // /Test-3 prefix independently. Recover stale session stack entries that
  // accidentally captured one or multiple copies of this deployment prefix.
  if (process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW !== "1") return route;
  let canonical = route;
  while (canonical === "/Test-3" || canonical.startsWith("/Test-3/") || canonical.startsWith("/Test-3?")) {
    canonical = canonical.slice("/Test-3".length) || "/";
  }
  return canonical;
}

function readRouteStack(): string[] {
  try {
    const raw = window.sessionStorage.getItem(APP_BACK_STACK_KEY);
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map(pathWithoutHash)
      .slice(-MAX_STACK_DEPTH);
  } catch {
    return [];
  }
}

function writeRouteStack(stack: string[]): void {
  try {
    window.sessionStorage.setItem(
      APP_BACK_STACK_KEY,
      JSON.stringify(stack.slice(-MAX_STACK_DEPTH)),
    );
  } catch {
    // Session history is a best-effort navigation aid only.
  }
}

function rememberRoute(value: string): void {
  const route = pathWithoutHash(value);
  const stack = readRouteStack();
  const existing = stack.lastIndexOf(route);
  if (existing >= 0) {
    writeRouteStack(stack.slice(0, existing + 1));
    return;
  }
  writeRouteStack([...stack, route]);
}

function previousRoute(currentValue: string): string {
  const current = pathWithoutHash(currentValue);
  try {
    const parsed = new URL(current, "https://efhc.local");
    if (parsed.pathname === "/admin/users" && parsed.searchParams.has("section")) {
      parsed.searchParams.delete("section");
      const query = parsed.searchParams.toString();
      return `${parsed.pathname}${query ? `?${query}` : ""}`;
    }
  } catch {
    // Continue with the route stack fallback.
  }
  const stack = readRouteStack();
  const index = stack.lastIndexOf(current);
  if (index > 0) return stack[index - 1];
  if (stack.length > 1) return stack[stack.length - 2];
  if (current.startsWith("/admin/") && current !== "/admin") return "/admin";
  return "/";
}

export function navigateBackWithinApp(router: NextRouter): Promise<boolean> {
  if (typeof window === "undefined") {
    return router.push("/");
  }
  const current = pathWithoutHash(router.asPath || router.pathname);
  if (current === "/") {
    return router.replace("/", undefined, { scroll: false });
  }

  const target = previousRoute(current);
  if (target === current) return Promise.resolve(false);

  // Android/system back must stay inside EFHC navigation. Browser history
  // may contain Telegram, an external browser document or the host shell;
  // router.back() can therefore close/leave the application. The internal
  // route stack is the authority for app-level Back.
  return router.push(target, undefined, { scroll: false });
}

export function useAppBackNavigation(router: NextRouter): void {
  const armingRef = useRef(false);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (typeof window === "undefined") return;
    // GitHub Pages is an isolated read-only preview hosted below /Test-3/.
    // Its browser history must remain browser-owned: the production back-guard
    // otherwise appends the Pages basePath repeatedly through router.push().
    // Only the explicit build-time Pages mode bypasses this guard.
    // Route history is needed by on-screen Back controls in *both* runtimes.
    // Only the Android/Telegram protective hash guard is disabled on Pages;
    // disabling the route stack here previously broke every Pages Back button.
    rememberRoute(routerRef.current.asPath || routerRef.current.pathname);
    const onRouteChange = (url: string): void => rememberRoute(url);
    router.events.on("routeChangeComplete", onRouteChange);
    if (process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW === "1") {
      return () => router.events.off("routeChangeComplete", onRouteChange);
    }
    let disposed = false;

    const armGuard = async (): Promise<void> => {
      if (disposed || armingRef.current) return;
      armingRef.current = true;
      try {
        // Back resolves before React publishes its next public router snapshot.
        const route = window.location.pathname + window.location.search;
        const baseState = (
          window.history.state || {}
        ) as AppHistoryState;
        window.history.replaceState(
          {
            ...baseState,
            [APP_BACK_BASE]: true,
            [APP_BACK_GUARD]: false,
          },
          "",
          route,
        );
        await routerRef.current.push(
          `${route}${APP_BACK_GUARD_HASH}`,
          undefined,
          { shallow: true, scroll: false },
        );
        if (disposed) return;
        const guardState = (
          window.history.state || {}
        ) as AppHistoryState;
        window.history.replaceState(
          {
            ...guardState,
            [APP_BACK_BASE]: false,
            [APP_BACK_GUARD]: true,
          },
          "",
          route,
        );
      } finally {
        armingRef.current = false;
      }
    };

    router.beforePopState(() => {
      // Browser/WebView history can contain the Telegram host, an external
      // document or the native shell before the first EFHC entry. Never let
      // Android/PWA Back delegate that decision to browser history. Resolve
      // Back through the internal EFHC route stack and block the native pop.
      window.setTimeout(() => {
        if (disposed) return;
        void navigateBackWithinApp(routerRef.current).then(() => {
          if (!disposed) void armGuard();
        });
      }, 0);
      return false;
    });

    const onNativeBack = (event: Event): void => {
      event.preventDefault?.();
      void navigateBackWithinApp(routerRef.current);
    };
    document.addEventListener("backbutton", onNativeBack);

    const bridgeWindow = window as AndroidBridgeWindow;
    const bridgeHandler = (): void => {
      void navigateBackWithinApp(routerRef.current);
    };
    bridgeWindow.__EFHC_ANDROID_BACK__ = bridgeHandler;

    void armGuard();

    return () => {
      disposed = true;
      router.beforePopState(() => true);
      router.events.off("routeChangeComplete", onRouteChange);
      document.removeEventListener("backbutton", onNativeBack);
      if (bridgeWindow.__EFHC_ANDROID_BACK__ === bridgeHandler) {
        delete bridgeWindow.__EFHC_ANDROID_BACK__;
      }
    };
    // Next's public router changes after our own shallow guard push. Bind to
    // its stable event bus, and read the current router in Back callbacks.
  }, [router.events]);
}

export const APP_BACK_NAVIGATION_CONTRACT = {
  bridge: "window.__EFHC_ANDROID_BACK__",
  native_event: "backbutton",
  root_fallback: "/",
  storage: "sessionStorage",
} as const;
