import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias → the real Proof Reviews route, so the guessable URL doesn't 404.
export const Route = createFileRoute("/_authenticated/coach/proofs")({
  beforeLoad: () => {
    throw redirect({ to: "/coach/approve" });
  },
});
