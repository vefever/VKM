// Lightweight client-side error reporting hook.
// Forwards uncaught React errors to a global handler if one is registered
// (e.g. an APM/monitoring snippet). No-ops gracefully when none is present.

type ReportOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type ErrorSink = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: ReportOptions,
  ) => void;
};

declare global {
  interface Window {
    __errorSink?: ErrorSink;
  }
}

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__errorSink?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
