import React, { useEffect, useRef, useState } from "react";
import { useInterfaceCustomization } from
  "../../hooks/useInterfaceCustomization";

type PointerStart = {
  x: number;
  y: number;
  at: number;
};

export function GlobalThemeControl() {
  const customization = useInterfaceCustomization();
  const pointerStartRef = useRef<PointerStart | null>(null);
  const suppressClickRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (customization.mode !== "editing") {
      setVisible(false);
      return;
    }
    let hideTimer: number | undefined;
    const reveal = () => {
      window.clearTimeout(hideTimer);
      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), 3_000);
    };
    const activityEvents = [
      "pointerdown", "pointermove", "mousemove", "touchstart", "touchmove",
      "wheel", "scroll", "keydown", "resize",
    ] as const;
    reveal();
    for (const name of activityEvents) {
      window.addEventListener(name, reveal, { passive: true, capture: true });
    }
    return () => {
      window.clearTimeout(hideTimer);
      for (const name of activityEvents) {
        window.removeEventListener(name, reveal, true);
      }
    };
  }, [customization.mode]);

  if (customization.mode !== "editing") return null;
  if (!visible) return null;
  return (
    <button
      type="button"
      className="efhc-global-theme-control"
      data-interface-customization-control="true"
      data-color-theme-control="true"
      aria-label="Переключить цветовую тему"
      onPointerDown={(event) => {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is optional in restricted WebView engines.
        }
        pointerStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          at: Date.now(),
        };
      }}
      onPointerUp={(event) => {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // The pointer may already be released by the host WebView.
        }
        const start = pointerStartRef.current;
        pointerStartRef.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const elapsed = Date.now() - start.at;
        const validSwipe = Math.abs(dx) >= 18
          && Math.abs(dx) > Math.abs(dy) * 1.25
          && elapsed <= 1_200;
        if (!validSwipe) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = true;
        if (dx < 0) customization.nextGlobalTheme();
        else customization.previousGlobalTheme();
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 320);
      }}
      onPointerCancel={() => {
        pointerStartRef.current = null;
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (suppressClickRef.current) return;
        customization.nextGlobalTheme();
      }}
    >
      <span aria-hidden="true">🌐</span>
    </button>
  );
}
