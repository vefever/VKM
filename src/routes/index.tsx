import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/routes/auth";

// The platform opens straight to sign-in — the marketing landing is hidden.
// We render the auth page directly at "/" (rather than redirecting) so the
// prerendered SPA shell matches the client render — a beforeLoad redirect here
// fires during hydration and causes a React #418 hydration mismatch on static
// hosts (cPanel / Cloudflare Pages). AuthPage forwards already-authenticated
// users to /app on mount. To restore the marketing landing, point `component`
// at LandingPage from src/components/marketing/landing.tsx.
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Sign in · VK Mentorship" }] }),
  component: AuthPage,
});
