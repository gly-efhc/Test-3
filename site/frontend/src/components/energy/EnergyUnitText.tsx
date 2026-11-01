import React from "react";

// Isolate the physical unit from uppercase KPI captions without changing them.
export function EnergyUnitText({ text }: { text: string }) {
  return <>{text.split(/(kwh)/gi).map((part, index) => /^kwh$/i.test(part)
    ? <span key={index} data-energy-unit="kWh" style={{ display: "inline", textTransform: "none", font: "inherit", letterSpacing: "inherit" }}>kWh</span>
    : part)}</>;
}
