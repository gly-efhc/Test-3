import { publicRuntimeValue } from "../lib/public-runtime";
import React from "react";

export function BrowserLoginDemo(props: {
  t: (key: string) => string;
}) {
  const openTelegram = () => {
    if (typeof window === "undefined") return;
    const envUrl = publicRuntimeValue("NEXT_PUBLIC_TWA_RETURN_URL") || "";
    const target = envUrl.trim() || "https://t.me/efhc_bot/app";
    window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <section
      className="efhc-browser-login"
      aria-label={props.t("browser_login.title")}
      data-browser-shell-mode="preview"
      data-public-login-layout="compact-inline"
    >
      <div className="efhc-browser-login_copy">
        <div className="efhc-browser-login_badge">
          {props.t("browser_login.badge")}
        </div>
        <div className="efhc-browser-login_text">
          <strong>{props.t("browser_login.title")}</strong>
          <span>{props.t("browser_login.subtitle")}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={openTelegram}
        className="efhc-browser-login_primary"
      >
        {props.t("browser_login.telegram_cta")}
      </button>
    </section>
  );
}
