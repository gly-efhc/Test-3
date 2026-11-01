import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  getInterfaceVariantAuthoredSlotCount,
  INTERFACE_VARIANT_SLOT_REGISTRY,
  INTERFACE_VARIANT_REGISTRY,
} from "../../lib/interfaceVariantRegistry";
import type {
  InterfaceCustomizationMode,
  InterfaceVariantGroup,
  InterfaceVariantSettings,
  VariantDotsPlacement,
} from "../../types/interfaceCustomization";

type Surface = {
  id: string;
  group: InterfaceVariantGroup;
  element: HTMLElement;
  placement: VariantDotsPlacement;
};

type PositionedSurface = Surface & {
  left: number;
  top: number;
};

export function InterfaceVariantDotsLayer(props: {
  surfaces: Surface[];
  mode: InterfaceCustomizationMode;
  effective: InterfaceVariantSettings;
  activeGroups: readonly InterfaceVariantGroup[];
}) {
  const [mounted, setMounted] = useState(false);
  const [positions, setPositions] = useState<PositionedSurface[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (props.mode !== "editing") {
      setPositions([]);
      return;
    }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = props.surfaces
          .filter((surface) => props.activeGroups.includes(surface.group))
          .map((surface) => {
            const rect = surface.element.getBoundingClientRect();
            if (
              rect.width <= 0
              || rect.height <= 0
              || rect.bottom < 0
              || rect.top > window.innerHeight
            ) return null;
            return {
              ...surface,
              left: rect.left + rect.width / 2,
              top: surface.placement === "below"
                ? Math.min(window.innerHeight - 5, rect.bottom + 6)
                : Math.max(5, rect.top - 8),
            };
          })
          .filter(Boolean) as PositionedSurface[];
        setPositions(next);
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [
    props.activeGroups,
    props.effective,
    props.mode,
    props.surfaces,
  ]);

  const content = useMemo(() => positions.map((surface) => {
    const compact = surface.group === "HI" || surface.group === "XH";
    const variants = compact
      ? INTERFACE_VARIANT_REGISTRY[surface.group]
      : INTERFACE_VARIANT_SLOT_REGISTRY[surface.group];
    const current = props.effective[surface.group];
    const slotCount = getInterfaceVariantAuthoredSlotCount(surface.group);
    const displayCount = compact
      ? INTERFACE_VARIANT_REGISTRY[surface.group].length : slotCount;
    if (displayCount < 2) return null;
    return (
      <div
        key={surface.id}
        className="efhc-interface-variant-dots"
        aria-hidden="true"
        style={{ left: surface.left, top: surface.top }}
      >
        {Array.from({ length: displayCount }, (_, index) => {
          const variant = variants[index] ?? null;
          return (
            <span
              key={variant || `empty-${index + 1}`}
              data-active={variant && variant === current ? "true" : "false"}
              data-slot-state={variant ? "available" : "empty"}
            />
          );
        })}
      </div>
    );
  }), [positions, props.effective]);

  if (!mounted || props.mode !== "editing") return null;
  return createPortal(content, document.body);
}
