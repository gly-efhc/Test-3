import { useEffect, useRef } from "react";
import type { NextRouter } from "next/router";

const APP_BACK_BASE = "__efhcAppBackBaseV1";
const APP_BACK_GUARD = "__efhcAppBackGuardV1";
const APP_BACK_STACK_KEY = "efhc_app_back_stack_v1";
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

// Browser history is a transport, not the authority for in-app navigation.
// Every route, including direct-entry /Test-3/ routes, keeps a same-URL guard
// entry. Native Android WebView Back, PWA Back and browser Back first consume
// that guard and then use the project-owned route stack. Never push a hash:
// Next.js basePath + hash guard previously produced broken nested /Test-3 paths.
export function useAppBackNavigation(router: NextRouter): void {
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (typeof window === "undefined") return;
    let disposed = false;
    let armingFrame = 0;
    const bridgeWindow = window as AndroidBridgeWindow;

    const armSameUrlGuard = (): void => {
      if (disposed) return;
      const url = window.location.pathname + window.location.search + window.location.hash;
      const currentState = (window.history.state || {}) as AppHistoryState;
      if (currentState[APP_BACK_GUARD]) return;
      // Preserve Next.js's original state (including __N / key), so its own
      // router.push can keep managing the real path and Next hydration.
      window.history.replaceState({
        ...currentState, [APP_BACK_BASE]: true, [APP_BACK_GUARD]: false,
      }, "", url);
      window.history.pushState({
        ...currentState, [APP_BACK_BASE]: false, [APP_BACK_GUARD]: true,
      }, "", url);
    };
    const scheduleGuard = (): void => {
      window.cancelAnimationFrame(armingFrame);
      armingFrame = window.requestAnimationFrame(armSameUrlGuard);
    };
    const onRouteChange = (url: string): void => {
      rememberRoute(url);
      scheduleGuard();
    };
    rememberRoute(routerRef.current.asPath || routerRef.current.pathname);
    router.events.on("routeChangeComplete", onRouteChange);

    // Native Back should close the topmost modal first, then navigate to the
    // previous EFHC route. All financial actions remain in their own handlers.
    const backInsideApp = (): void => {
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (modal) {
        document.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape", bubbles: true, cancelable: true,
        }));
        scheduleGuard();
        return;
      }
      void navigateBackWithinApp(routerRef.current).then(scheduleGuard);
    };

    // The capture-phase listener wins over Next's bubbling popstate handler.
    // On a guard pop, Next must not also navigate using the underlying browser
    // history or leave the app. stopImmediatePropagation is intentional.
    const onPopState = (event: PopStateEvent): void => {
      if (disposed) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      backInsideApp();
    };
    window.addEventListener("popstate", onPopState, true);
    router.beforePopState(() => {
      // Defensive fallback if a host dispatches popstate outside our capture.
      backInsideApp();
      return false;
    });
    const onNativeBack = (event: Event): void => {
      event.preventDefault?.();
      backInsideApp();
    };
    document.addEventListener("backbutton", onNativeBack);
    const bridgeHandler = (): void => backInsideApp();
    bridgeWindow.__EFHC_ANDROID_BACK__ = bridgeHandler;
    scheduleGuard();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(armingFrame);
      router.beforePopState(() => true);
      router.events.off("routeChangeComplete", onRouteChange);
      window.removeEventListener("popstate", onPopState, true);
      document.removeEventListener("backbutton", onNativeBack);
      if (bridgeWindow.__EFHC_ANDROID_BACK__ === bridgeHandler) {
        delete bridgeWindow.__EFHC_ANDROID_BACK__;
      }
    };
  }, [router.events]);
}

export const APP_BACK_NAVIGATION_CONTRACT = {
  bridge: "window.__EFHC_ANDROID_BACK__",
  native_event: "backbutton",
  browser_event: "popstate",
  history_guard: "same-url-state",
  root_fallback: "/",
  storage: "sessionStorage",
  pages_mode: "enabled",
} as const;
