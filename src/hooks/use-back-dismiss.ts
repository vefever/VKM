import { useEffect } from "react";

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
 * but ONLY if the entry is still current. That check matters: tapping a link
 * inside the sheet both closes it and navigates, and unwinding blindly there
 * would undo the navigation the user just asked for.
 */
export function useBackDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const id = ++overlayCounter;
    window.history.pushState({ vkmOverlayId: id }, "");

    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Still ours → closed by a button/backdrop, so drop the entry we added.
      // Not ours → either Back already consumed it, or a navigation replaced
      // it; going back in that case would rewind the user's own move.
      if ((window.history.state as { vkmOverlayId?: number } | null)?.vkmOverlayId === id) {
        window.history.back();
      }
    };
  }, [open, onClose]);
}
