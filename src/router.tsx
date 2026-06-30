import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true, // #11 — per-route scroll position restore
    defaultPreload: "intent", // #44 — preload next route on hover / touchstart / focus
    defaultPreloadStaleTime: 0,
  });

  return router;
};
