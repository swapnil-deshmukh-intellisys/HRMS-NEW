import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import "./ErrorBoundary.css";

type Props = {
  children: ReactNode;
  /** Optional custom fallback UI. If omitted, uses the default error card. */
  fallback?: ReactNode;
  /** Label shown in the error card to identify where the error occurred */
  context?: string;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * ErrorBoundary catches any runtime errors thrown by descendant components
 * and renders a graceful recovery UI instead of a blank screen.
 *
 * Usage:
 *   <ErrorBoundary context="Dashboard">
 *     <DashboardPage />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary] Uncaught error in ${this.props.context ?? "unknown"} section:`,
      error,
      info.componentStack
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-card" role="alert">
          <div className="error-boundary-icon">⚠️</div>
          <div className="error-boundary-body">
            <h3>Something went wrong</h3>
            {this.props.context && (
              <p className="error-boundary-context">
                in <strong>{this.props.context}</strong>
              </p>
            )}
            <p className="error-boundary-message">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <button
              className="secondary error-boundary-retry"
              onClick={this.handleReset}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
