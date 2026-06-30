import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// The platform opens straight to sign-in. We do this as a CLIENT-side redirect
// (render null, then navigate on mount) rather than:
//   • a beforeLoad redirect — that fires during hydration and throws a React
//     #418 hydration mismatch on static hosts, or
//   • rendering the AuthPage here — that bakes auth-page DOM into the prerendered
//     SPA shell, which then mismatches every AUTHENTICATED route on refresh
//     ("This page didn't load").
// Rendering null keeps the shell neutral so any route hydrates cleanly; the
// effect forwards to /auth (which itself bounces signed-in users to /app).
function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/auth", replace: true });
  }, [navigate]);
  return null;
}

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "VK Mentorship" }] }),
  component: IndexRedirect,
});
