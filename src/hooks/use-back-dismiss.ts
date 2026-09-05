import { useCallback, useEffect, useRef } from "react";

let overlayCounter = 0;
// Ids of the overlays currently open, in the order they opened. Only the last
// one reacts to a Back press: a lightbox inside a dialog must close the
// lightbox, not both at once — every hook instance hears the same popstate.
const stack: number[] = [];

/**
 * Make the device Back button (and the iOS edge-swipe) close an overlay instead
 * of leaving the page.
 *
 * On Android especially, Back is how people dismiss a sheet or dialog — pressing
 * it while one was open navigated the page underneath and left the overlay
 * covering the new screen. Native apps consume Back for the topmost overlay.
 *
 * Opening pushes a throwaway history entry that "belongs" to this overlay, so
 * Back pops that instead of the route. Closing any other way unwinds it again —
 * but ONLY if the entry is still current.
 *
 * The unwind must be skipped when the overlay closes *because the user is
 * navigating* (tapping a link inside it). The router pushes the new route
 * asynchronously, so our history.back() can land after it and pop the page the
 * user just asked for, dropping them back where they started — that is what made
 * the Submit sheet's "Weekly proof" bounce to the habits page. Two things
 * prevent it: a link click anywhere while the overlay is open is noticed here
 * automatically, and callers that navigate by other means can call the returned
 * function. Skipping just leaves the throwaway entry in place, which is
 * harmless: it carries the URL of the page they came from, so Back from the
 * destination still returns there.
 */
export function useBackDismiss(open: boolean, onClose: () => void) {
  const skipUnwind = useRef(false);

  // Held in a ref so an inline `onClose={() => setThing(null)}` — a new function
  // on every render — doesn't re-run the effect, which would tear down and push
  // a fresh history entry each time.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    skipUnwind.current = false;
    const id = ++overlayCounter;
    stack.push(id);
    window.history.pushState({ vkmOverlayId: id }, "");

    const drop = () => {
      const i = stack.lastIndexOf(id);
      if (i !== -1) stack.splice(i, 1);
    };

    const onPop = () => {
      if (stack[stack.length - 1] !== id) return; // an overlay above us owns this
      drop();
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);

    // A click on a link is about to become a navigation, whether the overlay
    // closes from the link's own handler or from a router redirect afterwards.
    // Capture phase so it is recorded before React runs the handler that closes.
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.("a[href]")) skipUnwind.current = true;
    };
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
      drop();
      if (skipUnwind.current) return;
      // Still ours → closed by a button/backdrop, so drop the entry we added.
      // Not ours → Back already consumed it, and going back again would rewind
      // the user's own move.
      if ((window.history.state as { vkmOverlayId?: number } | null)?.vkmOverlayId === id) {
        window.history.back();
      }
    };
  }, [open]);

  return useCallback(() => {
    skipUnwind.current = true;
  }, []);
}

/**
 * Back-dismiss for anything built on Radix (dialogs, sheets, alert dialogs) or
 * vaul (drawers): those own their open state internally, so rather than trying
 * to reach their setter we ask the top layer to dismiss the way Escape does.
 *
 * Radix only lets the topmost dismissable layer act on that, which — together
 * with the stack above — keeps one Back press to one layer.
 *
 * Called from the *Content components, which mount only while open.
 */
export function useBackDismissLayer() {
  const close = useCallback(() => {
    if (typeof document === "undefined") return;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }, []);
  useBackDismiss(true, close);
}
