import * as React from "react";
import * as ReactDOM from "react-dom";

// The Zoom Meeting SDK (Component View) is built for React 18 and reads React's
// old internal handle `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`
// (and `ReactDOM.findDOMNode`). React 19 removed/renamed both, so the SDK throws
// "Cannot read properties of undefined (reading 'ReactCurrentOwner')" on init.
//
// We recreate the minimal shape the SDK touches so it can initialize. This must
// run BEFORE the SDK module is imported. If the SDK needs more than this, the
// modal's try/catch falls back to "Open in Zoom".
let installed = false;

export function installZoomReactShim(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const R = React as unknown as Record<string, unknown>;
  const SECRET = "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED";
  if (!R[SECRET]) {
    R[SECRET] = {
      ReactCurrentOwner: { current: null },
      ReactCurrentDispatcher: { current: null },
      ReactCurrentBatchConfig: { transition: 0 },
      ReactCurrentActQueue: { current: null },
      IsSomeRendererActing: { current: false },
      ReactDebugCurrentFrame: { getStackAddendum: () => "" },
    };
  }

  const RD = ReactDOM as unknown as Record<string, unknown>;
  if (typeof RD.findDOMNode !== "function") {
    RD.findDOMNode = (inst: unknown) =>
      inst && (inst as { nodeType?: number }).nodeType ? inst : null;
  }
}
