import React from "react";
import { SafeErrorState } from "./ui/SafeErrorState";

type Translator = (key: string) => string;

type Props = React.PropsWithChildren<{
  title?: string;
  t?: Translator;
}>;

type State = { hasError: boolean; error?: unknown };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== "production") {
      try {
        // eslint-disable-next-line no-console
        console.error("EFHC UI error", error);
      } catch {
        // ignore
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const translate = this.props.t || ((key: string) => key);
    const fallbackTitle = translate("common.something_went_wrong");
    const title =
      this.props.title ||
      translate("common.screen_refresh_needed") ||
      fallbackTitle;
    const detail = translate(
      "common.safe_recoverable_screen_detail",
    );
    const reloadLabel = translate("common.reload");
    return (
      <div
        className="min-h-[60vh] flex items-center"
        style={{ justifyContent: "center" }}
      >
        <div className="max-w-md w-full">
          <p className="sr-only">{title}. {detail}. {reloadLabel}</p>
          <SafeErrorState
            status={500}
            onRetry={() => {
              this.setState({
                hasError: false,
                error: undefined,
              });
              try {
                window.location.reload();
              } catch {
                // Browser reload can be unavailable in tests.
              }
            }}
          />
        </div>
      </div>
    );
  }
}
