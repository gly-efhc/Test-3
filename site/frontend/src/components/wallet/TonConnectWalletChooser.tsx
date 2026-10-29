import React, { useEffect, useMemo, useRef, useState } from "react";

import type { WalletView } from "../../lib/wallet-provider";

type Filter = "all" | "mobile" | "telegram" | "browser";

const TON_CONNECT_PREFERRED_TECHNICAL_IDS = [
  "mytonwallet",
  "tonkeeper",
  "tonhub",
  "bitgetTonWallet",
] as const;

const TON_CONNECT_COMPOSITE_TECHNICAL_IDS = [
  "gramwallet",
  "okxTonWallet",
  "binanceWeb3TonWallet",
  "bybitTonWallet",
] as const;

function normalizeWalletKey(value: unknown): string {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normalized === "mywallet" || normalized === "mytonwallet") return "mytonwallet";
  return normalized;
}

function walletAliases(wallet: WalletView): string[] {
  return [wallet.walletKey, wallet.appName, wallet.name]
    .map(normalizeWalletKey)
    .filter(Boolean);
}

function fallbackLogo(name: string): string {
  const text = String(name || "?").trim().slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" rx="28" fill="#111827"/><text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="48" font-weight="700" fill="#9bc2ff">${text}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function isMobile(wallet: WalletView): boolean {
  return (wallet.platforms || []).some((value) => ["ios", "android"].includes(value.toLowerCase()));
}

function isBrowser(wallet: WalletView): boolean {
  return (wallet.platforms || []).some((value) => ["chrome", "firefox", "safari"].includes(value.toLowerCase()));
}

function isTelegram(wallet: WalletView): boolean {
  return String(wallet.universalUrl || "").includes("t.me/");
}

export function TonConnectWalletChooser(props: {
  open: boolean;
  title: string;
  description: string;
  wallets: WalletView[];
  busy?: boolean;
  emptyLabel: string;
  closeLabel: string;
  onClose: () => void;
  onSelect: (wallet: WalletView) => void;
  tr: (key: string) => string;
}) {
  const [view, setView] = useState<"main" | "all">("main");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const viewAllRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const restoreViewAllFocusRef = useRef(false);

  useEffect(() => {
    if (!props.open) return;
    setView("main");
    setQuery("");
    setFilter("all");
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    if (view === "all") {
      searchRef.current?.focus();
      return;
    }
    if (restoreViewAllFocusRef.current) {
      restoreViewAllFocusRef.current = false;
      viewAllRef.current?.focus();
    }
  }, [props.open, view]);

  const walletByTechnicalId = (app: string) => {
    const target = normalizeWalletKey(app);
    return props.wallets.find((wallet) => walletAliases(wallet).includes(target)) || null;
  };

  const telegramWallet = walletByTechnicalId("telegram-wallet");
  const popular = TON_CONNECT_PREFERRED_TECHNICAL_IDS
    .map(walletByTechnicalId)
    .filter((wallet): wallet is WalletView => Boolean(wallet));
  const composite = TON_CONNECT_COMPOSITE_TECHNICAL_IDS
    .map(walletByTechnicalId)
    .filter((wallet): wallet is WalletView => Boolean(wallet));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.wallets.filter((wallet) => {
      if (walletAliases(wallet).includes(normalizeWalletKey("telegram-wallet"))) return false;
      const hay = `${wallet.name} ${wallet.appName || ""} ${wallet.walletKey}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (filter === "mobile" && !isMobile(wallet)) return false;
      if (filter === "telegram" && !isTelegram(wallet)) return false;
      if (filter === "browser" && !isBrowser(wallet)) return false;
      return true;
    });
  }, [filter, props.wallets, query]);

  if (!props.open) return null;

  const select = (wallet: WalletView) => {
    if (props.busy) return;
    props.onSelect(wallet);
  };

  const returnToMain = () => {
    restoreViewAllFocusRef.current = true;
    setView("main");
    setQuery("");
    setFilter("all");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (props.busy) return;
    if (view === "all") {
      returnToMain();
      return;
    }
    props.onClose();
  };

  return (
    <div
      className="efhc-tonconnect-first-bind-stage"
      data-tonconnect-first-bind="owner-dark-v244-production-v245"
      data-tonconnect-registry-source="@tonconnect/sdk.getWallets"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !props.busy) props.onClose();
      }}
    >
      <section
        className="efhc-tonconnect-first-bind-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={view === "main" ? "efhc-tonconnect-first-bind-title" : "efhc-tonconnect-first-bind-all-title"}
        onKeyDown={handleKeyDown}
      >
        <div className="efhc-tonconnect-first-bind-inner">
          {view === "main" ? (
            <div data-tonconnect-first-bind-view="main">
              <div className="efhc-tonconnect-first-bind-top-actions">
                <button
                  type="button"
                  className="efhc-tonconnect-first-bind-circle"
                  aria-label="QR"
                  title="QR TON Connect"
                  disabled
                  data-tonconnect-qr-preserved="approved-ui-no-separate-runtime-yet"
                >
                  <span className="efhc-tonconnect-first-bind-qr" aria-hidden="true"><i /><i /><i /><i /></span>
                </button>
                <button
                  type="button"
                  className="efhc-tonconnect-first-bind-circle"
                  aria-label={props.closeLabel}
                  disabled={props.busy}
                  onClick={props.onClose}
                >
                  <span className="efhc-tonconnect-first-bind-close" aria-hidden="true">+</span>
                </button>
              </div>

              <h1 id="efhc-tonconnect-first-bind-title">{props.title}</h1>
              <p className="efhc-tonconnect-first-bind-lead">{props.description}</p>

              {telegramWallet ? (
                <button
                  type="button"
                  className="efhc-tonconnect-first-bind-telegram"
                  disabled={props.busy}
                  data-tonconnect-wallet-app={telegramWallet.appName || telegramWallet.walletKey}
                  onClick={() => select(telegramWallet)}
                >
                  <span className="efhc-tonconnect-first-bind-mini">◫</span>
                  <strong>{props.tr("wallet.tonconnect_open_telegram")}</strong>
                  <span className="efhc-tonconnect-first-bind-tg">➤</span>
                </button>
              ) : null}

              <div className="efhc-tonconnect-first-bind-section-label">{props.tr("wallet.tonconnect_choose_app")}</div>
              <div className="efhc-tonconnect-first-bind-popular">
                {popular.map((wallet) => (
                  <button
                    key={wallet.walletKey}
                    type="button"
                    className="efhc-tonconnect-first-bind-tile"
                    disabled={props.busy}
                    data-tonconnect-wallet-app={wallet.appName || wallet.walletKey}
                    onClick={() => select(wallet)}
                  >
                    <img
                      className="efhc-tonconnect-first-bind-logo"
                      src={wallet.imageUrl || fallbackLogo(wallet.name)}
                      alt=""
                      loading="lazy"
                      onError={(event) => { event.currentTarget.src = fallbackLogo(wallet.name); }}
                    />
                    <span>{wallet.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="efhc-tonconnect-first-bind-tile"
                  disabled={props.busy}
                  ref={viewAllRef}
                  data-tonconnect-view-all="true"
                  onClick={() => setView("all")}
                >
                  <span className="efhc-tonconnect-first-bind-all-logo">
                    {composite.slice(0, 4).map((wallet) => (
                      <img key={wallet.walletKey} src={wallet.imageUrl || fallbackLogo(wallet.name)} alt="" />
                    ))}
                  </span>
                  <span>{props.tr("wallet.tonconnect_all_wallets")}</span>
                </button>
              </div>
            </div>
          ) : (
            <div data-tonconnect-first-bind-view="all">
              <div className="efhc-tonconnect-first-bind-all-head">
                <button
                  type="button"
                  className="efhc-tonconnect-first-bind-circle"
                  aria-label={props.tr("wallet.tonconnect_back")}
                  disabled={props.busy}
                  onClick={returnToMain}
                >
                  <span aria-hidden="true" className="efhc-tonconnect-first-bind-back">‹</span>
                </button>
                <h1 id="efhc-tonconnect-first-bind-all-title">{props.tr("wallet.tonconnect_all_wallets")}</h1>
                <span aria-hidden="true" />
              </div>
              <div className="efhc-tonconnect-first-bind-count">
                {filtered.length} / {Math.max(0, props.wallets.length - (telegramWallet ? 1 : 0))} · {props.tr("wallet.tonconnect_count_suffix")}
              </div>
              <input
                ref={searchRef}
                className="efhc-tonconnect-first-bind-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={props.tr("wallet.tonconnect_search")}
                aria-label={props.tr("wallet.tonconnect_search")}
                autoFocus
              />
              <div className="efhc-tonconnect-first-bind-filters">
                {([
                  ["all", props.tr("wallet.tonconnect_filter_all")],
                  ["mobile", props.tr("wallet.tonconnect_filter_mobile")],
                  ["telegram", props.tr("wallet.tonconnect_filter_telegram")],
                  ["browser", props.tr("wallet.tonconnect_filter_browser")],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="efhc-tonconnect-first-bind-filter"
                    data-active={String(filter === value)}
                    aria-pressed={filter === value}
                    disabled={props.busy}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="efhc-tonconnect-first-bind-list" data-tonconnect-wallet-registry="full">
                {filtered.map((wallet) => (
                  <button
                    key={wallet.walletKey}
                    type="button"
                    className="efhc-tonconnect-first-bind-row"
                    disabled={props.busy}
                    data-tonconnect-wallet-app={wallet.appName || wallet.walletKey}
                    onClick={() => select(wallet)}
                  >
                    <img
                      src={wallet.imageUrl || fallbackLogo(wallet.name)}
                      alt=""
                      loading="lazy"
                      onError={(event) => { event.currentTarget.src = fallbackLogo(wallet.name); }}
                    />
                    <span>
                      <strong>{wallet.name}</strong>
                      <small>{(wallet.platforms || []).join(" · ") || "TON Connect"}</small>
                    </span>
                  </button>
                ))}
                {!filtered.length ? <div className="efhc-tonconnect-first-bind-empty">{props.emptyLabel || props.tr("wallet.tonconnect_empty_results")}</div> : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
