import { Component, ErrorInfo, ReactNode } from "react";
import { reportBoardRenderFailure } from "../core/renderFailures";

type Props = {
  children: ReactNode;
  scope: string;
  resetKey?: unknown;
};

type State = { error: Error | null };

/** Keeps one broken service panel or facade panel from taking down the board. */
export default class RenderErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportBoardRenderFailure({
      scope: this.props.scope,
      message: error.message || error.name || "Unknown render error",
    });
  }

  componentDidUpdate(previous: Props) {
    if (
      this.state.error &&
      previous.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          padding: 12,
          margin: 8,
          border: "1px solid hsl(var(--destructive, 0 72% 51%))",
          borderRadius: 6,
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          minWidth: 220,
        }}
      >
        <strong>{this.props.scope} could not be displayed.</strong>
        <div style={{ marginTop: 6, fontSize: 12 }}>
          {this.state.error.message}
        </div>
        <button
          type="button"
          style={{ marginTop: 8 }}
          onClick={() => this.setState({ error: null })}
        >
          Retry panel
        </button>
      </div>
    );
  }
}
