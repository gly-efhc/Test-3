import React from "react";

import { useT } from "../../hooks/useT";
import { Button } from "./Button";

type ErrorClass = 401 | 403 | 413 | 429 | 500;

type Props = {
  status: ErrorClass;
  onRetry?: () => void;
  homeHref?: string;
};

export function SafeErrorState(props: Props) {
  const t = useT();
  const keyPrefix = `safe_error.${props.status}`;
  return (
    <section
      className="efhc-safe-error-state"
      data-safe-error-status={props.status}
    >
      <span aria-hidden="true">!</span>
      <div>
        <strong>{t(`${keyPrefix}_title`)}</strong>
        <p>{t(`${keyPrefix}_detail`)}</p>
      </div>
      {props.onRetry ? (
        <Button variant="secondary" onClick={props.onRetry}>
          {t(`${keyPrefix}_action`)}
        </Button>
      ) : (
        <Button
          variant="secondary"
          href={props.homeHref || "/"}
        >
          {t(`${keyPrefix}_action`)}
        </Button>
      )}
    </section>
  );
}
