import React from "react";

type Props = {
  earnedLabel: string;
  earnedValue: string;
  remainingLabel: string;
  remainingValue: string;
  asset?: string;
  loading?: boolean;
};

export function BonusEarningsStrip(props: Props) {
  const asset = props.asset || "EFHCb";
  return (
    <div
      className="efhc-bonus-earnings-strip"
      data-bonus-earnings-strip="earned-and-remaining"
    >
      <div className="efhc-bonus-earnings-row" data-bonus-metric="earned">
        <span>{props.earnedLabel} · {asset}</span>
        <strong>{props.loading ? "…" : props.earnedValue}</strong>
      </div>
      <div className="efhc-bonus-earnings-row" data-bonus-metric="remaining">
        <span>{props.remainingLabel} · {asset}</span>
        <strong>{props.loading ? "…" : props.remainingValue}</strong>
      </div>
    </div>
  );
}
