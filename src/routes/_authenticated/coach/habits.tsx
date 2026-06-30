import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias → the real Habits & Activity route, so the guessable URL doesn't 404.
export const Route = createFileRoute("/_authenticated/coach/habits")({
  beforeLoad: () => {
    throw redirect({ to: "/coach/health" });
  },
});
