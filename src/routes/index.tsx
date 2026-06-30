import { createFileRoute, redirect } from "@tanstack/react-router";

// The platform opens straight to sign-in — the marketing landing is hidden.
// This route is intentionally redirect-only (no heavy component/imports) so the
// browser doesn't preload the whole landing page's JS just to throw it away.
// /auth in turn forwards already-authenticated users to /app.
//
// To restore the marketing landing: set `component` to the LandingPage from
// src/components/marketing/landing.tsx and remove the `beforeLoad` redirect.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
