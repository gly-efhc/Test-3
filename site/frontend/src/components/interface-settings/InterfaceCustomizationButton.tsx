import React from "react";
import { useInterfaceCustomization } from
  "../../hooks/useInterfaceCustomization";

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.2 13.1v-2.2l-2-.7a6.8 6.8 0 0 0-.6-1.4l.9-1.9-1.6-1.6-1.9.9a6.8 6.8 0 0 0-1.4-.6l-.7-2H9.7l-.7 2a6.8 6.8 0 0 0-1.4.6l-1.9-.9-1.6 1.6.9 1.9a6.8 6.8 0 0 0-.6 1.4l-2 .7v2.2l2 .7c.1.5.3 1 .6 1.4l-.9 1.9 1.6 1.6 1.9-.9c.4.3.9.5 1.4.6l.7 2h2.2l.7-2c.5-.1 1-.3 1.4-.6l1.9.9 1.6-1.6-.9-1.9c.3-.4.5-.9.6-1.4l2-.7Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5.2 12.4 4.3 4.3L19 7.3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InterfaceCustomizationButton(props: {
  hasBottomNav: boolean;
}) {
  const customization = useInterfaceCustomization();
  const editing = customization.mode === "editing";
  return (
    <button
      type="button"
      className="efhc-interface-customization-button"
      data-interface-customization-control="true"
      data-visible={customization.buttonVisible ? "true" : "false"}
      data-mode={customization.mode}
      data-has-bottom-nav={props.hasBottomNav ? "true" : "false"}
      aria-label={editing ? "Сохранить оформление" : "Настроить оформление"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (editing) customization.save();
        else customization.enter();
      }}
    >
      {editing ? <CheckIcon /> : <GearIcon />}
    </button>
  );
}
