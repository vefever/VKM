import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Without defaults, React Query treats every query as stale from the
  // instant it lands (staleTime: 0) — so even a cached hit refetches on every
  // remount, and refetchOnWindowFocus re-hits the network every time the tab
  // regains focus. That's what made revisiting a page always show a fresh
  // loading spinner instead of the cached content. 30s covers the vast
  // majority of admin/coach/participant screens (individual queries can still
  // opt into a shorter/longer staleTime where the data is more/less volatile).
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true, // #11 — per-route scroll position restore
    defaultPreload: "intent", // #44 — preload next route on hover / touchstart / focus
    // A hover-then-click within 10s reuses the preloaded route match instead
    // of treating it as instantly stale (was 0 — the preload was doing almost
    // nothing since the very next tick considered it expired).
    defaultPreloadStaleTime: 10_000,
  });

  return router;
};
