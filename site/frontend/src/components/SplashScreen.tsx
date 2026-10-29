import React from "react";

type SplashScreenProps = {
  visible: boolean;
  progress?: number;
  label?: string;
};

export function SplashScreen(props: SplashScreenProps) {
  return (
    <div
      className={[
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black transition-opacity duration-300",
        props.visible ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
      aria-hidden={!props.visible}
    >
      <div className="flex flex-col items-center gap-5 px-6 text-center">
        <img src="/assets/efhc/canon/efhc_logo_canon.svg" alt="EFHC" className="h-48 w-48 efhc-splash-breathe md:h-64 md:w-64" />
        <div className="text-sm tracking-wide efhc-text-muted2">
          EFHC
        </div>
        <div
          className="efhc-splash-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(props.progress || 0)}
        >
          <div className="efhc-splash-progress-head">
            <span>{props.label || "Loading"}</span>
            <strong>{Math.round(props.progress || 0)}%</strong>
          </div>
          <div className="efhc-splash-progress-track">
            <span style={{ width: `${props.progress || 0}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
