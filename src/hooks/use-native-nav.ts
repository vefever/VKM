import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * The two navigation behaviours that separate an app from a website.
 *
 * DIRECTION — a native screen slides in from the right when you go deeper and
 * back out to the right when you return. A transition that always animates the
 * same way reads as a page swap, not a stack.
 *
 * SCROLL RESTORATION — going back in an app returns you to exactly where you
 * were in the list. Browsers do this for real navigations, but a client-side
 * router replaces the document without touching scroll, so every "back" landed
 * at the top of the previous page — the single most website-like tell in the
 * whole shell.
 *
 * Positions are kept in memory (not sessionStorage) deliberately: they are only
 * meaningful for the current history stack, and persisting them would restore a
 * stale offset after a reload.
 */
export function useNativeNav(enabled: boolean) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isBack = useRef(false);
  const lastPath = useRef<string | null>(null);
  const positions = useRef(new Map<string, number>());
  // Mirrors isBack for the render that consumes it, since the popstate flag has
  // to be cleared once used.
  const direction = useRef<1 | -1>(1);

  // popstate fires for browser/gesture back and forward before the router
  // settles on the new location.
  useEffect(() => {
    if (!enabled) return;
    const onPop = () => {
      isBack.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled]);

  // Record where we were on the page we're leaving, then either restore the
  // remembered offset (back) or start at the top (forward), as an app does.
  useEffect(() => {
    if (!enabled) {
      lastPath.current = pathname;
      return;
    }
    const previous = lastPath.current;
    if (previous && previous !== pathname) {
      positions.current.set(previous, window.scrollY);
    }

    const goingBack = isBack.current;
    direction.current = goingBack ? -1 : 1;
    isBack.current = false;

    if (previous !== pathname) {
      const saved = goingBack ? (positions.current.get(pathname) ?? 0) : 0;
      // After the transition has painted, or the restore lands on the outgoing
      // page's height and gets clamped.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: "auto" }));
      });
    }

    lastPath.current = pathname;
  }, [pathname, enabled]);

  return { pathname, direction: direction.current };
}
