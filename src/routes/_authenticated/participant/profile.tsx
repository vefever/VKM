import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettings } from "@/components/participant/profile-settings";

export const Route = createFileRoute("/_authenticated/participant/profile")({
  head: () => ({ meta: [{ title: "Profile & settings · VKM" }] }),
  component: ProfileSettings,
});
