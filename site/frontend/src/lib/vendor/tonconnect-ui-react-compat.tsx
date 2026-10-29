import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FunctionComponent,
  type ReactNode,
} from "react";
import type {
  ConnectAdditionalRequest,
  RequiredFeatures,
  SendTransactionRequest,
  TonConnect,
  Wallet,
  WalletInfo,
} from "@tonconnect/sdk";

type ConnectRequestState =
  | { state: "loading" }
  | { state: "ready"; value: { tonProof?: string } }
  | null;

type UiOptions = {
  language?: string;
  uiPreferences?: Record<string, unknown>;
  actionsConfiguration?: {
    twaReturnUrl?: string;
    returnStrategy?: string;
  };
};

type ProviderProps = {
  children: ReactNode;
  manifestUrl?: string;
  restoreConnection?: boolean;
  walletsRequiredFeatures?: RequiredFeatures;
  walletsPreferredFeatures?: RequiredFeatures;
  actionsConfiguration?: UiOptions["actionsConfiguration"];
  uiPreferences?: UiOptions["uiPreferences"];
  language?: string;
};

type StatusListener = (wallet: Wallet | null) => void;
type StatusErrorListener = (error: unknown) => void;

type TonConnectLike = {
  readonly wallet: Wallet | null;
  readonly connected: boolean;
  restoreConnection: () => Promise<void>;
  getWallets: () => Promise<WalletInfo[]>;
  onStatusChange: (
    listener: StatusListener,
    onError?: StatusErrorListener,
  ) => () => void;
  disconnect: () => Promise<void>;
  sendTransaction: (tx: SendTransactionRequest) => Promise<unknown>;
  connect: (...args: any[]) => any;
};

type ModalState = {
  status: "closed" | "opened";
  open: boolean;
};

type TonConnectContextValue = {
  ui: TonConnectUICompat;
  wallet: Wallet | null;
  restoreSettled: boolean;
  restoreConnected: boolean;
  modalOpen: boolean;
};

function afterBrowserIdle<T>(work: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") return work();
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      work().then(resolve, reject);
    };
    const browserWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
    };
    if (browserWindow.requestIdleCallback) {
      browserWindow.requestIdleCallback(run, { timeout: 900 });
      return;
    }
    globalThis.setTimeout(run, 0);
  });
}

type JsBridgeWallet = WalletInfo & {
  jsBridgeKey: string;
  embedded?: boolean;
  injected?: boolean;
};

type RemoteWallet = WalletInfo & {
  bridgeUrl: string;
  universalLink: string;
};

function isEmbeddedWallet(
  wallet: WalletInfo,
): wallet is JsBridgeWallet {
  const value = wallet as Partial<JsBridgeWallet>;
  return Boolean(value.embedded && value.jsBridgeKey);
}

function isInjectedWallet(
  wallet: WalletInfo,
): wallet is JsBridgeWallet {
  const value = wallet as Partial<JsBridgeWallet>;
  return Boolean(value.injected && value.jsBridgeKey);
}

function isRemoteWallet(
  wallet: WalletInfo,
): wallet is RemoteWallet {
  const value = wallet as Partial<RemoteWallet>;
  return Boolean(value.bridgeUrl && value.universalLink);
}

class LazyTonConnectConnector implements TonConnectLike {
  private readonly manifestUrl: string;
  private readonly requiredFeatures: RequiredFeatures | undefined;
  private connector: TonConnect | null = null;
  private loading: Promise<TonConnect> | null = null;
  private listeners = new Map<
    StatusListener,
    { error?: StatusErrorListener; unsubscribe?: () => void }
  >();

  constructor(props: ProviderProps) {
    this.manifestUrl = String(props.manifestUrl || "").trim();
    this.requiredFeatures = props.walletsRequiredFeatures;
  }

  public get wallet(): Wallet | null {
    return this.connector?.wallet || null;
  }

  public get connected(): boolean {
    return Boolean(this.connector?.connected);
  }

  private async ensure(): Promise<TonConnect> {
    if (this.connector) return this.connector;
    if (!this.loading) {
      this.loading = loadTonConnectSdk().then((sdk) => {
        const connector = new sdk.TonConnect({
          manifestUrl: this.manifestUrl,
          walletsRequiredFeatures: this.requiredFeatures,
          // Cycle0337: SDK v4 telemetry is opt-out. Preserve EFHC
          // pre-upgrade behavior by not accepting new analytics implicitly.
          analytics: { mode: "off" },
        });
        this.connector = connector;
        this.listeners.forEach((entry, listener) => {
          entry.unsubscribe = connector.onStatusChange(
            listener,
            entry.error,
          );
        });
        return connector;
      });
    }
    return await this.loading;
  }

  public async restoreConnection(): Promise<void> {
    const connector = await afterBrowserIdle(() => this.ensure());
    await connector.restoreConnection();
  }

  public async getWallets(): Promise<WalletInfo[]> {
    return await (await this.ensure()).getWallets();
  }

  public onStatusChange(
    listener: StatusListener,
    onError?: StatusErrorListener,
  ): () => void {
    const entry: {
      error?: StatusErrorListener;
      unsubscribe?: () => void;
    } = { error: onError };
    this.listeners.set(listener, entry);
    if (this.connector) {
      entry.unsubscribe = this.connector.onStatusChange(
        listener,
        onError,
      );
    }
    return () => {
      entry.unsubscribe?.();
      this.listeners.delete(listener);
    };
  }

  public async disconnect(): Promise<void> {
    await (await this.ensure()).disconnect();
  }

  public async sendTransaction(
    tx: SendTransactionRequest,
  ): Promise<unknown> {
    return await (await this.ensure()).sendTransaction(tx);
  }

  public connect(...args: any[]): any {
    if (!this.connector) {
      throw new Error("TONCONNECT_CONNECTOR_NOT_READY");
    }
    const connect = this.connector.connect as (...values: any[]) => any;
    return connect(...args);
  }
}

function createServerSafeConnector(): TonConnectLike {
  return {
    wallet: null,
    connected: false,
    restoreConnection: async () => undefined,
    getWallets: async () => [],
    onStatusChange: (_cb, _onError) => () => undefined,
    disconnect: async () => undefined,
    sendTransaction: async () => {
      throw new Error("TONCONNECT_BROWSER_ONLY");
    },
    connect: () => {
      throw new Error("TONCONNECT_BROWSER_ONLY");
    },
  };
}

function e2eConnector(): TonConnectLike | null {
  if (typeof window === "undefined") return null;
  if (
    process.env.NEXT_PUBLIC_EFHC_E2E_TONCONNECT_MOCK !== "1"
  ) {
    return null;
  }
  return (window as any).__efhcTonConnectConnector || null;
}

async function loadTonConnectSdk() {
  return import("@tonconnect/sdk");
}

class TonConnectUICompat {
  public readonly connector: TonConnectLike;
  public readonly connectionRestored: Promise<boolean>;
  private connectRequest: ConnectAdditionalRequest | undefined;
  private options: UiOptions = {};
  private modalOpen = false;
  private modalListeners = new Set<(state: ModalState) => void>();

  constructor(props: ProviderProps) {
    const manifestUrl = String(props.manifestUrl || "").trim();
    if (!manifestUrl) {
      throw new Error("TONCONNECT_MANIFEST_REQUIRED");
    }
    const isBrowser = typeof window !== "undefined";
    const injectedE2e = e2eConnector();
    this.connector = injectedE2e || (
      isBrowser
        ? new LazyTonConnectConnector(props)
        : createServerSafeConnector()
    );
    this.options = {
      language: props.language,
      uiPreferences: props.uiPreferences,
      actionsConfiguration: props.actionsConfiguration,
    };
    const canRestoreInBrowser =
      isBrowser && props.restoreConnection !== false;
    if (!canRestoreInBrowser) {
      this.connectionRestored = Promise.resolve(false);
    } else {
      this.connectionRestored = this.connector
        .restoreConnection()
        .then(() => this.connector.connected)
        .catch(() => false);
    }
  }

  public set uiOptions(options: UiOptions) {
    this.options = { ...this.options, ...options };
  }

  public get uiOptions(): UiOptions {
    return this.options;
  }

  public setConnectRequestParameters(
    params: ConnectRequestState,
  ): void {
    if (!params || params.state !== "ready") {
      this.connectRequest = undefined;
      return;
    }
    const tonProof = String(params.value?.tonProof || "").trim();
    this.connectRequest = tonProof ? { tonProof } : undefined;
  }

  public async getWallets(): Promise<WalletInfo[]> {
    try {
      return await this.connector.getWallets();
    } catch (err) {
      if (
        typeof console !== "undefined"
        && process.env.NODE_ENV !== "production"
      ) {
        console.warn("TONCONNECT_WALLETS_UNAVAILABLE", err);
      }
      return [];
    }
  }

  public onStatusChange(
    cb: (wallet: Wallet | null) => void,
    onError?: (err: unknown) => void,
  ): () => void {
    return this.connector.onStatusChange(
      cb,
      (err) => onError?.(err),
    );
  }

  public onModalStateChange(
    cb: (state: ModalState) => void,
  ): () => void {
    this.modalListeners.add(cb);
    cb({
      status: this.modalOpen ? "opened" : "closed",
      open: this.modalOpen,
    });
    return () => this.modalListeners.delete(cb);
  }

  private setModalOpen(open: boolean): void {
    this.modalOpen = open;
    const state: ModalState = {
      status: open ? "opened" : "closed",
      open,
    };
    this.modalListeners.forEach((listener) => listener(state));
  }

  public async disconnect(): Promise<void> {
    await this.connector.disconnect();
  }

  public async sendTransaction(
    tx: SendTransactionRequest,
  ): Promise<unknown> {
    return await this.connector.sendTransaction(tx);
  }

  public async openModal(): Promise<void> {
    // EFHC owns the visible chooser and fills it from getWallets(). The compat
    // layer must never infer a wallet when no explicit registry entry was
    // selected, otherwise a financial action could route through the wrong
    // application.
    throw new Error("TONCONNECT_WALLET_SELECTION_REQUIRED");
  }

  public async connectWallet(walletKey?: string): Promise<void> {
    const wallets = await this.getWallets();
    const requestedKey = String(walletKey || "").trim();
    const selected = requestedKey
      ? wallets.find((wallet: any) =>
          String(wallet?.appName || wallet?.name || "").trim() === requestedKey
        )
      : null;
    if (requestedKey && !selected) {
      throw new Error("TONCONNECT_SELECTED_WALLET_NOT_FOUND");
    }
    const candidates = selected ? [selected] : wallets;
    const embedded = candidates.find(isEmbeddedWallet);
    if (embedded) {
      this.connector.connect(
        { jsBridgeKey: embedded.jsBridgeKey },
        { request: this.connectRequest },
      );
      return;
    }

    const injected = candidates.find(isInjectedWallet);
    if (injected) {
      this.connector.connect(
        { jsBridgeKey: injected.jsBridgeKey },
        { request: this.connectRequest },
      );
      return;
    }

    const remote = candidates.find(isRemoteWallet);
    if (!remote) {
      throw new Error("TONCONNECT_WALLET_NOT_FOUND");
    }
    const link = this.connector.connect(
      {
        bridgeUrl: remote.bridgeUrl,
        universalLink: remote.universalLink,
      },
      { request: this.connectRequest },
    );
    if (typeof window !== "undefined") {
      window.location.href = link;
    }
  }
}

const Ctx = createContext<TonConnectContextValue | null>(null);

export const TonConnectUIProvider: FunctionComponent<ProviderProps> =
  memo(function TonConnectUIProvider(props) {
    const inst = useMemo(
      () => new TonConnectUICompat(props),
      [props.manifestUrl, props.restoreConnection],
    );
    const [wallet, setWallet] = useState<Wallet | null>(
      () => inst.connector.wallet,
    );
    const [restoreSettled, setRestoreSettled] = useState(false);
    const [restoreConnected, setRestoreConnected] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
      inst.uiOptions = {
        language: props.language,
        uiPreferences: props.uiPreferences,
        actionsConfiguration: props.actionsConfiguration,
      };
    }, [
      inst,
      props.actionsConfiguration,
      props.language,
      props.uiPreferences,
    ]);

    useEffect(() => {
      const unsubscribe = inst.onStatusChange(
        (nextWallet) => setWallet(nextWallet),
        () => setWallet(null),
      );
      return () => unsubscribe();
    }, [inst]);

    useEffect(() => {
      let active = true;
      inst.connectionRestored
        .then((connected) => {
          if (!active) return;
          setRestoreConnected(Boolean(connected));
          setWallet(inst.connector.wallet);
        })
        .finally(() => {
          if (active) setRestoreSettled(true);
        });
      return () => {
        active = false;
      };
    }, [inst]);

    useEffect(
      () => inst.onModalStateChange((state) => {
        setModalOpen(state.open);
      }),
      [inst],
    );

    const value = useMemo<TonConnectContextValue>(
      () => ({
        ui: inst,
        wallet,
        restoreSettled,
        restoreConnected,
        modalOpen,
      }),
      [inst, modalOpen, restoreConnected, restoreSettled, wallet],
    );
    return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
  });

function useTonConnectContext(): TonConnectContextValue {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error("TONCONNECT_PROVIDER_NOT_SET");
  }
  return value;
}

export function useTonConnectUI(): [
  TonConnectUICompat,
  (options: UiOptions) => void,
] {
  const { ui } = useTonConnectContext();
  const setOptions = useCallback(
    (options: UiOptions) => {
      ui.uiOptions = options;
    },
    [ui],
  );
  return [ui, setOptions];
}

export function useTonWallet(): Wallet | null {
  return useTonConnectContext().wallet;
}

export function useTonAddress(): string {
  return String(useTonWallet()?.account?.address || "");
}

export function useIsConnectionRestored(): boolean {
  return useTonConnectContext().restoreSettled;
}

export function useTonConnectionRestoreResult(): {
  settled: boolean;
  connected: boolean;
} {
  const value = useTonConnectContext();
  return {
    settled: value.restoreSettled,
    connected: value.restoreConnected,
  };
}

export function useTonConnectModal(): {
  open: () => Promise<void>;
  close: () => Promise<void>;
  state: { status: "opened" | "closed" };
} {
  const value = useTonConnectContext();
  return {
    open: async () => await value.ui.openModal(),
    close: async () => undefined,
    state: { status: value.modalOpen ? "opened" : "closed" },
  };
}
