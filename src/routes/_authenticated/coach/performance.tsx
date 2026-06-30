import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias → the real Coach Performance route, so the guessable URL doesn't 404.
export const Route = createFileRoute("/_authenticated/coach/performance")({
  beforeLoad: () => {
    throw redirect({ to: "/coach/leaderboard" });
  },
});
