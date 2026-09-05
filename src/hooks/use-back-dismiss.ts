import { useCallback, useEffect, useRef } from "react";

let overlayCounter = 0;

/**
 * Make the device Back button (and the iOS edge-swipe) close an overlay instead
 * of leaving the page.
 *
 * On Android especially, Back is how people dismiss a sheet — pressing it while
 * the More menu was open navigated away underneath it and left the sheet
 * covering the new screen. Native apps consume Back for the topmost overlay.
 *
 * Opening pushes a throwaway history entry that "belongs" to this overlay, so
 * Back pops that instead of the route. Closing any other way unwinds it again —
 * but ONLY if the entry is still current.
 *
 * Returns a function to call when the overlay is closing *because the user is
 * navigating* (tapping a link inside it). That case must NOT unwind: the router
 * pushes the new route asynchronously, so our history.back() could land after
 * it and pop the page the user just asked for, dropping them back where they
 * started. That is exactly what made the Submit sheet's "Weekly proof" bounce
 * back to the habits page. Skipping the unwind leaves our throwaway entry in
 * place — harmless, since it carries the same URL as the page they came from,
 * so Back from the destination still returns there.
 */
export function useBackDismiss(open: boolean, onClose: () => void) {
  const skipUnwind = useRef(false);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    skipUnwind.current = false;
    const id = ++overlayCounter;
    window.history.pushState({ vkmOverlayId: id }, "");

    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Navigating away — leave history alone (see above).
      if (skipUnwind.current) return;
      // Still ours → closed by a button/backdrop, so drop the entry we added.
      // Not ours → Back already consumed it, and going back again would rewind
      // the user's own move.
      if ((window.history.state as { vkmOverlayId?: number } | null)?.vkmOverlayId === id) {
        window.history.back();
      }
    };
  }, [open, onClose]);

  return useCallback(() => {
    skipUnwind.current = true;
  }, []);
}
