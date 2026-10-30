import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  clearAuthSession,
  readAuthSession,
  subscribeAuthSessionInvalidation,
  type AuthSessionContext,
} from "../lib/auth-session";
import {
  fetchAuthSessionContext,
  revokeAuthSession,
} from "../lib/auth-session-client";
import { completeTelegramSessionLogin } from "../lib/telegram-auth";
import { getTelegramInitData } from "../lib/telegram";
import { completeTonProofLogin } from "../lib/ton-auth";
import {
  captureReferralStartParamFromFirstEntry,
} from "../lib/referral-start-param";

export type AuthBootstrapStatus =
  | "anonymous"
  | "restoring"
  | "authenticated"
  | "authenticating"
  | "error";

export type ProviderState = Readonly<{
  provider: string | null;
  authenticated: boolean;
}>;

export type AuthState = Readonly<{
  status: AuthBootstrapStatus;
  context: AuthSessionContext | null;
  errorCode: string | null;
}>;

type AuthSessionController = AuthState & {
  restoreSession: () => Promise<AuthSessionContext | null>;
  logout: () => Promise<void>;
  loginTelegram: () => Promise<AuthSessionContext>;
  loginTon: (proofRequest: unknown) => Promise<AuthSessionContext>;
};

const AuthSessionStore =
  createContext<AuthSessionController | null>(null);

function initialAuthState(): AuthState {
  return readAuthSession()
    ? { status: "restoring", context: null, errorCode: null }
    : { status: "anonymous", context: null, errorCode: null };
}

function errorCode(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "AUTH_SESSION_BOOTSTRAP_FAILED";
}

export function AuthSessionProvider(props: {
  children: ReactNode;
}): React.JSX.Element {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const telegramBootstrapStarted = useRef(false);

  useEffect(() => {
    captureReferralStartParamFromFirstEntry();
  }, []);

  const restoreSession = useCallback(async () => {
    if (!readAuthSession()) {
      setState({
        status: "anonymous",
        context: null,
        errorCode: null,
      });
      return null;
    }
    setState((current) => ({
      status: "restoring",
      context: current.context,
      errorCode: null,
    }));
    try {
      const context = await fetchAuthSessionContext();
      setState({
        status: "authenticated",
        context,
        errorCode: null,
      });
      return context;
    } catch (error) {
      if (!readAuthSession()) {
        setState({
          status: "anonymous",
          context: null,
          errorCode: null,
        });
        return null;
      }
      setState({
        status: "error",
        context: null,
        errorCode: errorCode(error),
      });
      return null;
    }
  }, []);

  useEffect(() => {
    if (readAuthSession()) {
      void restoreSession();
    }
  }, [restoreSession]);

  useEffect(() => subscribeAuthSessionInvalidation(() => {
    setState({
      status: "anonymous",
      context: null,
      errorCode: null,
    });
  }), []);

  const loginTelegram = useCallback(async () => {
    const initData = getTelegramInitData();
    if (!initData) {
      throw new Error("TELEGRAM_INIT_DATA_UNAVAILABLE");
    }
    setState((current) => ({
      status: "authenticating",
      context: current.context,
      errorCode: null,
    }));
    try {
      await completeTelegramSessionLogin(initData);
      const context = await fetchAuthSessionContext();
      setState({
        status: "authenticated",
        context,
        errorCode: null,
      });
      return context;
    } catch (error) {
      setState({
        status: readAuthSession() ? "error" : "anonymous",
        context: null,
        errorCode: errorCode(error),
      });
      throw error;
    }
  }, []);

  useEffect(() => {
    if (
      state.status !== "anonymous"
      || readAuthSession()
      || telegramBootstrapStarted.current
    ) {
      return;
    }
    if (!getTelegramInitData()) return;
    telegramBootstrapStarted.current = true;
    void loginTelegram().catch(() => undefined);
  }, [loginTelegram, state.status]);

  const loginTon = useCallback(async (proofRequest: unknown) => {
    setState((current) => ({
      status: "authenticating",
      context: current.context,
      errorCode: null,
    }));
    try {
      await completeTonProofLogin(proofRequest);
      const context = await fetchAuthSessionContext();
      setState({
        status: "authenticated",
        context,
        errorCode: null,
      });
      return context;
    } catch (error) {
      setState({
        status: readAuthSession() ? "error" : "anonymous",
        context: null,
        errorCode: errorCode(error),
      });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await revokeAuthSession();
    } finally {
      clearAuthSession();
      setState({
        status: "anonymous",
        context: null,
        errorCode: null,
      });
    }
  }, []);

  const controller = useMemo<AuthSessionController>(() => ({
    ...state,
    restoreSession,
    logout,
    loginTelegram,
    loginTon,
  }), [
    state,
    restoreSession,
    logout,
    loginTelegram,
    loginTon,
  ]);

  return (
    <AuthSessionStore.Provider value={controller}>
      {props.children}
    </AuthSessionStore.Provider>
  );
}

export function useAuthSessionController(): AuthSessionController {
  const value = useContext(AuthSessionStore);
  if (!value) {
    throw new Error("AUTH_SESSION_PROVIDER_REQUIRED");
  }
  return value;
}
export function useAuthOwnerGlobalId():
  AuthSessionContext["global_id"] | null {
  const authenticated = useAuthSessionController().context?.global_id ?? null;
  // No demo credential is put into AuthSession. This is just the 10-digit
  // account selector for the isolated public-Pages backend simulator.
  const [demoId, setDemoId] = useState<AuthSessionContext["global_id"] | null>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW !== "1" ||
        process.env.NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF !== "1") return;
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void Promise.all([
      import("../reconstruction/demoUnifiedStore"),
      import("../types/identity"),
    ]).then(([store, identity]) => {
      if (!active || !store.isDemoPreviewEnabled()) return;
      const update = () => setDemoId(identity.parseGlobalId(store.readDemoState().selected_global_id));
      unsubscribe = store.subscribeDemoState(update);
      update();
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);
  return authenticated ?? demoId;
}
