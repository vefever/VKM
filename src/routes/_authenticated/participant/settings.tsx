import { createFileRoute, redirect } from "@tanstack/react-router";

// Settings live on the profile page — keep this redirect for old links/bookmarks.
export const Route = createFileRoute("/_authenticated/participant/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/participant/profile" });
  },
});